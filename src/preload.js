import { contextBridge, ipcRenderer } from 'electron'

/**
 * Expose settings APIs to the renderer safely.
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
  }
})

// Daemon APIs removed
