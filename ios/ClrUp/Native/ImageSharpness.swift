import CoreGraphics

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
}
