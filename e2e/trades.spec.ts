import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const shots = join(root, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })
const L = (s: string) => `2026/11/03 18:00:00 1 a [INFO Client 1] ${s}`
const DEMO = [
  L('@From <GLD> Buyer_One: Hi, I would like to buy your Tabula Rasa Simple Robe listed for 10 chaos in Mercenaries (stash tab "Sale"; position: left 5, top 3) see you'),
  L("@From Bulk_Buyer: Hi, I'd like to buy your 50 Chaos Orb for my 1 Divine Orb in Mercenaries."),
  L('@To Seller_Two: Hi, I would like to buy your Goldrim Leather Cap listed for 3 chaos in Mercenaries (stash tab "x"; position: left 1, top 1)'),
  L(': Buyer_One has joined the area.'),
  L(': 12 monsters remain.')
].join('\n')

async function windowFor(app: ElectronApplication, route: string): Promise<Page> {
  for (let i = 0; i < 40; i++) {
    const p = app.windows().find(w => w.url().endsWith('#' + route))
    if (p) { await p.waitForLoadState('domcontentloaded'); return p }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`window ${route} not found`)
}

test('trade cards from whispers: icons, states, actions (S23)', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-trades-'))
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, CRIPS_TRADES_DEMO: DEMO, CRIPS_CLIENT_LOG: join(data, 'none.txt') }
  })
  const page = await windowFor(app, 'trades')
  const first = page.getByRole('article', { name: /Offer from Buyer_One/ })
  await expect(first).toBeVisible()
  await expect(first.getByText('Tabula Rasa Simple Robe')).toBeVisible()
  await expect(first.getByText('here')).toBeVisible() // buyer joined the area
  await expect(first.getByRole('button', { name: /Sale · left 5, top 3/ })).toBeVisible()
  await expect(page.getByRole('article', { name: /50 Chaos Orb/ })).toBeVisible()
  await expect(page.getByRole('article', { name: /Your offer to Seller_Two/ })).toBeVisible()
  await expect(page.locator('img[alt="Divine Orb"]')).toHaveCount(1) // currency icons from the game's image server
  await expect(page.getByTitle('Monsters remaining in this area')).toContainText('12')
  await page.screenshot({ path: join(shots, 'S23-trades.png') })
  // invite -> trade: without the input hook nothing is typed, but the card moves on
  await first.getByRole('button', { name: 'Invite' }).click()
  await expect(first.getByRole('button', { name: 'Trade', exact: true })).toBeVisible()
  await page.getByRole('article', { name: /50 Chaos Orb/ }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('article', { name: /50 Chaos Orb/ })).toHaveCount(0)
  await app.close()
})

test('stash calibration saves the frame', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-stash-'))
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, CRIPS_OPEN: 'stash', CRIPS_CLIENT_LOG: join(data, 'none.txt') }
  })
  const page = await windowFor(app, 'stash')
  await expect(page.getByText('Open a stash tab and fit the frame to its grid.')).toBeVisible()
  await page.screenshot({ path: join(shots, 'S24-stash-calibrate.png') })
  await page.getByRole('button', { name: 'Save frame' }).click()
  await expect.poll(() => JSON.parse(readFileSync(join(data, 'config.json'), 'utf8')).trades.stash).toMatchObject({ width: 634, height: 634 })
  await app.close()
})
