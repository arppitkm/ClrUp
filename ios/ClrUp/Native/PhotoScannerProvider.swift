import Foundation
import Photos
import UIKit

enum PhotoScannerError: Error {
  case assetNotFound
  case thumbnailFailed
}

/**
 * Metadata-only library scanning plus on-demand thumbnails. No method here
 * decodes a full-resolution image except the thumbnail path, and that path
 * writes JPEGs to disk and hands JS a `file://` URI — never base64 over the
 * bridge, which would be the first thing to fall over on a real library.
 *
 * `PHFetchResult` is a lazy, database-backed view, so counting and sorting
 * thousands of assets is a metadata query, not a decode — that's what keeps
 * `librarySummary`/`largeVideos` fast without any progress UI.
 */
final class PhotoScannerProvider: NSObject {

  private let imageManager = PHCachingImageManager()
  private lazy var thumbnailDirectory: URL = {
    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("ClrUpThumbnails", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()

  // MARK: Summary

  @objc func librarySummary() -> [String: NSNumber] {
    let screenshots = fetchScreenshots()
    let videos = fetchVideos()

    var screenshotBytes: Int64 = 0
    screenshots.enumerateObjects { asset, _, _ in
      screenshotBytes += Self.estimatedBytes(for: asset)
    }

    var largeVideoBytes: Int64 = 0
    videos.enumerateObjects { asset, _, _ in
      largeVideoBytes += Self.estimatedBytes(for: asset)
    }

    return [
      "screenshotCount": NSNumber(value: screenshots.count),
      "screenshotBytes": NSNumber(value: screenshotBytes),
      "largeVideoCount": NSNumber(value: videos.count),
      "largeVideoBytes": NSNumber(value: largeVideoBytes),
    ]
  }

  // MARK: Screenshots

  @objc func screenshotList() -> [[String: Any]] {
    let result = fetchScreenshots()
    var rows: [[String: Any]] = []
    rows.reserveCapacity(result.count)
    result.enumerateObjects { asset, _, _ in
      rows.append(Self.describe(asset))
    }
    return rows
  }

  // MARK: Videos

  @objc(videoListWithLimit:)
  func videoList(limit: Int) -> [[String: Any]] {
    let result = fetchVideos()
    // Sorted largest-first, on the metadata already gathered — no re-fetching.
    let described = (0..<result.count).map { Self.describe(result.object(at: $0)) }
    let sorted = described.sorted {
      (($0["bytes"] as? Int64) ?? 0) > (($1["bytes"] as? Int64) ?? 0)
    }
    return limit > 0 ? Array(sorted.prefix(limit)) : sorted
  }

  // MARK: Thumbnails

  @objc(requestThumbnailForAsset:targetWidth:completion:)
  func requestThumbnail(assetId: String, targetWidth: CGFloat, completion: @escaping (String?, Error?) -> Void) {
    // PHAsset.localIdentifier looks like "UUID/L0/001" — the embedded "/"
    // would otherwise be read as path separators, sending the write into
    // nonexistent subdirectories and failing silently from JS's perspective.
    let safeId = assetId.replacingOccurrences(of: "/", with: "_")
    let cachePath = thumbnailDirectory.appendingPathComponent("\(safeId)-\(Int(targetWidth)).jpg")
    if FileManager.default.fileExists(atPath: cachePath.path) {
      completion(cachePath.absoluteString, nil)
      return
    }

    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetch.firstObject else {
      completion(nil, PhotoScannerError.assetNotFound)
      return
    }

    let options = PHImageRequestOptions()
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = true
    options.isSynchronous = false

    let targetSize = CGSize(width: targetWidth, height: targetWidth)
    imageManager.requestImage(
      for: asset, targetSize: targetSize, contentMode: .aspectFill, options: options
    ) { image, info in
      // The framework can call back multiple times (a low-res pass, then a
      // high-res one); only the final, non-degraded delivery is written.
      let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
      guard !isDegraded else { return }

      guard let image, let data = image.jpegData(compressionQuality: 0.7) else {
        completion(nil, PhotoScannerError.thumbnailFailed)
        return
      }
      do {
        try data.write(to: cachePath, options: .atomic)
        completion(cachePath.absoluteString, nil)
      } catch {
        completion(nil, error)
      }
    }
  }

  // MARK: Fetch helpers

  private func fetchScreenshots() -> PHFetchResult<PHAsset> {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(
      format: "mediaType = %d AND (mediaSubtype & %d) != 0",
      PHAssetMediaType.image.rawValue,
      PHAssetMediaSubtype.photoScreenshot.rawValue
    )
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    return PHAsset.fetchAssets(with: options)
  }

  private func fetchVideos() -> PHFetchResult<PHAsset> {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.video.rawValue)
    return PHAsset.fetchAssets(with: options)
  }

  // MARK: Description / size estimation

  private static func describe(_ asset: PHAsset) -> [String: Any] {
    [
      "id": asset.localIdentifier,
      "createdAt": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
      "widthPx": asset.pixelWidth,
      "heightPx": asset.pixelHeight,
      "durationSeconds": asset.duration,
      "bytes": estimatedBytes(for: asset),
    ]
  }

  /**
   * `PHAssetResource`'s `fileSize` key isn't part of the public struct
   * surface, but reading it via KVC is a long-established, widely-shipped
   * technique (it's a real stored property the framework simply doesn't
   * expose through a typed accessor) and is far cheaper than the only fully
   * "public" alternative: downloading the whole asset just to measure it.
   * Falls back to a bitrate-based estimate from pixel count/duration if the
   * key is ever unavailable, so this never silently reports zero.
   */
  private static func estimatedBytes(for asset: PHAsset) -> Int64 {
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
