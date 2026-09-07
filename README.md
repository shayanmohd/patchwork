# Patchwork

An hour for an hour. A time bank ledger for a group that already meets: a street, a building, a library
circle, a family. No prices, no money, and no network.

- **Play listing:** https://play.google.com/store/apps/details?id=com.mohdshayan.patchwork
- **Site:** https://shayanmohd.github.io/patchwork/
- **Try it in a browser:** https://shayanmohd.github.io/patchwork/play/
- **Privacy policy:** https://shayanmohd.github.io/patchwork/privacy-policy.html

## How it is built

`web/` is the whole app: plain HTML, CSS and JavaScript, no build step and no dependencies. Balances are
derived from the ledger on every read rather than stored, so the book is the only source of truth, and an
exchange becomes a ledger line only when both sides confirm it.

`android/` is a thin Kotlin WebView shell that serves `web/` from an app-private https origin and declares
no INTERNET permission.

`docs/` is the GitHub Pages site: landing page, privacy policy and a playable copy.

`test/` holds the scripts that drive the app in a headless browser. Serve `web/` on a port and run them
with `_shiptools/drive.js`: they cover the happy path, the edges, export and merge, the upgrade from the
shipped 1.0.0 record in `test/fixture-1.0.0.json`, animations off, and a contrast audit of every text
node in both themes. The `review-*.js` set is the second, independent pass: the shell contract
(`back`, `onPause`, `onResume`), the safe-area insets, a merged book that arrives already past the
floor, and a book far larger than the quilt can hold. `review-05a-write100.js` regenerates
`test/review-fixture-1.0.0.json` by driving a checkout of the shipped 1.0.0 build itself.

## Build

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
```

Signing reads `android/keystore.properties`, which is not in this repository.
