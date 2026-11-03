import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { parseRoute, parseFragments, DEFAULT_OPTIONS, arrow, fragmentText } from '@shared/act/route'
import { onAreaEntered, jumpToArea, step } from '@shared/act/guide'
import { parseLogLine, snapshot, LineBuffer } from '@shared/act/log'
import { newTimer, toggle, tick, enterArea, csvRow, fmtDuration, EPILOGUE_AREA } from '@shared/act/timer'
import { expInfo } from '@shared/act/exp'
import { parsePobXml, codeToBytes, classifyImport, buildGems, groupsWithGem } from '@shared/act/pob'
import { planGems, resolveGem, vendorSearchStrings, LIBRARY_QUEST } from '@shared/act/gems'
import { diffSpecs } from '@shared/act/tree'
import { AREAS, QUESTS, GEMS, CHARACTERS, DEFAULT_ROUTE, questOrder } from '@shared/act/data'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8')

describe('route language', () => {
  it('parses fragments and strips comments', () => {
    expect(parseFragments('Find and kill {kill|Hillock}')).toEqual([{ t: 'text', v: 'Find and kill ' }, { t: 'kill', v: 'Hillock' }])
    expect(parseFragments('Go {dir|270}')[1]).toEqual({ t: 'dir', deg: 270 })
    expect(parseFragments('{quest|a1q2|a1q2b}')[0]).toEqual({ t: 'quest', id: 'a1q2', offer: 'a1q2b' })
    expect(parseFragments('{quest|a1q1}')[0]).toEqual({ t: 'quest', id: 'a1q1', offer: 'a1q1' })
    expect(arrow(270)).toBe('←')
    expect(arrow(0)).toBe('↑')
  })

  it('turns the shipped route into pages that each end in a known area', () => {
    const r = parseRoute(DEFAULT_ROUTE, DEFAULT_OPTIONS, AREAS)
    expect(r.pages.length).toBeGreaterThan(200)
    expect(r.pages[0]!.target).toBe('1_1_town')
    expect(r.pages[0]!.act).toBe(1)
    expect(r.pages.at(-1)!.act).toBe(10)
    const withoutTarget = r.pages.filter(p => !p.target)
    expect(withoutTarget.length).toBeLessThanOrEqual(10) // at most the closing steps of each act
    // every unknown id must be a labyrinth zone not listed in the area table
    expect(r.unknownAreas.every(a => /Labyrinth/.test(a))).toBe(true)
  })

  it('honours conditions', () => {
    const ls = parseRoute(DEFAULT_ROUTE, { ...DEFAULT_OPTIONS, leagueStart: true }, AREAS).pages
    const no = parseRoute(DEFAULT_ROUTE, { ...DEFAULT_OPTIONS, leagueStart: false }, AREAS).pages
    expect(ls.length).toBeGreaterThan(no.length) // league start adds the Tidal Island detour
    const text = (pages: typeof ls) => JSON.stringify(pages)
    expect(text(ls)).toContain('Hailrake')
    expect(text(no)).not.toContain('Hailrake')
  })

  it('derives logout and portal targets from where the player is', () => {
    const r = parseRoute('#section Act 1\n➞ {enter|1_1_2}\nDo stuff\n{logout}\n➞ {enter|1_1_3}\n{portal|set}\n{logout}\nTake {portal|use}', DEFAULT_OPTIONS, AREAS)
    expect(r.pages.map(p => p.target)).toEqual(['1_1_2', '1_1_town', '1_1_3', '1_1_town', '1_1_3'])
  })

  it('attaches #sub hints to the step above, even across a page break', () => {
    const r = parseRoute('#section Act 1\n➞ {enter|1_1_2}\n    #sub Go {dir|90}', DEFAULT_OPTIONS, AREAS)
    expect(r.pages[0]!.steps[0]!.hints).toHaveLength(1)
    expect(fragmentText(r.pages[0]!.steps[0]!.fragments, AREAS, id => id)).toBe('➞ The Coast')
  })

  it('reports unknown areas for the editor', () => {
    expect(parseRoute('➞ {enter|nowhere}', DEFAULT_OPTIONS, AREAS).unknownAreas).toEqual(['nowhere'])
  })
})

describe('guide progress', () => {
  const pages = parseRoute(DEFAULT_ROUTE, DEFAULT_OPTIONS, AREAS).pages
  it('advances only on the current target', () => {
    let s = { page: 0 }
    s = onAreaEntered(pages, s, '1_1_2') // not the target yet
    expect(s.page).toBe(0)
    s = onAreaEntered(pages, s, '1_1_town')
    expect(s.page).toBe(1)
  })
  it('jumps to the page after the current area and steps within bounds', () => {
    const s = jumpToArea(pages, { page: 0 }, '1_1_3')
    expect(pages[s.page - 1]!.target).toBe('1_1_3')
    expect(step(pages, { page: 0 }, -1).page).toBe(0)
    expect(step(pages, { page: pages.length - 1 }, 5).page).toBe(pages.length - 1)
    expect(jumpToArea(pages, { page: 3 }, 'not-an-area').page).toBe(3)
  })
})

describe('Client.txt', () => {
  it('reads areas, level-ups, whispers and AFK', () => {
    const lines = fx('client.txt').split('\n')
    expect(parseLogLine(lines[1]!)).toMatchObject({ kind: 'area', id: '1_1_1', level: 1 })
    expect(parseLogLine(lines[3]!)).toMatchObject({ kind: 'levelUp', character: 'Marc_Wit', className: 'Witch', level: 2 })
    expect(parseLogLine(lines[6]!)).toMatchObject({ kind: 'whisper', direction: 'from', name: 'Some_Seller' })
    expect(parseLogLine(lines[10]!)).toMatchObject({ kind: 'afk', on: true })
    expect(parseLogLine('garbage')).toBeNull()
    expect(snapshot(lines)).toEqual({ areaId: '1_1_2', areaLevel: 2, levels: { Marc_Wit: 4 }, lastWhisper: 'Some_Seller' })
  })
  it('buffers partial lines between reads', () => {
    const b = new LineBuffer()
    expect(b.push('abc\nde')).toEqual(['abc'])
    expect(b.push('f\r\ng')).toEqual(['def'])
  })
})

describe('timer', () => {
  it('counts per act, ignores AFK, finishes in the epilogue', () => {
    let s = toggle(newTimer(), Date.UTC(2026, 10, 3))
    s = tick(s, 1000, true)
    s = tick(s, 1000, false) // AFK
    s = enterArea(s, '1_2_1', 2).state
    s = tick(s, 2000, true)
    s = enterArea(s, '1_1_town', 1).state // going back does not lower the act
    expect(s.act).toBe(2)
    s = tick(s, 60_000, true) // capped at 5 s per tick
    expect(s.totalMs).toBe(8000)
    expect(s.actMs).toEqual({ 1: 1000, 2: 7000 })
    const end = enterArea(s, EPILOGUE_AREA, 11)
    expect(end.finishedNow).toBe(true)
    expect(tick(end.state, 1000, true).totalMs).toBe(8000)
    expect(csvRow(end.state)).toMatch(/^2026-11-03T00:00:00.000Z,00:08,00:01,00:07,00:00/)
  })
  it('does nothing while paused and formats hours', () => {
    expect(tick(newTimer(), 1000, true).totalMs).toBe(0)
    expect(fmtDuration(3_723_000)).toBe('1:02:03')
  })
})

describe('experience', () => {
  it('has a safe zone and penalises distance', () => {
    expect(expInfo(10, 10)).toMatchObject({ factor: 1, min: 7, max: 13, offBy: 0 })
    expect(expInfo(10, 15).offBy).toBe(2)
    expect(expInfo(10, 15).factor).toBeLessThan(1)
    expect(expInfo(32, 25)).toMatchObject({ min: 27, offBy: -2 })
  })
})

describe('Path of Building', () => {
  it('decodes an export code and reads class, gems and specs', () => {
    const xml = inflateSync(codeToBytes(fx('pob-code.txt'))).toString('utf8')
    const b = parsePobXml(xml)
    expect(b).toMatchObject({ className: 'Witch', ascendancy: 'Elementalist', level: 70 })
    expect(b.skillSets.map(s => s.title)).toEqual(['Early', 'Late'])
    expect(b.specs[1]).toMatchObject({ title: 'Act 5', nodes: [100, 300, 400, 500], ascendancy: 'Elementalist' })
    expect(buildGems(b).map(g => g.name)).toEqual(['Fireball', 'Arcane Surge', 'Added Fire Damage', 'Flame Dash'])
    expect(groupsWithGem(b, 'Fireball')).toHaveLength(2)
    expect(groupsWithGem(b, 'Added Fire Damage Support')).toHaveLength(1)
  })
  it('recognises what was pasted', () => {
    expect(classifyImport('https://pobb.in/AbC_12-x')).toEqual({ kind: 'pobbin', id: 'AbC_12-x' })
    expect(classifyImport(fx('pob-code.txt'))?.kind).toBe('code')
    expect(classifyImport('#section Act 1\n➞ {enter|1_1_2}')?.kind).toBe('guide')
    expect(classifyImport('hello')).toBeNull()
    expect(() => parsePobXml('<x/>')).toThrow()
  })
})

describe('gem plan', () => {
  const b = parsePobXml(fx('pob.xml'))
  const wanted = buildGems(b).map(g => resolveGem(g, GEMS)).filter((x): x is string => !!x)
  const ch = CHARACTERS.Witch!
  it('resolves PoB gems by id and by name', () => {
    expect(wanted).toContain('Metadata/Items/Gems/SupportGemAddedFireDamage')
    expect(wanted).toHaveLength(4)
  })
  it('plans quest rewards and vendor buys for the class, skipping starting gems', () => {
    const plan = planGems('Witch', wanted, questOrder(DEFAULT_ROUTE), QUESTS, [ch.start_gem_id, ch.chest_gem_id])
    const all = Object.values(plan.byQuest)
    const got = new Set(all.flatMap(p => [p.take, ...p.buy.map(b => b.gem)]).filter(Boolean))
    expect(got.has('Metadata/Items/Gems/SkillGemFireball')).toBe(false) // Witch starts with it
    expect(got.has('Metadata/Items/Gems/SupportGemAddedFireDamage')).toBe(true)
    expect(got.has('Metadata/Items/Gems/SkillGemFlameDash')).toBe(true)
    expect(plan.notAvailable).toEqual([])
    expect(plan.libraryGems).toContain('Metadata/Items/Gems/SupportGemAddedFireDamage') // Witch can only buy it in the library
  })
  it('respects removals and "not before act"', () => {
    const plan = planGems('Witch', wanted, questOrder(DEFAULT_ROUTE), QUESTS, [], {
      'Metadata/Items/Gems/SkillGemFlameDash': { removed: true },
      'Metadata/Items/Gems/SupportGemAddedFireDamage': { notBeforeAct: 3 }
    })
    const found = Object.entries(plan.byQuest).flatMap(([q, p]) => [p.take, ...p.buy.map(b => b.gem)].filter(Boolean).map(g => [q.split('|')[0]!, g] as const))
    expect(found.some(([, g]) => g === 'Metadata/Items/Gems/SkillGemFlameDash')).toBe(false)
    const fire = found.find(([, g]) => g === 'Metadata/Items/Gems/SupportGemAddedFireDamage')
    expect(QUESTS[fire![0]]!.a).toBeGreaterThanOrEqual(3)
    expect(typeof LIBRARY_QUEST).toBe('string')
  })
  it('splits vendor search strings at the limit', () => {
    const names = Array.from({ length: 40 }, (_, i) => `Gem Number ${i} Support`)
    const parts = vendorSearchStrings(names)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(p => p.length <= 250 && p.startsWith('"') && p.endsWith('"'))).toBe(true)
    expect(vendorSearchStrings(['Fireball', 'fireball'])).toEqual(['"fireball"'])
  })
})

describe('tree', () => {
  it('marks new and respecced nodes against the previous spec', () => {
    const d = diffSpecs([100, 300, 400], [100, 200, 300])
    expect(d.get(400)).toBe('added')
    expect(d.get(200)).toBe('removed')
    expect(d.get(100)).toBe('kept')
    expect(diffSpecs([1], null).get(1)).toBe('kept')
  })
})
