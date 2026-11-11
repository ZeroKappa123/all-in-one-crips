import { CHARACTERS, DEFAULT_ROUTE, GEMS, QUESTS, questOrder } from './data'
import { buildGems } from './pob'
import { planGems, resolveGem, vendorSearchStrings, type GemPlan } from './gems'
import type { Page } from './route'
import type { Slot } from './state'

/** The gem plan for a guide slot: rewards to take and gems to buy, or null without an imported build. */
export function gemPlanFor(slot: Slot | undefined): GemPlan | null {
  if (!slot?.pob || slot.gemQuests === 'off') return null
  const cls = slot.pob.className
  const wanted = buildGems(slot.pob).map(g => resolveGem(g, GEMS)).filter((x): x is string => !!x)
  const ch = CHARACTERS[cls]
  return planGems(cls, wanted, questOrder(slot.guide ?? DEFAULT_ROUTE), QUESTS, ch ? [ch.start_gem_id, ch.chest_gem_id] : [], slot.gemOverrides)
}

/** Names of the gems to buy at the quest hand-ins on this guide page. */
export function gemsToBuyOnPage(plan: GemPlan | null, page: Page | undefined): string[] {
  if (!plan || !page) return []
  const names: string[] = []
  for (const step of page.steps) for (const f of step.fragments) {
    if (f.t !== 'quest') continue
    for (const b of plan.byQuest[`${f.id}|${f.offer}`]?.buy ?? []) names.push(GEMS[b.gem]?.n ?? b.gem)
  }
  return [...new Set(names)]
}

/** Every gem of the imported build, as vendor search strings (split at the game's 250-character limit). */
export function allBuildGemStrings(slot: Slot | undefined): string[] {
  if (!slot?.pob) return []
  const names = buildGems(slot.pob).map(g => { const id = resolveGem(g, GEMS); return id ? GEMS[id]!.n : null }).filter((n): n is string => !!n)
  return vendorSearchStrings(names)
}

export { vendorSearchStrings }
