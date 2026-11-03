// Brings All-In-One CRIPS up to date after a Path of Exile patch, in one command:
//
//   npm run update            game data + price-check code + act data, checks, Windows ZIP
//   npm run update -- --data-only   only the data (no code from Awakened PoE Trade)
//   npm run update -- --no-zip      skip building the ZIP at the end
//
// Needs only Node and internet (no git, no GitHub account): everything is read from the public
// repositories of Awakened PoE Trade (MIT), exile-leveling (MIT) and GGG's skill tree export.
// Every step is checked (typecheck + tests). If a step breaks something, its files are put back
// and the report says so; the rest of the update is kept.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeIndexFiles } from './make-index-files.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const UA = 'All-In-One-CRIPS-update-script'
const report = []
const say = (msg) => { console.log(msg); report.push(msg) }

const REPOS = {
  apt: { name: 'SnosMe/awakened-poe-trade', branch: 'master' },
  leveling: { name: 'HeartofPhos/exile-leveling', branch: 'main' },
  tree: { name: 'grindinggear/skilltree-export', branch: 'master' }
}

// ---------- download helpers ----------
async function get (url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.text()
    } catch (e) {
      if (i >= tries) throw new Error(`download failed: ${url} (${e.message})`)
      await new Promise(r => setTimeout(r, 1500 * i))
    }
  }
}
const lf = (s) => s.replace(/\r\n/g, '\n')

/** The newest commit of a repository (or of one folder in it); falls back to the branch name. */
async function latest (repo, path) {
  const q = path ? `?path=${encodeURIComponent(path)}&per_page=1` : '?per_page=1'
  try {
    const list = JSON.parse(await get(`https://api.github.com/repos/${repo.name}/commits${q}`, 1) ?? '[]')
    if (list[0]) return { sha: list[0].sha, date: list[0].commit.committer.date }
  } catch { /* GitHub's API has an hourly limit; the files themselves are still reachable */ }
  return { sha: repo.branch, date: new Date().toISOString() }
}
async function raw (repo, ref, path, required = true) {
  const text = await get(`https://raw.githubusercontent.com/${repo.name}/${ref}/${path}`)
  if (text === null && required) throw new Error(`missing upstream file: ${repo.name}/${path}`)
  return text === null ? null : lf(text)
}

// ---------- safety net ----------
const BACKUP = join(ROOT, '.update-backup')
function backup (step, files) {
  const dir = join(BACKUP, step)
  rmSync(dir, { recursive: true, force: true })
  for (const f of files) {
    const src = join(ROOT, f)
    if (!existsSync(src)) continue
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    cpSync(src, join(dir, f))
  }
  return () => {
    for (const f of files) if (existsSync(join(dir, f))) cpSync(join(dir, f), join(ROOT, f))
  }
}
function write (file, text) {
  const p = join(ROOT, file)
  const before = existsSync(p) ? readFileSync(p) : null
  const next = Buffer.from(text)
  if (before && before.equals(next)) return false
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, next)
  return true
}
function checks () {
  try {
    execSync('npx tsc --noEmit -p tsconfig.json', { cwd: ROOT, stdio: 'pipe' })
    execSync('npx vitest run', { cwd: ROOT, stdio: 'pipe' })
    return null
  } catch (e) {
    return lf(String(e.stdout ?? '') + String(e.stderr ?? '')).split('\n').filter(Boolean).slice(-25).join('\n')
  }
}

// ---------- step 1: game data (items, mods, client strings) ----------
const DATA_FILES = ['resources/apt-data/en/items.ndjson', 'resources/apt-data/en/stats.ndjson', 'resources/apt-data/item-drop.json',
  'resources/apt-data/VERSION.json', 'resources/apt-data/en/items-name.index.bin', 'resources/apt-data/en/items-ref.index.bin',
  'resources/apt-data/en/stats-ref.index.bin', 'resources/apt-data/en/stats-matcher.index.bin',
  'src/apt/assets/data/client_strings.en.js', 'src/apt/assets/data/app_i18n.en.json']
const ACT_DIR = 'src/shared/act/data'

async function gameData () {
  const v = await latest(REPOS.apt, 'renderer/public/data/en')
  const d = 'renderer/public/data'
  const [items, stats, drop, strings, i18n] = await Promise.all([
    raw(REPOS.apt, v.sha, `${d}/en/items.ndjson`), raw(REPOS.apt, v.sha, `${d}/en/stats.ndjson`), raw(REPOS.apt, v.sha, `${d}/item-drop.json`),
    raw(REPOS.apt, v.sha, `${d}/en/client_strings.js`), raw(REPOS.apt, v.sha, `${d}/en/app_i18n.json`)
  ])
  JSON.parse(drop); JSON.parse(i18n)
  const typed = strings.replace(/@type\{import\('[^']*interfaces'\)\.TranslationDict\}/, "@type{import('./interfaces').TranslationDict}")
  let changed = 0
  changed += write('resources/apt-data/en/items.ndjson', items)
  changed += write('resources/apt-data/en/stats.ndjson', stats)
  changed += write('resources/apt-data/item-drop.json', drop)
  changed += write('src/apt/assets/data/client_strings.en.js', typed)
  changed += write('src/apt/assets/data/app_i18n.en.json', i18n)
  if (changed) {
    makeIndexFiles()
    write('resources/apt-data/VERSION.json', JSON.stringify(v) + '\n')
  }
  return changed ? `Spieldaten aktualisiert (Stand ${v.date.slice(0, 10)}, ${count(items)} Items, ${count(stats)} Mods)` : 'Spieldaten: schon aktuell'
}
const count = (ndjson) => ndjson.split('\n').filter(l => l.trim()).length

// ---------- step 2: act tracker data ----------
async function actData () {
  const tmp = join(ROOT, '.update-cache')
  rmSync(tmp, { recursive: true, force: true })
  const el = join(tmp, 'exile-leveling'), st = join(tmp, 'skilltree-export')
  const files = [...Array.from({ length: 10 }, (_, i) => `common/data/routes/act-${i + 1}.txt`),
    'common/data/json/areas.json', 'common/data/json/quests.json', 'common/data/json/gems.json', 'common/data/json/characters.json', 'LICENSE']
  const vl = await latest(REPOS.leveling)
  for (const f of files) {
    mkdirSync(dirname(join(el, f)), { recursive: true })
    writeFileSync(join(el, f), await raw(REPOS.leveling, vl.sha, f))
  }
  const vt = await latest(REPOS.tree)
  mkdirSync(st, { recursive: true })
  writeFileSync(join(st, 'data.json'), await raw(REPOS.tree, vt.sha, 'data.json'))
  const before = snapshot(ACT_DIR)
  execSync(`node scripts/import-act-data.mjs "${el}" "${st}"`, { cwd: ROOT, stdio: 'pipe' })
  rmSync(tmp, { recursive: true, force: true })
  return snapshot(ACT_DIR) === before ? 'Act-Tracker-Daten: schon aktuell' : 'Act-Tracker-Daten aktualisiert (Route, Quests, Gems, Passivbaum)'
}
function snapshot (dir) {
  const h = createHash('sha256')
  for (const f of readdirSync(join(ROOT, dir)).sort()) h.update(f).update(readFileSync(join(ROOT, dir, f)))
  return h.digest('hex')
}

// ---------- step 3: price-check code from Awakened PoE Trade ----------
// Files this app wrote or rewrote itself are never replaced.
const OWN = new Set(['shims/vue.ts', 'shims/vueuse.ts', 'web/Config.ts', 'web/background/IPC.ts', 'assets/data/loader.ts',
  'assets/data/client_strings.en.js', 'assets/data/client_strings.en.d.ts', 'assets/data/app_i18n.en.json'])
// Small, fixed changes on top of the original files. Each must still fit, or the file is left alone.
const PATCHES = {
  'assets/data/index.ts': [
    [/^(import type [^\n]*'\.\/interfaces'\n)/m, "$1import { dataLoader } from './loader'\nimport CLIENT_STRINGS_EN from './client_strings.en.js'\n"],
    ['await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items.ndjson`)).text()', 'await dataLoader().text(`${language}/items.ndjson`)'],
    ['new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-name.index.bin`)).arrayBuffer())', 'new Uint32Array(await dataLoader().binary(`${language}/items-name.index.bin`))'],
    ['new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/items-ref.index.bin`)).arrayBuffer())', 'new Uint32Array(await dataLoader().binary(`${language}/items-ref.index.bin`))'],
    ['await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats.ndjson`)).text()', 'await dataLoader().text(`${language}/stats.ndjson`)'],
    ['new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-ref.index.bin`)).arrayBuffer())', 'new Uint32Array(await dataLoader().binary(`${language}/stats-ref.index.bin`))'],
    ['new Uint32Array(await (await fetch(`${import.meta.env.BASE_URL}data/${language}/stats-matcher.index.bin`)).arrayBuffer())', 'new Uint32Array(await dataLoader().binary(`${language}/stats-matcher.index.bin`))'],
    ['(await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/en/client_strings.js`)).default', 'CLIENT_STRINGS_EN as TranslationDict'],
    ['await (await fetch(`${import.meta.env.BASE_URL}data/item-drop.json`)).json()', "JSON.parse(await dataLoader().text('item-drop.json'))"],
    ['await (await fetch(`${import.meta.env.BASE_URL}data/patrons.json`)).json()', '[]'],
    ['(await import(/* @vite-ignore */`${import.meta.env.BASE_URL}data/${lang}/client_strings.js`)).default', 'CLIENT_STRINGS_EN as TranslationDict // only English ships']
  ],
  'web/price-check/trade/pathofexile-trade.ts': [
    ['interface FetchResult {\n  id: string\n  item: {\n', "interface FetchResult {\n  id: string\n  item: {\n    icon?: string // image on GGG's CDN, shown as-is\n"],
    ['  hasFee: boolean\n', '  hasFee: boolean\n  icon?: string\n'],
    ['      hasFee: result.listing.fee != null,\n', '      hasFee: result.listing.fee != null,\n      icon: result.item.icon,\n']
  ]
}
export function applyPatches (rel, text) {
  for (const [from, to] of PATCHES[rel] ?? []) {
    const hits = typeof from === 'string' ? text.split(from).length - 1 : (from.test(text) ? 1 : 0)
    if (hits !== 1) throw new Error(`Anpassung passt nicht mehr: ${String(from).slice(0, 50).replace(/\n/g, ' ')}`)
    text = typeof from === 'string' ? text.replace(from, () => to) : text.replace(from, to)
  }
  return text
}
function listFiles (dir, base = dir) {
  return readdirSync(dir).flatMap(f => statSync(join(dir, f)).isDirectory() ? listFiles(join(dir, f), base) : [relative(base, join(dir, f)).split('\\').join('/')])
}

async function aptCode () {
  const v = await latest(REPOS.apt, 'renderer/src')
  const ours = listFiles(join(ROOT, 'src/apt')).filter(f => !OWN.has(f))
  const skipped = []
  let changed = 0
  for (const rel of ours) {
    const up = await raw(REPOS.apt, v.sha, `renderer/src/${rel}`, false)
    if (up === null) { skipped.push(`${rel} (upstream entfernt)`); continue }
    try { changed += write(`src/apt/${rel}`, applyPatches(rel, up)) } catch (e) { skipped.push(`${rel} (${e.message})`) }
  }
  return { msg: changed ? `Price-Check-Code: ${changed} Datei(en) von Awakened PoE Trade übernommen` : 'Price-Check-Code: schon aktuell', skipped, files: ours.map(f => `src/apt/${f}`) }
}

// ---------- run ----------
async function main () {
  console.log('All-In-One CRIPS – Update\n')
  const base = checks()
  if (base) { console.error('Vor dem Update schlagen die Prüfungen schon fehl – bitte erst beheben:\n' + base); process.exit(1) }

  const steps = [
    ['data', DATA_FILES, gameData],
    ['act', readdirSync(join(ROOT, ACT_DIR)).map(f => `${ACT_DIR}/${f}`), actData]
  ]
  if (!args.has('--data-only')) steps.push(['code', null, aptCode])

  for (const [name, files, run] of steps) {
    const list = files ?? listFiles(join(ROOT, 'src/apt')).map(f => `src/apt/${f}`)
    const restore = backup(name, list)
    try {
      const out = await run()
      const msg = typeof out === 'string' ? out : out.msg
      for (const s of out.skipped ?? []) say(`  ! nicht übernommen: ${s}`)
      const fail = checks()
      if (fail) { restore(); say(`✗ ${msg} – aber danach schlugen die Prüfungen fehl, alter Stand wiederhergestellt:\n${fail}`) } else say(`✓ ${msg}`)
    } catch (e) {
      restore()
      say(`✗ Schritt „${name}“ abgebrochen, alter Stand bleibt: ${e.message}`)
    }
  }
  rmSync(BACKUP, { recursive: true, force: true })

  if (!args.has('--no-zip')) {
    console.log('\nBaue das Windows-Paket …')
    try {
      execSync('npm run dist:zip', { cwd: ROOT, stdio: 'inherit' })
      say('✓ Fertig: dist/All-In-One-CRIPS-1.0.0-win.zip (an Freunde schicken; Einstellungen bleiben beim Ersetzen erhalten)')
    } catch { say('✗ Paket konnte nicht gebaut werden (siehe Ausgabe oben)') }
  }
  console.log('\n— Zusammenfassung —\n' + report.join('\n'))
}
if (fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e); process.exit(1) })
