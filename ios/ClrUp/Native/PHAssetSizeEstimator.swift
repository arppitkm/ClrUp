import Photos

/**
 * Shared by both photo scanners (large-file listing and similarity grouping)
 * so the estimate logic — and its one documented trade-off — lives in exactly
 * one place.
 */
enum PHAssetSizeEstimator {
  /**
   * `PHAssetResource`'s `fileSize` key isn't part of the public struct
   * surface, but reading it via KVC is a long-established, widely-shipped
   * technique (it's a real stored property the framework simply doesn't
   * expose through a typed accessor) and is far cheaper than the only fully
   * "public" alternative: downloading the whole asset just to measure it.
   * Falls back to a bitrate/pixel-based estimate if the key is ever
   * unavailable, so this never silently reports zero.
   */
  static func bytes(for asset: PHAsset) -> Int64 {
    let resources = PHAssetResource.assetResources(for: asset)
    for resource in resources {
      if let size = resource.value(forKey: "fileSize") as? Int64, size > 0 {
        return size
      }
    }

    let pixels = Int64(asset.pixelWidth) * Int64(asset.pixelHeight)
    if asset.mediaType == .video {
      let bitsPerSecond: Int64 = 8_000_000 // conservative 1080p-ish estimate
      return Int64(asset.duration) * (bitsPerSecond / 8)
    }
    return pixels / 2 // rough JPEG-ish estimate: ~0.5 bytes/pixel
  }
}
