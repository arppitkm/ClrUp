import CoreGraphics
import Vision

/**
 * Variance-of-Laplacian blur detection: a sharp, detailed image has high
 * local contrast (large second-derivative response almost everywhere), a
 * blurry one is smooth (small response almost everywhere). Standard,
 * well-documented technique — this is a direct implementation of it, run on a
 * fixed-size grayscale downsample so resolution doesn't bias the result.
 *
 * Two corrections on top of the textbook version, both verified against real
 * photos rather than assumed:
 *
 * 1. Tiled, not whole-frame: a photo reads as "in focus" if its actual
 *    subject is sharp, even when most of the frame is a flat, low-contrast
 *    background (a dark studio backdrop, sky, a wall) — averaging variance
 *    across the whole image lets that flat majority drag a genuinely sharp
 *    subject's score down into "blurry" territory. Scoring only the sharpest
 *    slice of tiles fixes that.
 * 2. Normalized by the image's own overall contrast: raw Laplacian variance
 *    is content-dependent, not just focus-dependent — a high-contrast subject
 *    (on-screen text/UI) reads "sharper" even when camera-shaken than a
 *    moody, low-contrast subject does when perfectly in focus, so a single
 *    fixed threshold on the raw value can't separate the two. Dividing by the
 *    frame's own pixel-intensity variance corrects for that: verified against
 *    a real deliberately-blurred photo set (raw ~2,300, would-be "sharp"
 *    threshold false-negative) alongside a real low-contrast-but-sharp photo
 *    (raw ~740, would-be false positive) — the normalized score separates
 *    both correctly (~0.4 vs ~1.5) where the raw score alone could not.
 *
 * Shared by SimilarPhotosProvider (best-shot quality ranking within a group)
 * and BlurryPhotosProvider (standalone blur flagging across the library), so
 * the one technique lives in exactly one place.
 */
enum ImageSharpness {
  private static let tilesPerSide = 8

  static func score(_ cgImage: CGImage, side: Int) -> Double {
    guard
      let context = CGContext(
        data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else { return 0 }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let data = context.data else { return 0 }
    let buffer = data.bindMemory(to: UInt8.self, capacity: side * side)

    var pixelSum = 0.0
    var pixelSumSquares = 0.0
    for i in 0..<(side * side) {
      let value = Double(buffer[i])
      pixelSum += value
      pixelSumSquares += value * value
    }
    let pixelMean = pixelSum / Double(side * side)
    let globalContrast = pixelSumSquares / Double(side * side) - pixelMean * pixelMean

    let tileSize = max(1, side / tilesPerSide)
    let tileGrid = tilesPerSide * tilesPerSide
    var tileSums = [Double](repeating: 0, count: tileGrid)
    var tileSumSquares = [Double](repeating: 0, count: tileGrid)
    var tileCounts = [Int](repeating: 0, count: tileGrid)

    for y in 1..<(side - 1) {
      let row = y * side
      let rowUp = (y - 1) * side
      let rowDown = (y + 1) * side
      let tileY = min(y / tileSize, tilesPerSide - 1)
      for x in 1..<(side - 1) {
        let center = Int(buffer[row + x])
        let laplacian =
          Int(buffer[rowUp + x]) + Int(buffer[rowDown + x]) + Int(buffer[row + x - 1]) + Int(buffer[row + x + 1])
          - 4 * center
        let value = Double(laplacian)
        let tileX = min(x / tileSize, tilesPerSide - 1)
        let tileIndex = tileY * tilesPerSide + tileX
        tileSums[tileIndex] += value
        tileSumSquares[tileIndex] += value * value
        tileCounts[tileIndex] += 1
      }
    }

    var tileVariances: [Double] = []
    tileVariances.reserveCapacity(tileGrid)
    for i in 0..<tileGrid where tileCounts[i] > 0 {
      let mean = tileSums[i] / Double(tileCounts[i])
      tileVariances.append(tileSumSquares[i] / Double(tileCounts[i]) - mean * mean)
    }
    guard !tileVariances.isEmpty else { return 0 }

    // The sharpest slice of the frame, not the whole frame: a subject only
    // needs to occupy part of the image to read as "in focus".
    tileVariances.sort(by: >)
    let topCount = max(1, tileVariances.count / 8) // sharpest ~12% of tiles
    let top = tileVariances.prefix(topCount)
    let topTileVariance = top.reduce(0, +) / Double(top.count)

    // +1 avoids a divide-by-near-zero blowup on a nearly-blank frame (a
    // single solid-color photo), where global contrast is ~0 but shouldn't
    // register as "infinitely sharp".
    return topTileVariance / (globalContrast + 1)
  }

  /**
   * Face-aware variant, used only for standalone blur flagging
   * (BlurryPhotosProvider — SimilarPhotosProvider's best-shot ranking
   * compares photos of the same subject to each other, where the whole-frame
   * metric above is fine).
   *
   * Real photos exposed a case the whole-frame metric can't handle: a photo
   * of a screen (high-contrast UI/text) reads as "sharper" even when
   * camera-shaken than a genuinely sharp portrait does, because skin/hair and
   * normal phone-camera processing just don't produce the same raw pixel
   * contrast as text edges — no amount of threshold tuning fixes comparing
   * two different kinds of content on one scale. When a face is present,
   * that's what "is this photo blurry" actually means, so this measures
   * sharpness (and normalizes contrast) *within the face region itself*,
   * against its own contrast budget rather than the rest of the frame's.
   * Falls back to the whole-frame metric when no face is found — screenshots,
   * objects, landscapes.
   *
   * Returns which path produced the score along with the score itself: the
   * two metrics land on different numerical scales (a face region's own
   * contrast budget is a different yardstick than a whole frame's), so a
   * caller comparing against a threshold needs to know which one it's
   * holding rather than assume both mean the same thing at the same number.
   */
  static func faceAwareScore(_ cgImage: CGImage, side: Int) -> (score: Double, usedFaceRegion: Bool) {
    guard let faceRegion = largestFacePixelRect(in: cgImage, side: side) else {
      return (score(cgImage, side: side), false)
    }
    if let regionValue = regionScore(cgImage, side: side, region: faceRegion) {
      return (regionValue, true)
    }
    return (score(cgImage, side: side), false)
  }

  /// The biggest detected face, in this image's pixel coordinates (top-left
  /// origin), padded outward for hair/context — a face-only crop is small
  /// and noisy at this resolution. `nil` when no face is found.
  private static func largestFacePixelRect(in cgImage: CGImage, side: Int) -> CGRect? {
    let request = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    guard (try? handler.perform([request])) != nil, let faces = request.results, !faces.isEmpty else {
      return nil
    }
    // The biggest/closest face is the one that actually represents "is this
    // portrait in focus" — a small background face in a group shot shouldn't
    // decide the whole photo's score.
    let largest = faces.max { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }!
    let box = largest.boundingBox // normalized 0...1, origin bottom-left

    let sideD = Double(side)
    let x = box.origin.x * sideD
    let y = (1 - box.origin.y - box.height) * sideD // flip to this buffer's top-left origin
    let w = box.width * sideD
    let h = box.height * sideD

    let padX = w * 0.4
    let padY = h * 0.4
    let padded = CGRect(x: x - padX, y: y - padY, width: w + padX * 2, height: h + padY * 2)
    return padded.intersection(CGRect(x: 0, y: 0, width: sideD, height: sideD))
  }

  /// Tile grid used *within* a face region — smaller than the whole-frame
  /// grid since the region itself is much smaller, but the same idea: even
  /// inside a face, flat skin (cheeks, forehead) has far less local contrast
  /// than eyes, eyebrows, hairline, or a mouth, so a flat average over the
  /// whole crop dilutes the signal exactly like a flat average over the
  /// whole frame did before tiling fixed that. Verified against real photos:
  /// without this, two genuinely sharp selfies scored *lower* than before
  /// face-region scoring existed at all (0.36→0.12, 0.43→0.18) — the region
  /// crop was being diluted by flat skin with nowhere else in the frame left
  /// to pull the top-12% average back up.
  private static let regionTilesPerSide = 4
  /// Below this, a face region is too small to tile meaningfully — falls
  /// back to the whole-frame metric instead of scoring noise.
  private static let minRegionSide = 16.0

  /// Variance-of-Laplacian over the sharpest slice of tiles *within*
  /// `region`, normalized by that same region's own pixel-intensity
  /// variance. `nil` when the region is missing or too small to tile
  /// meaningfully, so the caller can fall back to the whole-frame metric.
  private static func regionScore(_ cgImage: CGImage, side: Int, region: CGRect) -> Double? {
    guard region.width >= minRegionSide, region.height >= minRegionSide else { return nil }
    guard
      let context = CGContext(
        data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else { return nil }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let data = context.data else { return nil }
    let buffer = data.bindMemory(to: UInt8.self, capacity: side * side)

    let minX = max(1, Int(region.minX))
    let maxX = min(side - 2, Int(region.maxX))
    let minY = max(1, Int(region.minY))
    let maxY = min(side - 2, Int(region.maxY))
    guard minX < maxX, minY < maxY else { return nil }

    // Region's own contrast — the normalizer, same role as `globalContrast`
    // in the whole-frame metric, just scoped to this crop instead of the
    // full image.
    var pixelSum = 0.0
    var pixelSumSquares = 0.0
    var pixelCount = 0
    for y in minY...maxY {
      let row = y * side
      for x in minX...maxX {
        let value = Double(buffer[row + x])
        pixelSum += value
        pixelSumSquares += value * value
        pixelCount += 1
      }
    }
    let pixelMean = pixelSum / Double(pixelCount)
    let regionContrast = pixelSumSquares / Double(pixelCount) - pixelMean * pixelMean

    // Laplacian variance, bucketed into a small tile grid confined to the region.
    let tileSize = max(1, (maxX - minX + 1) / regionTilesPerSide)
    let tileGrid = regionTilesPerSide * regionTilesPerSide
    var tileSums = [Double](repeating: 0, count: tileGrid)
    var tileSumSquares = [Double](repeating: 0, count: tileGrid)
    var tileCounts = [Int](repeating: 0, count: tileGrid)

    for y in minY...maxY {
      let row = y * side
      let rowUp = (y - 1) * side
      let rowDown = (y + 1) * side
      let tileY = min((y - minY) / tileSize, regionTilesPerSide - 1)
      for x in minX...maxX {
        let center = Int(buffer[row + x])
        let laplacian =
          Int(buffer[rowUp + x]) + Int(buffer[rowDown + x]) + Int(buffer[row + x - 1]) + Int(buffer[row + x + 1])
          - 4 * center
        let value = Double(laplacian)
        let tileX = min((x - minX) / tileSize, regionTilesPerSide - 1)
        let tileIndex = tileY * regionTilesPerSide + tileX
        tileSums[tileIndex] += value
        tileSumSquares[tileIndex] += value * value
        tileCounts[tileIndex] += 1
      }
    }

    var tileVariances: [Double] = []
    tileVariances.reserveCapacity(tileGrid)
    for i in 0..<tileGrid where tileCounts[i] > 0 {
      let mean = tileSums[i] / Double(tileCounts[i])
      tileVariances.append(tileSumSquares[i] / Double(tileCounts[i]) - mean * mean)
    }
    guard !tileVariances.isEmpty else { return nil }

    tileVariances.sort(by: >)
    let topCount = max(1, tileVariances.count / 8) // sharpest ~12% of tiles, same fraction as the whole-frame metric
    let top = tileVariances.prefix(topCount)
    let topTileVariance = top.reduce(0, +) / Double(top.count)

    return topTileVariance / (regionContrast + 1)
  }
}
