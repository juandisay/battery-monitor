import { app, session } from 'electron'

/**
 * Apply Electron security hardening settings.
 */
export function applySecurityPolicies() {
  try { app.disableHardwareAcceleration() } catch {}
  try { app.enableSandbox() } catch {}
  try {
    app.on('web-contents-created', (_event, contents) => {
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
      contents.on('will-navigate', (e) => { e.preventDefault() })
    })
  } catch {}
  try {
    const ses = session.defaultSession
    ses.setPermissionCheckHandler(() => false)
    ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  } catch {}
}
