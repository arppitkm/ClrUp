# ClrUp

A storage cleaner for iPhone: finds similar/duplicate photos, blurry photos,
screenshots, large videos, and duplicate contacts, and lets you review exactly
what will be removed before anything is deleted. Bare React Native (New
Architecture, TurboModules) with Swift native modules — no Expo.

## Features

- **Storage dashboard** — a home screen showing used/free device storage and
  how much space each category could free, plus a running lifetime total of
  space freed with the app.
- **Similar Photos** — buckets the library by burst ID and time/location
  proximity, compares candidates with Vision's feature-print embeddings, ranks
  each group by sharpness/resolution/favorite status, and pre-selects
  everything but the best shot.
- **Blurry Photos** — flags out-of-focus photos on its own, independent of
  duplicate grouping, using a variance-of-Laplacian sharpness score. Faces are
  scored within the detected face region (via Vision) so a sharp portrait
  isn't compared unfairly against a photo of a screen or a flat background.
- **Screenshots** and **Large Videos** — fast metadata-only scans (no pixel
  decoding) with a grid/list, multi-select, and a video preview player.
- **Duplicate Contacts** — fuzzy name/phone/email matching with merge or
  delete, applied directly through Contacts.
- **Review before delete** — every destructive path funnels through one
  screen showing exactly what will be removed and how much space it frees.
  Nothing is deleted without this step and the system's own confirmation.
- **Swipe Cleanup** — a swipe-card alternative to grid selection for going
  through Similar Photos' extras and Blurry Photos candidates quickly.
- **Private Vault** — mark photos private and view them behind Face
  ID/Touch ID/passcode. This only hides them from ClrUp's own screens (there's
  no public API to hide an asset from the system Photos app); the underlying
  photo is untouched and excluded from every other scan.
- **Pull-to-refresh** — re-syncs every scan you have permission for from the
  Dashboard, so new photos/contacts show up without relaunching the app.
- **Permissions handling** — asks for Photos/Contacts access with a stated
  reason, and handles `denied` (deep-links to Settings) and `limited` (offers
  the system's "select more photos" picker) without breaking.

## Tech stack

- **React Native 0.87** (New Architecture / TurboModules), **React 19**,
  **TypeScript** — bare workflow, no Expo.
- **Zustand** for state (one small store per scan category).
- **React Navigation** (native-stack) for routing.
- **react-native-svg**, **react-native-screens**, **react-native-safe-area-context**
  — the only third-party native dependencies; everything else is a native
  Swift module written for this app.
- **Swift + Objective-C++ TurboModules** — each native feature is a Swift
  class with a thin `.mm` shim implementing the codegen-generated protocol.
- Apple frameworks used directly: **Photos**/**PhotosUI** (library access,
  the limited-library picker, deletion), **Vision** (feature-print similarity
  matching, face detection), **Contacts** (duplicate detection/merge),
  **AVKit**/**AVFoundation** (video preview playback), **LocalAuthentication**
  (Face ID/Touch ID/passcode gate for the Private Vault), **CoreGraphics**
  (grayscale downsampling + Laplacian sharpness scoring).
- **CocoaPods** for native dependency management, **Metro** as the JS bundler.
- **ESLint**, **Prettier**, **Jest** for linting, formatting, and unit tests.
- Built with the assistance of **Claude Code** (Anthropic) throughout —
  planning, native module scaffolding, and iterative on-device debugging.

## Prerequisites

- **macOS** with **Xcode 16+** (developed and tested against Xcode 27) and
  the iOS SDK/Simulator it bundles.
- **Node.js ≥ 22.11** (see `engines` in `package.json`).
- **Ruby ≥ 2.6.10** and **CocoaPods ≥ 1.13** (see `ios/Gemfile` — a `bundle
  install` picks the exact versions pinned there).
- A free (or paid) **Apple ID** signed into Xcode, to build for a real device.
  A free personal team is enough — there's no paid-account feature this app
  needs.
- A **physical iPhone or iPad** for full testing. The Simulator works for
  everything except two things (see **Known limitations** below).

## Setup

```bash
# 1. Clone and install JS dependencies
git clone https://github.com/arppitkm/ClrUp.git
cd ClrUp
npm install

# 2. Install native (CocoaPods) dependencies
cd ios
bundle install          # first time only — installs the pinned CocoaPods version
bundle exec pod install
cd ..
```

If `pod install` fails with a Unicode/encoding error, it's a locale issue in
the shell, not the project — run it as:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec pod install
```

## Running it

**Simulator** (fastest way to see it running; two features won't fully work —
see below):

```bash
npm start          # in one terminal — the Metro bundler
npm run ios        # in another — builds and boots the Simulator
```

**Real device** (needed for a true test of storage numbers, Similar Photos,
and Blurry Photos):

1. Open `ios/ClrUp.xcworkspace` in Xcode (not the `.xcodeproj` — the
   workspace includes the CocoaPods pods).
2. Select the `ClrUp` target → **Signing & Capabilities** → set **Team** to
   your own Apple ID. The project ships with automatic signing on, so once
   you pick your team Xcode will fetch a certificate/provisioning profile on
   its own.
3. Plug in your iPhone/iPad, select it as the run destination, and hit Run.
   On the very first install from a new team, iOS will refuse to launch the
   app until you go to **Settings → General → VPN & Device Management** and
   tap **Trust** on the developer profile. On iOS 16+, **Settings → Privacy
   & Security → Developer Mode** also needs to be turned on for the very
   first install of any development-signed app.
4. Grant Photos/Contacts access when the app asks (Screenshots/Large
   Videos/Similar Photos/Blurry Photos need Photos access; Duplicate Contacts
   needs Contacts access).

## Known limitations

- **iOS Simulator, not a real device**: `VNGenerateImageFeaturePrintRequest`
  (used for Similar Photos matching) fails to acquire a Neural Engine compute
  context on the Simulator — this is an environment gap, not a bug, and the
  code handles it by skipping the asset rather than crashing or fabricating a
  match. Similar Photos should be verified on a real device.
- **Simulator storage numbers**: the Simulator reports the host Mac's disk,
  not a phone's. The Dashboard labels this explicitly
  (`storage.isSimulator`) rather than presenting a fake phone-like number.
- **Blurry Photos accuracy on faces**: sharpness scoring is content-dependent
  by nature (see `ImageSharpness.swift`'s doc comments for the full story of
  what was tried). It reliably separates sharp vs. blurry screenshots/objects/
  scenes; on portraits, it's tuned to be reasonably useful but isn't perfect —
  a genuinely ambiguous case (soft lighting, natural camera softness) can
  occasionally be misjudged either direction.
- **No TestFlight distribution**: TestFlight requires enrollment in the paid
  Apple Developer Program ($99/year). This project was built and signed with
  a free personal team, which can install to cabled/trusted devices but can't
  distribute via TestFlight.
- **Private Vault doesn't hide photos from the system Photos app**: there is
  no public PhotoKit API for that. Marking a photo private only removes it
  from ClrUp's own screens; it stays exactly where it is in your library.

## Project structure

```
src/
  design-system/   # tokens, theme, shared UI primitives
  features/        # one folder per screen/category
  hooks/           # useThumbnail, usePermissions, useDeviceStorage
  native/          # TurboModule TS specs (one per native module)
  navigation/      # React Navigation stack + route types
  stores/          # Zustand stores, one per scan category
  types/           # shared domain types
ios/
  ClrUp/Native/    # Swift providers + Objective-C++ TurboModule shims
```

Each native feature follows the same pattern: a TS spec in `src/native/`, a
Swift class in `ios/ClrUp/Native/` with the actual logic, and a thin `.mm`
file registering it as a TurboModule.
