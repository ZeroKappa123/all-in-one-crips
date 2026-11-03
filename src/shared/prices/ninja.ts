import type { ParsedItem, PriceSnapshot } from '../types'

/**
 * Price aggregator for currency and uniques. The base URL is configurable because
 * the aggregator has moved endpoints before; a failing source only hides the summary,
 * it never blocks the trade search.
 */
export const DEFAULT_NINJA_BASE = 'https://poe.ninja/api/data'

interface CurrencyLine { currencyTypeName: string; chaosEquivalent?: number; receiveSparkLine?: { totalChange?: number } }
interface ItemLine { name: string; baseType?: string; chaosValue?: number; divineValue?: number; links?: number; sparkline?: { totalChange?: number } }

export function currencyUrl(base: string, league: string, type: 'Currency' | 'Fragment'): string {
  return `${base}/currencyoverview?league=${encodeURIComponent(league)}&type=${type}`
}

export function itemUrl(base: string, league: string, type: string): string {
  return `${base}/itemoverview?league=${encodeURIComponent(league)}&type=${type}`
}

export function overviewTypeFor(item: ParsedItem): { kind: 'currency' | 'item'; type: string } | null {
  if (item.rarity === 'currency') return { kind: 'currency', type: 'Currency' }
  if (item.rarity === 'divination') return { kind: 'item', type: 'DivinationCard' }
  if (item.rarity !== 'unique') return null
  const c = item.itemClass ?? ''
  if (/Body Armours|Helmets|Gloves|Boots|Shields|Quivers/.test(c)) return { kind: 'item', type: 'UniqueArmour' }
  if (/Rings|Amulets|Belts/.test(c)) return { kind: 'item', type: 'UniqueAccessory' }
  if (/Jewels/.test(c)) return { kind: 'item', type: 'UniqueJewel' }
  if (/Flasks/.test(c)) return { kind: 'item', type: 'UniqueFlask' }
  if (/Maps/.test(c)) return { kind: 'item', type: 'UniqueMap' }
  return { kind: 'item', type: 'UniqueWeapon' }
}

export function divinePrice(currencyLines: CurrencyLine[]): number | null {
  return currencyLines.find(l => l.currencyTypeName === 'Divine Orb')?.chaosEquivalent ?? null
}

export function findCurrency(lines: CurrencyLine[], name: string, divine: number | null): PriceSnapshot | null {
  if (name === 'Chaos Orb') return { name, chaosValue: 1, divineValue: divine ? round(1 / divine, 4) : null, changePct: 0 }
  const l = lines.find(x => x.currencyTypeName === name)
  if (!l?.chaosEquivalent) return null
  return {
    name,
    chaosValue: round(l.chaosEquivalent, 2),
    divineValue: divine ? round(l.chaosEquivalent / divine, 3) : null,
    changePct: l.receiveSparkLine?.totalChange ?? null
  }
}

export function findItem(lines: ItemLine[], item: ParsedItem): PriceSnapshot | null {
  const name = item.name ?? item.baseType
  // Uniques with 5/6 links are listed separately; match on links when the item has them.
  const links = item.links >= 5 ? item.links : undefined
  const l = lines.find(x => x.name === name && (x.links ?? undefined) === links) ?? lines.find(x => x.name === name && !x.links)
  if (!l?.chaosValue) return null
  return { name, chaosValue: round(l.chaosValue, 1), divineValue: l.divineValue ?? null, changePct: l.sparkline?.totalChange ?? null }
}

function round(n: number, d: number): number {
  const f = 10 ** d
  return Math.round(n * f) / f
}
