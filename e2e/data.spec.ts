import { _electron as electron, test, expect, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const item = readFileSync(join(root, 'test/fixtures/rare-boots-advanced.txt'), 'utf8')

async function launch(data: string, env: Record<string, string>) {
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, ...env }
  })
  let page: Page | undefined
  for (let i = 0; i < 40 && !page; i++) {
    page = app.windows().find(w => w.url().endsWith('#' + env.CRIPS_OPEN))
    if (!page) await new Promise(r => setTimeout(r, 250))
  }
  if (!page) throw new Error('window not found')
  return { app, page }
}

test('U01 game data: check now downloads, validates and the price check uses it', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-'))
  const s = await launch(data, { CRIPS_OPEN: 'settings' })
  await expect(s.page.getByTestId('data-version')).toContainText('Shipped with the app')
  await s.page.getByRole('button', { name: 'Check now' }).click()
  await expect(s.page.getByText('New game data is ready')).toBeVisible()
  await expect(s.page.getByTestId('data-version')).toContainText('Downloaded update')
  await expect(s.page.getByRole('switch', { name: 'Update automatically' })).toBeChecked()
  // a second check finds nothing newer
  await s.page.getByRole('button', { name: 'Check now' }).click()
  await expect(s.page.getByText('The game data is up to date.')).toBeVisible()
  await s.app.close()
  const dir = join(data, 'game-data', '0000000000000000000000000000000000fixture')
  for (const f of ['en/stats.ndjson', 'en/items.ndjson', 'en/stats-ref.index.bin', 'en/items-name.index.bin', 'item-drop.json']) expect(existsSync(join(dir, f))).toBe(true)

  const p = await launch(data, { CRIPS_OPEN: 'panel', CRIPS_ITEM: item })
  await expect(p.page.getByRole('heading', { name: 'Two-Toned Boots' })).toBeVisible()
  await expect(p.page.getByText('+85 total maximum Life')).toBeVisible()
  await p.app.close()
})

test('U02 game data: unusable download is rejected and the shipped data takes over', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-'))
  const sha = 'badbadbadbadbadbadbadbadbadbadbadbadbad0'
  const dir = join(data, 'game-data', sha)
  mkdirSync(join(dir, 'en'), { recursive: true })
  cpSync(join(root, 'resources/apt-data'), dir, { recursive: true })
  writeFileSync(join(dir, 'en', 'stats.ndjson'), '{"ref":"nothing","matchers":[]}\n') // parser can't start with this
  writeFileSync(join(data, 'game-data', 'state.json'), JSON.stringify({ active: { sha, date: '2026-10-01T00:00:00Z' }, rejected: [], lastCheck: null, lastError: null }))

  const p = await launch(data, { CRIPS_OPEN: 'panel', CRIPS_ITEM: item })
  await expect(p.page.getByRole('heading', { name: 'Two-Toned Boots' })).toBeVisible()
  await expect(p.page.getByText('+85 total maximum Life')).toBeVisible()
  await p.app.close()
  const state = JSON.parse(readFileSync(join(data, 'game-data', 'state.json'), 'utf8'))
  expect(state.active).toBeNull()
  expect(state.rejected).toContain(sha)
})
