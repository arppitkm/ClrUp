import Contacts
import Photos
import PhotosUI
import UIKit

/**
 * Photos and Contacts authorization, plus the two recovery paths the brief
 * calls out by name: `.limited` (offer to add more photos, don't pretend it's
 * full access) and `.denied` (send the user to Settings rather than dead-end
 * them). No ObjC-bridge naming here — see the note in DeviceStorageProvider.
 */
final class PermissionsProvider: NSObject {

  // MARK: Photos

  @objc func photosStatus() -> String {
    Self.photosStatusString(PHPhotoLibrary.authorizationStatus(for: .readWrite))
  }

  @objc(requestPhotosAuthorizationWithCompletion:)
  func requestPhotosAuthorization(completion: @escaping (String) -> Void) {
    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
      DispatchQueue.main.async {
        completion(Self.photosStatusString(status))
      }
    }
  }

  /// Presents Apple's picker for adding more photos to a `.limited` grant.
  @objc(presentLimitedLibraryPickerWithCompletion:)
  func presentLimitedLibraryPicker(completion: @escaping () -> Void) {
    DispatchQueue.main.async {
      guard let root = TopViewController.find() else {
        completion()
        return
      }
      // Lives in PhotosUI, not Photos — `presentLimitedLibraryPicker(from:)`
      // (no completion handler) is a different, older overload that doesn't
      // report back when the sheet closes.
      PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: root) { (_: [String]) in
        completion()
      }
    }
  }

  // MARK: Contacts

  @objc func contactsStatus() -> String {
    Self.contactsStatusString(CNContactStore.authorizationStatus(for: .contacts))
  }

  @objc(requestContactsAuthorizationWithCompletion:)
  func requestContactsAuthorization(completion: @escaping (String) -> Void) {
    CNContactStore().requestAccess(for: .contacts) { _, _ in
      // The granted bool alone can't distinguish `.denied` from `.restricted`;
      // re-reading the authoritative status after the callback can.
      let status = CNContactStore.authorizationStatus(for: .contacts)
      DispatchQueue.main.async {
        completion(Self.contactsStatusString(status))
      }
    }
  }

  // MARK: Settings

  @objc(openSettingsWithCompletion:)
  func openSettings(completion: @escaping () -> Void) {
    DispatchQueue.main.async {
      guard let url = URL(string: UIApplication.openSettingsURLString) else {
        completion()
        return
      }
      UIApplication.shared.open(url, options: [:]) { _ in
        completion()
      }
    }
  }

  // MARK: Helpers

  private static func photosStatusString(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "notDetermined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorized: return "authorized"
    case .limited: return "limited"
    @unknown default: return "denied"
    }
  }

  private static func contactsStatusString(_ status: CNAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "notDetermined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorized: return "authorized"
    @unknown default: return "denied"
    }
  }

}
