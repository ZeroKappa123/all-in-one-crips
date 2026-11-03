import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

const PANEL_WIDTH = 460

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
    focusable: false, title: 'Assay Guide'
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
  tree = new BrowserWindow({ ...common, ...area, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false, title: 'Assay Tree' })
  tree.setAlwaysOnTop(true, 'screen-saver')
  load(tree, 'tree')
  tree.once('ready-to-show', () => { tree?.show(); tree?.focus() })
}

export function hideTreeOverlay(): void {
  if (tree && !tree.isDestroyed()) tree.hide()
}

export function openGearWindow(): void {
  if (gear && !gear.isDestroyed()) { gear.show(); gear.focus(); return }
  gear = new BrowserWindow({ ...common, width: 420, height: 520, title: 'Assay – Gear tracker', autoHideMenuBar: true, alwaysOnTop: true, backgroundColor: '#0e1014' })
  load(gear, 'gear')
  gear.once('ready-to-show', () => gear?.show())
}

export function openEditor(slot: number): void {
  if (editor && !editor.isDestroyed()) editor.close()
  editor = new BrowserWindow({ ...common, width: 980, height: 720, title: 'Assay – Guide editor', autoHideMenuBar: true, backgroundColor: '#0e1014' })
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
    title: 'Assay'
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
  settings = new BrowserWindow({ ...common, width: 720, height: 600, minWidth: 560, minHeight: 420, title: 'Assay – Settings', autoHideMenuBar: true, backgroundColor: '#0e1014' })
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
    overlay = new BrowserWindow({ ...common, ...area, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false, title: 'Assay Overlay' })
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
  return [panel, settings, overlay, guide, tree, gear, editor].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())
}
