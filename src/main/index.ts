import { app, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'node:path'
import type { Config } from '@shared/config'
import { expandChatCommand } from '@shared/config'
import type { SearchBody } from '@shared/trade/query'
import type { ParsedItem } from '@shared/types'
import { overviewTypeFor } from '@shared/prices/ninja'
import { getConfig, setConfig, wasRepaired, dataDir } from './configStore'
import { aggregatorPrice, fetchListings, getLeagues, getStats, search, TradeError } from './tradeClient'
import { sendChat, startInput, stopInput, updateInputConfig } from './input'
import { allWindows, getPanel, hideOverlay, hidePanel, openSettings, resizePanel, showPanelAtCursor, toggleOverlay, resizeGuide, setGuideMovedHandler, hideTreeOverlay, openTreeOverlay, openGearWindow, openEditor } from './windows'
import { initAct, onActHotkey, lastWhisper as actLastWhisper, guideOverlayMoved } from './act'
import { getLogs, log } from './log'

let tray: Tray | null = null
let inputMode: 'hook' | 'fallback' = 'fallback'

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => openSettings())

// Transparent windows need the compositor; some Linux setups render them black on the GPU path.
if (process.platform === 'linux' && process.env.ASSAY_DISABLE_GPU !== '0') app.disableHardwareAcceleration()

const ALLOWED_EXTERNAL = [/^https:\/\/www\.pathofexile\.com\/trade\//, /^https:\/\/www\.poewiki\.net\/wiki\//]

function wrap<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: { kind: string; detail?: string; retryInSec?: number } }> {
  return fn().then(
    data => ({ ok: true as const, data }),
    (e: unknown) => {
      if (e instanceof TradeError) return { ok: false as const, error: { kind: e.kind, detail: e.message, retryInSec: e.retryInSec } }
      log('error', String(e))
      return { ok: false as const, error: { kind: 'network', detail: String(e) } }
    }
  )
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => ({ config: getConfig(), repaired: wasRepaired(), inputMode, dataDir: dataDir() }))
  ipcMain.handle('config:set', (_e, patch: Partial<Config>) => {
    const next = setConfig(patch)
    updateInputConfig(next)
    for (const w of allWindows()) w.webContents.send('config:changed', next)
    return next
  })
  ipcMain.handle('data:stats', () => wrap(getStats))
  ipcMain.handle('data:leagues', () => wrap(getLeagues))
  ipcMain.handle('trade:search', (_e, league: string, body: SearchBody) => wrap(() => search(league, body)))
  ipcMain.handle('trade:fetch', (_e, id: string, ids: string[]) => wrap(() => fetchListings(id, ids)))
  ipcMain.handle('prices:aggregate', (_e, item: ParsedItem) => wrap(async () => {
    const t = overviewTypeFor(item)
    if (!t) return null
    const c = getConfig()
    return aggregatorPrice(c.ninjaBase, c.leagueId, item, t.kind, t.type)
  }))
  ipcMain.handle('logs:get', () => getLogs())
  ipcMain.on('panel:hide', () => hidePanel())
  ipcMain.on('panel:resize', (_e, h: number) => resizePanel(h))
  ipcMain.on('guide:resize', (_e, h: number) => resizeGuide(h))
  ipcMain.on('tree:hide', () => hideTreeOverlay())
  ipcMain.on('overlay:hide', () => hideOverlay())
  ipcMain.on('settings:open', () => openSettings())
  ipcMain.on('shell:open', (_e, url: string) => {
    if (ALLOWED_EXTERNAL.some(re => re.test(url))) void shell.openExternal(url)
    else log('warn', `blocked external url ${url}`)
  })
  ipcMain.on('app:quit', () => app.quit())
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Assay')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Settings', click: () => openSettings() },
    { label: 'Open data folder', click: () => void shell.openPath(dataDir()) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
  tray.on('click', () => openSettings())
}

app.whenReady().then(() => {
  registerIpc()
  const config = getConfig()
  setGuideMovedHandler(guideOverlayMoved)
  initAct()
  createTray()
  getPanel() // load early so the first check is instant
  inputMode = startInput(config, {
    onAction(action, ctx) {
      if (action === 'overlay') { toggleOverlay(); return }
      if (action === 'guideToggle' || action === 'guidePrev' || action === 'guideNext' || action === 'treeOverlay' || action === 'gemSearch') { onActHotkey(action); return }
      if (action === 'wiki') {
        if (!ctx.itemText) return
        const lines = ctx.itemText.split(/\r?\n/)
        const rarityIdx = lines.findIndex(l => l.startsWith('Rarity: '))
        const name = lines[rarityIdx + 1]?.trim()
        if (name) void shell.openExternal(`https://www.poewiki.net/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`)
        return
      }
      const win = showPanelAtCursor()
      win.webContents.send('item:checked', { text: ctx.itemText ?? '', locked: action === 'priceCheckLocked' })
    },
    onChat(i) {
      const cmd = getConfig().chatCommands[i]
      if (!cmd) return
      const msg = expandChatCommand(cmd.text, actLastWhisper())
      if (msg) void sendChat(msg)
    }
  })
  log('info', `ready, input mode ${inputMode}`)
  if (process.env.ASSAY_OPEN === 'panel') {
    // Used by end-to-end tests: show the panel with a canned item.
    const win = showPanelAtCursor()
    const send = () => setTimeout(() => win.webContents.send('item:checked', { text: process.env.ASSAY_ITEM ?? '', locked: true }), 300)
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  }
  if (process.env.ASSAY_OPEN === 'settings') openSettings()
  if (process.env.ASSAY_OPEN === 'overlay') toggleOverlay()
  if (process.env.ASSAY_OPEN === 'tree') openTreeOverlay()
  if (process.env.ASSAY_OPEN === 'gear') openGearWindow()
  if (process.env.ASSAY_OPEN === 'editor') openEditor(0)
})

app.on('window-all-closed', () => { /* stay in tray */ })
app.on('will-quit', () => stopInput())
