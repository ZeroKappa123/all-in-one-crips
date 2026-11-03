import { _electron as electron, test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const exe = join(root, 'dist/linux-unpacked/all-in-one-crips')

test('packaged build starts, finds its native input module and runs a price check', async () => {
  test.skip(!existsSync(exe), 'no packaged build')
  const app = await electron.launch({
    executablePath: exe,
    args: ['--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: mkdtempSync(join(tmpdir(), 'assay-')), CRIPS_OPEN: 'panel', CRIPS_ITEM: readFileSync(join(root, 'test/fixtures/rare-boots-advanced.txt'), 'utf8') }
  })
  let page = app.windows().find(w => w.url().endsWith('#panel'))
  for (let i = 0; i < 40 && !page; i++) { await new Promise(r => setTimeout(r, 250)); page = app.windows().find(w => w.url().endsWith('#panel')) }
  await expect(page!.getByRole('heading', { name: 'Two-Toned Boots' })).toBeVisible()
  await expect(page!.getByText('+85 total maximum Life')).toBeVisible()
  // the act tracker ships its data inside the package and opens its guide window
  let guide = app.windows().find(w => w.url().endsWith('#guide'))
  for (let i = 0; i < 40 && !guide; i++) { await new Promise(r => setTimeout(r, 250)); guide = app.windows().find(w => w.url().endsWith('#guide')) }
  await expect(guide!.getByText('Hillock')).toBeVisible()
  await app.close()
})
