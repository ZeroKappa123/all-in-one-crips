import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseItem, ParseError, longestLink } from '@shared/parser/parseItem'
import { StatIndex } from '@shared/parser/matchStats'
import { buildFilters, withTolerance } from '@shared/parser/buildFilters'
import { buildSearch, canSearch, toListings, tradeSiteUrl } from '@shared/trade/query'
import { RateLimiter, parseRules } from '@shared/trade/rateLimiter'
import { findCurrency, divinePrice, findItem, overviewTypeFor } from '@shared/prices/ninja'
import { loadConfig, DEFAULT_CONFIG, findConflict, expandChatCommand } from '@shared/config'
import type { TradeStat } from '@shared/types'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8')
const stats: TradeStat[] = JSON.parse(fx('stats.json')).result.flatMap((g: { entries: TradeStat[] }) => g.entries)
const index = new StatIndex(stats)

describe('parseItem', () => {
  it('reads a rare wand', () => {
    const item = parseItem(fx('rare-wand.txt'))
    expect(item.rarity).toBe('rare')
    expect(item.itemClass).toBe('Wands')
    expect(item.name).toBe('Gloom Whisper')
    expect(item.baseType).toBe('Imbued Wand')
    expect(item.itemLevel).toBe(84)
    expect(item.quality).toBe(20)
    expect(item.sockets).toBe('B-B-R')
    expect(item.links).toBe(3)
    expect(item.mods.map(m => [m.source, m.text])).toEqual([
      ['implicit', '36% increased Spell Damage'],
      ['explicit', '+1 to Level of all Fire Spell Skill Gems'],
      ['explicit', 'Adds 20 to 38 Fire Damage to Spells'],
      ['explicit', '+38 to maximum Mana'],
      ['explicit', '+33% to Fire Resistance']
    ])
  })

  it('reads crafted mods, influences of fractured items and sockets with groups', () => {
    const item = parseItem(fx('rare-boots.txt'))
    expect(item.mods.find(m => m.source === 'crafted')?.text).toBe('+15 to maximum Mana')
    expect(item.mods).toHaveLength(9)
    expect(item.links).toBe(3)
  })

  it('reads a corrupted unique and skips flavour text', () => {
    const item = parseItem(fx('unique-belt.txt'))
    expect(item.rarity).toBe('unique')
    expect(item.corrupted).toBe(true)
    expect(item.mods.map(m => m.text)).toEqual(['+31 to maximum Life', '+48 to maximum Life', 'Cannot be Frozen'])
  })

  it('reads currency stacks and gems', () => {
    const c = parseItem(fx('currency.txt'))
    expect(c.rarity).toBe('currency')
    expect(c.baseType).toBe('Divine Orb')
    expect(c.stackSize).toBe(7)
    expect(c.mods).toEqual([])
    const g = parseItem(fx('gem.txt'))
    expect(g.rarity).toBe('gem')
    expect(g.gemLevel).toBe(20)
    expect(g.quality).toBe(20)
    expect(g.corrupted).toBe(true)
  })

  it('rejects empty and non-English text', () => {
    expect(() => parseItem('')).toThrow(ParseError)
    expect(() => parseItem('hello world')).toThrowError(expect.objectContaining({ kind: 'clipboard-empty' }))
    expect(() => parseItem(fx('german.txt'))).toThrowError(expect.objectContaining({ kind: 'not-english' }))
  })

  it('handles Windows line endings', () => {
    expect(parseItem(fx('rare-wand.txt').replace(/\n/g, '\r\n')).mods).toHaveLength(5)
  })

  it('counts the longest linked group', () => {
    expect(longestLink('R-G-B-B-R-G')).toBe(6)
    expect(longestLink('R-G B-B-R')).toBe(3)
    expect(longestLink('R G B')).toBe(1)
  })
})

describe('stat matching', () => {
  it('maps mods to trade stats and averages ranges', () => {
    const item = parseItem(fx('rare-wand.txt'))
    const hits = item.mods.map(m => index.match(m))
    expect(hits.map(h => h?.stat.id)).toEqual([
      'implicit.t_spell_dmg', 'explicit.t_fire_gems', 'explicit.t_fire_spells', 'explicit.t_mana', 'explicit.t_fire_res'
    ])
    expect(hits[2]?.value).toBe(29)
  })

  it('maps "reduced" to the "increased" stat with a negative value', () => {
    const hit = index.match({ text: '12% reduced Attribute Requirements', source: 'explicit', values: [12] })
    expect(hit?.stat.id).toBe('explicit.t_attr_req')
    expect(hit?.value).toBe(-12)
  })

  it('falls back from crafted to explicit and matches value-less stats', () => {
    expect(index.match({ text: '+15 to maximum Mana', source: 'crafted', values: [15] })?.stat.id).toBe('crafted.t_mana')
    expect(index.match({ text: '30% increased Stun and Block Recovery', source: 'crafted', values: [30] })?.stat.id).toBe('explicit.t_stun')
    expect(index.match({ text: 'Cannot be Frozen', source: 'explicit', values: [] })).toMatchObject({ value: null })
  })
})

describe('buildFilters', () => {
  it('sums pseudo totals and hides the resistance lines they consumed', () => {
    const { stats: f, unmatched } = buildFilters(parseItem(fx('rare-boots.txt')), index, 10)
    const byId = Object.fromEntries(f.map(s => [s.statId, s]))
    expect(byId['pseudo.pseudo_total_life']?.value).toBe(85) // 70 + 30 str / 2
    expect(byId['pseudo.pseudo_total_elemental_resistance']?.value).toBe(85) // 12*2 + 40 + 21
    expect(byId['pseudo.pseudo_total_chaos_resistance']?.value).toBe(12)
    expect(byId['pseudo.pseudo_increased_movement_speed']?.min).toBe(27)
    expect(f.some(s => s.statId === 'explicit.t_cold_res')).toBe(false)
    expect(f.some(s => s.statId === 'explicit.t_life')).toBe(true) // life is not hidden
    expect(f.filter(s => s.pseudo).every(s => s.enabled)).toBe(true)
    expect(unmatched).toEqual([])
  })

  it('drops pseudo rules whose ID the live stat list does not know', () => {
    const small = new StatIndex(stats.filter(s => s.id !== 'pseudo.pseudo_total_chaos_resistance'))
    const { stats: f } = buildFilters(parseItem(fx('rare-boots.txt')), small)
    expect(f.some(s => s.statId === 'pseudo.pseudo_total_chaos_resistance')).toBe(false)
    expect(f.some(s => s.statId === 'explicit.t_chaos_res')).toBe(true)
  })

  it('applies tolerance downwards, also for negative values', () => {
    expect(withTolerance(100, 10)).toBe(90)
    expect(withTolerance(-12, 10)).toBe(-13)
    expect(withTolerance(5, 99)).toBe(2) // capped at 50 %
  })
})

describe('buildSearch', () => {
  it('builds a rare search with enabled stats only', () => {
    const item = parseItem(fx('rare-boots.txt'))
    const f = buildFilters(item, index)
    const body = buildSearch(item, f.stats, f.props)
    const q = body.query as any
    expect(q.status.option).toBe('online')
    expect(q.type).toBe('Two-Toned Boots')
    expect(q.filters.type_filters.filters.rarity.option).toBe('nonunique')
    expect(q.stats[0].filters.map((x: any) => x.id)).toEqual(f.stats.filter(s => s.enabled).map(s => s.statId))
    expect(body.sort).toEqual({ price: 'asc' })
  })

  it('searches uniques by name, gems by level and quality', () => {
    const u = parseItem(fx('unique-belt.txt'))
    const uf = buildFilters(u, index)
    const uq = buildSearch(u, uf.stats, uf.props).query as any
    expect(uq.name).toBe('Coiled Promise')
    expect(uq.filters.misc_filters.filters.corrupted.option).toBe('true')
    const g = parseItem(fx('gem.txt'))
    const gf = buildFilters(g, index)
    const gq = buildSearch(g, gf.stats, gf.props).query as any
    expect(gq.type).toBe('Fireball')
    expect(gq.filters.misc_filters.filters).toMatchObject({ gem_level: { min: 20 }, quality: { min: 20 } })
  })

  it('refuses a rare search without stats', () => {
    const item = parseItem(fx('rare-wand.txt'))
    const f = buildFilters(item, index)
    expect(canSearch(item, f.stats.map(s => ({ ...s, enabled: false })))).toBe(false)
  })

  it('builds trade site links safely', () => {
    expect(tradeSiteUrl('Settlers of Kalguur', 'abc')).toBe('https://www.pathofexile.com/trade/search/Settlers%20of%20Kalguur/abc')
  })
})

describe('toListings', () => {
  it('maps status, tab pricing and groups by seller', () => {
    const l = toListings(JSON.parse(fx('fetch.json')).result)
    expect(l).toHaveLength(3)
    expect(l[0]).toMatchObject({ seller: 'Seller1', status: 'online', tabPriced: false, count: 1 })
    expect(l[1]).toMatchObject({ seller: 'Seller2', status: 'afk', tabPriced: true, count: 2 })
    expect(l[2]).toMatchObject({ status: 'offline', currency: 'divine' })
  })
})

describe('RateLimiter', () => {
  it('blocks when the window is full, with one slot spare', () => {
    let t = 0
    const rl = new RateLimiter(() => t)
    rl.update('search', { 'x-rate-limit-rules': 'Ip', 'x-rate-limit-ip': '3:10:60', 'x-rate-limit-ip-state': '1:10:0' }, 200)
    rl.record('search'); t = 1000
    expect(rl.waitMs('search')).toBe(0)
    rl.record('search'); t = 2000
    expect(rl.waitMs('search')).toBe(8000) // first hit at 0 expires at 10 s
    t = 10_001
    expect(rl.waitMs('search')).toBe(0)
  })

  it('honours restrictions and 429 Retry-After', () => {
    let t = 0
    const rl = new RateLimiter(() => t)
    rl.update('fetch', { 'x-rate-limit-rules': 'Ip', 'x-rate-limit-ip': '10:5:10', 'x-rate-limit-ip-state': '11:5:10' }, 200)
    expect(rl.waitMs('fetch')).toBe(10_000)
    rl.update('x', {}, 429)
    expect(rl.waitMs('x')).toBe(60_000)
    rl.update('y', { 'retry-after': '7' }, 429)
    expect(rl.waitMs('y')).toBe(7000)
  })

  it('parses rule headers', () => {
    expect(parseRules('8:10:60,15:60:120')).toEqual([{ hits: 8, periodMs: 10_000 }, { hits: 15, periodMs: 60_000 }])
    expect(parseRules('garbage')).toEqual([])
  })
})

describe('price aggregator', () => {
  const lines = [
    { currencyTypeName: 'Divine Orb', chaosEquivalent: 200, receiveSparkLine: { totalChange: 3.5 } },
    { currencyTypeName: 'Exalted Orb', chaosEquivalent: 12 }
  ]
  it('converts currency to chaos and divine', () => {
    const d = divinePrice(lines)
    expect(findCurrency(lines, 'Divine Orb', d)).toMatchObject({ chaosValue: 200, divineValue: 1, changePct: 3.5 })
    expect(findCurrency(lines, 'Exalted Orb', d)?.divineValue).toBe(0.06)
    expect(findCurrency(lines, 'Chaos Orb', d)?.chaosValue).toBe(1)
    expect(findCurrency(lines, 'Mirror of Kalandra', d)).toBeNull()
  })
  it('finds uniques and picks the right overview', () => {
    const item = parseItem(fx('unique-belt.txt'))
    expect(overviewTypeFor(item)).toEqual({ kind: 'item', type: 'UniqueAccessory' })
    expect(findItem([{ name: 'Coiled Promise', chaosValue: 42.26 }], item)?.chaosValue).toBe(42.3)
  })
})

describe('config', () => {
  it('repairs broken or partial config', () => {
    expect(loadConfig(DEFAULT_CONFIG).repaired).toBe(false)
    expect(loadConfig({ leagueId: 'Hardcore' })).toMatchObject({ repaired: true, config: { leagueId: 'Hardcore' } })
    expect(loadConfig('nonsense').config).toEqual(DEFAULT_CONFIG)
    expect(loadConfig({ ...DEFAULT_CONFIG, searchTolerancePct: 400 }).config.searchTolerancePct).toBe(10)
  })
  it('finds hotkey conflicts across actions and chat commands', () => {
    expect(findConflict(DEFAULT_CONFIG, 'Ctrl+D')).toBe('priceCheck')
    expect(findConflict(DEFAULT_CONFIG, 'Ctrl+D', { action: 'priceCheck' })).toBeNull()
    expect(findConflict(DEFAULT_CONFIG, 'F5')).toBe('chat: /hideout')
    expect(findConflict(DEFAULT_CONFIG, 'F6')).toBeNull()
  })
  it('expands @last for whispers and commands', () => {
    expect(expandChatCommand('@last Good luck!', 'Tom')).toBe('@Tom Good luck!')
    expect(expandChatCommand('/invite @last', 'Tom')).toBe('/invite Tom')
    expect(expandChatCommand('/invite @last', null)).toBeNull()
    expect(expandChatCommand('/hideout', null)).toBe('/hideout')
  })
})
