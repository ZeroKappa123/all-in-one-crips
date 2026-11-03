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
  return [panel, settings, overlay].filter((w): w is BrowserWindow => !!w && !w.isDestroyed())
}
