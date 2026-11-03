import type { Listing, ParsedItem, PropertyFilters, SellerStatus, StatFilter } from '../types'

export interface SearchBody {
  query: Record<string, unknown>
  sort: { price: 'asc' }
}

const CLASS_TO_CATEGORY: Record<string, string> = {
  'Body Armours': 'armour.chest', Helmets: 'armour.helmet', Gloves: 'armour.gloves', Boots: 'armour.boots',
  Shields: 'armour.shield', Quivers: 'armour.quiver', Belts: 'accessory.belt', Rings: 'accessory.ring',
  Amulets: 'accessory.amulet', Jewels: 'jewel', 'Abyss Jewels': 'jewel.abyss', Wands: 'weapon.wand',
  Daggers: 'weapon.dagger', 'Rune Daggers': 'weapon.runedagger', Claws: 'weapon.claw', Bows: 'weapon.bow',
  Staves: 'weapon.staff', Warstaves: 'weapon.warstaff', Sceptres: 'weapon.sceptre',
  'One Hand Swords': 'weapon.onesword', 'Two Hand Swords': 'weapon.twosword',
  'One Hand Axes': 'weapon.oneaxe', 'Two Hand Axes': 'weapon.twoaxe',
  'One Hand Maces': 'weapon.onemace', 'Two Hand Maces': 'weapon.twomace', Maps: 'map', Flasks: 'flask'
}

export function buildSearch(item: ParsedItem, stats: StatFilter[], props: PropertyFilters, onlineOnly = true): SearchBody {
  const query: Record<string, unknown> = { status: { option: onlineOnly ? 'online' : 'any' } }

  if (item.rarity === 'unique' && item.name) {
    query.name = item.name
    query.type = item.baseType
  } else if (item.rarity === 'gem' || item.rarity === 'currency' || item.rarity === 'divination') {
    query.type = item.baseType
  } else if (props.useBaseType && item.rarity !== 'magic') {
    query.type = item.baseType
  }

  const filters: Record<string, unknown> = {}
  const category = item.itemClass ? CLASS_TO_CATEGORY[item.itemClass] : undefined
  if (category && !query.type) filters.type_filters = { filters: { category: { option: category } } }
  if (item.rarity === 'rare' || item.rarity === 'magic' || item.rarity === 'unique') {
    const tf = (filters.type_filters ?? { filters: {} }) as { filters: Record<string, unknown> }
    tf.filters.rarity = { option: item.rarity === 'unique' ? 'unique' : 'nonunique' }
    filters.type_filters = tf
  }

  const misc: Record<string, unknown> = {}
  if (props.itemLevelMin !== null) misc.ilvl = { min: props.itemLevelMin }
  if (props.gemLevelMin !== null) misc.gem_level = { min: props.gemLevelMin }
  if (props.qualityMin !== null) misc.quality = { min: props.qualityMin }
  if (props.corrupted !== null) misc.corrupted = { option: String(props.corrupted) }
  if (Object.keys(misc).length) filters.misc_filters = { filters: misc }
  if (props.linksMin !== null) filters.socket_filters = { filters: { links: { min: props.linksMin } } }
  if (props.mapTier !== null) filters.map_filters = { filters: { map_tier: { min: props.mapTier, max: props.mapTier } } }
  if (Object.keys(filters).length) query.filters = filters

  const active = stats.filter(s => s.enabled)
  query.stats = [{
    type: 'and',
    filters: active.map(s => ({
      id: s.statId,
      value: dropNulls({ min: s.min, max: s.max }),
      disabled: false
    }))
  }]
  return { query, sort: { price: 'asc' } }
}

function dropNulls(v: { min: number | null; max: number | null }): Record<string, number> {
  const out: Record<string, number> = {}
  if (v.min !== null) out.min = v.min
  if (v.max !== null) out.max = v.max
  return out
}

/** Whether the search can run at all: rares and magics need at least one stat. */
export function canSearch(item: ParsedItem, stats: StatFilter[]): boolean {
  if (item.rarity === 'rare' || item.rarity === 'magic') return stats.some(s => s.enabled)
  return true
}

export function tradeSiteUrl(league: string, searchId: string): string {
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}/${encodeURIComponent(searchId)}`
}

// ---- fetch response mapping ----

interface RawResult {
  id: string
  listing?: {
    indexed?: string
    account?: { name?: string; online?: { status?: string } | null }
    price?: { amount?: number; currency?: string }
    stash?: { name?: string }
  }
  item?: { note?: string }
}

export function toListings(results: (RawResult | null)[]): Listing[] {
  const mapped: Listing[] = []
  for (const r of results) {
    if (!r?.listing?.price?.amount || !r.listing.price.currency) continue
    const online = r.listing.account?.online
    const status: SellerStatus = !online ? 'offline' : online.status === 'afk' ? 'afk' : 'online'
    const stashName = r.listing.stash?.name ?? ''
    mapped.push({
      id: r.id,
      amount: r.listing.price.amount,
      currency: r.listing.price.currency,
      seller: r.listing.account?.name ?? '?',
      status,
      indexedAt: r.listing.indexed ?? '',
      tabPriced: !r.item?.note && /^~(b\/o|price) /.test(stashName),
      count: 1
    })
  }
  return groupBySeller(mapped)
}

/** Same seller at the same price is one row with a count – dump tabs otherwise flood the list. */
export function groupBySeller(listings: Listing[]): Listing[] {
  const out: Listing[] = []
  for (const l of listings) {
    const prev = out.find(o => o.seller === l.seller && o.amount === l.amount && o.currency === l.currency)
    if (prev) prev.count += 1
    else out.push({ ...l })
  }
  return out
}
