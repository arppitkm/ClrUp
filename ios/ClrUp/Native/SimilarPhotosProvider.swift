import CoreLocation
import CoreGraphics
import Foundation
import Photos
import Vision

/**
 * Finds duplicate and near-duplicate photos and picks a keeper for each
 * group. A three-stage funnel, cheapest first — see the design note below
 * each stage for why it's ordered this way.
 *
 * Screenshots are excluded entirely: many near-identical screenshots of the
 * same UI would otherwise false-cluster, and they already have their own
 * dedicated screen.
 */
final class SimilarPhotosProvider: NSObject {

  private let imageManager = PHCachingImageManager()
  /// Longest side used for both Vision comparison and sharpness analysis.
  /// Large enough for Vision's model, small enough to keep a bucket of a
  /// dozen photos fast to compare pairwise.
  private static let analysisSize = 256

  @objc(scanSimilarPhotosWithCompletion:)
  func scanSimilarPhotos(completion: @escaping ([[String: Any]]?, Error?) -> Void) {
    // Vision + pixel decoding is real work — never do it on the calling
    // (bridge) queue.
    DispatchQueue.global(qos: .userInitiated).async {
      let groups = self.scan()
      DispatchQueue.main.async {
        completion(groups, nil)
      }
    }
  }

  // MARK: Pipeline

  private func scan() -> [[String: Any]] {
    let assets = fetchCandidateAssets()
    let buckets = bucket(assets)

    var groups: [[String: Any]] = []
    for bucket in buckets where bucket.count >= 2 {
      groups.append(contentsOf: groupsWithinBucket(bucket))
    }
    return groups
  }

  // MARK: Stage 1 — metadata bucketing (no pixels read)

  /**
   * Collapses the library into small candidate buckets before touching a
   * single pixel. This is what makes the whole scan tractable: comparing
   * every photo to every other photo is O(n²) — 200 million comparisons on a
   * 20k-photo library. Bucketing by burst ID, then by a chained time/location
   * window, turns that into O(n · k) for a small k, since real duplicates are
   * near-identical in *when and where* they were taken, not just what they
   * show.
   */
  private func bucket(_ assets: [AssetInfo]) -> [[AssetInfo]] {
    var byBurst: [String: [AssetInfo]] = [:]
    var unburst: [AssetInfo] = []
    for asset in assets {
      if let burst = asset.burstIdentifier {
        byBurst[burst, default: []].append(asset)
      } else {
        unburst.append(asset)
      }
    }

    var buckets = Array(byBurst.values)

    // Chain the rest by creation time: consecutive assets within 10s of each
    // other join the same bucket (and location within ~50m, when both have
    // it — most synthetic/test libraries won't carry GPS metadata, so this
    // arm rarely fires outside a real library, but it's cheap to check).
    let sorted = unburst.sorted { ($0.createdAt ?? .distantPast) < ($1.createdAt ?? .distantPast) }
    var current: [AssetInfo] = []
    for asset in sorted {
      if let last = current.last {
        let closeInTime = Self.within(seconds: 10, asset.createdAt, last.createdAt)
        let closeInSpace = Self.withinLocation(metres: 50, asset.location, last.location)
        if closeInTime && closeInSpace {
          current.append(asset)
          continue
        }
        if current.count >= 2 { buckets.append(current) }
        current = [asset]
      } else {
        current = [asset]
      }
    }
    if current.count >= 2 { buckets.append(current) }

    return buckets
  }

  private static func within(seconds: TimeInterval, _ a: Date?, _ b: Date?) -> Bool {
    guard let a, let b else { return false }
    return abs(a.timeIntervalSince(b)) <= seconds
  }

  private static func withinLocation(metres: CLLocationDistance, _ a: CLLocation?, _ b: CLLocation?) -> Bool {
    // Neither asset has location data — don't let a missing signal block an
    // otherwise-good time-based match.
    guard let a, let b else { return true }
    return a.distance(from: b) <= metres
  }

  // MARK: Stage 2 — Vision feature prints, within each bucket only

  /**
   * Runs only inside a bucket (typically 2–8 photos), so the O(k²) pairwise
   * comparison here is cheap even though it would be prohibitive across the
   * whole library. `VNGenerateImageFeaturePrintRequest` is a learned
   * embedding — robust to crop/exposure/recompression in a way a hand-rolled
   * perceptual hash isn't — and runs on the Neural Engine.
   */
  private func groupsWithinBucket(_ bucket: [AssetInfo]) -> [[String: Any]] {
    var analyses: [AssetAnalysis] = []
    analyses.reserveCapacity(bucket.count)
    for info in bucket {
      guard let analysis = analyze(info) else { continue }
      analyses.append(analysis)
    }
    guard analyses.count >= 2 else { return [] }

    var unionFind = UnionFind(count: analyses.count)
    for i in 0..<analyses.count {
      for j in (i + 1)..<analyses.count {
        if Self.confidence(between: analyses[i], analyses[j]) != nil {
          unionFind.union(i, j)
        }
      }
    }

    var membersByRoot: [Int: [Int]] = [:]
    for i in 0..<analyses.count {
      membersByRoot[unionFind.find(i), default: []].append(i)
    }

    var groups: [[String: Any]] = []
    for (_, members) in membersByRoot where members.count >= 2 {
      let groupAnalyses = members.map { analyses[$0] }
      // Recomputed directly over the final group (cheap: groups are tiny)
      // rather than tracked during the union pass above, since path
      // compression can move a pair's recorded root out from under it.
      var strongest = Confidence.medium
      for i in 0..<groupAnalyses.count {
        for j in (i + 1)..<groupAnalyses.count {
          if let c = Self.confidence(between: groupAnalyses[i], groupAnalyses[j]), c.strongerThan(strongest) {
            strongest = c
          }
        }
      }
      groups.append(describeGroup(groupAnalyses, confidence: strongest))
    }
    return groups
  }

  /// `nil` means "not similar enough to group at all" (distance ≥ 0.6).
  private static func confidence(between a: AssetAnalysis, _ b: AssetAnalysis) -> Confidence? {
    let sameByteFootprint =
      a.info.bytes == b.info.bytes && a.info.widthPx == b.info.widthPx && a.info.heightPx == b.info.heightPx
    if sameByteFootprint {
      return .exact
    }
    var distance: Float = 0
    guard (try? a.featurePrint.computeDistance(&distance, to: b.featurePrint)) != nil else { return nil }
    if distance < 0.3 { return .high }
    if distance < 0.6 { return .medium }
    return nil
  }

  // MARK: Stage 3 — quality ranking (pick the keeper)

  private func describeGroup(_ analyses: [AssetAnalysis], confidence: Confidence) -> [String: Any] {
    let best = analyses.max { $0.qualityScore < $1.qualityScore }
    let reclaimable = analyses.filter { $0.info.id != best?.info.id }.reduce(Int64(0)) { $0 + $1.info.bytes }

    let assetRows: [[String: Any]] = analyses.map { analysis in
      [
        "id": analysis.info.id,
        "createdAt": (analysis.info.createdAt?.timeIntervalSince1970 ?? 0) * 1000,
        "widthPx": analysis.info.widthPx,
        "heightPx": analysis.info.heightPx,
        "bytes": analysis.info.bytes,
        "isBest": analysis.info.id == best?.info.id,
      ]
    }

    return [
      "id": UUID().uuidString,
      "confidence": confidence.rawValue,
      "assets": assetRows,
      "reclaimableBytes": reclaimable,
    ]
  }

  // MARK: Per-asset analysis (fetch + Vision + sharpness, once per photo)

  private func analyze(_ info: AssetInfo) -> AssetAnalysis? {
    guard let cgImage = fetchAnalysisImage(for: info.asset) else { return nil }
    // Vision's feature-print model can fail to acquire a compute context in
    // some environments (observed on Simulator; not expected on a real
    // device, where every compute backend has a complete implementation).
    // Skipping the asset on failure is deliberate: silently retrying with a
    // forced CPU-only pass was tried and produces non-discriminating,
    // effectively-zero distances for every pair — that's worse than skipping,
    // since it would fabricate false duplicate groups instead of reporting
    // nothing.
    guard let observation = try? Self.featurePrint(for: cgImage) else { return nil }
    let sharpness = Self.sharpnessScore(cgImage)
    let score = Self.qualityScore(info: info, sharpness: sharpness)
    return AssetAnalysis(info: info, featurePrint: observation, qualityScore: score)
  }

  private func fetchAnalysisImage(for asset: PHAsset) -> CGImage? {
    let options = PHImageRequestOptions()
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .exact
    options.isNetworkAccessAllowed = true
    options.isSynchronous = true // already off-main; keeps this function a simple sequential fetch

    var result: CGImage?
    let size = CGSize(width: Self.analysisSize, height: Self.analysisSize)
    imageManager.requestImage(
      for: asset, targetSize: size, contentMode: .aspectFit, options: options
    ) { image, _ in
      result = image?.cgImage
    }
    return result
  }

  private static func featurePrint(for cgImage: CGImage) throws -> VNFeaturePrintObservation {
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first as? VNFeaturePrintObservation else {
      throw SimilarPhotosError.featurePrintFailed
    }
    return observation
  }

  /**
   * Variance-of-Laplacian blur detection: a sharp, detailed image has high
   * local contrast (large second-derivative response almost everywhere), a
   * blurry one is smooth (small response almost everywhere). Standard,
   * well-documented technique — this is a direct implementation of it, run
   * on a fixed-size grayscale downsample so resolution doesn't bias the
   * result (that's handled as its own, separate factor in `qualityScore`).
   */
  private static func sharpnessScore(_ cgImage: CGImage) -> Double {
    let size = analysisSize
    guard
      let context = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
      )
    else { return 0 }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: size, height: size))
    guard let data = context.data else { return 0 }
    let buffer = data.bindMemory(to: UInt8.self, capacity: size * size)

    var sum = 0.0
    var sumSquares = 0.0
    var count = 0
    for y in 1..<(size - 1) {
      let row = y * size
      let rowUp = (y - 1) * size
      let rowDown = (y + 1) * size
      for x in 1..<(size - 1) {
        let center = Int(buffer[row + x])
        let laplacian =
          Int(buffer[rowUp + x]) + Int(buffer[rowDown + x]) + Int(buffer[row + x - 1]) + Int(buffer[row + x + 1])
          - 4 * center
        let value = Double(laplacian)
        sum += value
        sumSquares += value * value
        count += 1
      }
    }
    guard count > 0 else { return 0 }
    let mean = sum / Double(count)
    return sumSquares / Double(count) - mean * mean // variance
  }

  /**
   * Sharpness dominates (it's what people actually mean by "the good one" in
   * a burst), resolution is a tiebreaker, and explicit user signals
   * (favorited, edited) override both — a photo the user already curated is
   * a statement of intent no pixel analysis should out-vote.
   *
   * Not yet included: face-quality scoring (open eyes, face count). Sharpness
   * + resolution + favorite/edited is a real, defensible "best shot" signal
   * on its own; face detection is a documented follow-up, not silently
   * dropped.
   */
  private static func qualityScore(info: AssetInfo, sharpness: Double) -> Double {
    var score = sharpness
    let megapixels = Double(info.widthPx * info.heightPx) / 1_000_000
    score += megapixels * 40 // tiebreaker: sharpness values from real photos typically dwarf this
    if info.isFavorite { score += 100_000 } // explicit user intent overrides everything else
    if info.hasAdjustments { score += 500 }
    return score
  }

  // MARK: Fetch

  /**
   * Fetches all images and excludes screenshots in Swift, not in the
   * predicate — see the comment on `PhotoScannerProvider.fetchScreenshots()`
   * for why: Photos' predicate evaluator doesn't reliably support the
   * `(mediaSubtype & x)` bitmask form, so it silently matched almost nothing
   * instead of erroring.
   */
  private func fetchCandidateAssets() -> [AssetInfo] {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
    let result = PHAsset.fetchAssets(with: options)

    var assets: [AssetInfo] = []
    assets.reserveCapacity(result.count)
    result.enumerateObjects { asset, _, _ in
      guard !asset.mediaSubtypes.contains(.photoScreenshot) else { return }
      assets.append(
        AssetInfo(
          asset: asset,
          id: asset.localIdentifier,
          createdAt: asset.creationDate,
          location: asset.location,
          burstIdentifier: asset.burstIdentifier,
          widthPx: asset.pixelWidth,
          heightPx: asset.pixelHeight,
          bytes: PHAssetSizeEstimator.bytes(for: asset),
          isFavorite: asset.isFavorite,
          hasAdjustments: asset.hasAdjustments
        )
      )
    }
    return assets
  }
}

// MARK: - Supporting types

private struct AssetInfo {
  let asset: PHAsset
  let id: String
  let createdAt: Date?
  let location: CLLocation?
  let burstIdentifier: String?
  let widthPx: Int
  let heightPx: Int
  let bytes: Int64
  let isFavorite: Bool
  let hasAdjustments: Bool
}

private struct AssetAnalysis {
  let info: AssetInfo
  let featurePrint: VNFeaturePrintObservation
  let qualityScore: Double
}

private enum Confidence: String {
  case exact
  case high
  case medium

  private var rank: Int {
    switch self {
    case .exact: return 2
    case .high: return 1
    case .medium: return 0
    }
  }

  func strongerThan(_ other: Confidence) -> Bool { rank > other.rank }
}

private enum SimilarPhotosError: Error {
  case featurePrintFailed
}

/// Minimal union-find (disjoint set) with path compression, used to merge
/// overlapping pairwise matches into single groups — without it, a 5-shot
/// burst can fragment into confusing partial groups instead of one group of 5.
private struct UnionFind {
  private var parent: [Int]

  init(count: Int) {
    parent = Array(0..<count)
  }

  mutating func find(_ x: Int) -> Int {
    if parent[x] != x {
      parent[x] = find(parent[x])
    }
    return parent[x]
  }

  mutating func union(_ a: Int, _ b: Int) {
    let rootA = find(a)
    let rootB = find(b)
    if rootA != rootB {
      parent[rootB] = rootA
    }
  }
}
