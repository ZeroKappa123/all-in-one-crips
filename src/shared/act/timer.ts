/**
 * Campaign timer as a pure state machine. The main process calls tick() once a second with
 * whether time should count right now (not AFK, not paused in hideout).
 */
export interface TimerState {
  running: boolean
  finished: boolean
  act: number
  totalMs: number
  actMs: Record<number, number>
  startedOn: string | null // ISO date of the run start, for the CSV
}

export const EPILOGUE_AREA = '2_11_endgame_town'

export function newTimer(): TimerState {
  return { running: false, finished: false, act: 1, totalMs: 0, actMs: {}, startedOn: null }
}

export function toggle(s: TimerState, now: number): TimerState {
  if (s.finished) return s
  return { ...s, running: !s.running, startedOn: s.startedOn ?? new Date(now).toISOString() }
}

export function tick(s: TimerState, deltaMs: number, counting: boolean): TimerState {
  if (!s.running || s.finished || !counting || deltaMs <= 0) return s
  const d = Math.min(deltaMs, 5000) // a sleeping laptop must not add an hour
  return { ...s, totalMs: s.totalMs + d, actMs: { ...s.actMs, [s.act]: (s.actMs[s.act] ?? 0) + d } }
}

/** Acts only count up, on the first entry into a later act, and only while the timer runs. */
export function enterArea(s: TimerState, areaId: string, act: number | undefined): { state: TimerState; finishedNow: boolean } {
  if (!s.running || s.finished) return { state: s, finishedNow: false }
  if (areaId === EPILOGUE_AREA) return { state: { ...s, running: false, finished: true }, finishedNow: true }
  if (act !== undefined && act > s.act && act <= 10) return { state: { ...s, act }, finishedNow: false }
  return { state: s, finishedNow: false }
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const CSV_HEADER = 'started,total,' + Array.from({ length: 10 }, (_, i) => `act${i + 1}`).join(',')

export function csvRow(s: TimerState): string {
  const acts = Array.from({ length: 10 }, (_, i) => fmtDuration(s.actMs[i + 1] ?? 0))
  return [s.startedOn ?? '', fmtDuration(s.totalMs), ...acts].join(',')
}
