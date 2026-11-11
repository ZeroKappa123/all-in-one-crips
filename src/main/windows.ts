import { BrowserWindow, nativeTheme, screen } from 'electron'
import { getConfig } from './configStore'
import { join } from 'node:path'

const PANEL_WIDTH = 480

/** Window background behind the page while it loads, matching the chosen appearance. */
export function windowBackground(): string {
  const t = getConfig().theme
  const dark = t === 'dark' || (t === 'system' && nativeTheme.shouldUseDarkColors)
  return dark ? '#1c1c1e' : '#f2f2f7'
}

export function applyTheme(): void {
  const t = getConfig().theme
  nativeTheme.themeSource = t === 'system' ? 'system' : t
  for (const w of [settings, gear, editor]) if (w && !w.isDestroyed()) w.setBackgroundColor(windowBackground())
}

function load(win: BrowserWindow, route: string): void {
  const url = process.env.ELECTRON_RENDERER_URL
  if (url) void win.loadURL(`${url}#${route}`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
}

const common = {
  show: false,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false
  }
} as const

let panel: BrowserWindow | null = null
let guide: BrowserWindow | null = null
let tree: BrowserWindow | null = null
let gear: BrowserWindow | null = null
let editor: BrowserWindow | null = null
let trades: BrowserWindow | null = null
let stashWin: BrowserWindow | null = null
let onTradesMoved: ((x: number, y: number) => void) | null = null
export function setTradesMovedHandler(fn: (x: number, y: number) => void): void { onTradesMoved = fn }

/** Incoming and outgoing trade cards: transparent, never steals focus, clicks pass through except on cards. */
export function getTradesWindow(show = false): BrowserWindow {
  if (trades && !trades.isDestroyed()) { if (show && !trades.isVisible()) trades.showInactive(); return trades }
  const area = screen.getPrimaryDisplay().workArea
  const width = 380
  const pos = getConfig().trades.position
  trades = new BrowserWindow({
    ...common, width, height: 120,
    x: pos?.x ?? Math.round(area.x + area.width - width - 24), y: pos?.y ?? area.y + 80,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, focusable: false,
    title: 'All-In-One CRIPS – Trades'
  })
  trades.setAlwaysOnTop(true, 'screen-saver')
  trades.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  trades.setIgnoreMouseEvents(true, { forward: true })
  trades.on('moved', () => { const b = trades!.getBounds(); onTradesMoved?.(b.x, b.y) })
  load(trades, 'trades')
  trades.once('ready-to-show', () => { if (show) trades?.showInactive() })
  return trades
}

export function setTradesInteractive(on: boolean): void {
  if (trades && !trades.isDestroyed()) trades.setIgnoreMouseEvents(!on, { forward: true })
}

export function resizeTrades(h: number): void {
  if (!trades || trades.isDestroyed()) return
  const b = trades.getBounds()
  const height = Math.max(1, Math.min(Math.ceil(h), 700))
  if (height !== b.height) trades.setBounds({ ...b, height })
  if (h < 4 && trades.isVisible()) trades.hide()
}

let omniWin: BrowserWindow | null = null
const OMNI_WIDTH = 360

/** Small menu at the cursor for the omni key. Never takes focus, so the game keeps the keyboard. */
export function getOmniWindow(): BrowserWindow {
  if (omniWin && !omniWin.isDestroyed()) return omniWin
  omniWin = new BrowserWindow({
    ...common, width: OMNI_WIDTH, height: 200, frame: false, transparent: true, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, focusable: false, title: 'All-In-One CRIPS – Vendor search'
  })
  omniWin.setAlwaysOnTop(true, 'screen-saver')
  load(omniWin, 'omni')
  return omniWin
}

/** Shows the menu with its top-left corner at the cursor, kept on the cursor's screen. */
export function showOmniAt(p: { x: number; y: number }): void {
  const w = getOmniWindow()
  const area = screen.getDisplayNearestPoint(p).workArea
  const b = w.getBounds()
  const x = Math.min(Math.max(area.x, p.x + 8), area.x + area.width - OMNI_WIDTH)
  const y = Math.min(Math.max(area.y, p.y + 8), area.y + area.height - b.height)
  w.setBounds({ x, y, width: OMNI_WIDTH, height: b.height })
  w.showInactive()
}

export function resizeOmni(h: number): void {
  if (!omniWin || omniWin.isDestroyed()) return
  const b = omniWin.getBounds()
  const area = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea
  const height = Math.max(40, Math.min(Math.ceil(h), 640))
  omniWin.setBounds({ ...b, height, y: Math.min(b.y, area.y + area.height - height) })
}

export function hideOmni(): void { if (omniWin && !omniWin.isDestroyed() && omniWin.isVisible()) omniWin.hide() }
export function omniBounds(): Electron.Rectangle | null { return omniWin && !omniWin.isDestroyed() && omniWin.isVisible() ? omniWin.getBounds() : null }

/** Fullscreen click-through layer that outlines the traded item in the stash, or lets you calibrate the stash grid. */
export function getStashWindow(): BrowserWindow {
  if (stashWin && !stashWin.isDestroyed()) return stashWin
  const area = screen.getPrimaryDisplay().bounds
  stashWin = new BrowserWindow({ ...common, ...area, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false, focusable: false, title: 'All-In-One CRIPS – Stash' })
  stashWin.setAlwaysOnTop(true, 'screen-saver')
  stashWin.setIgnoreMouseEvents(true)
  load(stashWin, 'stash')
  return stashWin
}

export function showStashHighlight(stash: { tab: string; left: number; top: number }, item: string): void {
  const w = getStashWindow()
  const send = () => { w.showInactive(); w.webContents.send('stash:highlight', { stash, item }) }
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send)
  else send()
}

let stashCalibrating = false
/** Asked by the stash window when it starts, so a request sent before it was ready isn't lost. */
export function isStashCalibrating(): boolean { return stashCalibrating }

export function calibrateStash(on: boolean): void {
  stashCalibrating = on
  const w = getStashWindow()
  w.setIgnoreMouseEvents(!on)
  w.setFocusable(on)
  const send = () => { w.show(); if (on) w.focus(); w.webContents.send('stash:calibrate', on) }
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send)
  else send()
}

export function hideStash(): void {
  stashCalibrating = false
  if (stashWin && !stashWin.isDestroyed()) { stashWin.setIgnoreMouseEvents(true); stashWin.hide() }
}
let onGuideMoved: ((x: number, y: number) => void) | null = null

export function setGuideMovedHandler(fn: (x: number, y: number) => void): void { onGuideMoved = fn }

/** The campaign guide: transparent, never takes focus, lets clicks through except on its controls. */
export function getGuideWindow(pos: { x: number | null; y: number | null }): BrowserWindow {
  if (guide && !guide.isDestroyed()) return guide
  const area = screen.getPrimaryDisplay().workArea
  const width = 560
  guide = new BrowserWindow({
    ...common,
    width,
    height: 200,
    x: pos.x ?? Math.round(area.x + (area.width - width) / 2),
    y: pos.y ?? area.y + area.height - 240,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    focusable: false, title: 'All-In-One CRIPS – Guide'
  })
  guide.setAlwaysOnTop(true, 'screen-saver')
  guide.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  guide.setIgnoreMouseEvents(true, { forward: true })
  guide.on('moved', () => { const b = guide!.getBounds(); onGuideMoved?.(b.x, b.y) })
  load(guide, 'guide')
  guide.once('ready-to-show', () => guide?.showInactive())
  return guide
}

export function toggleGuideWindow(visible: boolean): void {
  if (visible) { const w = getGuideWindow({ x: null, y: null }); if (!w.isVisible()) w.showInactive() }
  else if (guide && !guide.isDestroyed()) guide.hide()
}

export function setGuideInteractive(on: boolean): void {
  if (guide && !guide.isDestroyed()) guide.setIgnoreMouseEvents(!on, { forward: true })
}

export function resizeGuide(contentHeight: number): void {
  if (!guide || guide.isDestroyed()) return
  const b = guide.getBounds()
  const h = Math.max(60, Math.min(Math.ceil(contentHeight), 600))
  if (h !== b.height) guide.setBounds({ ...b, y: b.y + (b.height - h), height: h }) // grow upwards from the bottom edge
}

export function openTreeOverlay(): void {
  if (tree && !tree.isDestroyed()) { if (tree.isVisible()) { tree.hide(); return } tree.show(); tree.focus(); return }
  const area = screen.getPrimaryDisplay().bounds
  tree = new BrowserWindow({ ...common, ...area, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false, title: 'All-In-One CRIPS – Tree' })
  tree.setAlwaysOnTop(true, 'screen-saver')
  load(tree, 'tree')
  tree.once('ready-to-show', () => { tree?.show(); tree?.focus() })
}

export function hideTreeOverlay(): void {
  if (tree && !tree.isDestroyed()) tree.hide()
}

export function openGearWindow(): void {
  if (gear && !gear.isDestroyed()) { gear.show(); gear.focus(); return }
  gear = new BrowserWindow({ ...common, width: 420, height: 520, title: 'All-In-One CRIPS – Gear tracker', autoHideMenuBar: true, alwaysOnTop: true, backgroundColor: windowBackground() })
  load(gear, 'gear')
  gear.once('ready-to-show', () => gear?.show())
}

export function openEditor(slot: number): void {
  if (editor && !editor.isDestroyed()) editor.close()
  editor = new BrowserWindow({ ...common, width: 980, height: 720, title: 'All-In-One CRIPS – Guide editor', autoHideMenuBar: true, backgroundColor: windowBackground() })
  load(editor, `editor/${slot}`)
  editor.once('ready-to-show', () => editor?.show())
}
let settings: BrowserWindow | null = null
let overlay: BrowserWindow | null = null

/** The price-check panel: frameless, transparent, above the game. */
export function getPanel(): BrowserWindow {
  if (panel && !panel.isDestroyed()) return panel
  panel = new BrowserWindow({
    ...common,
    width: PANEL_WIDTH,
    height: 640,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'All-In-One CRIPS'
  })
  panel.setAlwaysOnTop(true, 'screen-saver')
  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  load(panel, 'panel')
  return panel
}

/** Puts the panel beside the cursor, on the side with more room, inside the current display. */
export function showPanelAtCursor(): BrowserWindow {
  const win = getPanel()
  const cursor = screen.getCursorScreenPoint()
  const area = screen.getDisplayNearestPoint(cursor).workArea
  const [w, h] = win.getSize() as [number, number]
  const right = cursor.x - area.x < area.width / 2
  const x = right ? Math.min(cursor.x + 24, area.x + area.width - w) : Math.max(area.x, cursor.x - w - 24)
  const y = Math.max(area.y, Math.min(cursor.y - 80, area.y + area.height - h))
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h })
  win.show()
  win.focus()
  return win
}

/** Fit the window to the panel so no invisible area covers the game. Grows upwards if it would leave the screen. */
export function resizePanel(contentHeight: number): void {
  if (!panel || panel.isDestroyed()) return
  const b = panel.getBounds()
  const area = screen.getDisplayMatching(b).workArea
  const height = Math.max(120, Math.min(Math.ceil(contentHeight), Math.floor(area.height * 0.85)))
  const y = Math.min(b.y, area.y + area.height - height)
  if (height !== b.height || y !== b.y) panel.setBounds({ x: b.x, y, width: b.width, height })
}

export function hidePanel(): void {
  if (panel && !panel.isDestroyed() && panel.isVisible()) panel.hide()
}

export function openSettings(): BrowserWindow {
  if (settings && !settings.isDestroyed()) { settings.show(); settings.focus(); return settings }
  settings = new BrowserWindow({ ...common, width: 720, height: 600, minWidth: 560, minHeight: 420, title: 'All-In-One CRIPS', autoHideMenuBar: true, backgroundColor: windowBackground() })
  load(settings, 'settings')
  settings.once('ready-to-show', () => settings?.show())
  return settings
}

/** Fullscreen transparent layer with widgets, toggled by the overlay hotkey. */
export function toggleOverlay(): void {
  if (overlay && !overlay.isDestroyed()) {
    if (overlay.isVisible()) { overlay.hide(); return }
  } else {
    const area = screen.getPrimaryDisplay().bounds
    overlay = new BrowserWindow({ ...common, ...area, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false, title: 'All-In-One CRIPS – Overlay' })
    overlay.setAlwaysOnTop(true, 'screen-saver')
    load(overlay, 'overlay')
    overlay.once('ready-to-show', () => { overlay?.show(); overlay?.focus() })
    return
  }
  overlay.show()
  overlay.focus()
}

export function hideOverlay(): void {
  if (overlay && !overlay.isDestroyed()) overlay.hide()
}

export function allWindows(): BrowserWindow[] {
  return [panel, settings, overlay, guide, tree, gear, editor, trades, stashWin, omniWin].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())
}
