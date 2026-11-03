import { app, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildIndexes } from '@shared/dataIndex'
import { dataDir, getConfig } from './configStore'
import { allWindows } from './windows'
import { log } from './log'

/**
 * Keeps the game data (items and mods) current without a new app version: after a patch,
 * Awakened PoE Trade publishes new data files in its public repository (MIT). The app downloads
 * them, checks them, and only then uses them. Anything that fails falls back to the shipped data.
 */
const REPO = 'SnosMe/awakened-poe-trade'
const DATA_PATH = 'renderer/public/data'
const UA = 'All-In-One-CRIPS/1.0.0 (game data update)'
const EVERY_MS = 6 * 60 * 60 * 1000

interface Version { sha: string; date: string }
interface State { active: Version | null; rejected: string[]; lastCheck: string | null; lastError: string | null }
export interface DataStatus { bundled: Version | null; active: Version | null; lastCheck: string | null; lastError: string | null; checking: boolean }

const root = () => join(dataDir(), 'game-data')
const stateFile = () => join(root(), 'state.json')
let checking = false

function readState(): State {
  try { return JSON.parse(readFileSync(stateFile(), 'utf8')) as State } catch { return { active: null, rejected: [], lastCheck: null, lastError: null } }
}
function writeState(s: State): void {
  mkdirSync(root(), { recursive: true })
  writeFileSync(stateFile() + '.tmp', JSON.stringify(s, null, 2))
  renameSync(stateFile() + '.tmp', stateFile())
}

export function bundledRoot(): string {
  const packaged = join(process.resourcesPath ?? '', 'apt-data')
  if (app.isPackaged && existsSync(packaged)) return packaged
  return join(__dirname, '..', '..', 'resources', 'apt-data')
}

function bundledVersion(): Version | null {
  try { return JSON.parse(readFileSync(join(bundledRoot(), 'VERSION.json'), 'utf8')) as Version } catch { return null }
}

/** Folder the parser reads from: a validated download if there is one, else the shipped data. */
export function activeDataRoot(): string {
  const s = readState()
  if (s.active && !s.rejected.includes(s.active.sha)) {
    const dir = join(root(), s.active.sha)
    if (existsSync(join(dir, 'en', 'stats.ndjson'))) return dir
  }
  return bundledRoot()
}

export function dataStatus(): DataStatus {
  const s = readState()
  return { bundled: bundledVersion(), active: s.active && !s.rejected.includes(s.active.sha) ? s.active : null, lastCheck: s.lastCheck, lastError: s.lastError, checking }
}

async function get(url: string, kind: 'json' | 'text'): Promise<unknown> {
  const fx = process.env.CRIPS_FIXTURES
  if (fx) {
    // tests: the "latest commit" is a fixture, the files are the shipped ones
    if (url.includes('api.github.com')) return JSON.parse(readFileSync(join(fx, 'apt-gh-commits.json'), 'utf8'))
    const rel = url.split(`/${DATA_PATH}/`)[1]!
    return readFileSync(join(bundledRoot(), rel), 'utf8')
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: kind === 'json' ? 'application/vnd.github+json' : '*/*' }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return kind === 'json' ? res.json() : res.text()
}

function notify(): void {
  for (const w of allWindows()) w.webContents.send('data:changed', dataStatus())
}

/** Looks for newer data; downloads, checks and activates it. Returns what happened. */
export async function checkForData(): Promise<'updated' | 'current' | 'failed'> {
  if (checking) return 'current'
  checking = true
  notify()
  const s = readState()
  try {
    const commits = await get(`https://api.github.com/repos/${REPO}/commits?path=${DATA_PATH}/en&per_page=1`, 'json') as Array<{ sha: string; commit: { committer: { date: string } } }>
    const latest = commits[0]
    if (!latest) throw new Error('no data versions listed')
    const version = { sha: latest.sha, date: latest.commit.committer.date }
    s.lastCheck = new Date().toISOString()
    const current = s.active?.sha ?? bundledVersion()?.sha
    if (version.sha === current || s.rejected.includes(version.sha)) { s.lastError = null; writeState(s); return 'current' }
    if (bundledVersion() && new Date(version.date) <= new Date(bundledVersion()!.date)) { s.lastError = null; writeState(s); return 'current' }

    const raw = (p: string) => `https://raw.githubusercontent.com/${REPO}/${version.sha}/${DATA_PATH}/${p}`
    const [stats, items, drop] = await Promise.all([
      get(raw('en/stats.ndjson'), 'text') as Promise<string>,
      get(raw('en/items.ndjson'), 'text') as Promise<string>,
      get(raw('item-drop.json'), 'text') as Promise<string>
    ])
    // Checks before use: every line readable, the drop table is JSON, and nothing shrank suspiciously.
    const idx = buildIndexes(stats, items)
    JSON.parse(drop)
    const shipped = buildIndexes(readFileSync(join(bundledRoot(), 'en', 'stats.ndjson'), 'utf8'), readFileSync(join(bundledRoot(), 'en', 'items.ndjson'), 'utf8')).counts
    if (idx.counts.stats < shipped.stats * 0.9 || idx.counts.items < shipped.items * 0.9) throw new Error('new data has far fewer entries than expected')

    const dir = join(root(), version.sha), tmp = dir + '.part'
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(join(tmp, 'en'), { recursive: true })
    writeFileSync(join(tmp, 'en', 'stats.ndjson'), stats)
    writeFileSync(join(tmp, 'en', 'items.ndjson'), items)
    writeFileSync(join(tmp, 'item-drop.json'), drop)
    writeFileSync(join(tmp, 'en', 'stats-ref.index.bin'), idx.statsRef)
    writeFileSync(join(tmp, 'en', 'stats-matcher.index.bin'), idx.statsMatcher)
    writeFileSync(join(tmp, 'en', 'items-name.index.bin'), idx.itemsName)
    writeFileSync(join(tmp, 'en', 'items-ref.index.bin'), idx.itemsRef)
    rmSync(dir, { recursive: true, force: true })
    renameSync(tmp, dir)
    const old = s.active?.sha
    s.active = version
    s.lastError = null
    writeState(s)
    if (old && old !== version.sha) rmSync(join(root(), old), { recursive: true, force: true })
    log('info', `game data updated to ${version.sha.slice(0, 7)} (${version.date})`)
    return 'updated'
  } catch (e) {
    s.lastError = String(e instanceof Error ? e.message : e)
    s.lastCheck = new Date().toISOString()
    writeState(s)
    log('warn', `game data update failed: ${s.lastError}`)
    return 'failed'
  } finally {
    checking = false
    notify()
  }
}

/** The renderer could not start the parser with the downloaded data: never use that version again. */
export function rejectActive(reason: string): void {
  const s = readState()
  if (!s.active) return
  log('warn', `downloaded game data ${s.active.sha.slice(0, 7)} rejected: ${reason}; using the shipped data`)
  s.rejected.push(s.active.sha)
  s.active = null
  s.lastError = `Downloaded data didn't work (${reason}); using the shipped data.`
  writeState(s)
  notify()
}

export function initDataUpdates(): void {
  ipcMain.handle('data:status', () => dataStatus())
  ipcMain.handle('data:check', () => checkForData())
  ipcMain.on('data:failed', (_e, reason: string) => rejectActive(reason))
  const auto = () => { if (getConfig().dataUpdates.auto) void checkForData() }
  setTimeout(auto, process.env.CRIPS_FIXTURES ? 60_000 : 10_000) // tests trigger checks themselves
  setInterval(auto, EVERY_MS)
}
