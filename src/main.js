import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, powerMonitor, dialog } from 'electron'
import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import { createLogger } from './logger.js'
import { applySecurityPolicies } from './security.js'
import * as daemon from './daemon-bridge.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Base64 for a 1x1 transparent PNG (used as template tray icon)
const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0OBaUAAAAASUVORK5CYII='

/**
 * Create the application settings store with defaults.
 */
function createSettingsStore() {
  const store = new Store({
    name: 'settings',
    defaults: {
      thresholdPercent: 70, // default threshold
      notificationsEnabled: true,
      launchAtStartup: false,
      repeatNotifications: true,
      repeatIntervalSec: 5,
      notifyOnAC: true
    }
  })
  return store
}

/**
 * Apply login item settings based on stored preference.
 */
function applyLoginItemSettings(launchAtStartup) {
  try {
    app.setLoginItemSettings({ openAtLogin: launchAtStartup })
  } catch (err) {
    console.error('Failed to set login item settings:', err)
  }
}

let tray = null
let settingsWindow = null
let pollInterval = null
let lastNotified = false
let store = null
let notifyRepeatTimer = null
const log = createLogger()

/**
 * Create the settings window used for configuration only.
 */
function createSettingsWindow() {
  if (settingsWindow) {
    try {
      if (!settingsWindow.isDestroyed()) {
        settingsWindow.show()
        settingsWindow.focus()
        return
      }
    } catch {}
    settingsWindow = null
  }

  try {
    app.dock.show()
  } catch {}

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 420,
    title: 'Battery Monitor Settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
    try { app.dock.hide() } catch {}
  })

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'))
}

/**
 * Build and set the tray menu.
 */
function setTrayMenu() {
  const currentSettings = getSettings()
  const menu = Menu.buildFromTemplate([
    {
      label: 'Battery Monitor',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Commands',
      submenu: [
        { label: 'Disable Power Adapter', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.disablePowerAdapter) },
        { label: 'Enable Power Adapter', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.enablePowerAdapter) },
        { type: 'separator' },
        { label: 'Charge to Limit', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.chargeToLimit) },
        { label: 'Charge to Full', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.chargeToFull) },
        { label: 'Disable Charging', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.disableCharging) },
        { type: 'separator' },
        { label: 'Pause Background Activity', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.pauseActivity) },
        { label: 'Resume Background Activity', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.resumeActivity) },
        { label: 'Approve Background Activity…', enabled: daemon.isAvailable(), click: () => handleCommand(() => daemon.approveDaemon(20)) },
        { label: 'Launch Background Service…', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.registerDaemon) },
        { type: 'separator' },
        { label: 'Remove Background Service…', enabled: daemon.isAvailable(), click: () => handleCommand(daemon.removeDaemon) }
      ]
    },
    {
      label: 'Settings…',
      click: () => createSettingsWindow()
    },
    {
      label: 'Diagnostics',
      submenu: [
        { label: 'Battery State', click: () => showState() }
      ]
    },
    {
      label: 'Enable Notifications',
      type: 'checkbox',
      checked: !!currentSettings.notificationsEnabled,
      click: (item) => {
        store.set('notificationsEnabled', item.checked)
      }
    },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: !!currentSettings.launchAtStartup,
      click: (item) => {
        store.set('launchAtStartup', item.checked)
        applyLoginItemSettings(item.checked)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(menu)
}

/**
 * Create the tray icon and initialize its state.
 */
function createTray() {
  let img
  try {
    const trayPath = resolveAsset('assets/trayTemplate.png')
    img = nativeImage.createFromPath(trayPath)
    if (!img || img.isEmpty()) throw new Error('empty tray icon')
    img.setTemplateImage(true)
  } catch {
    img = nativeImage.createFromDataURL(`data:image/png;base64,${TRANSPARENT_PNG_BASE64}`)
    img.setTemplateImage(true)
  }
  tray = new Tray(img)
  tray.setToolTip('Battery Monitor')
  setTrayMenu()
}

/**
 * Read all settings from the store safely.
 */
function getSettings() {
  try {
    return {
      thresholdPercent: store.get('thresholdPercent'),
      notificationsEnabled: store.get('notificationsEnabled'),
      launchAtStartup: store.get('launchAtStartup'),
      repeatNotifications: store.get('repeatNotifications'),
      repeatIntervalSec: store.get('repeatIntervalSec'),
      notifyOnAC: store.get('notifyOnAC')
    }
  } catch (err) {
    log.error('Failed to read settings', err)
    return { thresholdPercent: 70, notificationsEnabled: true, launchAtStartup: false, repeatNotifications: true, repeatIntervalSec: 5, notifyOnAC: true }
  }
}

/**
 * Show a native macOS notification.
 */
function showChargeNotification() {
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: 'Battery Monitor', body: 'Please charge your device' })
    n.show()
  } catch (err) {
    log.error('Failed to show notification', err)
  }

  // Fallback for macOS to ensure Notification Center receives the alert
  try {
    if (process.platform === 'darwin') {
      const script = 'display notification "Please charge your device" with title "Battery Monitor"'
      exec(`osascript -e '${script}'`, (error) => {
        if (error) {
          log.error('osascript notification failed', error)
        }
      })
    }
  } catch (err) {
    log.error('Fallback notification failed', err)
  }
}

/**
 * Update tray title with the current battery percentage.
 */
function updateTrayTitle(percent, chargeFlag = false) {
  try {
    if (!tray) return
    const base = Number.isFinite(percent) ? `${Math.round(percent)}%` : '--%'
    const text = chargeFlag ? `${base} Please charge` : base
    tray.setTitle(text)
    tray.setToolTip(`Battery: ${text}`)
  } catch (err) {
    log.error('Failed to update tray title', err)
  }
}

/**
 * Determine whether we should notify given current battery state and settings.
 */
function shouldNotify(percent, isOnBattery, notificationsEnabled, thresholdPercent, notifyOnAC) {
  if (!notificationsEnabled) return false
  if (!isOnBattery && !notifyOnAC) return false
  if (!Number.isFinite(percent)) return false
  return percent <= thresholdPercent
}

/**
 * Poll battery level and handle threshold notifications with debouncing.
 */
async function pollBatteryOnce() {
  try {
    const { percent, onBattery: isOnBattery } = await getBatteryStatus()

    const { notificationsEnabled, thresholdPercent, repeatNotifications, notifyOnAC } = getSettings()
    const trayCond = Number.isFinite(percent) && percent <= thresholdPercent && (isOnBattery || notifyOnAC)
    updateTrayTitle(percent, trayCond)
    const notifyCond = shouldNotify(percent, isOnBattery, notificationsEnabled, thresholdPercent, notifyOnAC)
    if (notifyCond) {
      if (!lastNotified) {
        showChargeNotification()
        lastNotified = true
      }
      if (repeatNotifications) {
        startRepeatNotify()
      }
    } else {
      // Reset notification flag when charging or above threshold
      if (Number.isFinite(percent) && percent > (thresholdPercent + 2)) {
        lastNotified = false
      }
      if (!isOnBattery) {
        lastNotified = false
      }
      stopRepeatNotify()
    }
  } catch (err) {
    log.error('Battery polling failed', err)
  }
}

/**
 * Start adaptive battery polling.
 */
function startPolling() {
  stopPolling()
  pollBatteryOnce()
  pollInterval = setInterval(() => {
    pollBatteryOnce()
  }, 60_000)
}

/**
 * Stop battery polling if running.
 */
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Wire up power events to improve efficiency and correctness.
 */
function attachPowerEvents() {
  try {
    powerMonitor.on('on-battery', () => {
      lastNotified = false
      startPolling()
    })
    powerMonitor.on('on-ac', () => {
      lastNotified = false
      startPolling()
    })
    powerMonitor.on('resume', () => startPolling())
    powerMonitor.on('suspend', () => stopPolling())
  } catch (err) {
    log.error('Failed attaching power events', err)
  }
}

/**
 * Register IPC handlers for settings.
 */
function registerIpc() {
  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:save', async (_event, payload) => {
    const { thresholdPercent, notificationsEnabled, launchAtStartup, repeatNotifications, repeatIntervalSec, notifyOnAC } = payload || {}
    try {
      // Clamp and persist threshold if provided
      if (thresholdPercent !== undefined && thresholdPercent !== null) {
        const n = Number(thresholdPercent)
        if (Number.isFinite(n)) {
          const clamped = Math.min(100, Math.max(1, Math.round(n)))
          store.set('thresholdPercent', clamped)
        }
      }
      if (typeof notificationsEnabled === 'boolean') {
        store.set('notificationsEnabled', notificationsEnabled)
      }
      if (typeof launchAtStartup === 'boolean') {
        store.set('launchAtStartup', launchAtStartup)
        applyLoginItemSettings(launchAtStartup)
      }
      if (typeof repeatNotifications === 'boolean') {
        store.set('repeatNotifications', repeatNotifications)
        store.set('notificationsEnabled', repeatNotifications)
      }
      if (repeatIntervalSec !== undefined && repeatIntervalSec !== null) {
        const n = Number(repeatIntervalSec)
        if (Number.isFinite(n)) {
          const clamped = Math.min(600, Math.max(1, Math.round(n)))
          store.set('repeatIntervalSec', clamped)
        }
      }
      if (typeof notifyOnAC === 'boolean') {
        store.set('notifyOnAC', notifyOnAC)
      }
      setTrayMenu()
      pollBatteryOnce()
      return { ok: true }
    } catch (err) {
      log.error('Failed saving settings', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('notify:test', async () => {
    try {
      showChargeNotification()
      return { ok: true }
    } catch (err) {
      log.error('Failed to trigger test notification', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('daemon:get-settings', async () => {
    try {
      const res = await daemon.getSettings()
      const obj = res && res.settings ? res.settings : res
      return { ok: true, settings: obj || {} }
    } catch (err) {
      log.error('Failed to get daemon settings', err)
      return { ok: false, error: String(err), settings: {} }
    }
  })

  ipcMain.handle('daemon:set-settings', async (_event, payload) => {
    try {
      await daemon.setSettings(payload || {})
      return { ok: true }
    } catch (err) {
      log.error('Failed to set daemon settings', err)
      return { ok: false, error: String(err) }
    }
  })
}

/**
 * Initialize application and tray-only UI.
 */
function initialize() {
  store = createSettingsStore()
  applyLoginItemSettings(store.get('launchAtStartup'))
  applySecurityPolicies()
  createTray()

  // Hide dock for tray-only app until settings open
  try { app.dock.hide() } catch {}

  registerIpc()
  attachPowerEvents()
  startPolling()
  if (daemon.isAvailable()) tryDaemonBootstrap()
  refreshDaemonSupport()
  setInterval(refreshDaemonSupport, 10000)
}

app.whenReady().then(() => {
  initialize()
  handleTestNotifyFlag()
})

app.on('window-all-closed', (e) => {
  // Keep the app running in the tray
  e.preventDefault()
})

app.on('before-quit', () => {
  stopPolling()
})
/**
 * Parse threshold value from CLI args or npm run args.
 */
function parseThresholdArg() {
  const candidates = []
  try {
    for (const a of process.argv || []) {
      const m = String(a).match(/^--threshold=(\d{1,3})$/)
      if (m) candidates.push(Number(m[1]))
      else if (/^\d{1,3}$/.test(String(a))) candidates.push(Number(a))
    }
  } catch {}

  try {
    const raw = process.env.npm_config_argv
    if (raw) {
      const parsed = JSON.parse(raw)
      const orig = parsed && parsed.original ? parsed.original : []
      for (const a of orig) {
        const m = String(a).match(/^--threshold=(\d{1,3})$/)
        if (m) candidates.push(Number(m[1]))
        else if (/^\d{1,3}$/.test(String(a))) candidates.push(Number(a))
      }
    }
  } catch {}

  const n = candidates.find((v) => Number.isFinite(v))
  if (!Number.isFinite(n)) return undefined
  return Math.min(100, Math.max(1, Math.round(n)))
}

/**
 * Handle CLI flag to trigger a notification test and exit.
 */
function handleTestNotifyFlag() {
  try {
    const hasFlag = process.argv.includes('--test-notify')
    if (hasFlag) {
      const th = parseThresholdArg()
      if (Number.isFinite(th)) {
        try { store.set('thresholdPercent', th) } catch {}
      } else {
        console.log('test:notify requires threshold. Usage: npm run test:notify 50')
      }

      getBatteryStatus().then(({ percent, onBattery }) => {
        console.log(`[test:notify] battery=${Number.isFinite(percent) ? percent : 'N/A'}% onBattery=${onBattery} threshold=${Number.isFinite(th) ? th : 'N/A'}`)
        if (Number.isFinite(th) && onBattery && Number.isFinite(percent) && percent <= th) {
          showChargeNotification()
          console.log('[test:notify] notification sent')
        } else {
          console.log('[test:notify] skip: condition not met')
        }
        setTimeout(() => {
          app.quit()
        }, 2000)
      })
    }
  } catch (err) {
    log.error('Test notify handling failed', err)
  }
}
/**
 * Read battery status from Electron powerMonitor or pmset fallback.
 */
function getBatteryStatus() {
  return new Promise((resolve) => {
    try {
      if (daemon.isAvailable()) {
        daemon.getState().then((st) => {
          try {
            const percent = Number.isFinite(st.percent) ? Math.min(100, Math.max(0, Number(st.percent))) : NaN
            const onBattery = !!st.onBattery
            resolve({ percent, onBattery })
          } catch {
            resolve({ percent: NaN, onBattery: false })
          }
        }).catch(() => {
          // Fallback to Electron/pmset
          legacyStatus(resolve)
        })
        return
      }
    } catch {}

    legacyStatus(resolve)
  try {
    const level = powerMonitor.getBatteryLevel?.()
    const percentFromPM = Number.isFinite(level) ? Math.round(level * 100) : NaN
    const onBattery = !!powerMonitor.isOnBatteryPower?.()
    if (Number.isFinite(percentFromPM)) {
      resolve({ percent: percentFromPM, onBattery })
      return
    }
  } catch {}

    if (process.platform !== 'darwin') {
      resolve({ percent: NaN, onBattery: false })
      return
    }

    try {
      exec('pmset -g batt', (error, stdout) => {
        if (error || !stdout) {
          log.error('pmset failed', error)
          resolve({ percent: NaN, onBattery: false })
          return
        }
        try {
          const text = String(stdout)
          const m = text.match(/(\d{1,3})%/)
          const percent = m ? Math.min(100, Math.max(0, Number(m[1]))) : NaN
          const onBattery = /Battery Power/i.test(text)
          resolve({ percent, onBattery })
        } catch {
          log.error('pmset parse failed')
          resolve({ percent: NaN, onBattery: false })
        }
      })
    } catch {
      log.error('pmset invocation failed')
      resolve({ percent: NaN, onBattery: false })
    }
  })
}

/**
 * Fallback status using Electron power APIs and pmset.
 */
function legacyStatus(resolve) {
  try {
    const level = powerMonitor.getBatteryLevel?.()
    const percentFromPM = Number.isFinite(level) ? Math.round(level * 100) : NaN
    const onBattery = !!powerMonitor.isOnBatteryPower?.()
    if (Number.isFinite(percentFromPM)) {
      resolve({ percent: percentFromPM, onBattery })
      return
    }
  } catch {}

  if (process.platform !== 'darwin') {
    resolve({ percent: NaN, onBattery: false })
    return
  }

  try {
    exec('pmset -g batt', (error, stdout) => {
      if (error || !stdout) {
        log.error('pmset failed', error)
        resolve({ percent: NaN, onBattery: false })
        return
      }
      try {
        const text = String(stdout)
        const m = text.match(/(\d{1,3})%/)
        const percent = m ? Math.min(100, Math.max(0, Number(m[1]))) : NaN
        const onBattery = /Battery Power/i.test(text)
        resolve({ percent, onBattery })
      } catch {
        log.error('pmset parse failed')
        resolve({ percent: NaN, onBattery: false })
      }
    })
  } catch {
    log.error('pmset invocation failed')
    resolve({ percent: NaN, onBattery: false })
  }
}
/**
 * Start repeat notification timer while battery is at/below threshold.
 */
function startRepeatNotify() {
  const { repeatNotifications, repeatIntervalSec, notificationsEnabled, thresholdPercent, notifyOnAC } = getSettings()
  if (!repeatNotifications || !notificationsEnabled) return
  const intervalMs = Math.min(60_000, Math.max(1000, Math.round((repeatIntervalSec || 5) * 1000)))
  if (notifyRepeatTimer) return
  notifyRepeatTimer = setInterval(async () => {
    try {
      const { percent, onBattery } = await getBatteryStatus()
      if (shouldNotify(percent, onBattery, notificationsEnabled, thresholdPercent, notifyOnAC)) {
        showChargeNotification()
      } else {
        stopRepeatNotify()
      }
    } catch (err) {
      log.error('Repeat notification tick failed', err)
    }
  }, intervalMs)
}

/**
 * Stop repeat notification timer.
 */
function stopRepeatNotify() {
  if (notifyRepeatTimer) {
    clearInterval(notifyRepeatTimer)
    notifyRepeatTimer = null
  }
}
function resolveAsset(rel) {
  try {
    const devPath = path.join(__dirname, '..', rel)
    return devPath
  } catch {}
  try {
    const prodPath = path.join(process.resourcesPath || __dirname, rel)
    return prodPath
  } catch {}
  return rel
}

/**
 * Query bridge for current state and notify user.
 */
async function showState() {
  try {
    const st = await daemon.getState()
    const body = typeof st.percent === 'number'
      ? `Battery ${st.percent}%` + (st.onBattery ? ' (on battery)' : ' (on AC)')
      : 'State unavailable'
    if (Notification.isSupported()) new Notification({ title: 'Battery Monitor', body }).show()
  } catch (err) {
    log.error('state query failed', err)
    showBridgeMissingNotice()
  }
}

/**
 * Execute a daemon command with logging.
 */
async function handleCommand(fn) {
  try {
    if (!daemon.isAvailable()) {
      showBridgeMissingNotice()
      return
    }

    try {
      const support = await daemon.isSupported()
      if (!support || !support.ok) {
        showDaemonInstallNotice(support)
        return
      }
    } catch {
      showBridgeMissingNotice()
      return
    }

    let res = await fn()
    if (res && res.error) {
      const err = String(res.error)
      if (err === 'authorization_required' || err === 'not_authorized') {
        await promptAuthorization(fn)
        return
      }
      if (err === 'comm_failed' || err === 'btctl_not_found') {
        await tryDaemonBootstrap()
        const again = await fn()
        if (again && again.error) showBridgeMissingNotice()
        return
      }
      if (err === 'enable_failed' || err === 'missing_plist' || err === 'not_in_app_bundle' || err === 'unsupported_os') {
        try { await daemon.registerDaemon() } catch {}
        const again = await fn()
        if (again && again.error) showDaemonInstallNotice(again)
        return
      }
      log.error('daemon command error', res.error)
    }
  } catch (err) {
    log.error('daemon command failed', err)
    showBridgeMissingNotice()
  }
}

/**
 * Attempt to register, start, approve, and authorize daemon at startup.
 */
async function tryDaemonBootstrap() {
  try {
    if (!daemon.isAvailable()) {
      showBridgeMissingNotice()
      return
    }

    try { await daemon.registerDaemon() } catch {}

    const status = await daemon.startDaemon()
    if (status && status.requiresApproval) {
      try { await daemon.approveDaemon(20) } catch {}
    }

    try { await daemon.authorizeManage() } catch {}
  } catch (err) {
    log.error('daemon bootstrap failed', err)
  }
}

/**
 * Inform the user that native bridge is missing when commands fail.
 */
function showBridgeMissingNotice() {
  try {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: 'Battery Monitor', body: 'Native service bridge unavailable. Install or build btctl.' })
    n.show()
  } catch {}
}

function showDaemonInstallNotice(detail) {
  try {
    const body = typeof detail?.path === 'string'
      ? `Daemon plist missing: ${detail.path}`
      : 'Daemon not installed or app not packaged. Build and install the app, then launch the background service.'
    if (Notification.isSupported()) new Notification({ title: 'Battery Monitor', body }).show()
  } catch {}
}

// Global error handlers
process.on('uncaughtException', (err) => {
  try { log.error('uncaughtException', err) } catch {}
})
process.on('unhandledRejection', (reason) => {
  try { log.error('unhandledRejection', reason) } catch {}
})
async function promptAuthorization(retryFn) {
  try {
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'Battery Monitor',
      message: 'Authorization required',
      detail: 'To manage power state, you may be prompted to authorize. If not, approve Battery Monitor in System Settings → Login Items first.',
      buttons: ['Approve', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })
    if (result.response === 0) {
      try {
        await daemon.authorizeManage()
        const again = await retryFn()
        if (again && again.error) log.error('retry command error', again.error)
      } catch (err) {
        log.error('approval failed', err)
      }
    }
  } catch (err) {
    log.error('authorization prompt failed', err)
  }
}
let daemonSupported = false
async function refreshDaemonSupport() {
  try {
    const r = await daemon.isSupported()
    daemonSupported = !!(r && r.ok)
    setTrayMenu()
  } catch {
    daemonSupported = false
    setTrayMenu()
  }
}
