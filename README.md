# Battery Monitor (Electron)

Native macOS battery monitor tray app migrated from BatteryToolkit.

## Features

- Tray app showing battery percentage with low-battery alerts
- Settings for threshold, repeat interval, launch at login, notify on AC
- Power event integration using Electron `powerMonitor`
- Logging to `userData/battery-monitor.log` with global error handlers
- Security hardening: sandbox, blocked `window.open`, navigation denied, strict preload isolation

## Migrated Native Sources

The original Swift sources from `BatteryToolkit` are mirrored under `native/BatteryToolkit` for reference. Assets from `Assets.xcassets` are packaged via `assets` where applicable.

To enable full daemon-powered controls, build a small CLI bridge `btctl` that talks to the BatteryToolkit daemon via XPC and place it at `native/bin/btctl` before packaging.

### Build btctl (Xcode)

1. Create an Xcode project or SwiftPM executable that links the BatteryToolkit client sources and defines commands:
   - `start`, `upgrade`, `approve <timeoutSec>`, `remove`
   - `state`, `get-settings`, `set-settings <json>`
   - `disable-power`, `enable-power`, `charge-limit`, `charge-full`, `disable-charging`, `pause`, `resume`
2. Compile for arm64 and output binary to `native/bin/btctl`.
3. Ensure proper code signing and entitlements for SMAppService if registering login items and privileged executables.

Electron will automatically attempt daemon bootstrap at startup and wire menu commands to `btctl`.

### Build btctl (SwiftPM CLI)

Run:

```
npm run build:btctl
```

This compiles the Swift CLI and copies the binary to `native/bin/btctl`.

## Develop

```bash
npm install
npm start
```

## Build (Apple silicon)

```bash
npm run build
```

## Test Notification

```bash
npm run test:notify -- 50
```

This triggers a notification if your battery is on battery power and <= 50%.
