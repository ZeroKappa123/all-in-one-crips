export interface LogEntry { at: string; level: 'info' | 'warn' | 'error'; msg: string }

const entries: LogEntry[] = []
const MAX = 300

export function log(level: LogEntry['level'], msg: string): void {
  entries.push({ at: new Date().toISOString(), level, msg })
  if (entries.length > MAX) entries.splice(0, entries.length - MAX)
  if (level !== 'info' || process.env.ASSAY_DEBUG) console[level === 'info' ? 'log' : level](`[assay] ${msg}`)
}

export function getLogs(): LogEntry[] {
  return [...entries]
}
