/**
 * Indicates whether a daemon bridge is available.
 */
export function isAvailable() { return false }

/**
 * Returns the current battery state from daemon (removed).
 */
export function getState() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }

/**
 * Returns settings from daemon (removed).
 */
export function getSettings() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }

/**
 * Persists settings to daemon (removed).
 */
export function setSettings() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }

/**
 * Daemon management commands (removed).
 */
export function startDaemon() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function approveDaemon() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function upgradeDaemon() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function removeDaemon() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function registerDaemon() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function isSupported() { return Promise.resolve({ ok: false }) }
export function authorizeManage() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }

/**
 * Power control commands (removed).
 */
export function disablePowerAdapter() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function enablePowerAdapter() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function chargeToLimit() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function chargeToFull() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function disableCharging() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function pauseActivity() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
export function resumeActivity() { return Promise.resolve({ ok: false, error: 'daemon_removed' }) }
