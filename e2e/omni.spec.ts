import { _electron as electron, test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(__dirname, '..')
const shots = join(root, '..', 'replica', 'clone-screens')
mkdirSync(shots, { recursive: true })

test('S24 omni key menu: vendor searches in the guide look, a pick closes it', async () => {
  const data = mkdtempSync(join(tmpdir(), 'crips-omni-'))
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), '--no-sandbox'],
    env: { ...process.env, CRIPS_FIXTURES: join(root, 'test/fixtures'), CRIPS_DATA_DIR: data, CRIPS_OMNI_DEMO: '1', CRIPS_CLIENT_LOG: join(data, 'none.txt') }
  })
  let page
  for (let i = 0; i < 40 && !page; i++) { page = app.windows().find(w => w.url().endsWith('#omni')); if (!page) await new Promise(r => setTimeout(r, 250)) }
  if (!page) throw new Error('omni window not found')
  await expect(page.getByText('Vendor search')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Items' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1) // no build imported: only items
  await expect(page.getByText(/Import your build/)).toBeVisible() // no build: no gem searches yet
  await page.locator('.guide-classic').screenshot({ path: join(shots, 'S24-omni.png') })
  const visible = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#omni'))?.isVisible())
  expect(await visible()).toBe(true)
  await page.getByRole('button', { name: 'Items' }).click()
  await expect.poll(visible).toBe(false)
  await app.close()
})
