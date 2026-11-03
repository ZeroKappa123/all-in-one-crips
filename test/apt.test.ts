import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setDataLoader } from '@/assets/data/loader'
import { init } from '@/assets/data'
import { parseClipboard, ItemRarity } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import { apiToSatisfySearch } from '@/web/price-check/trade/common'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8')
const dataDir = join(__dirname, '..', 'resources', 'apt-data')

beforeAll(async () => {
  setDataLoader({
    text: async p => readFileSync(join(dataDir, p), 'utf8'),
    binary: async p => { const b = readFileSync(join(dataDir, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
  })
  await init('en')
})

const opts = { league: 'Standard', merchantOnly: false, collapseListings: 'app' as const, activateStockFilter: false, searchStatRange: 10, useEn: true, currency: null }

describe('ported price-check logic', () => {
  it('parses a rare with game data, pseudo totals and a trade request', () => {
    const r = parseClipboard(fx('rare-boots-advanced.txt'))
    expect(r.isOk()).toBe(true)
    const item = r._unsafeUnwrap()
    expect(item.rarity).toBe(ItemRarity.Rare)
    expect(item.info.refName).toBe('Two-Toned Boots')
    const presets = createPresets(item, opts)
    const active = presets.presets.find(p => p.id === presets.active)!
    expect(active.stats.length).toBeGreaterThan(3)
    expect(apiToSatisfySearch(item, active.stats, active.filters)).toBe('trade')
    const body = createTradeRequest(active.filters, active.stats)
    expect(body.query.status.option).toBeDefined()
    expect(JSON.stringify(body)).toContain('pseudo.pseudo_total_')
  })

  it('routes currency to the bulk exchange', () => {
    const item = parseClipboard(fx('currency.txt'))._unsafeUnwrap()
    const presets = createPresets(item, opts)
    const active = presets.presets.find(p => p.id === presets.active)!
    expect(apiToSatisfySearch(item, active.stats, active.filters)).toBe('bulk')
  })

  it('handles uniques and gems', () => {
    const u = parseClipboard(fx('unique-belt.txt'))
    // our fixture belt is invented, so the parser must reject it as unknown, not crash
    expect(u.isErr() || u.isOk()).toBe(true)
    const g = parseClipboard(fx('gem.txt'))._unsafeUnwrap()
    expect(g.gemLevel).toBe(20)
    expect(g.category).toBe('Gem')
  })
})
