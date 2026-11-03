import { ipcMain, screen } from 'electron'
import { fullRect, hasFrame, moveRect, toggleRect, wideRect, withoutFrame, isWide, type Rect, type Screen } from '@shared/widescreen'
import type { Config } from '@shared/config'
import { getConfig, setConfig } from './configStore'
import { gameWindowApi } from './gameWindow'
import { log } from './log'

/**
 * Keeps the game window borderless and switches it between full height and the wide picture.
 * Runs only while switched on; switching off puts the window back to full screen.
 */
const GAME_CLASS = 'POEWindowClass'
const SETTLE_MS = 2500 // the game resets its size right after the frame is removed; wait before resizing

export interface WidescreenStatus { supported: boolean; found: boolean; wide: boolean; enabled: boolean }

let timer: NodeJS.Timeout | null = null
let pending: NodeJS.Timeout | null = null
let onChange: (() => void) | null = null

export function onWidescreenChange(fn: () => void): void { onChange = fn }

function find(): bigint | null {
  const api = gameWindowApi()
  return api ? api.find(GAME_CLASS, getConfig().windowTitle) : null
}

function screenOf(r: Rect | null): Screen {
  const d = r ? screen.getDisplayMatching({ x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) }) : screen.getPrimaryDisplay()
  return d.bounds
}

function apply(rect: Rect): boolean {
  const api = gameWindowApi(), hwnd = find()
  if (!api || !hwnd) return false
  const ok = api.move(hwnd, rect)
  if (!ok) log('warn', 'could not move the game window (if the game runs as administrator, run this app as administrator too)')
  return ok
}

/** One check: remove the title bar if the game shows one, then bring it to the chosen size. */
function tick(): void {
  const api = gameWindowApi(), hwnd = find()
  if (!api || !hwnd || pending) return
  const style = api.style(hwnd)
  if (!hasFrame(style)) return
  api.setStyle(hwnd, withoutFrame(style))
  pending = setTimeout(() => {
    pending = null
    const ws = getConfig().widescreen
    const s = screenOf(api.rect(hwnd))
    apply(ws.wide ? wideRect(s, ws) : fullRect(s))
    onChange?.()
  }, SETTLE_MS)
}

export function startWidescreen(): void {
  stopTimer()
  if (!getConfig().widescreen.enabled || !gameWindowApi()) return
  timer = setInterval(tick, 500)
  tick()
}

function stopTimer(): void {
  if (timer) clearInterval(timer)
  if (pending) clearTimeout(pending)
  timer = null; pending = null
}

export function status(): WidescreenStatus {
  const ws = getConfig().widescreen
  const api = gameWindowApi()
  const hwnd = api ? find() : null
  const r = api && hwnd ? api.rect(hwnd) : null
  return { supported: !!api, found: !!hwnd, wide: r ? isWide(r, screenOf(r)) : ws.wide, enabled: ws.enabled }
}

/** Switch the wide picture on or off; turning it on also switches the feature on. */
export function setWide(wide: boolean): WidescreenStatus {
  const cur = getConfig().widescreen
  const next = { ...cur, wide, enabled: cur.enabled || wide }
  save(next)
  const api = gameWindowApi(), hwnd = find()
  if (api && hwnd) {
    const s = screenOf(api.rect(hwnd))
    apply(wide ? wideRect(s, next) : fullRect(s))
  }
  if (next.enabled && !timer) startWidescreen()
  onChange?.()
  return status()
}

export function updateWidescreen(patch: Partial<Config['widescreen']>): WidescreenStatus {
  const cur = getConfig().widescreen
  const next = { ...cur, ...patch }
  save(next)
  if (!next.enabled) { stopTimer(); restore() }
  else {
    startWidescreen()
    if (('zoom' in patch || 'anchorTop' in patch) && next.wide) setWide(true)
  }
  onChange?.()
  return status()
}

/** Hotkeys: F2 toggles, Ctrl/Shift + arrows move. */
export function widescreenAction(action: 'wideToggle' | 'wideUp' | 'wideDown' | 'wideUpFine' | 'wideDownFine'): void {
  const api = gameWindowApi(), hwnd = find()
  if (!api || !hwnd) return
  const r = api.rect(hwnd)
  if (!r) return
  const s = screenOf(r)
  if (action === 'wideToggle') {
    const next = toggleRect(r, s, getConfig().widescreen)
    if (apply(next)) save({ ...getConfig().widescreen, wide: isWide(next, s) })
    onChange?.()
    return
  }
  apply(moveRect(r, s, action.startsWith('wideUp') ? 'up' : 'down', action.endsWith('Fine')))
}

/** Back to full screen, e.g. when the feature is switched off or the app quits. */
export function restore(): void {
  const api = gameWindowApi(), hwnd = find()
  if (!api || !hwnd) return
  const r = api.rect(hwnd)
  if (r && isWide(r, screenOf(r))) apply(fullRect(screenOf(r)))
}

function save(ws: Config['widescreen']): void {
  setConfig({ widescreen: ws })
}

export function registerWidescreenIpc(): void {
  ipcMain.handle('widescreen:status', () => status())
  ipcMain.handle('widescreen:wide', (_e, wide: boolean) => setWide(wide))
  ipcMain.handle('widescreen:update', (_e, patch: Partial<Config['widescreen']>) => updateWidescreen(patch))
}

export function stopWidescreen(): void {
  stopTimer()
  if (getConfig().widescreen.enabled) restore()
}
