import { app, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'node:path'
import type { Config } from '@shared/config'
import { expandChatCommand } from '@shared/config'
import { getConfig, setConfig, wasRepaired, dataDir, migrateOldData } from './configStore'
import { registerProxyIpc } from './proxy'
import { sendChat, setActionGate, startInput, stopInput, updateInputConfig } from './input'
import { onWidescreenChange, registerWidescreenIpc, setWide, startWidescreen, status as widescreenStatus, stopWidescreen, widescreenAction } from './widescreen'
import { gameWindowApi } from './gameWindow'
import { applyTheme, allWindows, getTradesWindow, setTradesInteractive, resizeTrades, setTradesMovedHandler, calibrateStash, hideStash, getPanel, hideOverlay, hidePanel, openSettings, resizePanel, showPanelAtCursor, toggleOverlay, resizeGuide, setGuideMovedHandler, hideTreeOverlay, openTreeOverlay, openGearWindow, openEditor } from './windows'
import { initTrades } from './trades'
import { initAct, onActHotkey, lastWhisper as actLastWhisper, guideOverlayMoved } from './act'
import { getLogs, log } from './log'

let tray: Tray | null = null
let inputMode: 'hook' | 'fallback' = 'fallback'

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => openSettings())

// Transparent windows need the compositor; some Linux setups render them black on the GPU path.
if (process.platform === 'linux' && process.env.CRIPS_DISABLE_GPU !== '0') app.disableHardwareAcceleration()

const ALLOWED_EXTERNAL = [/^https:\/\/www\.pathofexile\.com\/trade\//, /^https:\/\/www\.poewiki\.net\/wiki\//, /^https:\/\/poe\.ninja\//]

function registerIpc(): void {
  ipcMain.handle('config:get', () => ({ config: getConfig(), repaired: wasRepaired(), inputMode, dataDir: dataDir() }))
  ipcMain.handle('config:set', (_e, patch: Partial<Config>) => {
    const next = setConfig(patch)
    updateInputConfig(next)
    if ('widescreen' in patch) { startWidescreen(); tray?.setContextMenu(trayMenu()) }
    if ('theme' in patch) applyTheme()
    for (const w of allWindows()) w.webContents.send('config:changed', next)
    return next
  })
  registerProxyIpc()
  registerWidescreenIpc()
  ipcMain.handle('logs:get', () => getLogs())
  ipcMain.on('panel:hide', () => hidePanel())
  ipcMain.on('panel:resize', (_e, h: number) => resizePanel(h))
  ipcMain.on('guide:resize', (_e, h: number) => resizeGuide(h))
  ipcMain.on('tree:hide', () => hideTreeOverlay())
  ipcMain.on('trades:interactive', (_e, on: boolean) => setTradesInteractive(on))
  ipcMain.on('trades:resize', (_e, h: number) => resizeTrades(h))
  ipcMain.on('trades:show', () => getTradesWindow(true))
  ipcMain.on('stash:calibrate', (_e, on: boolean) => calibrateStash(on))
  ipcMain.on('stash:hide', () => hideStash())
  ipcMain.on('overlay:hide', () => hideOverlay())
  ipcMain.on('settings:open', () => openSettings())
  ipcMain.on('shell:open', (_e, url: string) => {
    if (ALLOWED_EXTERNAL.some(re => re.test(url))) void shell.openExternal(url)
    else log('warn', `blocked external url ${url}`)
  })
  ipcMain.on('app:quit', () => app.quit())
}

function trayMenu(): Menu {
  const ws = widescreenStatus()
  return Menu.buildFromTemplate([
    { label: 'Widescreen', type: 'checkbox', checked: ws.enabled && ws.wide, enabled: ws.supported, toolTip: ws.supported ? undefined : 'Windows only', click: item => { setWide(item.checked) } },
    { type: 'separator' },
    { label: 'Settings', click: () => openSettings() },
    { label: 'Open data folder', click: () => void shell.openPath(dataDir()) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
}

/** Every change to widescreen (tray, overlay, hotkey, settings) refreshes the menu and all windows. */
function widescreenChanged(): void {
  tray?.setContextMenu(trayMenu())
  for (const w of allWindows()) w.webContents.send('config:changed', getConfig())
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('All-In-One CRIPS')
  tray.setContextMenu(trayMenu())
  tray.on('click', () => openSettings())
}

app.setName('All-In-One CRIPS')

app.whenReady().then(() => {
  migrateOldData()
  registerIpc()
  const config = getConfig()
  applyTheme()
  setGuideMovedHandler(guideOverlayMoved)
  initAct()
  initTrades()
  setTradesMovedHandler((x, y) => setConfig({ trades: { ...getConfig().trades, position: { x, y } } }))
  getTradesWindow()
  onWidescreenChange(widescreenChanged)
  setActionGate(a => !a.startsWith('wide') || (getConfig().widescreen.enabled && !!gameWindowApi()))
  createTray()
  startWidescreen()
  getPanel() // load early so the first check is instant
  inputMode = startInput(config, {
    onAction(action, ctx) {
      if (action === 'overlay') { toggleOverlay(); return }
      if (action === 'wideToggle' || action === 'wideUp' || action === 'wideDown' || action === 'wideUpFine' || action === 'wideDownFine') { widescreenAction(action); return }
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
  if (process.env.CRIPS_OPEN === 'panel') {
    // Used by end-to-end tests: show the panel with a canned item.
    const win = showPanelAtCursor()
    const send = () => setTimeout(() => win.webContents.send('item:checked', { text: process.env.CRIPS_ITEM ?? '', locked: true }), 300)
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  }
  if (process.env.CRIPS_OPEN === 'settings') openSettings()
  if (process.env.CRIPS_OPEN === 'overlay') toggleOverlay()
  if (process.env.CRIPS_OPEN === 'tree') openTreeOverlay()
  if (process.env.CRIPS_OPEN === 'gear') openGearWindow()
  if (process.env.CRIPS_OPEN === 'editor') openEditor(0)
  if (process.env.CRIPS_OPEN === 'stash') calibrateStash(true)
})

app.on('window-all-closed', () => { /* stay in tray */ })
app.on('will-quit', () => { stopInput(); stopWidescreen() })
