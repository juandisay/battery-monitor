const { contextBridge, ipcRenderer } = require('electron')

/**
 * Expose settings APIs to the renderer safely (CommonJS preload for macOS).
 */
contextBridge.exposeInMainWorld('settingsAPI', {
  /**
   * Get current settings from main process.
   */
  get: async () => {
    try {
      return await ipcRenderer.invoke('settings:get')
    } catch (err) {
      console.error('Failed to get settings:', err)
      return { thresholdPercent: 70, notificationsEnabled: true, launchAtStartup: false }
    }
  },
  /**
   * Save settings to main process.
   */
  save: async (settings) => {
    try {
      const res = await ipcRenderer.invoke('settings:save', settings)
      return res
    } catch (err) {
      console.error('Failed to save settings:', err)
      return { ok: false, error: String(err) }
    }
  },
  /**
   * Trigger a test notification from main process.
   */
  testNotify: async () => {
    try {
      const res = await ipcRenderer.invoke('notify:test')
      return res
    } catch (err) {
      console.error('Failed to test notify:', err)
      return { ok: false, error: String(err) }
    }
  }
})

// Daemon APIs removed
