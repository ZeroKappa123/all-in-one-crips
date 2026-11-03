export type Rarity = 'normal' | 'magic' | 'rare' | 'unique' | 'gem' | 'currency' | 'divination' | 'other'

export type ModSource = 'explicit' | 'implicit' | 'crafted' | 'enchant' | 'fractured' | 'scourge'

export interface ParsedMod {
  text: string // line as shown, without the "(implicit)" style suffix
  source: ModSource
  values: number[] // all numbers found in the line, in order
}

export interface ParsedItem {
  raw: string
  itemClass?: string
  rarity: Rarity
  name?: string // unique / rare name
  baseType: string
  itemLevel?: number
  quality?: number
  gemLevel?: number
  mapTier?: number
  sockets?: string
  links: number
  corrupted: boolean
  mirrored: boolean
  unidentified: boolean
  stackSize?: number
  influences: string[]
  mods: ParsedMod[]
}

/** One entry of the trade site's stat list (GET /api/trade/data/stats). */
export interface TradeStat {
  id: string
  text: string
  type: string // explicit, implicit, crafted, enchant, fractured, pseudo, ...
}

export interface StatFilter {
  key: string // stable key for React
  statId: string
  label: string
  value: number | null
  min: number | null
  max: number | null
  enabled: boolean
  pseudo: boolean
  source: ModSource | 'pseudo'
}

export interface PropertyFilters {
  itemLevelMin: number | null
  linksMin: number | null
  qualityMin: number | null
  gemLevelMin: number | null
  mapTier: number | null
  corrupted: boolean | null // null = any
  useBaseType: boolean
}

export type SellerStatus = 'online' | 'afk' | 'offline'

export interface Listing {
  id: string
  amount: number
  currency: string
  seller: string
  status: SellerStatus
  indexedAt: string // ISO
  tabPriced: boolean
  count: number // grouped listings from the same seller at the same price
}

export interface League {
  id: string
  text: string
}

export interface PriceSnapshot {
  name: string
  chaosValue: number
  divineValue: number | null
  changePct: number | null
}

export type CheckError =
  | { kind: 'clipboard-empty' }
  | { kind: 'not-english' }
  | { kind: 'unsupported'; detail: string }
  | { kind: 'rate-limited'; retryInSec: number }
  | { kind: 'network'; detail: string }
  | { kind: 'league'; detail: string }
  | { kind: 'no-stats-selected' }
