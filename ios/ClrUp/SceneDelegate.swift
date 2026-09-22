import UIKit
import React

/**
 * Owns the window for one scene and starts React Native inside it. Window
 * creation moved here (from `AppDelegate`) because newer iOS SDKs require
 * apps to adopt the UIScene lifecycle rather than the old single-window one.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    factory.startReactNative(
      withModuleName: "ClrUp",
      in: window,
      launchOptions: nil
    )
  }
}
