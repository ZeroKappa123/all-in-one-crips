import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const fx = (f: string) => readFileSync(join(root, 'test/fixtures', f), 'utf8')
const shots = join(root, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })

async function launch(env: Record<string, string>, config?: object): Promise<{ app: ElectronApplication; page: Page }> {
  const data = mkdtempSync(join(tmpdir(), 'crips-'))
  if (config) writeFileSync(join(data, 'config.json'), JSON.stringify(config))
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, ...env }
  })
  const route = ['settings', 'overlay'].includes(env.CRIPS_OPEN ?? '') ? env.CRIPS_OPEN! : 'panel'
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

test('F01 rare: game-data parser, pseudo filters, search, grouped listings', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: fx('rare-boots-advanced.txt') })
  await expect(page.getByRole('heading', { name: 'Two-Toned Boots' })).toBeVisible()
  await expect(page.getByText('+85 total maximum Life')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Pseudo' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('214')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Away' }).first()).toBeVisible()
  await expect(page.getByText('×2')).toHaveCount(0) // grouped only from 3 listings on, like the original
  // currency icons and the item art come from GGG's image server
  // (offline here, so the text label stays visible until an image actually loads)
  await expect(page.locator('img[alt="Chaos Orb"]').first()).toHaveAttribute('src', /^https:\/\/web\.poecdn\.com\//)
  await expect(page.locator('header img[src^="https://web.poecdn.com/gen/image/"]')).toHaveCount(1)
  await expect(page.getByText('chaos').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  await page.screenshot({ path: join(shots, 'S01-S03.png') })
  // changing a filter hides the results until the next search
  await page.getByRole('checkbox').first().click()
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  expect((page as any).__errors).toEqual([])
  await app.close()
})

test('F02 unique: market value with trend, automatic search', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: fx('unique-goldrim.txt') })
  await expect(page.getByRole('heading', { name: 'Goldrim' })).toBeVisible()
  await expect(page.getByLabel('Market value (poe.ninja)')).toContainText('3')
  await expect(page.getByText('-10%')).toBeVisible()
  await expect(page.getByText('Matched')).toBeVisible()
  await page.screenshot({ path: join(shots, 'S02-unique.png') })
  await app.close()
})

test('F03 currency: bulk exchange and market value', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: fx('currency.txt') })
  await expect(page.getByRole('heading', { name: 'Divine Orb' })).toBeVisible()
  await expect(page.getByLabel('Market value (poe.ninja)')).toContainText('1 div') // like the original: ~1 divine is shown as 1 div
  await expect(page.getByRole('columnheader', { name: 'Rate' })).toBeVisible()
  await expect(page.getByText('(180:1)')).toBeVisible()
  await page.screenshot({ path: join(shots, 'S04-currency.png') })
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#panel'))!.getBounds().height)).toBeLessThan(560)
  await app.close()
})

test('errors: empty clipboard and other client languages', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: '' })
  await expect(page.getByRole('alert')).toContainText('No item on the clipboard')
  await app.close()
  const b = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: fx('german.txt') })
  await expect(b.page.getByRole('alert')).toContainText('English')
  await b.app.close()
})

test('settings: sidebar, league from the trade site, hotkey conflict, about', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'settings' })
  await expect(page.getByRole('heading', { name: 'Price Check' })).toBeVisible()
  await page.getByLabel('League').selectOption('Mercenaries')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.getByLabel('Search automatically').click()
  await page.screenshot({ path: join(shots, 'S06-general.png') })
  await page.getByRole('tab', { name: 'Keyboard' }).click()
  await page.getByRole('button', { name: /^Open item in wiki:/ }).click()
  await page.keyboard.press('Control+D')
  await expect(page.getByRole('alert')).toContainText('Already used by priceCheck')
  await page.getByRole('button', { name: /^Open item in wiki:/ }).click()
  await page.keyboard.press('Alt+Q')
  await page.screenshot({ path: join(shots, 'S06-hotkeys.png') })
  await page.getByRole('tab', { name: 'About' }).click()
  await expect(page.getByText('Made by zero').last()).toBeVisible()
  await expect(page.getByText(/Alexander Drozdov, MIT License/)).toBeVisible()
  await page.screenshot({ path: join(shots, 'S06-about.png') })
  await page.getByRole('tab', { name: 'Diagnostics' }).click()
  await expect(page.getByText(/ready, input mode/)).toBeVisible()
  const dir = await app.evaluate(async () => (globalThis as any).process.env.CRIPS_DATA_DIR)
  const saved = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
  expect(saved).toMatchObject({ leagueId: 'Mercenaries', autoSearch: false })
  expect(saved.hotkeys.find((h: any) => h.action === 'wiki').keys).toBe('Alt+Q')
  await app.close()
})

test('S05 overlay widgets', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'overlay' })
  await page.getByRole('button', { name: 'Stopwatch' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/^00:0[1-9]$/)).toBeVisible({ timeout: 4000 })
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.screenshot({ path: join(shots, 'S05-overlay.png') })
  expect((page as any).__errors).toEqual([])
  await app.close()
})

test('S06 image strip: add pictures, show one large, flip, remove', async () => {
  const icon = join(root, 'resources/icon.png'), tray = join(root, 'resources/tray.png')
  const { app, page } = await launch({ CRIPS_OPEN: 'overlay', CRIPS_IMAGE_PICK: `${icon}|${tray}` })
  await expect(page.getByText('Cheat sheets')).toBeVisible()
  await page.getByRole('button', { name: 'Add images' }).click()
  await expect(page.getByRole('button', { name: 'Show icon large' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show tray large' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add images' })).toHaveCount(0) // only while arranging, once there are pictures
  await page.getByRole('button', { name: 'Show icon large' }).click()
  const viewer = page.getByRole('dialog', { name: 'icon' })
  await expect(viewer.getByRole('img', { name: 'icon' })).toHaveAttribute('src', /^data:image\/png;base64,/)
  await page.screenshot({ path: join(shots, 'S06-image-large.png') })
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'tray' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(app.windows().find(w => w.url().endsWith('#overlay'))).toBeTruthy()
  // arranging: move and remove
  await page.getByRole('button', { name: 'Arrange widgets' }).click()
  await page.getByRole('button', { name: 'Move tray left' }).click()
  await page.getByRole('button', { name: 'Remove icon' }).click()
  await expect(page.getByRole('button', { name: 'Show icon large' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show tray large' })).toBeVisible()
  // the image strip can be hidden from the menu
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Image strip' }).click()
  await expect(page.getByText('Cheat sheets')).toHaveCount(0)
  expect((page as any).__errors).toEqual([])
  await app.close()
})

test('appearance: dark by default, switch to light in settings, overlays follow', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'settings' })
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  await page.screenshot({ path: join(shots, 'S06-dark.png') })
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  const panel = app.windows().find(w => w.url().endsWith('#panel'))!
  await expect.poll(() => panel.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await page.screenshot({ path: join(shots, 'S06-light.png') })
  await page.getByRole('radio', { name: 'System' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? 'system')).toBe('system')
  await app.close()
})

test('light appearance in the price panel', async () => {
  const base = JSON.parse(JSON.stringify({ version: 1 }))
  const { app, page } = await launch({ CRIPS_OPEN: 'panel', CRIPS_ITEM: fx('rare-boots-advanced.txt') }, { ...base, theme: 'light' })
  await expect(page.getByRole('heading', { name: 'Two-Toned Boots' })).toBeVisible()
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('214')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await page.screenshot({ path: join(shots, 'S01-light.png') })
  await app.close()
})

test('widescreen: switch in settings, overlay menu and keyboard list', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'settings' })
  await page.getByRole('tab', { name: 'Widescreen' }).click()
  // this test machine is Linux: the feature explains itself instead of failing
  await expect(page.getByText('Moving the game window works on Windows only.')).toBeVisible()
  await page.getByLabel('Wide picture').click()
  await expect(page.getByLabel('Manage the game window')).toBeChecked() // turning on the wide picture switches the feature on
  await page.getByLabel('Wideness').fill('1.5')
  await page.screenshot({ path: join(shots, 'S22-widescreen.png') })
  const dir = await app.evaluate(async () => (globalThis as any).process.env.CRIPS_DATA_DIR)
  await expect.poll(() => JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).widescreen).toMatchObject({ enabled: true, wide: true, zoom: 1.5 })
  await page.getByRole('tab', { name: 'Keyboard' }).click()
  await expect(page.getByRole('button', { name: /^Widescreen on\/off: F2/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Move game window up: Ctrl\+Up/ })).toBeVisible()
  await app.close()
})

test('widescreen: on/off button in the overlay menu', async () => {
  const { app, page } = await launch({ CRIPS_OPEN: 'overlay' })
  const btn = page.getByRole('button', { name: 'Wide picture' })
  await expect(btn).toHaveAttribute('aria-pressed', 'false')
  await btn.click()
  await expect(btn).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: join(shots, 'S05-overlay-widescreen.png') })
  await btn.click()
  await expect(btn).toHaveAttribute('aria-pressed', 'false')
  await app.close()
})
