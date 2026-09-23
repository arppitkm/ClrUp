import Foundation

/**
 * Persists a single running total across launches: how many bytes ClrUp has
 * freed for this user, ever. One Int64 doesn't need a database —
 * UserDefaults is the right-sized tool.
 */
final class AppStatsProvider: NSObject {
  private static let key = "clrup.lifetimeFreedBytes"

  @objc func lifetimeFreedBytes() -> NSNumber {
    NSNumber(value: UserDefaults.standard.object(forKey: Self.key) as? Int64 ?? 0)
  }

  @objc(addFreedBytes:)
  func addFreedBytes(_ bytes: NSNumber) -> NSNumber {
    let next = (UserDefaults.standard.object(forKey: Self.key) as? Int64 ?? 0) + bytes.int64Value
    UserDefaults.standard.set(next, forKey: Self.key)
    return NSNumber(value: next)
  }
}
