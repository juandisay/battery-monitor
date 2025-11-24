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
