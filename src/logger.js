import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * Simple file logger with rotation for Electron main process.
 */
export function createLogger() {
  const dir = safeUserDataPath()
  const file = path.join(dir, 'battery-monitor.log')
  return {
    /**
     * Log informational message to file and console.
     */
    info: (msg, meta) => {
      try {
        const line = formatLine('INFO', msg, meta)
        fs.appendFileSync(file, line)
      } catch {}
      try { console.log(msg, meta ?? '') } catch {}
    },
    /**
     * Log error message to file and console.
     */
    error: (msg, err) => {
      try {
        const line = formatLine('ERROR', msg, serializeError(err))
        fs.appendFileSync(file, line)
      } catch {}
      try { console.error(msg, err ?? '') } catch {}
    }
  }
}

/**
 * Ensure userData directory exists.
 */
function safeUserDataPath() {
  let dir
  try { dir = app.getPath('userData') } catch { dir = process.cwd() }
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  return dir
}

/**
 * Format a single log line with timestamp.
 */
function formatLine(level, msg, meta) {
  const ts = new Date().toISOString()
  const payload = meta !== undefined ? ` ${JSON.stringify(meta)}` : ''
  return `${ts} [${level}] ${String(msg)}${payload}\n`
}

/**
 * Serialize thrown values to plain object.
 */
function serializeError(err) {
  if (!err) return undefined
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return String(err)
}
