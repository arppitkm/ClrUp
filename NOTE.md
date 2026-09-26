Built with bare React Native (New Architecture/TurboModules) plus Swift native modules — no Expo, no third-party photo libraries. Claude Code was used throughout for planning, native module scaffolding, and on-device debugging. Vision handles photo similarity and face detection; Photos/PhotosUI/Contacts/AVKit/LocalAuthentication cover the rest natively.

What works: the full scan-review-clean loop for Similar Photos, Blurry Photos, Screenshots, Large Videos, and Duplicate Contacts, all funneling through one Review screen before any deletion. Bonus features built: Swipe Cleanup, a Face ID/Touch ID-gated Private Vault, pull-to-refresh, and a lifetime space-freed counter.

What's missing: video compression, a home screen widget, and TestFlight (needs a paid developer account).

Hardest problem: reliable blur detection. Raw sharpness scoring is content-dependent — a blurry screen photo can score "sharper" than a sharp portrait — so it needed tiling, per-region contrast normalization, and face-aware scoring, calibrated against real photos across several rounds of on-device testing.
