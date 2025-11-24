/* global settingsAPI */

/**
 * Set status feedback text.
 */
function setStatus(text, type = 'info') {
  const el = document.getElementById('status')
  if (!el) return
  el.textContent = text || ''
  el.style.marginTop = '8px'
  el.style.color = type === 'error' ? '#b00020' : '#333'
}

/**
 * Initialize UI with current settings and wire interactions.
 */
async function init() {
  const thresholdEl = document.getElementById('threshold')
  const thresholdValEl = document.getElementById('thresholdValue')
  const notificationsEl = document.getElementById('notifications')
  const startupEl = document.getElementById('startup')
  const repeatEl = document.getElementById('repeat')
  const intervalEl = document.getElementById('interval')
  const notifyOnACEl = document.getElementById('notifyOnAC')
  const saveBtn = document.getElementById('save')
  const testBtn = document.getElementById('testNotify')
  const closeBtn = document.getElementById('close')
  const minChargeEl = document.getElementById('minCharge')
  const maxChargeEl = document.getElementById('maxCharge')
  const minChargeValEl = document.getElementById('minChargeValue')
  const maxChargeValEl = document.getElementById('maxChargeValue')
  const adapterSleepEl = document.getElementById('adapterSleep')
  const magSafeSyncEl = document.getElementById('magSafeSync')
  const saveDaemonBtn = document.getElementById('saveDaemon')

  // Assume settingsAPI is available via preload (no user-facing warnings)

  try {
    const settings = await window.settingsAPI.get()
    thresholdEl.value = settings.thresholdPercent
    thresholdValEl.textContent = `${settings.thresholdPercent}%`
    notificationsEl.checked = !!settings.notificationsEnabled
    startupEl.checked = !!settings.launchAtStartup
    repeatEl.checked = !!settings.repeatNotifications
    intervalEl.value = Number(settings.repeatIntervalSec || 5)
    notifyOnACEl.checked = !!settings.notifyOnAC
  } catch (err) {
    console.error('Failed to init settings UI:', err)
    setStatus('Failed to load settings', 'error')
  }

  // Daemon settings removed
  try { if (saveDaemonBtn) saveDaemonBtn.disabled = true } catch {}

  thresholdEl.addEventListener('input', () => {
    thresholdValEl.textContent = `${thresholdEl.value}%`
  })

  minChargeEl.addEventListener('input', () => {
    minChargeValEl.textContent = `${minChargeEl.value}%`
  })

  maxChargeEl.addEventListener('input', () => {
    maxChargeValEl.textContent = `${maxChargeEl.value}%`
  })

  repeatEl.addEventListener('change', () => {
    notificationsEl.checked = !!repeatEl.checked
  })

  saveBtn.addEventListener('click', async () => {
    const payload = {
      thresholdPercent: Number(thresholdEl.value),
      notificationsEnabled: !!notificationsEl.checked,
      launchAtStartup: !!startupEl.checked,
      repeatNotifications: !!repeatEl.checked,
      repeatIntervalSec: Number(intervalEl.value),
      notifyOnAC: !!notifyOnACEl.checked
    }
    try {
      const res = await window.settingsAPI.save(payload)
      if (res?.ok) {
        setStatus('Settings saved')
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
  })

  // Daemon save removed

  testBtn.addEventListener('click', async () => {
    try {
      const res = await window.settingsAPI.testNotify()
      if (res?.ok) {
        setStatus('Test notification sent')
      }
    } catch (err) {
      console.error('Test notify failed:', err)
    }
  })

  closeBtn.addEventListener('click', () => {
    window.close()
  })
}

/**
 * Initialize after DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
  init()
})
