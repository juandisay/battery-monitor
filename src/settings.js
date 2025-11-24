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
  const startupEl = document.getElementById('startup')
  const notifyOnACEl = document.getElementById('notifyOnAC')
  const saveBtn = document.getElementById('save')
  const testBtn = document.getElementById('testNotify')
  const closeBtn = document.getElementById('close')
  // Daemon settings elements removed

  // Assume settingsAPI is available via preload (no user-facing warnings)

  try {
    const settings = await window.settingsAPI.get()
    thresholdEl.value = settings.thresholdPercent
    thresholdValEl.textContent = `${settings.thresholdPercent}%`
    startupEl.checked = !!settings.launchAtStartup
    notifyOnACEl.checked = !!settings.notifyOnAC
  } catch (err) {
    console.error('Failed to init settings UI:', err)
    setStatus('Failed to load settings', 'error')
  }

  // Daemon settings removed

  thresholdEl.addEventListener('input', () => {
    thresholdValEl.textContent = `${thresholdEl.value}%`
  })

  // Daemon sliders removed

  

  saveBtn.addEventListener('click', async () => {
    const payload = {
      thresholdPercent: Number(thresholdEl.value),
      launchAtStartup: !!startupEl.checked,
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
