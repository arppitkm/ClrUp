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
  /// Below this, a photo reads as meaningfully out of focus rather than just
  /// soft. `ImageSharpness.score` is a contrast-normalized ratio (see its own
  /// doc comment), not a raw magnitude, so this threshold is a unitless
  /// cutoff rather than a pixel-scale number. Calibrated against 13 real
  /// photos across three content types: 4 genuinely out-of-focus shots scored
  /// 0.37–0.43, 7 sharp shots (screen photos, selfies, a low-contrast car
  /// photo) scored 0.50–1.53 — except one sharp selfie that scored 0.36,
  /// below every blurry sample. That one miss is a known, accepted false
  /// positive: raw pixel-contrast is inherently lower for skin/hair/typical
  /// phone-camera softness than for hard-edged content (UI, text), so a
  /// portrait can read as "less sharp" than a truly blurry photo of a crisp
  /// subject — fixing that fully would need face-region-aware analysis, not
  /// just a threshold. 0.45 was the best single cutoff found against this set.
  private static let blurThreshold = 0.45
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
      let score = ImageSharpness.score(cgImage, side: Self.analysisSize)
      if score < Self.blurThreshold {
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
