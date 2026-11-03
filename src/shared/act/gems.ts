import type { PobGem } from './pob'

export interface GemInfo { n: string; l: number; s: number; c: string }
export interface QuestInfo {
  n: string
  a: number
  r: Record<string, { npc: string; q: Record<string, string[]>; v: Record<string, { c: string[]; npc: string }> }>
}

export const LIBRARY_QUEST = 'a3q12'

export interface GemOverride { removed?: boolean; notBeforeAct?: number }

/** What to do at one quest hand-in: the reward to pick and the gems to buy from the vendor afterwards. */
export interface QuestPlan { take: string | null; buy: { gem: string; npc: string }[] }

export interface GemPlan {
  byQuest: Record<string, QuestPlan> // "quest|offer" -> what to do at that hand-in
  notAvailable: string[] // build gems no quest or vendor in the campaign offers to this class
  libraryGems: string[] // gems whose first pickup is the Act 3 library
}

/** Matches a PoB gem to a gem id from the data, by id first, then by name. */
export function resolveGem(g: PobGem, gems: Record<string, GemInfo>): string | null {
  if (g.gemId && gems[g.gemId]) return g.gemId
  const byName = (name: string) => Object.entries(gems).find(([, v]) => v.n.toLowerCase() === name.toLowerCase())?.[0] ?? null
  return byName(g.name) ?? byName(`${g.name} Support`)
}

/**
 * Greedy plan: walk the quests in campaign order; each offer gives one quest reward and any number of
 * vendor purchases. A gem is taken as the reward if offered to this class, otherwise bought.
 */
export function planGems(
  className: string,
  wanted: string[],
  questOrder: string[],
  quests: Record<string, QuestInfo>,
  startingGems: string[],
  overrides: Record<string, GemOverride> = {}
): GemPlan {
  const need = new Set(wanted.filter(g => !overrides[g]?.removed && !startingGems.includes(g)))
  const byQuest: Record<string, QuestPlan> = {}
  const firstAt: Record<string, string> = {}
  const done = new Set<string>()

  // an empty class list means every class may take it (e.g. the Act 3 library)
  const forClass = (classes: string[]) => classes.length === 0 || classes.includes(className)
  for (const key of questOrder) {
    const [qid = '', offerId = qid] = key.split('|')
    const q = quests[qid]
    const offer = q?.r[offerId]
    if (!q || !offer || byQuest[key]) continue
    const avail = (g: string) => need.has(g) && !done.has(g) && (overrides[g]?.notBeforeAct ?? 0) <= q.a
    let take: string | null = null
    for (const [g, classes] of Object.entries(offer.q)) {
      if (avail(g) && forClass(classes)) { take = g; done.add(g); firstAt[g] = qid; break }
    }
    const buy: { gem: string; npc: string }[] = []
    for (const [g, v] of Object.entries(offer.v)) {
      if (avail(g) && forClass(v.c)) { buy.push({ gem: g, npc: v.npc }); done.add(g); firstAt[g] = qid }
    }
    byQuest[key] = { take, buy }
  }
  return {
    byQuest,
    notAvailable: [...need].filter(g => !done.has(g)),
    libraryGems: Object.entries(firstAt).filter(([, q]) => q === LIBRARY_QUEST).map(([g]) => g)
  }
}

/**
 * Search string for the vendor window: lower-case gem names joined as one regex, split so
 * no part exceeds the game's 250-character search limit.
 */
export function vendorSearchStrings(names: string[], limit = 250): string[] {
  const terms = [...new Set(names.map(n => n.toLowerCase().replace(/ support$/, '').replace(/"/g, '')))]
  const parts: string[] = []
  let cur: string[] = []
  const size = (xs: string[]) => xs.join('|').length + 2 // quotes
  for (const t of terms) {
    if (cur.length && size([...cur, t]) > limit) { parts.push(`"${cur.join('|')}"`); cur = [] }
    cur.push(t)
  }
  if (cur.length) parts.push(`"${cur.join('|')}"`)
  return parts
}
