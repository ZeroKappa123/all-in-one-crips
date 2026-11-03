import type { ParsedItem, PropertyFilters, StatFilter } from '../types'
import { StatIndex } from './matchStats'
import { computePseudo, PSEUDO_RULES } from './pseudo'

export interface FilterSet {
  stats: StatFilter[]
  unmatched: string[] // mod lines with no trade stat; shown greyed out
  props: PropertyFilters
}

/** Lower bound a search starts from: a bit below the item's own roll so similar items show up. */
export function withTolerance(value: number, tolerancePct: number): number {
  const t = Math.max(0, Math.min(50, tolerancePct)) / 100
  if (value < 0) return Math.ceil(value * (1 + t))
  return Math.floor(value * (1 - t))
}

export function buildFilters(item: ParsedItem, index: StatIndex, tolerancePct = 10): FilterSet {
  const rules = PSEUDO_RULES.filter(r => index.has(r.id))
  const pseudo = computePseudo(item.mods, rules)
  const hidden = new Set(pseudo.flatMap(p => p.consumed))

  const stats: StatFilter[] = pseudo.map((p, i) => ({
    key: `p${i}`,
    statId: p.id,
    label: p.label.replace('#', String(p.value)),
    value: p.value,
    min: withTolerance(p.value, tolerancePct),
    max: null,
    enabled: false,
    pseudo: true,
    source: 'pseudo'
  }))

  const unmatched: string[] = []
  item.mods.forEach((mod, i) => {
    if (hidden.has(mod)) return
    const hit = index.match(mod)
    if (!hit) { unmatched.push(mod.text); return }
    stats.push({
      key: `m${i}`,
      statId: hit.stat.id,
      label: mod.text,
      value: hit.value,
      min: hit.value === null ? null : withTolerance(hit.value, tolerancePct),
      max: null,
      enabled: false,
      pseudo: false,
      source: mod.source
    })
  })

  // Uniques are mostly identified by name, rares need the user to pick what matters.
  // Pre-tick the pseudo totals, they are what most searches start from.
  if (item.rarity === 'rare' || item.rarity === 'magic') {
    for (const s of stats) if (s.pseudo) s.enabled = true
  }

  const props: PropertyFilters = {
    itemLevelMin: null, // off by default; the panel offers the item's own level as a one-click filter
    linksMin: item.links >= 5 ? item.links : null,
    qualityMin: item.rarity === 'gem' && item.quality ? item.quality : null,
    gemLevelMin: item.rarity === 'gem' && item.gemLevel ? item.gemLevel : null,
    mapTier: item.mapTier ?? null,
    corrupted: item.rarity === 'gem' || item.rarity === 'unique' ? item.corrupted : null,
    useBaseType: item.rarity !== 'magic'
  }
  return { stats, unmatched, props }
}
