import { ipcMain, screen } from 'electron'
import { getConfig } from './configStore'
import { omniContext } from './act'
import { pasteIntoSearch, setMouseHandler } from './input'
import { getOmniWindow, hideOmni, omniBounds, resizeOmni, showOmniAt } from './windows'
import { vendorSearchStrings } from '@shared/act/plan'
import { combineItemSearches } from '@shared/omni'

/**
 * Omni key, after Exile-UI: hold a mouse button (middle by default) for a moment at a vendor and
 * a small menu opens at the cursor with search strings – the gems this guide page buys, every gem
 * of the build, and item searches for levelling. A click puts one into the shop's search box.
 * That is one local action per click (Ctrl+F and paste); nothing is bought or sent to the server.
 */
export interface OmniEntry { id: string; label: string; kind: 'gems' | 'items'; parts: string[] }
export interface OmniMenu { entries: OmniEntry[]; noBuild: boolean }

const HOLD_MS = 200
const BUTTON: Record<string, number> = { middle: 3, mouse4: 4, mouse5: 5 }
let holdTimer: ReturnType<typeof setTimeout> | null = null
let menu: OmniMenu = { entries: [], noBuild: false }

/** Two choices: the gems (this guide page's, else the whole build's) and the items. */
export function buildMenu(): OmniMenu {
  const ctx = omniContext()
  const entries: OmniEntry[] = []
  const gems = ctx.pageGems.length ? vendorSearchStrings(ctx.pageGems) : ctx.allGems
  if (gems.length) entries.push({ id: 'gems', label: ctx.pageGems.length ? 'page' : 'all', kind: 'gems', parts: gems })
  const items = combineItemSearches(getConfig().omni.strings.filter(s => s.enabled).map(s => s.regex))
  if (items.length) entries.push({ id: 'items', label: 'items', kind: 'items', parts: items })
  return { entries, noBuild: !ctx.hasBuild }
}

function open(): void {
  const cfg = getConfig().omni
  if (!cfg.anywhere && !omniContext().inTown) return
  menu = buildMenu()
  if (!menu.entries.length) return
  const w = getOmniWindow()
  const send = () => w.webContents.send('omni:menu', menu)
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send); else send()
  showOmniAt(screen.getCursorScreenPoint())
}

function onMouse(kind: 'down' | 'up', button: number): void {
  const cfg = getConfig().omni
  const ours = cfg.button !== 'off' && BUTTON[cfg.button] === button
  if (kind === 'down') {
    // a click anywhere outside the open menu closes it
    const b = omniBounds()
    if (b) {
      const p = screen.getCursorScreenPoint()
      const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height
      if (!inside) hideOmni()
    }
    if (ours) { if (holdTimer) clearTimeout(holdTimer); holdTimer = setTimeout(() => { holdTimer = null; open() }, HOLD_MS) }
  } else if (ours && holdTimer) { clearTimeout(holdTimer); holdTimer = null } // a short click stays a normal click in the game
}

export function initOmni(): void {
  setMouseHandler(onMouse)
  ipcMain.handle('omni:get', () => menu)
  ipcMain.on('omni:resize', (_e, h: number) => resizeOmni(h))
  ipcMain.on('omni:close', () => hideOmni())
  ipcMain.on('omni:pick', (_e, id: string, part: number) => {
    const text = menu.entries.find(e => e.id === id)?.parts[part]
    hideOmni()
    if (text) void pasteIntoSearch(text)
  })
  if (process.env.CRIPS_OMNI_DEMO) setTimeout(() => { menu = buildMenu(); const w = getOmniWindow(); w.webContents.once('did-finish-load', () => w.webContents.send('omni:menu', menu)); showOmniAt({ x: 200, y: 200 }) }, 300) // tests
}
