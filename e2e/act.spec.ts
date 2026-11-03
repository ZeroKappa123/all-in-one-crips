import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const shots = join(root, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })
const stamp = (s: number) => `2026/11/03 18:00:${String(s).padStart(2, '0')} 1 a [DEBUG Client 1]`
const area = (s: number, id: string, lvl = 1) => `${stamp(s)} Generating level ${lvl} area "${id}" with seed 1\n`

async function launch(open: string, opts: { act?: object; log?: string } = {}): Promise<{ app: ElectronApplication; page: Page; data: string; log: string }> {
  const data = mkdtempSync(join(tmpdir(), 'crips-act-'))
  const log = join(data, 'Client.txt')
  writeFileSync(log, opts.log ?? area(0, '1_1_1'))
  if (opts.act) writeFileSync(join(data, 'act.json'), JSON.stringify(opts.act))
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, CRIPS_CLIENT_LOG: log, CRIPS_OPEN: open }
  })
  const want = open === 'editor' ? '#editor/0' : `#${open}`
  let page: Page | undefined
  for (let i = 0; i < 40 && !page; i++) {
    page = app.windows().find(w => w.url().endsWith(want))
    if (!page) await new Promise(r => setTimeout(r, 250))
  }
  if (!page) throw new Error(`window ${want} not found`)
  await page.waitForLoadState('domcontentloaded')
  return { app, page, data, log }
}

async function guidePage(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 40; i++) {
    const p = app.windows().find(w => w.url().endsWith('#guide'))
    if (p) { await p.waitForLoadState('domcontentloaded'); return p }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('guide window not found')
}

test('F11 guide follows Client.txt, F12 timer, e-exp (S11–S13)', async () => {
  const { app, page: settings, log } = await launch('settings')
  const guide = await guidePage(app)
  await expect(guide.getByText('Hillock')).toBeVisible()
  await expect(guide.getByText(/^1\//)).toBeVisible()
  // walking into the wrong area does nothing, the target area turns the page
  appendFileSync(log, area(1, '1_1_2', 2))
  await guide.waitForTimeout(800)
  await expect(guide.getByText('Hillock')).toBeVisible()
  appendFileSync(log, area(2, '1_1_town'))
  await expect(guide.getByText('Enemy at the Gate')).toBeVisible()
  // character level and experience window
  await settings.getByRole('tab', { name: 'Act Tracker' }).click()
  await settings.getByLabel('Character name').fill('Marc_Wit')
  await settings.getByLabel('Character name').blur()
  appendFileSync(log, `${stamp(3)} : Marc_Wit (Witch) is now level 4\n`.replace('[DEBUG', '[INFO'))
  appendFileSync(log, area(4, '1_1_2', 2))
  await expect(guide.getByText(/1 \| 2 \| 7/)).toBeVisible()
  // timer: start, count, act changes on entering act 2
  await guide.getByRole('button', { name: /^Act 1, paused/ }).click()
  await guide.waitForTimeout(2200)
  appendFileSync(log, area(5, '1_2_1', 13))
  await expect(guide.getByRole('button', { name: /^Act 2, running/ })).toBeVisible()
  // next / previous and long-press jump
  const before = await guide.getByText(/^\d+\/\d+$/).textContent()
  await guide.getByRole('button', { name: /^Next page/ }).click()
  await expect(guide.getByText(/^\d+\/\d+$/)).not.toHaveText(before!)
  await guide.screenshot({ path: join(shots, 'S11-guide.png') })
  await settings.screenshot({ path: join(shots, 'S14-act-settings.png') })
  await app.close()
})

test('F13 PoB import fills gem plan, gear tracker and tree (S14, S16, S18, S20)', async () => {
  const { app, page } = await launch('settings')
  await page.getByRole('tab', { name: 'Act Tracker' }).click()
  await app.evaluate(({ clipboard }) => clipboard.writeText('https://pobb.in/test-build'))
  await page.getByRole('button', { name: 'Import from clipboard' }).click()
  await expect(page.getByText(/Build imported: Witch \(Elementalist\), 2 trees/)).toBeVisible()
  await page.getByRole('button', { name: 'Plan gem pickups' }).click()
  await expect(page.getByRole('cell', { name: /gem Added Fire Damage Support$/ })).toBeVisible()
  await page.getByLabel('Skip Flame Dash').click()
  await expect(page.getByRole('cell', { name: /gem Flame Dash$/ })).toHaveClass(/line-through/)
  await page.screenshot({ path: join(shots, 'S16-gem-plan.png'), fullPage: true })
  // guide shows what to take at quest hand-ins
  const guide = await guidePage(app)
  await expect(guide.getByRole('img', { name: 'Town' }).first()).toBeVisible() // page 1 ends in Lioneye's Watch
  await guide.getByRole('button', { name: /^Next page/ }).click()
  await expect(guide.getByText('Enemy at the Gate')).toBeVisible()
  // own guide symbols and gem dots in the style of exile-leveling
  await expect(guide.getByRole('img', { name: 'Quest' }).first()).toBeVisible()
  await guide.screenshot({ path: join(shots, 'S11-guide-quest.png') })
  for (let i = 0; i < 2; i++) await guide.getByRole('button', { name: /^Next page/ }).click()
  await expect(guide.locator('[data-step-icon="waypoint"]').first()).toBeVisible()
  await guide.screenshot({ path: join(shots, 'S11-guide-waypoint.png') })
  // gear tracker got the build gems
  await page.getByRole('button', { name: 'Open gear tracker' }).click()
  await expect.poll(() => app.windows().some(w => w.url().endsWith('#gear'))).toBe(true)
  const gear = app.windows().find(w => w.url().endsWith('#gear'))!
  await expect(gear.getByText('Added Fire Damage Support')).toBeVisible()
  await gear.screenshot({ path: join(shots, 'S20-gear.png') })
  await app.close()
})

test('S18 tree overlay renders the build and switches specs', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-tree-'))
  void data
  const tree = JSON.parse(readFileSync(join(root, 'src/shared/act/data/tree.json'), 'utf8'))
  const witchStart = Object.entries(tree.nodes).find(([, n]: any) => n[5] === 3)![0]
  const near = Object.entries(tree.nodes).filter(([, n]: any) => !n[3]).slice(0, 30).map(([id]) => Number(id))
  const pob = {
    className: 'Witch', ascendancy: 'Elementalist', level: 70, skillSets: [],
    specs: [{ title: 'Act 2', nodes: [Number(witchStart), ...near.slice(0, 15)], ascendancy: 'Elementalist' }, { title: 'Act 5', nodes: [Number(witchStart), ...near.slice(5, 30)], ascendancy: 'Elementalist' }]
  }
  const act = { slots: [{ id: 's', name: 'Witch', info: '', guide: null, options: { leagueStart: true, optionals: false, bandit: 'kill', library: true }, gemQuests: 'build', character: '', pob, gemOverrides: {}, page: 0 }] }
  const { app, page } = await launch('tree', { act })
  await expect(page.getByText('Act 2')).toBeVisible()
  await page.keyboard.press('e')
  await expect(page.getByText('Act 5')).toBeVisible()
  await page.keyboard.down('w')
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(shots, 'S18-tree.png') })
  await page.keyboard.up('w')
  await app.close()
})

test('S15 editor splits pages, flags unknown areas, previews', async () => {
  const { app, page } = await launch('editor')
  await expect(page.getByRole('heading', { name: /Guide editor/ })).toBeVisible()
  const first = page.getByLabel('Page 1', { exact: true })
  await expect(first).toContainText('Hillock')
  await first.fill('Kill {kill|Someone}\n➞ {enter|no_such_area}')
  await expect(page.getByText('Unknown area: no_such_area')).toBeVisible()
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Preview' }).first().click()
  await expect(page.getByText('Someone', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(shots, 'S15-editor.png') })
  // every kind of step with its symbol, for a visual check
  await first.fill('Kill {kill|Hillock} ➞ {enter|1_1_town}\n{waypoint|1_1_2} {dir|90} {dir|225}\nHand in {quest|a1q1}\nPlace {portal|set}, take {portal|use}\nComplete {trial}, get {crafting}\n{ascend|normal}\nFind {quest_text|Medicine Chest}\n{logout}')
  await page.getByRole('button', { name: 'Preview' }).first().click()
  await page.getByRole('button', { name: 'Preview' }).first().click()
  for (const k of ['Town', 'Waypoint', 'Quest', 'Portal', 'Trial', 'Crafting', 'Labyrinth', 'Log out']) await expect(page.getByRole('img', { name: k }).first()).toBeVisible()
  await page.locator('.material-hud').first().screenshot({ path: join(shots, 'S15-guide-symbols.png') })
  await page.getByRole('button', { name: 'Save guide' }).click()
  await expect(page.getByText('Unsaved changes')).toHaveCount(0)
  await app.close()
})
