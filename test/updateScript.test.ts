import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error plain JS build script
import { applyPatches } from '../scripts/update.mjs'

const ref = join(__dirname, '..', '..', 'ref', 'apt', 'renderer', 'src')
const lf = (s: string) => s.replace(/\r\n/g, '\n')

describe.skipIf(!existsSync(ref))('update script', () => {
  for (const rel of ['assets/data/index.ts', 'web/price-check/trade/pathofexile-trade.ts']) {
    it(`re-creates our version of ${rel} from the original`, () => {
      const up = lf(readFileSync(join(ref, rel), 'utf8'))
      expect(applyPatches(rel, up)).toBe(readFileSync(join(__dirname, '..', 'src', 'apt', rel), 'utf8'))
    })
  }
  it('refuses a patch that no longer fits', () => {
    expect(() => applyPatches('web/price-check/trade/pathofexile-trade.ts', 'nothing here')).toThrow(/passt nicht mehr/)
  })
})
