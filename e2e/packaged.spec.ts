import { _electron as electron, test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const exe = join(root, 'dist/linux-unpacked/assay')

test('packaged build starts, finds its native input module and runs a price check', async () => {
  test.skip(!existsSync(exe), 'no packaged build')
  const app = await electron.launch({
    executablePath: exe,
    args: ['--no-sandbox'],
    env: { ...process.env, ASSAY_FIXTURES: join(root, 'test/fixtures'), ASSAY_DATA_DIR: mkdtempSync(join(tmpdir(), 'assay-')), ASSAY_OPEN: 'panel', ASSAY_ITEM: readFileSync(join(root, 'test/fixtures/rare-wand.txt'), 'utf8') }
  })
  let page = app.windows().find(w => w.url().endsWith('#panel'))
  for (let i = 0; i < 40 && !page; i++) { await new Promise(r => setTimeout(r, 250)); page = app.windows().find(w => w.url().endsWith('#panel')) }
  await expect(page!.getByRole('heading', { name: /Gloom Whisper/ })).toBeVisible()
  await expect(page!.getByText('Adds 20 to 38 Fire Damage to Spells')).toBeVisible()
  await app.close()
})
