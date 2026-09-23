import UIKit

/// Anywhere a native module needs to present real UI on top of the app (a
/// system picker, a video player) needs a view controller to present from.
/// Shared by PermissionsProvider and PhotoScannerProvider rather than
/// duplicated in each.
enum TopViewController {
  static func find() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }

    guard var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
      return nil
    }
    while let presented = top.presentedViewController {
      top = presented
    }
    return top
  }
}
