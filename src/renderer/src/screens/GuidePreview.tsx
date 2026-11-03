import { AREAS } from '@shared/act/data'
import { parseRoute } from '@shared/act/route'
import type { Slot } from '@shared/act/state'
import { useGemPlan } from '../act/useAct'
import { StepLine } from './Guide'

/** Renders one editor page exactly as the overlay would, with the slot's conditions applied. */
export function StepPreview({ text, slot }: { text: string; slot: Slot }) {
  const plan = useGemPlan(slot)
  const { pages } = parseRoute(text, slot.options, AREAS)
  return (
    <div className="rounded-md border border-border bg-bg px-4 py-3">
      {pages.flatMap(p => p.steps).map((s, i) => <StepLine key={i} step={s} plan={plan} slot={slot} />)}
    </div>
  )
}
