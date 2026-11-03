import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleHelp, GripHorizontal, Waypoints, Package } from 'lucide-react'
import { AREAS, GEMS, QUESTS, CHARACTERS } from '@shared/act/data'
import { arrow, type Fragment, type Step } from '@shared/act/route'
import { fmtDuration, type TimerState } from '@shared/act/timer'
import { expInfo } from '@shared/act/exp'
import type { GemPlan } from '@shared/act/gems'
import type { Slot } from '@shared/act/state'
import { useAct, useGemPlan, usePages, usePress } from '../act/useAct'
import { S } from '../strings'

const A = S.act

/** Interactive parts tell the main process to stop letting clicks through while hovered. */
const hot = {
  onMouseEnter: () => window.assay.act.interactive(true),
  onMouseLeave: () => window.assay.act.interactive(false)
}

export function Guide() {
  const act = useAct()
  const slot = act?.store.slots[act.store.activeSlot]
  const { pages } = usePages(slot)
  const plan = useGemPlan(slot)
  const root = useRef<HTMLDivElement>(null)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(([e]) => { if (e) window.assay.act.resizeGuide(e.target.getBoundingClientRect().height + 2) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])

  const prev = usePress(() => void window.assay.act.page('prev'), () => void window.assay.act.page('reset'))
  const next = usePress(() => void window.assay.act.page('next'), () => void window.assay.act.page('jump'))

  if (!act || !slot) return null
  const { store, live } = act
  const page = pages[slot.page]
  const charLevel = slot.character ? live.levels[slot.character] : undefined
  const gearReady = charLevel ? store.gear.filter(g => g.level <= charLevel).length : 0

  return (
    <div className="h-full flex items-end">
      <div ref={root} className="w-full rounded-md border border-border bg-bg text-text shadow-pop" style={{ opacity: store.overlay.opacity, fontSize: `${14 * store.overlay.fontScale}px` }}>
        <div className="flex items-start gap-3 px-4 pt-3 pb-2">
          <span {...hot} aria-hidden className="mt-[2px] cursor-move text-text-muted" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} title="Drag to move">
            <GripHorizontal className="h-[14px] w-[14px]" />
          </span>
          <div className="flex-1 min-w-0" aria-live="polite">
            {live.logStatus === 'missing' && <p className="text-warning">{A.logMissing}</p>}
            {!page && <p className="text-text-muted">{A.noGuide}</p>}
            {page && page.steps.map((s, i) => <StepLine key={`${slot.page}-${i}`} step={s} plan={plan} slot={slot} />)}
            {page && slot.page === pages.length - 1 && <p className="text-success mt-2">{A.done}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 h-[30px] text-xs">
          <button {...hot} {...prev} aria-label={`${A.prev}. ${A.holdReset}`} title={A.holdReset} className="text-text-muted hover:text-text"><ChevronLeft className="h-[16px] w-[16px]" /></button>
          <span className="font-mono text-text-muted tabular-nums">{A.pageOf(slot.page + 1, pages.length)}</span>
          <button {...hot} {...next} aria-label={`${A.next}. ${A.holdJump}`} title={A.holdJump} className="text-text-muted hover:text-text"><ChevronRight className="h-[16px] w-[16px]" /></button>
          {store.timerEnabled && <Timer timer={store.timer} afk={live.afk || live.idle} />}
          <span className="flex-1" />
          {gearReady > 0 && (
            <button {...hot} onClick={() => window.assay.act.open('gear')} className="flex items-center gap-2 text-success">
              <Package aria-hidden className="h-[12px] w-[12px]" />{A.gearReady(gearReady)}
            </button>
          )}
          {charLevel && live.areaLevel !== null && <Exp level={charLevel} area={live.areaLevel} />}
          <button {...hot} onClick={() => setHelp(h => !h)} aria-expanded={help} aria-label="Help" className="text-text-muted hover:text-text"><CircleHelp className="h-[14px] w-[14px]" /></button>
        </div>
        {help && <p className="px-4 pb-3 text-xs text-text-muted">{A.help}</p>}
      </div>
    </div>
  )
}

function Timer({ timer, afk }: { timer: TimerState; afk: boolean }) {
  const holdRight = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tone = timer.finished ? 'text-success' : timer.running && !afk ? 'text-text' : 'text-text-muted'
  return (
    <span className={`flex items-center gap-3 font-mono tabular-nums ${tone}`} title={afk && timer.running ? A.afk : A.pausedHint}>
      <span>{fmtDuration(timer.totalMs)}</span>
      <button
        {...hot}
        aria-label={`Act ${timer.act}, ${timer.running ? 'running' : 'paused'}. ${A.pausedHint}`}
        onClick={() => void window.assay.act.timer('toggle')}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { if (e.button === 2) holdRight.current = setTimeout(() => void window.assay.act.timer('reset'), 800) }}
        onPointerUp={() => { if (holdRight.current) clearTimeout(holdRight.current) }}
        className={`px-2 rounded-sm border ${timer.running ? 'border-accent' : 'border-border'}`}
      >A{timer.act}</button>
      <span>{fmtDuration(timer.actMs[timer.act] ?? 0)}</span>
    </span>
  )
}

function Exp({ level, area }: { level: number; area: number }) {
  const e = expInfo(level, area)
  const ok = e.offBy === 0
  return (
    <span className={`font-mono ${ok ? 'text-success' : 'text-danger'}`} title={`${A.expTitle}: ${e.min}–${e.max}. ${Math.round(e.factor * 100)}% experience here.`}>
      {e.min} | {area} | {e.max}{!ok && ` (${e.offBy > 0 ? '+' : ''}${e.offBy})`}
    </span>
  )
}

export function StepLine({ step, plan, slot }: { step: Step; plan: GemPlan | null; slot: Slot }) {
  return (
    <div className="leading-[1.5]">
      <p>{step.fragments.map((f, i) => <Frag key={i} f={f} plan={plan} slot={slot} />)}</p>
      {step.hints.map((h, i) => (
        <p key={i} className="pl-6 text-text-muted" style={{ fontSize: '0.85em' }}>{h.map((f, j) => <Frag key={j} f={f} plan={plan} slot={slot} />)}</p>
      ))}
    </div>
  )
}

function Frag({ f, plan, slot }: { f: Fragment; plan: GemPlan | null; slot: Slot }) {
  switch (f.t) {
    case 'text': return <>{f.v}</>
    case 'kill': return <strong className="text-danger">{f.v}</strong>
    case 'enter': case 'area': return <span className="text-accent">{AREAS[f.area]?.n ?? f.area}</span>
    case 'waypoint': return f.area
      ? <span className="text-rarity-gem"><Waypoints aria-hidden className="inline h-[1em] w-[1em] -mt-[2px] mr-1" />{AREAS[f.area]?.n ?? f.area}</span>
      : <span className="text-rarity-gem">waypoint</span>
    case 'logout': return <strong className="text-text-muted">Log out</strong>
    case 'portal': return <span className="text-rarity-magic">{f.use ? 'the portal' : 'a portal'}</span>
    case 'quest': return <Quest id={f.id} offer={f.offer} plan={plan} slot={slot} />
    case 'questText': case 'generic': case 'arena': return <span className="text-rarity-currency">{f.v}</span>
    case 'dir': return <span aria-label={`direction ${f.deg} degrees`} className="font-semibold">{arrow(f.deg)}</span>
    case 'crafting': return <span className="text-success">crafting recipe</span>
    case 'trial': return <span className="text-rarity-magic">Trial of Ascendancy</span>
    case 'ascend': return <span className="text-rarity-magic">{f.v} Labyrinth</span>
  }
}

function Quest({ id, offer, plan, slot }: { id: string; offer: string; plan: GemPlan | null; slot: Slot }) {
  const q = QUESTS[id]
  const name = <span className="text-warning">{q?.n ?? id}</span>
  if (slot.gemQuests === 'off') return name
  const gemName = (g: string) => GEMS[g]?.n ?? g
  if (plan) {
    const p = plan.byQuest[`${id}|${offer}`]
    if (!p || (!p.take && !p.buy.length)) return name
    return (
      <>
        {name}
        <span className="block pl-6" style={{ fontSize: '0.85em' }}>
          {p.take && <><span className="text-text-muted">{A.take} </span><span className="text-rarity-gem">{gemName(p.take)}</span></>}
          {p.take && p.buy.length > 0 && <span className="text-text-muted"> · </span>}
          {p.buy.length > 0 && <><span className="text-text-muted">{A.buy} </span>{p.buy.map((b, i) => (
            <span key={b.gem}>{i > 0 && ', '}<span className={plan.libraryGems.includes(b.gem) ? 'underline text-rarity-gem' : 'text-rarity-gem'}>{gemName(b.gem)}</span></span>
          ))}<span className="text-text-muted"> {A.from} {p.buy[0]!.npc}</span></>}
        </span>
      </>
    )
  }
  if (slot.gemQuests === 'all') {
    // No build imported: list the quest rewards this character's class could pick.
    const cls = slot.pob?.className ?? Object.keys(CHARACTERS).find(c => slot.character.toLowerCase().includes(c.toLowerCase()))
    const o = q?.r[offer]
    if (!cls || !o) return name
    const options = Object.entries(o.q).filter(([, c]) => c.length === 0 || c.includes(cls)).map(([g]) => gemName(g))
    if (!options.length) return name
    return <>{name}<span className="block pl-6 text-text-muted" style={{ fontSize: '0.85em' }}>{options.join(', ')}</span></>
  }
  return name
}
