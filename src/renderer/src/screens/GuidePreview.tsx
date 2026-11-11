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
    <div className="guide-classic px-4 py-3 leading-[1.45]" style={{ background: "rgba(var(--g-bg), 0.92)", border: "1px solid var(--g-frame)", fontSize: "15px" }}>
      {pages.flatMap(p => p.steps).map((s, i) => <StepLine key={i} step={s} plan={plan} slot={slot} />)}
    </div>
  )
}
