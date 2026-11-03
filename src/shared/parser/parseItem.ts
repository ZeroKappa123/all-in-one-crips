import type { ModSource, ParsedItem, ParsedMod, Rarity } from '../types'

const SEPARATOR = '--------'
const NUMBER = /[+-]?\d+(?:\.\d+)?/g

const RARITY: Record<string, Rarity> = {
  Normal: 'normal',
  Magic: 'magic',
  Rare: 'rare',
  Unique: 'unique',
  Gem: 'gem',
  Currency: 'currency',
  'Divination Card': 'divination'
}

const SOURCE_SUFFIX: [RegExp, ModSource][] = [
  [/\s*\(implicit\)$/, 'implicit'],
  [/\s*\(crafted\)$/, 'crafted'],
  [/\s*\(enchant\)$/, 'enchant'],
  [/\s*\(fractured\)$/, 'fractured'],
  [/\s*\(scourge\)$/, 'scourge']
]

const INFLUENCE = /^(Shaper|Elder|Crusader|Hunter|Redeemer|Warlord|Searing Exarch|Eater of Worlds) Item$/

/** Lines that describe the item but are never mods. */
const NON_MOD_PREFIX = [
  'Item Class:', 'Rarity:', 'Quality', 'Requirements:', 'Level:', 'Str:', 'Dex:', 'Int:', 'Sockets:',
  'Item Level:', 'Stack Size:', 'Map Tier:', 'Item Quantity:', 'Item Rarity:', 'Monster Pack Size:',
  'Physical Damage:', 'Elemental Damage:', 'Chaos Damage:', 'Critical Strike Chance:', 'Attacks per Second:',
  'Weapon Range:', 'Armour:', 'Evasion Rating:', 'Energy Shield:', 'Ward:', 'Chance to Block:',
  'Note:', 'Experience:', 'Mana Cost:', 'Cost:', 'Cast Time:', 'Cooldown Time:', 'Reservation:',
  'Can be used', 'Place into', 'Right click', 'Travel to', 'Shift click', 'Unidentified', 'Corrupted', 'Mirrored',
  'Split', 'Synthesised Item', 'Fractured Item', 'Searing Exarch Item', 'Eater of Worlds Item'
]

export class ParseError extends Error {
  constructor(public kind: 'clipboard-empty' | 'not-english' | 'unsupported', message: string) {
    super(message)
  }
}

export function looksLikeItem(text: string): boolean {
  return /^(Item Class: .+\r?\n)?Rarity: /m.test(text.slice(0, 120))
}

function numbers(line: string): number[] {
  return (line.match(NUMBER) ?? []).map(Number)
}

function firstNumber(line: string): number | undefined {
  const n = numbers(line)[0]
  return n === undefined ? undefined : Math.abs(n)
}

export function parseItem(raw: string): ParsedItem {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) throw new ParseError('clipboard-empty', 'empty')
  if (!looksLikeItem(text)) {
    // Item text in other client languages has no English "Rarity:" header.
    if (/^[^\n]{0,40}: [^\n]+\n[^\n]{0,40}: /.test(text)) throw new ParseError('not-english', 'not english')
    throw new ParseError('clipboard-empty', 'no item text')
  }

  const sections = text.split(`\n${SEPARATOR}\n`).map(s => s.split('\n').map(l => l.trim()).filter(Boolean))
  const header = sections[0] ?? []
  const item: ParsedItem = {
    raw,
    rarity: 'other',
    baseType: '',
    links: 0,
    corrupted: false,
    mirrored: false,
    unidentified: false,
    influences: [],
    mods: []
  }

  const names: string[] = []
  for (const line of header) {
    if (line.startsWith('Item Class: ')) item.itemClass = line.slice(12)
    else if (line.startsWith('Rarity: ')) item.rarity = RARITY[line.slice(8)] ?? 'other'
    else names.push(line)
  }
  if (names.length >= 2) {
    item.name = names[0]
    item.baseType = names[1] ?? ''
  } else {
    item.baseType = names[0] ?? ''
  }
  if (!item.baseType) throw new ParseError('unsupported', 'no base type')

  // Magic items carry prefix/suffix in the base name; keep as-is, query builder uses item class instead.

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i] ?? []
    let consumed = false
    for (const line of section) {
      if (line.startsWith('Item Level: ')) { item.itemLevel = firstNumber(line); consumed = true }
      else if (line.startsWith('Quality')) { item.quality = firstNumber(line); consumed = true }
      else if (line.startsWith('Map Tier: ')) { item.mapTier = firstNumber(line); consumed = true }
      else if (line.startsWith('Stack Size: ')) {
        const m = line.match(/Stack Size: ([\d,.\s]+)\//)
        item.stackSize = m?.[1] ? Number(m[1].replace(/[,.\s]/g, '')) : undefined
        consumed = true
      } else if (line.startsWith('Sockets: ')) {
        item.sockets = line.slice(9).trim()
        item.links = longestLink(item.sockets)
        consumed = true
      } else if (line === 'Corrupted') { item.corrupted = true; consumed = true }
      else if (line === 'Mirrored') { item.mirrored = true; consumed = true }
      else if (line === 'Unidentified') { item.unidentified = true; consumed = true }
      else if (INFLUENCE.test(line)) { item.influences.push(line.replace(/ Item$/, '')); consumed = true }
      else if (item.rarity === 'gem' && line.startsWith('Level: ') && i === 1) {
        item.gemLevel = firstNumber(line)
        consumed = true
      }
    }
    if (section[0] === 'Requirements:') {
      const lvl = section.find(l => l.startsWith('Level: '))
      if (lvl) item.requiredLevel = firstNumber(lvl)
    }
    if (consumed || section[0]?.endsWith(':') || isPropertySection(section)) continue
    if (item.rarity === 'gem' || item.rarity === 'currency' || item.rarity === 'divination') continue
    for (const line of section) {
      const mod = parseModLine(line)
      if (mod) item.mods.push(mod)
    }
  }
  return item
}

function isPropertySection(section: string[]): boolean {
  // The first section after the header lists the item class name (e.g. "Wand") and its properties.
  return section.some(l => NON_MOD_PREFIX.some(p => l.startsWith(p))) ||
    (section.length === 1 && /^[A-Z][A-Za-z' -]+$/.test(section[0] ?? '') && !/\d/.test(section[0] ?? ''))
}

export function parseModLine(line: string): ParsedMod | null {
  if (!line || NON_MOD_PREFIX.some(p => line.startsWith(p))) return null
  if (/^\{.*\}$/.test(line)) return null // advanced-description headers
  let source: ModSource = 'explicit'
  let text = line
  for (const [re, s] of SOURCE_SUFFIX) {
    if (re.test(text)) { source = s; text = text.replace(re, ''); break }
  }
  if (!/\d/.test(text) && !/^(Cannot|Has no|Grants|Your|You|Allocates)/.test(text)) {
    // flavour text and unique lore lines have no numbers and no keyword
    if (source === 'explicit') return null
  }
  return { text, source, values: numbers(text) }
}

export function longestLink(sockets: string): number {
  return Math.max(0, ...sockets.split(' ').map(group => group.split('-').filter(Boolean).length))
}
