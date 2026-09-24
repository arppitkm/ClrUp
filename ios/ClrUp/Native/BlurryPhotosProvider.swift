import Foundation
import Photos

/**
 * Flags photos whose focus is soft enough that they're unlikely to be worth
 * keeping — the same variance-of-Laplacian signal SimilarPhotosProvider uses
 * to pick a group's best shot (see ImageSharpness), run standalone across the
 * whole non-screenshot photo library rather than within a duplicate bucket.
 *
 * Unlike similarity, blur has no metadata shortcut — there's no cheap
 * bucketing pass that narrows the field before touching pixels, so this is
 * the one scanner in the app that pays a real decode cost across the library.
 */
final class BlurryPhotosProvider: NSObject {

  private let imageManager = PHCachingImageManager()
  private static let analysisSize = 256
  /// `ImageSharpness.faceAwareScore` returns one of two metrics on two
  /// different numerical scales — a face region's own contrast budget isn't
  /// the same yardstick as a whole frame's — so each needs its own cutoff.
  /// Applying one shared threshold to both was an earlier mistake here that
  /// produced meaningless results for whichever path it wasn't calibrated
  /// against.
  ///
  /// Calibrated against real on-device scores only — an earlier version of
  /// this comment cited 1.53 for a sharp photo, but that number came from an
  /// offline Python approximation of this algorithm, never actually measured
  /// on-device, and it ran well above the real value. Lesson learned: never
  /// set a threshold from anything but a real on-device reading. Real data:
  /// two genuinely blurry screen photos scored 0.44–0.45, three genuinely
  /// sharp non-face photos (a car photo, a flat vector graphic, a photo of a
  /// note) scored 0.54–0.55 — 0.49 sits in the gap.
  private static let wholeFrameBlurThreshold = 0.49
  /// PENDING RECALIBRATION: real portrait data so far is inconclusive — the
  /// one genuinely blurry portrait sampled (0.28) landed *inside* the range
  /// of sharp portraits sampled (0.21–0.34), so no cutoff separates them yet.
  /// Needs more real blurry-portrait examples before this number means
  /// anything; 0.25 is a placeholder, not a calibrated value.
  private static let faceRegionBlurThreshold = 0.25
  /// Sanity cap, mirroring LargeVideosScreen's MAX_VIDEOS: every candidate
  /// costs a real pixel decode here, so this keeps a very large library's
  /// scan bounded. Most-recent photos are analyzed first since they're the
  /// most relevant to ongoing cleanup.
  private static let maxCandidates = 3000

  @objc(scanBlurryPhotosWithCompletion:)
  func scanBlurryPhotos(completion: @escaping ([[String: Any]]?, Error?) -> Void) {
    // Real decode + pixel work for every candidate — never on the bridge queue.
    DispatchQueue.global(qos: .userInitiated).async {
      let result = self.scan()
      DispatchQueue.main.async {
        completion(result, nil)
      }
    }
  }

  private func scan() -> [[String: Any]] {
    var flagged: [(AssetInfo, Double)] = []
    for info in fetchCandidates() {
      guard let cgImage = fetchAnalysisImage(for: info.asset) else { continue }
      let (score, usedFaceRegion) = ImageSharpness.faceAwareScore(cgImage, side: Self.analysisSize)
      let threshold = usedFaceRegion ? Self.faceRegionBlurThreshold : Self.wholeFrameBlurThreshold
      if score < threshold {
        flagged.append((info, score))
      }
    }
    // Blurriest first — the ones most worth a second look lead the list.
    flagged.sort { $0.1 < $1.1 }
    return flagged.map { info, score in
      [
        "id": info.id,
        "createdAt": (info.createdAt?.timeIntervalSince1970 ?? 0) * 1000,
        "widthPx": info.widthPx,
        "heightPx": info.heightPx,
        "bytes": info.bytes,
        "sharpnessScore": score,
      ]
    }
  }

  private func fetchAnalysisImage(for asset: PHAsset) -> CGImage? {
    let options = PHImageRequestOptions()
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .exact
    options.isNetworkAccessAllowed = true
    options.isSynchronous = true // already off-main; keeps this a simple sequential fetch

    var result: CGImage?
    let size = CGSize(width: Self.analysisSize, height: Self.analysisSize)
    imageManager.requestImage(
      for: asset, targetSize: size, contentMode: .aspectFit, options: options
    ) { image, _ in
      result = image?.cgImage
    }
    return result
  }

  /**
   * Fetches non-screenshot images only — screenshots are UI captures, not
   * photographs, so "in focus" isn't a meaningful question for them (the same
   * exclusion SimilarPhotosProvider makes, for the same reason). Private
   * assets are excluded too, before paying the decode cost, not after —
   * a photo locked in the Vault shouldn't surface elsewhere. Most-recent
   * first, capped at `maxCandidates`.
   */
  private func fetchCandidates() -> [AssetInfo] {
    let privateIds = PrivateVaultStore.ids()
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    let result = PHAsset.fetchAssets(with: options)

    var assets: [AssetInfo] = []
    assets.reserveCapacity(min(result.count, Self.maxCandidates))
    result.enumerateObjects { asset, _, stop in
      guard !asset.mediaSubtypes.contains(.photoScreenshot) else { return }
      guard !privateIds.contains(asset.localIdentifier) else { return }
      assets.append(
        AssetInfo(
          asset: asset,
          id: asset.localIdentifier,
          createdAt: asset.creationDate,
          widthPx: asset.pixelWidth,
          heightPx: asset.pixelHeight,
          bytes: PHAssetSizeEstimator.bytes(for: asset)
        )
      )
      if assets.count >= Self.maxCandidates { stop.pointee = true }
    }
    return assets
  }
}

private struct AssetInfo {
  let asset: PHAsset
  let id: String
  let createdAt: Date?
  let widthPx: Int
  let heightPx: Int
  let bytes: Int64
}
