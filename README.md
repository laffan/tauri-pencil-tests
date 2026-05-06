# tauri-pencil-tests

Bare-bones Tauri 2.0 iOS demo that detects:

- **Touch type** — shows `pencil` or `finger` whenever you touch the screen.
- **Apple Pencil double-tap** — toggles a `mode: ON / mode: OFF` indicator.

The native bits live in a small local Tauri plugin (`tauri-plugin-pencil/`)
written in Swift. The plugin attaches a `UIPencilInteraction` and a passive
`UIGestureRecognizer` to the `WKWebView` and emits events into JS via Tauri's
plugin event channel.

## Layout

```
.
├── index.html, src/main.js          # vanilla JS + Vite frontend
├── src-tauri/                       # the Tauri app shell
│   ├── src/lib.rs                   # registers tauri_plugin_pencil
│   └── tauri.conf.json
└── tauri-plugin-pencil/             # local plugin
    ├── src/lib.rs                   # 14 lines of Rust
    └── ios/Sources/PencilPlugin.swift
```

## Requirements

- macOS with Xcode 15+ (iOS bits cannot be built on Linux/Windows)
- Node 18+ and Rust (stable)
- A physical iPad with an Apple Pencil — pencil events do **not** fire in
  the iOS Simulator
- Tauri's iOS prerequisites: <https://v2.tauri.app/start/prerequisites/#ios>

## First-run setup

```bash
npm install

# Generate iOS app icons (skip if you don't care, but the bundler complains)
npx tauri icon path/to/some-1024.png

# Generate the Xcode project under src-tauri/gen/apple/
npx tauri ios init
```

## Running on a device

```bash
npx tauri ios dev
# or pick a specific device
npx tauri ios dev "Your iPad"
```

The first launch may need you to open `src-tauri/gen/apple/<app>.xcodeproj`
in Xcode once to set the signing team.

## How it works

`tauri-plugin-pencil/ios/Sources/PencilPlugin.swift`:

- `TouchTypeRecognizer` is a `UIGestureRecognizer` subclass that observes
  every touch-down. It immediately enters `.failed` state and has
  `cancelsTouchesInView = false`, so the WKWebView still receives all
  touches normally — we just peek at `UITouch.type`.
- A `UIPencilInteraction` is added to the webview. Its delegate fires
  `pencilInteractionDidTap(_:)` on Apple Pencil 2nd gen / Pencil Pro
  double-tap (whichever action the user has set system-wide).
- Both fire `self.trigger("touch", ...)` / `self.trigger("double-tap", ...)`
  which surfaces in JS as `addPluginListener("pencil", ...)`.

`src/main.js`:

```js
import { addPluginListener } from "@tauri-apps/api/core";

await addPluginListener("pencil", "touch",      (p) => { /* p.type */ });
await addPluginListener("pencil", "double-tap", ()  => { /* toggle */ });
```

## Reusing the plugin in another project

Drop `tauri-plugin-pencil/` in next to your existing `src-tauri/`, then in
`src-tauri/Cargo.toml`:

```toml
tauri-plugin-pencil = { path = "../tauri-plugin-pencil" }
```

In `src-tauri/src/lib.rs`:

```rust
.plugin(tauri_plugin_pencil::init())
```

Add `"pencil:default"` to your capabilities file. That's it — listen for
`touch` / `double-tap` events from your draw code.

## Notes / caveats

- Double-tap requires Apple Pencil 2 or Pencil Pro and an iPad model that
  supports it. The 1st-gen pencil has no double-tap hardware.
- The user's system pencil-action setting (Settings → Apple Pencil) does
  not block the delegate callback; the app always sees the tap.
- `UITouch.type` values: `.pencil` is reported as `"pencil"`, anything else
  (`.direct`, `.indirect`, `.indirectPointer`) is reported as `"finger"`.
- The recognizer fires on touch-**down** only. If you need stream
  events (move/end), extend `TouchTypeRecognizer.touchesMoved` /
  `touchesEnded` and add another `trigger` call.
