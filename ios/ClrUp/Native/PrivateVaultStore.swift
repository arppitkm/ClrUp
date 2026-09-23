import Foundation

/**
 * Shared, static access to which PHAsset ids are marked private. Every
 * scanner (Screenshots, Large Videos, Similar Photos, Blurry Photos) reads
 * this to exclude private assets from its results — a photo you've locked
 * away in the Vault shouldn't still turn up as a suggestion, or even just a
 * visible thumbnail, in some other screen. `PrivateVaultProvider` (the
 * TurboModule-facing object) writes here; this file has no dependency on
 * PhotosUI/LocalAuthentication so every provider can import it cheaply.
 */
enum PrivateVaultStore {
  private static let key = "clrup.privateAssetIds"

  static func ids() -> Set<String> {
    Set((UserDefaults.standard.array(forKey: key) as? [String]) ?? [])
  }

  static func add(_ ids: [String]) -> [String] {
    var current = Self.ids()
    current.formUnion(ids)
    let result = Array(current)
    UserDefaults.standard.set(result, forKey: key)
    return result
  }

  static func remove(_ ids: [String]) -> [String] {
    var current = Self.ids()
    current.subtract(ids)
    let result = Array(current)
    UserDefaults.standard.set(result, forKey: key)
    return result
  }
}
