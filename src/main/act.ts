import { app, clipboard, dialog, ipcMain, Notification } from 'electron'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { parseRoute, type Page } from '@shared/act/route'
import { onAreaEntered, jumpToArea, step, clampState } from '@shared/act/guide'
import { applyEvent, type LogEvent, type LogSnapshot } from '@shared/act/log'
import { csvRow, CSV_HEADER, enterArea, newTimer, tick, toggle } from '@shared/act/timer'
import { classifyImport, codeToBytes, parsePobXml } from '@shared/act/pob'
import { AREAS, DEFAULT_ROUTE } from '@shared/act/data'
import { type ActLive, type ActStore, type Slot, defaultActStore, loadActStore, newSlot } from '@shared/act/state'
import { dataDir } from './configStore'
import { LogWatcher } from './logWatcher'
import { log } from './log'
import { lastInputAt, hookActive, pasteIntoSearch } from './input'
import { allWindows, getGuideWindow, setGuideInteractive, openTreeOverlay, openGearWindow, openEditor, toggleGuideWindow } from './windows'
import { vendorSearchStrings } from '@shared/act/gems'
import { GEMS } from '@shared/act/data'
import { buildGems } from '@shared/act/pob'
import { resolveGem } from '@shared/act/gems'

const file = () => join(dataDir(), 'act.json')
let store: ActStore = defaultActStore()
const live: ActLive = { logStatus: 'searching', logPath: null, areaId: null, areaLevel: null, levels: {}, afk: false, idle: false, lastWhisper: null }
let watcher: LogWatcher | null = null
let pagesCache: { key: string; pages: Page[] } | null = null
let searchPart = 0
const notifiedGear = new Set<string>()

export function lastWhisper(): string | null {
  return live.lastWhisper
}

function save(): void {
  mkdirSync(dataDir(), { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(store))
  renameSync(tmp, file())
}

let broadcastPending = false
function broadcast(): void {
  if (broadcastPending) return
  broadcastPending = true
  setTimeout(() => {
    broadcastPending = false
    for (const w of allWindows()) w.webContents.send('act:state', { store, live })
  }, 30)
}

function slot(): Slot {
  return store.slots[store.activeSlot] ?? store.slots[0]!
}

export function pages(): Page[] {
  const s = slot()
  const key = JSON.stringify([s.id, s.guide?.length, s.guide?.slice(0, 64), s.options])
  if (pagesCache?.key !== key) pagesCache = { key, pages: parseRoute(s.guide ?? DEFAULT_ROUTE, s.options, AREAS).pages }
  return pagesCache.pages
}

function setPage(page: number): void {
  slot().page = clampState(pages(), { page }).page
  save()
  broadcast()
}

function onEvents(events: LogEvent[], initial: boolean): void {
  let changed = false
  for (const e of events) {
    const snap: LogSnapshot = { areaId: live.areaId, areaLevel: live.areaLevel, levels: live.levels, lastWhisper: live.lastWhisper }
    applyEvent(snap, e)
    Object.assign(live, snap)
    if (e.kind === 'afk') live.afk = e.on
    if (e.kind === 'area' && !initial) {
      live.afk = false
      const s = slot()
      s.page = onAreaEntered(pages(), { page: s.page }, e.id).page
      const r = enterArea(store.timer, e.id, AREAS[e.id]?.a)
      store.timer = r.state
      if (r.finishedNow) writeRun()
      changed = true
    }
    if (e.kind === 'levelUp' && !initial) checkGear(e.character, e.level)
  }
  if (changed) save()
  broadcast()
}

function checkGear(character: string, level: number): void {
  if (!slot().character || character !== slot().character) return
  const ready = store.gear.filter(g => g.level <= level && !notifiedGear.has(g.id))
  if (!ready.length) return
  for (const g of ready) notifiedGear.add(g.id)
  if (Notification.isSupported()) new Notification({ title: 'Gear ready', body: ready.map(g => g.name).join(', ') }).show()
}

function writeRun(): void {
  const dir = join(dataDir(), 'export')
  mkdirSync(dir, { recursive: true })
  const csv = join(dir, 'campaign runs.csv')
  try {
    if (!existsSync(csv)) writeFileSync(csv, CSV_HEADER + '\n')
    appendFileSync(csv, csvRow(store.timer) + '\n')
  } catch (e) {
    log('warn', `could not write run log: ${String(e)}`) // e.g. file open in Excel
  }
}

function startWatcher(): void {
  watcher?.stop()
  watcher = new LogWatcher(onEvents)
  live.logStatus = watcher.start(store.logPath)
  live.logPath = watcher.path
  broadcast()
}

let lastTick = Date.now()
function timerTick(): void {
  const now = Date.now()
  const delta = now - lastTick
  lastTick = now
  live.idle = hookActive() && now - lastInputAt() > 10_000
  const inHideout = !!live.areaId && /hideout/i.test(live.areaId)
  const counting = !live.afk && !live.idle && !(store.timerHideoutPause && inHideout)
  const before = store.timer.totalMs
  store.timer = tick(store.timer, delta, counting)
  if (store.timer.totalMs !== before) {
    if (Math.floor(store.timer.totalMs / 1000) % 5 === 0) save()
    broadcast()
  }
}

async function importInto(index: number, text: string): Promise<{ ok: boolean; message: string }> {
  const s = store.slots[index]
  if (!s) return { ok: false, message: 'No such guide slot.' }
  const kind = classifyImport(text)
  if (!kind) return { ok: false, message: "That's neither a Path of Building code, a pobb.in link nor a guide." }
  if (kind.kind === 'guide') {
    const r = parseRoute(kind.text, s.options, AREAS)
    if (!r.pages.length) return { ok: false, message: 'The guide has no steps.' }
    s.guide = kind.text
    s.page = 0
    save(); broadcast()
    return { ok: true, message: `Guide imported: ${r.pages.length} pages${r.unknownAreas.length ? `, ${r.unknownAreas.length} unknown areas` : ''}.` }
  }
  let code: string
  if (kind.kind === 'pobbin') {
    try {
      if (process.env.CRIPS_FIXTURES) code = readFileSync(join(process.env.CRIPS_FIXTURES, 'pob-code.txt'), 'utf8')
      else {
        const res = await fetch(`https://pobb.in/${encodeURIComponent(kind.id)}/raw`, { headers: { 'User-Agent': 'All-In-One-CRIPS/1.0.0' }, signal: AbortSignal.timeout(10_000) })
        if (!res.ok) return { ok: false, message: `pobb.in answered ${res.status}.` }
        code = await res.text()
      }
    } catch (e) {
      return { ok: false, message: "Couldn't reach pobb.in." }
    }
  } else code = kind.code
  try {
    const build = parsePobXml(inflateSync(codeToBytes(code)).toString('utf8'))
    s.pob = build
    // the wiki's behaviour: importing a build adds its gems to the gear tracker
    for (const g of buildGems(build)) {
      const id = resolveGem(g, GEMS)
      const info = id ? GEMS[id] : undefined
      if (info && !store.gear.some(x => x.kind === 'gem' && x.name === info.n)) {
        store.gear.push({ id: `gem-${id}`, name: info.n, level: info.l, kind: 'gem' })
      }
    }
    save(); broadcast()
    return { ok: true, message: `Build imported: ${build.className}${build.ascendancy ? ` (${build.ascendancy})` : ''}, ${build.specs.length} trees.` }
  } catch (e) {
    log('warn', `pob import failed: ${String(e)}`)
    return { ok: false, message: "Couldn't read that Path of Building code." }
  }
}

function currentSearchStrings(): string[] {
  const b = slot().pob
  if (!b) return []
  const names = buildGems(b).map(g => { const id = resolveGem(g, GEMS); return id ? GEMS[id]!.n : null }).filter((n): n is string => !!n)
  return vendorSearchStrings(names)
}

export function onActHotkey(action: 'guideToggle' | 'guidePrev' | 'guideNext' | 'treeOverlay' | 'gemSearch'): void {
  if (action === 'guideToggle') { store.overlay.visible = !store.overlay.visible; save(); toggleGuideWindow(store.overlay.visible); broadcast() }
  else if (action === 'guidePrev') setPage(slot().page - 1)
  else if (action === 'guideNext') setPage(slot().page + 1)
  else if (action === 'treeOverlay') openTreeOverlay()
  else if (action === 'gemSearch') {
    const parts = currentSearchStrings()
    if (!parts.length) return
    const text = parts[searchPart % parts.length]!
    searchPart++
    void pasteIntoSearch(text)
  }
}

export function initAct(): void {
  try {
    if (existsSync(file())) store = loadActStore(JSON.parse(readFileSync(file(), 'utf8')))
  } catch (e) {
    log('warn', `act.json unreadable, starting fresh: ${String(e)}`)
  }
  // A new session starts with the timer paused, as players expect after a restart.
  store.timer = { ...store.timer, running: false }
  if (!store.timer.actMs) store.timer = newTimer()

  ipcMain.handle('act:get', () => ({ store, live }))
  ipcMain.handle('act:update', (_e, patch: Partial<ActStore>) => {
    const logChanged = 'logPath' in patch && patch.logPath !== store.logPath
    store = { ...store, ...patch }
    save(); broadcast()
    if (logChanged) startWatcher()
    if ('overlay' in patch) toggleGuideWindow(store.overlay.visible && store.enabled)
    if ('enabled' in patch) toggleGuideWindow(store.overlay.visible && store.enabled)
    return store
  })
  ipcMain.handle('act:slot:update', (_e, index: number, patch: Partial<Slot>) => {
    const s = store.slots[index]
    if (!s) return store
    store.slots[index] = { ...s, ...patch }
    pagesCache = null
    save(); broadcast()
    return store
  })
  ipcMain.handle('act:slot:add', () => { store.slots.push(newSlot(store.slots.length + 1)); store.activeSlot = store.slots.length - 1; save(); broadcast(); return store })
  ipcMain.handle('act:slot:remove', (_e, index: number) => {
    if (store.slots.length <= 1) return store
    store.slots.splice(index, 1)
    store.activeSlot = Math.min(store.activeSlot, store.slots.length - 1)
    pagesCache = null
    save(); broadcast()
    return store
  })
  ipcMain.handle('act:page', (_e, cmd: 'prev' | 'next' | 'reset' | 'jump') => {
    const s = slot()
    if (cmd === 'reset') setPage(0)
    else if (cmd === 'jump' && live.areaId) setPage(jumpToArea(pages(), { page: s.page }, live.areaId).page)
    else if (cmd === 'prev' || cmd === 'next') setPage(step(pages(), { page: s.page }, cmd === 'next' ? 1 : -1).page)
  })
  ipcMain.handle('act:timer', (_e, cmd: 'toggle' | 'reset') => {
    store.timer = cmd === 'reset' ? newTimer() : toggle(store.timer, Date.now())
    if (cmd === 'reset') slot().page = 0
    save(); broadcast()
  })
  ipcMain.handle('act:import', (_e, index: number, text?: string) => importInto(index, text ?? clipboard.readText()))
  ipcMain.handle('act:export', (_e, index: number) => {
    const s = store.slots[index]
    const text = s?.guide ?? DEFAULT_ROUTE
    clipboard.writeText(text)
    return text
  })
  ipcMain.handle('act:logpath:pick', async () => {
    const r = await dialog.showOpenDialog({ title: 'Find Client.txt', properties: ['openFile'], filters: [{ name: 'Client.txt', extensions: ['txt'] }] })
    if (r.canceled || !r.filePaths[0]) return store
    store.logPath = r.filePaths[0]
    save(); startWatcher()
    return store
  })
  ipcMain.handle('act:gear:add', (_e, g: { name: string; level: number; kind: 'item' | 'gem' }) => {
    if (!store.gear.some(x => x.name === g.name && x.kind === g.kind)) store.gear.push({ ...g, id: `${g.kind}-${Date.now().toString(36)}` })
    save(); broadcast()
    return store
  })
  ipcMain.handle('act:gear:remove', (_e, id: string) => { store.gear = store.gear.filter(g => g.id !== id); save(); broadcast(); return store })
  ipcMain.handle('act:treeimg:add', async () => {
    const r = await dialog.showOpenDialog({ title: 'Add tree screenshots', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
    if (r.canceled) return store
    const dir = join(dataDir(), 'tree-images')
    mkdirSync(dir, { recursive: true })
    for (const p of r.filePaths) {
      const name = `${Date.now().toString(36)}-${store.treeImages.length}${extname(p).toLowerCase()}`
      copyFileSync(p, join(dir, name))
      store.treeImages.push({ file: name, caption: '' })
    }
    save(); broadcast()
    return store
  })
  ipcMain.handle('act:treeimg:get', (_e, index: number) => {
    const img = store.treeImages[index]
    if (!img) return null
    const p = join(dataDir(), 'tree-images', img.file)
    if (!existsSync(p)) return null
    const mime = img.file.endsWith('.png') ? 'image/png' : img.file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${readFileSync(p).toString('base64')}`
  })
  ipcMain.handle('act:searchStrings', () => currentSearchStrings())
  ipcMain.on('act:interactive', (_e, on: boolean) => setGuideInteractive(on))
  ipcMain.on('act:open', (_e, what: 'tree' | 'gear' | 'editor', arg?: number) => {
    if (what === 'tree') openTreeOverlay()
    else if (what === 'gear') openGearWindow()
    else openEditor(arg ?? store.activeSlot)
  })

  startWatcher()
  setInterval(timerTick, 1000)
  if (store.enabled && store.overlay.visible) getGuideWindow(store.overlay)
  app.on('before-quit', () => save())
}

export function guideOverlayMoved(x: number, y: number): void {
  store.overlay = { ...store.overlay, x, y }
  save()
}
