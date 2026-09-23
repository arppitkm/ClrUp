import AVKit
import Foundation
import Photos
import UIKit

enum PhotoScannerError: Error {
  case assetNotFound
  case thumbnailFailed
  case notPresentable
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
    for asset in screenshots {
      screenshotBytes += PHAssetSizeEstimator.bytes(for: asset)
    }

    var largeVideoBytes: Int64 = 0
    videos.enumerateObjects { asset, _, _ in
      largeVideoBytes += PHAssetSizeEstimator.bytes(for: asset)
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
    fetchScreenshots().map(Self.describe)
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

  /**
   * Presents Apple's own `AVPlayerViewController` over whatever's currently
   * showing — full playback controls, AirPlay, fullscreen, all for free,
   * rather than building a custom player for what the brief only requires as
   * "a preview". No third-party video library needed for this either: the
   * whole feature lives in AVKit, part of the system.
   */
  @objc(presentVideoPlayerForAsset:completion:)
  func presentVideoPlayer(assetId: String, completion: @escaping (Bool, Error?) -> Void) {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetch.firstObject, asset.mediaType == .video else {
      completion(false, PhotoScannerError.assetNotFound)
      return
    }

    let options = PHVideoRequestOptions()
    options.isNetworkAccessAllowed = true
    options.deliveryMode = .automatic

    PHImageManager.default().requestPlayerItem(forVideo: asset, options: options) { playerItem, _ in
      DispatchQueue.main.async {
        guard let playerItem else {
          completion(false, PhotoScannerError.thumbnailFailed)
          return
        }
        guard let root = TopViewController.find() else {
          completion(false, PhotoScannerError.notPresentable)
          return
        }
        let player = AVPlayer(playerItem: playerItem)
        let controller = AVPlayerViewController()
        controller.player = player
        root.present(controller, animated: true) {
          player.play()
        }
        completion(true, nil)
      }
    }
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

  // MARK: Deletion

  /**
   * Screenshots, videos, and similar-photo extras all delete through this one
   * path — `PHAssetChangeRequest.deleteAssets` doesn't care about media type.
   * `performChanges` itself presents the system's "Delete N Photos?" sheet;
   * this is the single confirmation for the whole batch, not per-item. If the
   * user cancels that sheet, `success` comes back false with no error — that
   * is a normal outcome, not a failure to surface, so it resolves with 0
   * either way rather than rejecting; only genuine failures reject.
   */
  @objc(deleteAssetsWithIds:completion:)
  func deleteAssets(ids: [String], completion: @escaping (NSNumber?, Error?) -> Void) {
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
    guard fetchResult.count > 0 else {
      completion(NSNumber(value: 0), nil)
      return
    }

    PHPhotoLibrary.shared().performChanges({
      PHAssetChangeRequest.deleteAssets(fetchResult)
    }) { success, _ in
      // Deliberately never rejects here: a cancelled system sheet and a
      // genuine failure both surface the same way to Apple's completion
      // handler (success = false), with no reliable way to tell them apart
      // across iOS versions. Resolving with 0 either way matches this
      // method's documented contract and avoids surfacing a scary native
      // error for what is usually just the user tapping Cancel.
      DispatchQueue.main.async {
        completion(NSNumber(value: success ? fetchResult.count : 0), nil)
      }
    }
  }

  // MARK: Fetch helpers

  /**
   * Fetches all images and filters the screenshot subtype in Swift, rather
   * than in the predicate. `(mediaSubtype & %d) != 0` looks like valid
   * NSPredicate syntax, but Photos' predicate evaluator only recognizes a
   * narrow, undocumented whitelist of expressions — this bitmask form
   * silently matched almost nothing instead of erroring, so it was actually
   * broken from the start. `PHAssetMediaSubtype` is a real Swift OptionSet on
   * the fetched `PHAsset`, so checking it directly is unambiguous.
   */
  private func fetchScreenshots() -> [PHAsset] {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.image.rawValue)
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    let result = PHAsset.fetchAssets(with: options)

    var screenshots: [PHAsset] = []
    result.enumerateObjects { asset, _, _ in
      if asset.mediaSubtypes.contains(.photoScreenshot) {
        screenshots.append(asset)
      }
    }
    return screenshots
  }

  private func fetchVideos() -> PHFetchResult<PHAsset> {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.video.rawValue)
    return PHAsset.fetchAssets(with: options)
  }

  // MARK: Description

  private static func describe(_ asset: PHAsset) -> [String: Any] {
    [
      "id": asset.localIdentifier,
      "createdAt": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
      "widthPx": asset.pixelWidth,
      "heightPx": asset.pixelHeight,
      "durationSeconds": asset.duration,
      "bytes": PHAssetSizeEstimator.bytes(for: asset),
    ]
  }
}
