import Foundation

enum DeviceStorageError: Error {
  case unavailable
}

/**
 * Real device capacity, via the same non-deprecated resource keys Apple
 * recommends over the old `NSFileManager` attributes call (which is known to
 * misreport on APFS). Deliberately has no ObjC-bridge naming of its own —
 * `RCTDeviceStorage.mm` is the TurboModule; this is just the Swift logic it
 * delegates to, kept separate so it stays trivially testable.
 */
final class DeviceStorageProvider: NSObject {
  @objc func snapshotAndReturnError(_ error: NSErrorPointer) -> [String: NSNumber]? {
    let url = URL(fileURLWithPath: NSHomeDirectory())

    do {
      let values = try url.resourceValues(forKeys: [
        .volumeAvailableCapacityForImportantUsageKey,
        .volumeTotalCapacityKey,
      ])

      guard
        let free = values.volumeAvailableCapacityForImportantUsage,
        let total = values.volumeTotalCapacity
      else {
        error?.pointee = DeviceStorageError.unavailable as NSError
        return nil
      }

      let totalBytes = Int64(total)
      let freeBytes = free
      let usedBytes = max(0, totalBytes - freeBytes)

      return [
        "totalBytes": NSNumber(value: totalBytes),
        "freeBytes": NSNumber(value: freeBytes),
        "usedBytes": NSNumber(value: usedBytes),
        "isSimulator": NSNumber(value: Self.isSimulator),
      ]
    } catch let resourceError {
      error?.pointee = resourceError as NSError
      return nil
    }
  }

  private static var isSimulator: Bool {
    #if targetEnvironment(simulator)
      return true
    #else
      return false
    #endif
  }
}
