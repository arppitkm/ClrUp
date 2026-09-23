import Foundation
import LocalAuthentication
import PhotosUI
import UIKit

enum PrivateVaultError: Error {
  case notPresentable
}

/**
 * The private section lives entirely inside ClrUp: marking a photo private
 * only remembers its id in this list and gates viewing it here behind Face
 * ID/Touch ID/passcode. It does *not* hide the asset from the system Photos
 * app — there's no public PhotoKit API for that, and rebuilding storage as an
 * encrypted copy-then-delete vault is a much bigger, riskier feature than
 * "remember which ones are private and lock the view of them."
 */
final class PrivateVaultProvider: NSObject, PHPickerViewControllerDelegate {
  private var pickerCompletion: (([String]) -> Void)?

  // MARK: Storage
  // Delegates to PrivateVaultStore, which every scanner also reads from to
  // exclude private assets — see its own doc comment.

  @objc func privateAssetIds() -> [String] {
    Array(PrivateVaultStore.ids())
  }

  @objc(addPrivateAssetIds:)
  func addPrivateAssetIds(_ ids: [String]) -> [String] {
    PrivateVaultStore.add(ids)
  }

  @objc(removePrivateAssetIds:)
  func removePrivateAssetIds(_ ids: [String]) -> [String] {
    PrivateVaultStore.remove(ids)
  }

  // MARK: Authentication

  /**
   * `.deviceOwnerAuthentication` tries Face ID/Touch ID first and falls back
   * to the device's own passcode entry automatically if biometrics fail or
   * aren't enrolled — this single system policy is what "PIN or Face ID
   * protected" means in practice, with no custom PIN screen to build.
   */
  @objc(authenticateWithReason:completion:)
  func authenticate(reason: String, completion: @escaping (Bool) -> Void) {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
      DispatchQueue.main.async { completion(false) }
      return
    }
    context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
      DispatchQueue.main.async { completion(success) }
    }
  }

  // MARK: Picker

  /// Apple's own multi-select picker. `assetIdentifier` on each result is
  /// populated (matching `PHAsset.localIdentifier`) because this app already
  /// has Photos library access — no separate permission dance needed here.
  @objc(presentAssetPickerWithCompletion:)
  func presentAssetPicker(completion: @escaping ([String]?, Error?) -> Void) {
    DispatchQueue.main.async {
      guard let root = TopViewController.find() else {
        completion(nil, PrivateVaultError.notPresentable)
        return
      }
      var config = PHPickerConfiguration(photoLibrary: .shared())
      config.selectionLimit = 0 // unlimited
      config.filter = .any(of: [.images, .videos])
      let picker = PHPickerViewController(configuration: config)
      picker.delegate = self
      self.pickerCompletion = { ids in completion(ids, nil) }
      root.present(picker, animated: true)
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    let ids = results.compactMap { $0.assetIdentifier }
    pickerCompletion?(ids)
    pickerCompletion = nil
  }
}
