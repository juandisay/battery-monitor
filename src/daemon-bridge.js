import { execFile } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

/**
 * Resolve the native daemon control binary path.
 */
function resolveBtctlPath() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const override = process.env.BTCTL_PATH
  const candidates = [
    override,
    path.join(__dirname, '..', 'native', 'bin', 'btctl'),
    path.join(process.resourcesPath || __dirname, 'native', 'bin', 'btctl'),
    '/Applications/BatteryToolkit.app/Contents/MacOS/btctl'
  ].filter(Boolean)
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p } catch {}
  }
  return undefined
}

/**
 * Execute btctl with arguments and parse JSON output.
 */
/**
 * Execute btctl with arguments and parse JSON output with reliable timeout handling.
 */
function runBtctl(args = []) {
  return new Promise((resolve) => {
    const bin = resolveBtctlPath()
    if (!bin) return resolve({ ok: false, error: 'btctl_not_found' })

    const isApprove = Array.isArray(args) && String(args[0]) === 'approve'
    const approveSec = isApprove ? Math.max(1, Number(args[1] || 20)) : 0
    const options = {
      timeout: isApprove ? (approveSec + 5) * 1000 : 0,
      maxBuffer: 256 * 1024
    }

    execFile(bin, args, options, (err, stdout, stderr) => {
      const text = String(stdout || '').trim()
      const detail = String(stderr || '').trim()
      try {
        if (text) return resolve(JSON.parse(text))
      } catch {}
      if (err) {
        const timedOut = err.code === 'ETIMEDOUT'
        return resolve({ ok: false, error: timedOut ? 'timeout' : 'exec_failed', message: detail || err.message })
      }
      resolve({ ok: true })
    })
  })
}

export function isAvailable() {
  return !!resolveBtctlPath()
}

/**
 * Start or update daemon registration.
 */
export function startDaemon() {
  return runBtctl(['start'])
}

/**
 * Request approval for login item and wait.
 */
export function approveDaemon(timeoutSec = 20) {
  return runBtctl(['approve', String(timeoutSec)])
}

/**
 * Upgrade daemon from legacy helper.
 */
export function upgradeDaemon() {
  return runBtctl(['upgrade'])
}

/**
 * Remove daemon and cleanup.
 */
export function removeDaemon() {
  return runBtctl(['remove'])
}

/**
 * Return current daemon state.
 */
export function getState() {
  return runBtctl(['state'])
}

/**
 * Return current settings from daemon.
 */
export function getSettings() {
  return runBtctl(['get-settings'])
}

/**
 * Persist settings to daemon.
 */
export function setSettings(payload) {
  const args = ['set-settings', JSON.stringify(payload || {})]
  return runBtctl(args)
}

/**
 * Power control commands.
 */
export async function disablePowerAdapter() {
  const first = await runBtctl(['disable-power'])
  if (!first || !first.error) return first
  const err = String(first.error)
  if (err === 'authorization_required' || err === 'not_authorized') {
    await runBtctl(['authorize-manage'])
    return runBtctl(['disable-power'])
  }
  if (err === 'comm_failed' || err === 'btctl_not_found') {
    await runBtctl(['register-daemon'])
    const started = await runBtctl(['start'])
    if (started && started.requiresApproval) await runBtctl(['approve', '20'])
    await runBtctl(['authorize-manage'])
    return runBtctl(['disable-power'])
  }
  if (err === 'enable_failed' || err === 'missing_plist' || err === 'not_in_app_bundle' || err === 'unsupported_os') {
    await runBtctl(['register-daemon'])
    return runBtctl(['disable-power'])
  }
  return first
}
export async function enablePowerAdapter() {
  const first = await runBtctl(['enable-power'])
  if (!first || !first.error) return first
  const err = String(first.error)
  if (err === 'authorization_required' || err === 'not_authorized') {
    await runBtctl(['authorize-manage'])
    return runBtctl(['enable-power'])
  }
  if (err === 'comm_failed' || err === 'btctl_not_found') {
    await runBtctl(['register-daemon'])
    const started = await runBtctl(['start'])
    if (started && started.requiresApproval) await runBtctl(['approve', '20'])
    await runBtctl(['authorize-manage'])
    return runBtctl(['enable-power'])
  }
  if (err === 'enable_failed' || err === 'missing_plist' || err === 'not_in_app_bundle' || err === 'unsupported_os') {
    await runBtctl(['register-daemon'])
    return runBtctl(['enable-power'])
  }
  return first
}
export function chargeToLimit() { return runBtctl(['charge-limit']) }
export function chargeToFull() { return runBtctl(['charge-full']) }
export function disableCharging() { return runBtctl(['disable-charging']) }
export function pauseActivity() { return runBtctl(['pause']) }
export function resumeActivity() { return runBtctl(['resume']) }
export function authorizeManage() { return runBtctl(['authorize-manage']) }
export function isSupported() { return runBtctl(['is-supported']) }
export function registerDaemon() { return runBtctl(['register-daemon']) }
