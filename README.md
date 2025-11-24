# Battery Monitor

Native macOS battery monitor tray app with low-battery alerts, settings, and keyboard shortcut.

## Supported Platforms

- macOS on Apple silicon (arm64, M1/M2+)
- Intel Macs are not supported

## Features

- macOS tray app showing battery percentage with low-battery alerts
- Toggle notifications from tray or keyboard (`Ctrl+Alt+N`)
- Loop interval: `0` = single alert, `>0` = repeating alerts
- Tray title/tooltip indicate status and next-alert countdown
- Settings: threshold (%), loop interval (s), launch at login, notify on AC
- Battery status via Electron `powerMonitor` with `pmset` fallback on macOS
- Robust error logging with global handlers
- Security policies: sandboxed, blocked `window.open`, denied navigation, isolated preload

## Notes

This app focuses on tray-based battery monitoring and notifications using Electron-only APIs. Native daemon integration has been removed.

Notifications are controlled via the tray menu and keyboard shortcut, not via a master toggle in the settings panel. The only notification-related configuration in Settings is the loop interval (seconds) used for repeating alerts when the threshold is met.

Notification Loop Behavior:
- Interval = 0: A single notification is shown when the threshold is met; no repeat is scheduled.
- Interval > 0: Notifications repeat at the configured interval until disabled or the condition no longer holds.

Dynamic Interval Updates:
- Changing the loop interval in Settings immediately reconfigures the notification loop without restart.
- The existing loop is safely cleaned up and a new schedule starts with the updated interval.

Keyboard Shortcut:
- Press `Ctrl+Alt+N` to toggle notifications on/off. The tray title shows `🔔` when enabled and `🔕` when disabled.

Settings Overview:
- Notification threshold (%) — slider at top of Settings
- Loop interval (seconds) — integer 0–3600
- Launch at startup — macOS login item
- Notify when charging — deliver alerts even when on AC power

Assets:
- App icon: place `assets/icon.icns` and set in `package.json` `build.mac.icon`.
- Tray icon: `assets/trayTemplate.png` (monochrome template image, tinted by macOS).
  - Generate `.icns` from a base PNG using `sips` and `iconutil`:
    - `mkdir -p assets/AppIcon.iconset`
    - Resize with `sips` to standard sizes, then: `iconutil -c icns assets/AppIcon.iconset -o assets/icon.icns`

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

## Unit Tests

```bash
npm run test:unit
```

Runs basic tests for interval clamping and single vs loop behavior.
