import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const fx = (f: string) => readFileSync(join(root, 'test/fixtures', f), 'utf8')
const shots = join(root, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })

async function launch(env: Record<string, string>): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, ASSAY_FIXTURES: join(root, 'test/fixtures'), ASSAY_DATA_DIR: mkdtempSync(join(tmpdir(), 'assay-')), ...env }
  })
  const route = env.ASSAY_OPEN === 'settings' || env.ASSAY_OPEN === 'overlay' ? env.ASSAY_OPEN : 'panel'
  let page: Page | undefined
  for (let i = 0; i < 40 && !page; i++) {
    page = app.windows().find(w => w.url().endsWith('#' + route))
    if (!page) await new Promise(r => setTimeout(r, 250))
  }
  if (!page) throw new Error('window not found')
  await page.waitForLoadState('domcontentloaded')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  ;(page as any).__errors = errors
  return { app, page }
}

test('F01 rare item: pseudo totals, search, listings (S01, S03)', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'panel', ASSAY_ITEM: fx('rare-boots.txt') })
  await expect(page.getByRole('heading', { name: /Storm Stride/ })).toBeVisible()
  await expect(page.getByText('+85 total maximum Life')).toBeVisible()
  await expect(page.getByText('+85% total Elemental Resistance')).toBeVisible()
  await expect(page.getByText(/of 214 listings/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Away' })).toBeVisible()
  await expect(page.getByText('×2')).toBeVisible()
  await page.screenshot({ path: join(shots, 'S01-S03.png') })
  // untick everything -> search disabled with a hint
  const ticked = page.getByRole('checkbox', { checked: true })
  while (await ticked.count()) await ticked.first().uncheck()
  await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled()
  await expect(page.getByText('Pick at least one stat to search.')).toBeVisible()
  // keyboard: tick one stat, submit with Enter
  await page.getByLabel(/Minimum for \+70 to maximum Life/).fill('60')
  await page.getByLabel(/Minimum for \+70 to maximum Life/).press('Enter')
  await expect(page.getByText(/of 214 listings/)).toBeVisible()
  expect((page as any).__errors).toEqual([])
  await app.close()
})

test('F02 unique: market value and search (S01, S04)', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'panel', ASSAY_ITEM: fx('unique-belt.txt') })
  await expect(page.getByRole('heading', { name: /Coiled Promise/ })).toBeVisible()
  await expect(page.getByText('42.3c')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Corrupted' })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: join(shots, 'S02-unique.png') })
  await app.close()
})

test('F03 currency: market value only (S04)', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'panel', ASSAY_ITEM: fx('currency.txt') })
  await expect(page.getByText('183c')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search' })).toHaveCount(0)
  // the window shrinks to the panel so no invisible area covers the game
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#panel'))!.getBounds().height)).toBeLessThan(300)
  await page.screenshot({ path: join(shots, 'S04-currency.png') })
  await app.close()
})

test('errors: empty clipboard and non-English text', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'panel', ASSAY_ITEM: '' })
  await expect(page.getByRole('alert')).toContainText('No item found on the clipboard')
  await page.screenshot({ path: join(shots, 'S01-error.png') })
  await app.close()
  const b = await launch({ ASSAY_OPEN: 'panel', ASSAY_ITEM: fx('german.txt') })
  await expect(b.page.getByRole('alert')).toContainText('Only English')
  await b.app.close()
})

test('F04/F05 settings: league, hotkey conflict, keyboard tabs (S06, S07)', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'settings' })
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByLabel('League').selectOption('Hardcore')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'S06-general.png') })
  await page.getByRole('tab', { name: 'General' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Hotkeys' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /^Open item in wiki:/ }).click()
  await page.keyboard.press('Control+D')
  await expect(page.getByRole('alert')).toContainText('Already used by priceCheck')
  await page.getByRole('button', { name: /^Open item in wiki:/ }).click()
  await page.keyboard.press('Alt+Q')
  await expect(page.getByRole('button', { name: /^Open item in wiki: Alt\+Q/ })).toBeVisible()
  await page.screenshot({ path: join(shots, 'S06-hotkeys.png') })
  await page.getByRole('tab', { name: 'Debug' }).click()
  await expect(page.getByText(/ready, input mode/)).toBeVisible()
  await page.screenshot({ path: join(shots, 'S07-debug.png') })
  const cfg = await app.evaluate(async () => (globalThis as any).process.env.ASSAY_DATA_DIR)
  const saved = JSON.parse(readFileSync(join(cfg, 'config.json'), 'utf8'))
  expect(saved.leagueId).toBe('Hardcore')
  expect(saved.hotkeys.find((h: any) => h.action === 'wiki').keys).toBe('Alt+Q')
  await app.close()
})

test('S05 overlay: stopwatch widget toggles and runs', async () => {
  const { app, page } = await launch({ ASSAY_OPEN: 'overlay' })
  await page.getByRole('button', { name: 'Stopwatch' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/^00:0[1-9]$/)).toBeVisible({ timeout: 4000 })
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.getByRole('button', { name: 'Arrange widgets' }).click()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  await page.screenshot({ path: join(shots, 'S05-overlay.png') })
  expect((page as any).__errors).toEqual([])
  await app.close()
})
