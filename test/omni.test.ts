import { describe, expect, it } from 'vitest'
import { DEFAULT_OMNI_STRINGS } from '../src/shared/config'

// Path of Exile checks a quoted search as a case-insensitive regular expression on each line of the item.
const matches = (search: string, item: string) => new RegExp(search.replace(/^"|"$/g, ''), 'im').test(item)
const s = (name: string) => DEFAULT_OMNI_STRINGS.find(x => x.name === name)!.regex

const boots = 'Item Class: Boots\nRarity: Magic\nRunner\'s Leather Boots\n--------\nSockets: R-G B\n--------\n10% increased Movement Speed'
const wand = 'Item Class: Wands\nRarity: Magic\nDriftwood Wand\n--------\nSockets: B-B-R\n--------\n+1 to Level of all Fire Spell Skill Gems'
const sword = 'Item Class: One Hand Swords\nRarity: Magic\nRusted Sword\n--------\nSockets: R-G-B-R\n--------\nAdds 2 to 4 Physical Damage\n12% increased Attack Speed'
const ring = 'Item Class: Rings\nRarity: Magic\nIron Ring\n--------\n+12% to Cold Resistance'

describe('omni key item searches', () => {
  it('fit within the game\'s 250 characters and are quoted', () => {
    for (const x of DEFAULT_OMNI_STRINGS) { expect(x.regex.length).toBeLessThanOrEqual(250); expect(x.regex).toMatch(/^".*"$/) }
  })
  it('find what they say and nothing else', () => {
    expect(matches(s('Movement speed'), boots)).toBe(true)
    expect(matches(s('Movement speed'), sword)).toBe(false) // attack speed is not movement speed
    expect(matches(s('3-link or more'), wand)).toBe(true)
    expect(matches(s('3-link or more'), boots)).toBe(false) // R-G B is a 2-link
    expect(matches(s('4-link or more'), sword)).toBe(true)
    expect(matches(s('4-link or more'), wand)).toBe(false)
    expect(matches(s('Red-green-blue link'), sword)).toBe(true)
    expect(matches(s('Red-green-blue link'), wand)).toBe(false)
    expect(matches(s('+1 to gem levels'), wand)).toBe(true)
    expect(matches(s('Physical damage weapon'), sword)).toBe(true)
    for (const x of DEFAULT_OMNI_STRINGS) expect(matches(x.regex, ring)).toBe(false)
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePobXml } from '../src/shared/act/pob'
import { newSlot } from '../src/shared/act/state'
import { parseRoute } from '../src/shared/act/route'
import { AREAS, DEFAULT_ROUTE } from '../src/shared/act/data'
import { allBuildGemStrings, gemPlanFor, gemsToBuyOnPage } from '../src/shared/act/plan'

describe('omni key gem searches', () => {
  const slot = { ...newSlot(1), pob: parsePobXml(readFileSync(join(__dirname, 'fixtures', 'pob.xml'), 'utf8')) }
  const plan = gemPlanFor(slot)
  const { pages } = parseRoute(DEFAULT_ROUTE, slot.options, AREAS)
  it('lists the gems to buy on the pages with quest hand-ins, and only there', () => {
    const withBuys = pages.map(p => gemsToBuyOnPage(plan, p)).filter(g => g.length)
    expect(withBuys.length).toBeGreaterThan(0)
    expect(gemsToBuyOnPage(plan, pages[0])).toEqual([]) // the first page has no vendor stop
    const all = allBuildGemStrings(slot)
    expect(all.length).toBeGreaterThan(0)
    for (const part of all) expect(part.length).toBeLessThanOrEqual(250)
  })
})

import { combineItemSearches } from '../src/shared/omni'
describe('omni key items entry', () => {
  it('joins all item searches into one quoted search that still finds each kind of item', () => {
    const parts = combineItemSearches(DEFAULT_OMNI_STRINGS.map(x => x.regex))
    expect(parts).toHaveLength(1)
    expect(parts[0]!.length).toBeLessThanOrEqual(250)
    for (const item of [boots, wand, sword]) expect(matches(parts[0]!, item)).toBe(true)
    expect(matches(parts[0]!, ring)).toBe(false)
  })
  it('splits when the game limit would be exceeded', () => {
    const parts = combineItemSearches(Array.from({ length: 12 }, (_, i) => `"${'x'.repeat(30)}${i}"`))
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(250)
  })
})
