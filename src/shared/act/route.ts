/**
 * Parser for the route language used by exile-leveling route files.
 *
 *   #section Act 1                       starts an act
 *   #ifdef LEAGUE_START / #ifndef / #endif   conditional blocks (nestable)
 *   ➞ {enter|1_1_2} #The Coast           a step; text after " #" is a comment
 *       #sub Go {dir|270}                hint line for the step above
 *   {logout}, {waypoint|id}, {portal|use}  moves without an explicit "enter"
 *
 * A page is the run of steps up to and including the next move. Entering the move's
 * target area completes the page.
 */

export type Fragment =
  | { t: 'text'; v: string }
  | { t: 'kill'; v: string }
  | { t: 'enter'; area: string }
  | { t: 'waypoint'; area: string | null } // null = "get the waypoint here"
  | { t: 'logout' }
  | { t: 'portal'; use: boolean }
  | { t: 'quest'; id: string; offer: string }
  | { t: 'questText'; v: string }
  | { t: 'generic'; v: string }
  | { t: 'arena'; v: string }
  | { t: 'dir'; deg: number }
  | { t: 'crafting'; area: string | null }
  | { t: 'trial' }
  | { t: 'ascend'; v: string }
  | { t: 'area'; area: string }

export interface Step {
  fragments: Fragment[]
  hints: Fragment[][]
}

export interface Page {
  act: number
  steps: Step[]
  target: string | null // area that completes this page
}

export interface RouteOptions {
  leagueStart: boolean
  optionals: boolean
  bandit: 'kill' | 'alira' | 'kraityn' | 'oak'
  library: boolean // Act 3 library gem quest
}

export interface AreaInfo { n: string; a: number; l: number; t: number; p: string; w: number }

export const DEFAULT_OPTIONS: RouteOptions = { leagueStart: true, optionals: false, bandit: 'kill', library: true }

export function definesFor(o: RouteOptions): Set<string> {
  const d = new Set<string>()
  if (o.leagueStart) d.add('LEAGUE_START')
  if (o.optionals) d.add('OPTIONAL')
  if (o.library) d.add('LIBRARY')
  d.add(`BANDIT_${o.bandit.toUpperCase()}`)
  return d
}

const FRAG = /\{([a-z_]+)(?:\|([^}]*))?\}/g

export function parseFragments(line: string): Fragment[] {
  const out: Fragment[] = []
  let last = 0
  for (const m of line.matchAll(FRAG)) {
    if (m.index! > last) out.push({ t: 'text', v: line.slice(last, m.index) })
    out.push(toFragment(m[1]!, m[2]))
    last = m.index! + m[0].length
  }
  if (last < line.length) out.push({ t: 'text', v: line.slice(last) })
  return out.filter(f => f.t !== 'text' || f.v.length > 0)
}

function toFragment(kind: string, arg: string | undefined): Fragment {
  switch (kind) {
    case 'kill': return { t: 'kill', v: arg ?? '' }
    case 'enter': return { t: 'enter', area: arg ?? '' }
    case 'waypoint': return { t: 'waypoint', area: arg ?? null }
    case 'waypoint_get': return { t: 'waypoint', area: null }
    case 'logout': return { t: 'logout' }
    case 'portal': return { t: 'portal', use: arg === 'use' }
    case 'quest': { const [id = '', offer] = (arg ?? '').split('|'); return { t: 'quest', id, offer: offer ?? id } }
    case 'quest_text': return { t: 'questText', v: arg ?? '' }
    case 'generic': return { t: 'generic', v: arg ?? '' }
    case 'arena': return { t: 'arena', v: arg ?? '' }
    case 'dir': return { t: 'dir', deg: Number(arg ?? 0) }
    case 'crafting': return { t: 'crafting', area: arg ?? null }
    case 'trial': return { t: 'trial' }
    case 'ascend': return { t: 'ascend', v: arg ?? '' }
    case 'area': return { t: 'area', area: arg ?? '' }
    default: return { t: 'text', v: `{${kind}${arg ? '|' + arg : ''}}` }
  }
}

function stripComment(line: string): string {
  const i = line.indexOf(' #')
  return (i >= 0 ? line.slice(0, i) : line).trimEnd()
}

export interface ParseResult {
  pages: Page[]
  unknownAreas: string[] // areas referenced but not in the area table
}

export function parseRoute(text: string, options: RouteOptions, areas: Record<string, AreaInfo>): ParseResult {
  const defines = definesFor(options)
  const stack: boolean[] = []
  const pages: Page[] = []
  const unknown = new Set<string>()
  let act = 0
  let current: Step[] = []
  let here: string | null = null // where the player is while walking the route
  let portalFrom: string | null = null

  const active = () => stack.every(Boolean)
  const known = (id: string) => { if (!areas[id]) unknown.add(id); return id }
  const flush = (target: string | null) => {
    if (current.length) pages.push({ act, steps: current, target })
    current = []
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#ifdef ')) { stack.push(defines.has(line.slice(7).trim())); continue }
    if (line.startsWith('#ifndef ')) { stack.push(!defines.has(line.slice(8).trim())); continue }
    if (line === '#endif') { stack.pop(); continue }
    if (!active()) continue
    if (line.startsWith('#section')) {
      flush(null)
      act = Number(line.match(/\d+/)?.[0] ?? act + 1)
      continue
    }
    if (line.startsWith('#sub ')) {
      const prev = current[current.length - 1] ?? pages[pages.length - 1]?.steps.at(-1)
      prev?.hints.push(parseFragments(stripComment(line.slice(5))))
      continue
    }
    if (line.startsWith('#')) continue // other directives and full-line comments

    const fragments = parseFragments(stripComment(line))
    current.push({ fragments, hints: [] })

    // Work out whether this step moves the player, and where to.
    let target: string | null = null
    for (const f of fragments) {
      if (f.t === 'enter') target = known(f.area)
      else if (f.t === 'waypoint' && f.area) target = known(f.area)
      else if (f.t === 'logout' && here) target = areas[here]?.t ? here : areas[here]?.p ?? null
      else if (f.t === 'portal' && !f.use) portalFrom = here
      else if (f.t === 'portal' && f.use && portalFrom) { target = portalFrom; portalFrom = null }
      else if (f.t === 'area') known(f.area)
      else if (f.t === 'crafting' && f.area) known(f.area)
    }
    if (target) {
      here = target
      flush(target)
    }
  }
  flush(null)
  return { pages, unknownAreas: [...unknown] }
}

/** Plain text of a fragment list, for search, previews and screen readers. */
export function fragmentText(fs: Fragment[], areas: Record<string, AreaInfo>, questName: (id: string) => string): string {
  return fs.map(f => {
    switch (f.t) {
      case 'text': case 'kill': case 'questText': case 'generic': case 'arena': return f.v
      case 'enter': case 'area': return areas[f.area]?.n ?? f.area
      case 'waypoint': return f.area ? `Waypoint to ${areas[f.area]?.n ?? f.area}` : 'the waypoint'
      case 'logout': return 'Log out'
      case 'portal': return f.use ? 'the portal' : 'a portal'
      case 'quest': return questName(f.id)
      case 'dir': return arrow(f.deg)
      case 'crafting': return 'the crafting recipe'
      case 'trial': return 'the Trial of Ascendancy'
      case 'ascend': return `the ${f.v} Labyrinth`
    }
  }).join('')
}

export function arrow(deg: number): string {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  return arrows[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!
}
