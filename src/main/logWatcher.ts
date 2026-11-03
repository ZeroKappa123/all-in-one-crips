import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { defaultLogPaths, LineBuffer, parseLogLine, type LogEvent } from '@shared/act/log'
import { log } from './log'

const TAIL_BYTES = 256 * 1024
const POLL_MS = 500

/**
 * Follows Client.txt by polling its size. Never reads the whole file (it can be gigabytes):
 * the last 256 KB give the current state, after that only new bytes are read.
 */
export class LogWatcher {
  private pos = 0
  private timer: NodeJS.Timeout | null = null
  private buf = new LineBuffer()
  path: string | null = null

  constructor(private onEvents: (events: LogEvent[], initial: boolean) => void) {}

  start(preferred: string | null): 'ok' | 'missing' {
    this.stop()
    const candidates = [preferred, process.env.ASSAY_CLIENT_LOG, ...defaultLogPaths(process.platform, homedir())].filter((p): p is string => !!p)
    this.path = candidates.find(p => existsSync(p)) ?? null
    if (!this.path) { log('warn', 'Client.txt not found'); return 'missing' }
    log('info', `following ${this.path}`)
    const size = statSync(this.path).size
    const from = Math.max(0, size - TAIL_BYTES)
    const initial = this.read(from, size)
    this.pos = size
    // the first line of the tail is probably cut in half; drop it
    const lines = from > 0 ? initial.slice(1) : initial
    this.onEvents(lines.map(parseLogLine).filter((e): e is LogEvent => !!e), true)
    this.timer = setInterval(() => this.poll(), POLL_MS)
    return 'ok'
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private poll(): void {
    if (!this.path) return
    let size: number
    try { size = statSync(this.path).size } catch { return }
    if (size < this.pos) { this.pos = 0; this.buf = new LineBuffer() } // file was truncated or replaced
    if (size === this.pos) return
    const lines = this.read(this.pos, size)
    this.pos = size
    const events = lines.map(parseLogLine).filter((e): e is LogEvent => !!e)
    if (events.length) this.onEvents(events, false)
  }

  private read(from: number, to: number): string[] {
    const fd = openSync(this.path!, 'r')
    try {
      const len = Math.min(to - from, 8 * 1024 * 1024)
      const b = Buffer.alloc(len)
      readSync(fd, b, 0, len, from)
      return this.buf.push(b.toString('utf8'))
    } finally {
      closeSync(fd)
    }
  }
}
