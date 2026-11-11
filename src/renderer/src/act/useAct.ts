import { useEffect, useMemo, useState } from 'react'
import { parseRoute, type Page } from '@shared/act/route'
import { AREAS, CHARACTERS, DEFAULT_ROUTE, GEMS, QUESTS, questOrder } from '@shared/act/data'
import { buildGems } from '@shared/act/pob'
import type { GemPlan } from '@shared/act/gems'
import { gemPlanFor } from '@shared/act/plan'
import type { ActLive, ActStore, Slot } from '@shared/act/state'

export function useAct() {
  const [state, setState] = useState<{ store: ActStore; live: ActLive } | null>(null)
  useEffect(() => {
    void window.crips.act.get().then(setState)
    return window.crips.act.onState(setState)
  }, [])
  return state
}

export function usePages(slot: Slot | undefined): { pages: Page[]; unknownAreas: string[] } {
  return useMemo(() => {
    if (!slot) return { pages: [], unknownAreas: [] }
    return parseRoute(slot.guide ?? DEFAULT_ROUTE, slot.options, AREAS)
  }, [slot?.guide, slot?.options.leagueStart, slot?.options.optionals, slot?.options.bandit, slot?.options.library])
}

export function useGemPlan(slot: Slot | undefined): GemPlan | null {
  return useMemo(() => gemPlanFor(slot), [slot?.pob, slot?.gemQuests, slot?.gemOverrides, slot?.guide])
}

/** Click vs. long press, for the guide's controls. */
export function usePress(onClick: () => void, onLong: () => void, ms = 600) {
  let t: ReturnType<typeof setTimeout> | null = null
  let long = false
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      long = false
      t = setTimeout(() => { long = true; onLong() }, ms)
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      if (t) clearTimeout(t)
      if (!long) onClick()
    },
    onPointerLeave: () => { if (t) clearTimeout(t) },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.shiftKey ? onLong() : onClick() } }
  }
}
