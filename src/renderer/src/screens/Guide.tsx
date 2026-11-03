import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleHelp, GripHorizontal, Waypoints, Package } from 'lucide-react'
import { AREAS, GEMS, QUESTS, CHARACTERS } from '@shared/act/data'
import { arrow, type Fragment, type Step } from '@shared/act/route'
import { fmtDuration, type TimerState } from '@shared/act/timer'
import { expInfo } from '@shared/act/exp'
import type { GemPlan } from '@shared/act/gems'
import type { Slot } from '@shared/act/state'
import { useAct, useGemPlan, usePages, usePress } from '../act/useAct'
import { DirectionIcon, GemDot, StepIcon } from '../act/glyphs'
import { S } from '../strings'

const A = S.act

/** Interactive parts tell the main process to stop letting clicks through while hovered. */
const hot = {
  onMouseEnter: () => window.crips.act.interactive(true),
  onMouseLeave: () => window.crips.act.interactive(false)
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
    const ro = new ResizeObserver(([e]) => { if (e) window.crips.act.resizeGuide(e.target.getBoundingClientRect().height + 2) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])

  const prev = usePress(() => void window.crips.act.page('prev'), () => void window.crips.act.page('reset'))
  const next = usePress(() => void window.crips.act.page('next'), () => void window.crips.act.page('jump'))

  if (!act || !slot) return null
  const { store, live } = act
  const page = pages[slot.page]
  const charLevel = slot.character ? live.levels[slot.character] : undefined
  const gearReady = charLevel ? store.gear.filter(g => g.level <= charLevel).length : 0

  return (
    <div className="h-full flex items-end">
      <div ref={root} className="w-full rounded-xl material-hud text-text" style={{ opacity: store.overlay.opacity, fontSize: `${14 * store.overlay.fontScale}px` }}>
        <div className="flex items-start gap-4 px-5 pt-4 pb-3">
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

        <div className="flex items-center gap-4 border-t hairline px-5 h-[34px] text-sm">
          <button {...hot} {...prev} aria-label={`${A.prev}. ${A.holdReset}`} title={A.holdReset} className="text-text-muted hover:text-text"><ChevronLeft className="h-[16px] w-[16px]" /></button>
          <span className="tabular text-text-muted">{A.pageOf(slot.page + 1, pages.length)}</span>
          <button {...hot} {...next} aria-label={`${A.next}. ${A.holdJump}`} title={A.holdJump} className="text-text-muted hover:text-text"><ChevronRight className="h-[16px] w-[16px]" /></button>
          {store.timerEnabled && <Timer timer={store.timer} afk={live.afk || live.idle} />}
          <span className="flex-1" />
          {gearReady > 0 && (
            <button {...hot} onClick={() => window.crips.act.open('gear')} className="flex items-center gap-2 text-success">
              <Package aria-hidden className="h-[12px] w-[12px]" />{A.gearReady(gearReady)}
            </button>
          )}
          {charLevel && live.areaLevel !== null && <Exp level={charLevel} area={live.areaLevel} />}
          <button {...hot} onClick={() => setHelp(h => !h)} aria-expanded={help} aria-label="Help" className="text-text-muted hover:text-text"><CircleHelp className="h-[14px] w-[14px]" /></button>
        </div>
        {help && <p className="px-5 pb-4 text-sm text-text-muted">{A.help}</p>}
      </div>
    </div>
  )
}

function Timer({ timer, afk }: { timer: TimerState; afk: boolean }) {
  const holdRight = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tone = timer.finished ? 'text-success' : timer.running && !afk ? 'text-text' : 'text-text-muted'
  return (
    <span className={`flex items-center gap-3 tabular ${tone}`} title={afk && timer.running ? A.afk : A.pausedHint}>
      <span>{fmtDuration(timer.totalMs)}</span>
      <button
        {...hot}
        aria-label={`Act ${timer.act}, ${timer.running ? 'running' : 'paused'}. ${A.pausedHint}`}
        onClick={() => void window.crips.act.timer('toggle')}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { if (e.button === 2) holdRight.current = setTimeout(() => void window.crips.act.timer('reset'), 800) }}
        onPointerUp={() => { if (holdRight.current) clearTimeout(holdRight.current) }}
        className={`px-3 h-[18px] rounded-full text-xs font-semibold ${timer.running ? 'bg-accent text-on-accent' : 'bg-fill text-text-muted'}`}
      >A{timer.act}</button>
      <span>{fmtDuration(timer.actMs[timer.act] ?? 0)}</span>
    </span>
  )
}

function Exp({ level, area }: { level: number; area: number }) {
  const e = expInfo(level, area)
  const ok = e.offBy === 0
  return (
    <span className={`tabular ${ok ? 'text-success' : 'text-danger'}`} title={`${A.expTitle}: ${e.min}–${e.max}. ${Math.round(e.factor * 100)}% experience here.`}>
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
  const area = (id: string) => AREAS[id]
  switch (f.t) {
    case 'text': return <>{f.v}</>
    case 'kill': return <strong className="text-act-enemy">{f.v}</strong>
    case 'enter': case 'area': {
      const a = area(f.area)
      return <span className="whitespace-nowrap">{a?.t ? <StepIcon kind="town" /> : null}<strong className="text-act-area">{a?.n ?? f.area}</strong></span>
    }
    case 'waypoint': return f.area
      ? <span className="whitespace-nowrap"><StepIcon kind="waypoint" /><strong className="text-act-waypoint">{area(f.area)?.n ?? f.area}</strong></span>
      : <span className="whitespace-nowrap"><StepIcon kind="waypoint" /><strong className="text-act-waypoint">Waypoint</strong></span>
    case 'logout': return <span className="whitespace-nowrap"><StepIcon kind="logout" /><strong className="text-text-muted">Log out</strong></span>
    case 'portal': return <span className="whitespace-nowrap"><StepIcon kind="portal" /><strong className="text-act-waypoint">{f.use ? 'Portal' : 'a Portal'}</strong></span>
    case 'quest': return <Quest id={f.id} offer={f.offer} plan={plan} slot={slot} />
    case 'questText': return <strong className="text-act-item">{f.v}</strong>
    case 'generic': case 'arena': return <strong className="text-text">{f.v}</strong>
    case 'dir': return <DirectionIcon deg={f.deg} />
    case 'crafting': return <span className="whitespace-nowrap"><StepIcon kind="crafting" /><strong className="text-act-item">Crafting recipe</strong></span>
    case 'trial': return <span className="whitespace-nowrap"><StepIcon kind="trial" /><strong className="text-act-trial">Trial of Ascendancy</strong></span>
    case 'ascend': return <span className="whitespace-nowrap"><StepIcon kind="ascend" /><strong className="text-act-trial">{f.v[0]?.toUpperCase()}{f.v.slice(1)} Labyrinth</strong></span>
  }
}

function Quest({ id, offer, plan, slot }: { id: string; offer: string; plan: GemPlan | null; slot: Slot }) {
  const q = QUESTS[id]
  const name = <span className="whitespace-nowrap"><StepIcon kind="quest" /><strong className="text-act-quest">{q?.n ?? id}</strong></span>
  const gem = (g: string, extra = '') => <span key={g} className={`whitespace-nowrap ${extra}`}><GemDot attr={GEMS[g]?.c ?? ''} /><span className="text-text font-medium">{GEMS[g]?.n ?? g}</span></span>
  if (slot.gemQuests === 'off') return name
  const gemName = (g: string) => GEMS[g]?.n ?? g
  if (plan) {
    const p = plan.byQuest[`${id}|${offer}`]
    if (!p || (!p.take && !p.buy.length)) return name
    return (
      <>
        {name}
        <span className="block pl-6" style={{ fontSize: '0.85em' }}>
          {p.take && <><span className="text-text-muted">{A.take} </span>{gem(p.take)}</>}
          {p.take && p.buy.length > 0 && <span className="text-text-muted"> · </span>}
          {p.buy.length > 0 && <><span className="text-text-muted">{A.buy} </span>{p.buy.map((b, i) => (
            <span key={b.gem}>{i > 0 && ', '}{gem(b.gem, plan.libraryGems.includes(b.gem) ? 'underline' : '')}</span>
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
    const options = Object.entries(o.q).filter(([, c]) => c.length === 0 || c.includes(cls)).map(([g]) => g)
    if (!options.length) return name
    return <>{name}<span className="block pl-6" style={{ fontSize: '0.85em' }}>{options.map((g, i) => <span key={g}>{i > 0 && ', '}{gem(g)}</span>)}</span></>
  }
  return name
}
