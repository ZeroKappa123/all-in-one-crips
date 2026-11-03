import type { ModSource, ParsedMod, TradeStat } from '../types'

const NUM = '([+-]?\\d+(?:\\.\\d+)?)'

export interface StatMatch {
  stat: TradeStat
  value: number | null // representative value (average for "# to #")
  negated: boolean
}

interface Compiled {
  stat: TradeStat
  re: RegExp
  hashes: number
}

/**
 * Index of trade stats, built once per stat list. Templates like "+#% to Fire Resistance"
 * become regular expressions; "#" matches a signed number.
 */
export class StatIndex {
  private bySource = new Map<string, Compiled[]>()
  readonly ids = new Set<string>()

  constructor(stats: TradeStat[]) {
    for (const stat of stats) {
      this.ids.add(stat.id)
      const list = this.bySource.get(stat.type) ?? []
      list.push(compile(stat))
      this.bySource.set(stat.type, list)
    }
  }

  has(id: string): boolean {
    return this.ids.has(id)
  }

  match(mod: ParsedMod): StatMatch | null {
    const pools = poolsFor(mod.source)
    for (const pool of pools) {
      const hit = this.find(pool, mod.text)
      if (hit) return hit
      // "reduced" mods are listed on the trade site as "increased" with a negative value
      const flipped = flip(mod.text)
      if (flipped) {
        const f = this.find(pool, flipped)
        if (f) return { ...f, value: f.value === null ? null : -f.value, negated: true }
      }
    }
    return null
  }

  private find(pool: string, text: string): StatMatch | null {
    const list = this.bySource.get(pool)
    if (!list) return null
    // Prefer templates with more fixed text (fewer wildcards) to avoid greedy false matches.
    let best: { c: Compiled; m: RegExpMatchArray } | null = null
    for (const c of list) {
      const m = text.match(c.re)
      if (m && (!best || c.re.source.length - c.hashes > best.c.re.source.length - best.c.hashes)) best = { c, m }
    }
    if (!best) return null
    const nums = best.m.slice(1).map(Number).filter(n => !Number.isNaN(n))
    const value = nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length
    return { stat: best.c.stat, value: value === null ? null : round(value), negated: false }
  }
}

function compile(stat: TradeStat): Compiled {
  // Some templates contain alternatives like "(Local)"; drop parenthesised tags.
  const template = stat.text.replace(/\s*\((Local|Shield|Staves|Bows)\)$/i, '')
  const parts = template.split('#')
  const body = parts.map(escape).join(NUM)
  // "+#%" templates also match values written without the plus sign
  const re = new RegExp('^' + body.replace(/\\\+\(/g, '\\+?(') + '$')
  return { stat, re, hashes: parts.length - 1 }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function flip(text: string): string | null {
  if (/\breduced\b/.test(text)) return text.replace(/\breduced\b/, 'increased')
  if (/\bless\b/.test(text)) return text.replace(/\bless\b/, 'more')
  return null
}

function poolsFor(source: ModSource): string[] {
  switch (source) {
    case 'implicit': return ['implicit']
    case 'crafted': return ['crafted', 'explicit']
    case 'enchant': return ['enchant']
    case 'fractured': return ['fractured', 'explicit']
    case 'scourge': return ['scourge', 'explicit']
    default: return ['explicit']
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
