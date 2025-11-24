# Battery Monitor (Electron)

Native macOS battery monitor tray app migrated from BatteryToolkit.

## Features

- Tray app showing battery percentage with low-battery alerts
- Settings for threshold, repeat interval, launch at login, notify on AC
- Power event integration using Electron `powerMonitor`
- Logging to `userData/battery-monitor.log` with global error handlers
- Security hardening: sandbox, blocked `window.open`, navigation denied, strict preload isolation

## Notes

This app focuses on tray-based battery monitoring and notifications using Electron-only APIs. Native daemon integration has been removed.

Notifications are controlled via the tray menu and keyboard shortcut, not in the settings panel. The only notification-related configuration in Settings is the loop interval (seconds) used for repeating alerts when the threshold is met.

Notification Loop Behavior:
- Interval = 0: A single notification is shown when the threshold is met; no repeat is scheduled.
- Interval > 0: Notifications repeat at the configured interval until disabled or the condition no longer holds.

Dynamic Interval Updates:
- Changing the loop interval in Settings immediately reconfigures the notification loop without restart.
- The existing loop is safely cleaned up and a new schedule starts with the updated interval.

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
