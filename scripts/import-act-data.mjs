// Converts third-party data into the compact files the Act Tracker ships with.
// Usage: node scripts/import-act-data.mjs <path to exile-leveling> <path to skilltree-export>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [el, st] = process.argv.slice(2)
if (!el || !st) { console.error('usage: import-act-data.mjs <exile-leveling> <skilltree-export>'); process.exit(1) }
const out = new URL('../src/shared/act/data/', import.meta.url)
const read = p => JSON.parse(readFileSync(p, 'utf8'))
const write = (name, data) => { writeFileSync(new URL(name, out), typeof data === 'string' ? data : JSON.stringify(data)); console.log('wrote', name) }

// route: concatenate acts in order, unchanged
const route = Array.from({ length: 10 }, (_, i) => readFileSync(join(el, `common/data/routes/act-${i + 1}.txt`), 'utf8').trimEnd()).join('\n')
write('route.txt', route + '\n')

const areas = read(join(el, 'common/data/json/areas.json'))
write('areas.json', Object.fromEntries(Object.values(areas).map(a => [a.id, {
  n: a.name, a: a.act, l: a.level, t: a.is_town_area ? 1 : 0, p: a.parent_town_area_id, w: a.has_waypoint ? 1 : 0
}])))

const quests = read(join(el, 'common/data/json/quests.json'))
write('quests.json', Object.fromEntries(Object.values(quests).map(q => [q.id, {
  n: q.name, a: Number(q.act),
  r: Object.fromEntries(Object.entries(q.reward_offers).map(([offerId, o]) => [offerId, {
    npc: o.quest_npc,
    q: Object.fromEntries(Object.entries(o.quest ?? {}).map(([g, v]) => [g, v.classes])),
    v: Object.fromEntries(Object.entries(o.vendor ?? {}).map(([g, v]) => [g, { c: v.classes, npc: v.npc }]))
  }]))
}])))

const gems = read(join(el, 'common/data/json/gems.json'))
write('gems.json', Object.fromEntries(Object.values(gems).map(g => [g.id, { n: g.name, l: g.required_level, s: g.is_support ? 1 : 0, c: g.primary_attribute?.[0] ?? '' }])))
write('characters.json', read(join(el, 'common/data/json/characters.json')))

// skill tree: precompute positions so the app never needs the 6 MB source file
const t = read(join(st, 'data.json'))
const { orbitRadii, skillsPerOrbit } = t.constants
const ANGLES = {
  16: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
  40: [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350]
}
const angle = (count, i) => (ANGLES[count]?.[i] ?? (360 * i) / count) * Math.PI / 180
const nodes = {}
const edges = new Set()
for (const [id, n] of Object.entries(t.nodes)) {
  if (id === 'root' || n.group === undefined || n.isProxy || n.isBlighted || n.expansionJewel) continue
  const g = t.groups[n.group]
  if (!g || g.isProxy) continue
  const r = orbitRadii[n.orbit] ?? 0
  const a = angle(skillsPerOrbit[n.orbit] ?? 1, n.orbitIndex ?? 0)
  const flags = (n.isNotable ? 1 : 0) | (n.isKeystone ? 2 : 0) | (n.isMastery ? 4 : 0) | (n.classStartIndex !== undefined ? 8 : 0) | (n.isJewelSocket ? 16 : 0) | (n.isAscendancyStart ? 32 : 0)
  nodes[id] = [Math.round(g.x + r * Math.sin(a)), Math.round(g.y - r * Math.cos(a)), flags, n.ascendancyName ?? '', n.name ?? '', n.classStartIndex ?? -1]
}
for (const [id, n] of Object.entries(t.nodes)) {
  if (!nodes[id] || n.isMastery) continue
  for (const o of n.out ?? []) {
    if (!nodes[o] || t.nodes[o]?.isMastery) continue
    if ((nodes[id][3] || '') !== (nodes[o][3] || '')) continue // no lines between ascendancy and main tree
    if ((nodes[id][2] & 8) || (nodes[o][2] & 8)) continue // class start ring is drawn separately
    edges.add(id < o ? `${id}-${o}` : `${o}-${id}`)
  }
}
write('tree.json', {
  version: t.tree ?? '',
  classes: t.classes.map(c => ({ name: c.name, asc: c.ascendancies.map(a => a.name) })),
  nodes,
  edges: [...edges].map(e => e.split('-').map(Number))
})

write('../../../../resources/THIRD_PARTY.md', `# Third-party data

## exile-leveling (route, areas, quests, gems, characters)
https://github.com/HeartofPhos/exile-leveling

${readFileSync(join(el, 'LICENSE'), 'utf8')}

## Passive skill tree data
https://github.com/grindinggear/skilltree-export – published by Grinding Gear Games for community tools.
Assay isn't affiliated with or endorsed by Grinding Gear Games.
`)
