import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Package } from 'lucide-react'
import { AREAS, GEMS, QUESTS, CHARACTERS } from '@shared/act/data'
import { arrow, type Fragment, type Step } from '@shared/act/route'
import { fmtDuration, type TimerState } from '@shared/act/timer'
import { expInfo } from '@shared/act/exp'
import type { GemPlan } from '@shared/act/gems'
import type { Slot } from '@shared/act/state'
import { useAct, useGemPlan, usePages, usePress } from '../act/useAct'
import { DirectionIcon, GemCost, StepIcon } from '../act/glyphs'
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
  const omni = useOmniLabel()

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
      <div ref={root} className="guide-classic w-full"
        style={{ background: `rgba(var(--g-bg), ${store.overlay.opacity})`, border: '1px solid var(--g-frame)', fontSize: `${15 * store.overlay.fontScale}px` }}>
        <div className="px-4 pt-3 pb-2 leading-[1.45]" aria-live="polite">
          {live.logStatus === 'missing' && <p style={{ color: 'var(--g-kill)' }}>{A.logMissing}</p>}
          {!page && <p style={{ color: 'var(--g-muted)' }}>{A.noGuide}</p>}
          {page && page.steps.map((s, i) => <StepLine key={`${slot.page}-${i}`} step={s} plan={plan} slot={slot} omni={omni} />)}
          {page && slot.page === pages.length - 1 && <p className="mt-1" style={{ color: 'var(--g-item)' }}>{A.done}</p>}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 h-[2em]" style={{ borderTop: '1px solid var(--g-frame)', fontSize: '0.8em' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span {...hot} aria-hidden title="Drag to move" className="h-[0.7em] w-[0.7em] bg-[#f2f2f2] cursor-move shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
            <span className="tabular" style={{ color: 'var(--g-muted)' }}>{A.pageOf(slot.page + 1, pages.length)}</span>
            {store.timerEnabled && <Timer timer={store.timer} afk={live.afk || live.idle} />}
          </div>
          <div className="flex items-center gap-[2px]">
            <button {...hot} {...prev} className="g-btn" aria-label={`${A.prev}. ${A.holdReset}`} title={A.holdReset}><ChevronLeft aria-hidden className="h-[1em] w-[1em]" /></button>
            <button {...hot} onClick={() => setHelp(h => !h)} className="g-btn" aria-expanded={help} aria-label="Help">?</button>
            <button {...hot} {...next} className="g-btn" aria-label={`${A.next}. ${A.holdJump}`} title={A.holdJump}><ChevronRight aria-hidden className="h-[1em] w-[1em]" /></button>
          </div>
          <div className="flex items-center justify-end gap-3 min-w-0">
            {gearReady > 0 && (
              <button {...hot} onClick={() => window.crips.act.open('gear')} className="flex items-center gap-1" style={{ color: 'var(--g-item)' }}>
                <Package aria-hidden className="h-[1em] w-[1em]" />{A.gearReady(gearReady)}
              </button>
            )}
            {charLevel && live.areaLevel !== null && <Exp level={charLevel} area={live.areaLevel} />}
            <HoldReset />
          </div>
        </div>
        {help && <p className="px-4 pb-3" style={{ color: 'var(--g-muted)', fontSize: '0.8em' }}>{A.help}{omni ? ` ${A.omniHelp(omni)}` : ''}</p>}
      </div>
    </div>
  )
}

/** The omni key's name for the guide's "buy gems" lines, or null when it is switched off. */
function useOmniLabel(): string | null {
  const [button, setButton] = useState<string>('off')
  useEffect(() => {
    void window.crips.getConfig().then(r => setButton(r.config.omni.button))
    return window.crips.onConfig(c => setButton(c.omni.button))
  }, [])
  return button === 'off' ? null : (S.omni as Record<string, unknown>)[button] as string
}

const HOLD_MS = 1200

/** Restart button: hold it until the ring is full, then the guide goes back to page 1 and the timer to zero. */
function HoldReset() {
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const raf = useRef<number | null>(null)
  const stop = () => { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; setProgress(0) }
  const start = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (e.pointerId >= 0) e.currentTarget.setPointerCapture(e.pointerId)
    if (raf.current !== null) return
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / HOLD_MS)
      setProgress(p)
      if (p < 1) { raf.current = requestAnimationFrame(tick); return }
      raf.current = null
      void window.crips.act.timer('reset')
      setDone(true)
      setTimeout(() => { setDone(false); setProgress(0) }, 900)
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current) }, [])
  const r = 8, c = 2 * Math.PI * r
  return (
    <button {...hot} type="button" aria-label={A.resetHold} title={A.resetHold} data-testid="act-reset"
      onPointerDown={start} onPointerUp={() => { if (!done) stop() }} onPointerCancel={stop} onLostPointerCapture={() => { if (!done) stop() }}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start({ button: 0, currentTarget: e.currentTarget, pointerId: -1 } as unknown as React.PointerEvent) }}
      onKeyUp={() => { if (!done) stop() }}
      className="relative grid place-items-center h-[1.6em] w-[1.6em]" style={{ color: done ? 'var(--g-item)' : progress > 0 ? 'var(--g-kill)' : 'var(--g-muted)' }}>
      <svg aria-hidden viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
        <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} opacity={progress > 0 ? 1 : 0} />
      </svg>
      <RotateCcw aria-hidden className="h-[0.8em] w-[0.8em]" />
      {done && <span role="status" className="sr-only">{A.resetDone}</span>}
    </button>
  )
}

function Timer({ timer, afk }: { timer: TimerState; afk: boolean }) {
  const holdRight = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tone = timer.finished ? 'var(--g-item)' : timer.running && !afk ? 'var(--g-text)' : 'var(--g-muted)'
  return (
    <span className="flex items-center gap-2 tabular" style={{ color: tone }} title={afk && timer.running ? A.afk : A.pausedHint}>
      <span>{fmtDuration(timer.totalMs)}</span>
      <button
        {...hot}
        aria-label={`Act ${timer.act}, ${timer.running ? 'running' : 'paused'}. ${A.pausedHint}`}
        onClick={() => void window.crips.act.timer('toggle')}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { if (e.button === 2) holdRight.current = setTimeout(() => void window.crips.act.timer('reset'), 800) }}
        onPointerUp={() => { if (holdRight.current) clearTimeout(holdRight.current) }}
        className="g-btn" style={{ height: '1.4em', color: timer.running ? 'var(--g-quest)' : 'var(--g-muted)' }}
      >A{timer.act}</button>
      <span>{fmtDuration(timer.actMs[timer.act] ?? 0)}</span>
    </span>
  )
}

function Exp({ level, area }: { level: number; area: number }) {
  const e = expInfo(level, area)
  const ok = e.offBy === 0
  return (
    <span className="tabular" style={{ color: ok ? 'var(--g-item)' : 'var(--g-kill)' }} title={`${A.expTitle}: ${e.min}–${e.max}. ${Math.round(e.factor * 100)}% experience here.`}>
      {e.min} | {area} | {e.max}{!ok && ` (${e.offBy > 0 ? '+' : ''}${e.offBy})`}
    </span>
  )
}

type Omni = string | null

const C = (v: string) => ({ color: `var(--g-${v})` })

export function StepLine({ step, plan, slot, omni = null }: { step: Step; plan: GemPlan | null; slot: Slot; omni?: Omni }) {
  return (
    <div className="flex gap-[0.45em]">
      <span aria-hidden className="shrink-0 text-[0.7em] leading-[2.1]">◆</span>
      <div className="min-w-0">
        <p>{step.fragments.map((f, i) => <Frag key={i} f={f} plan={plan} slot={slot} omni={omni} />)}</p>
        {step.hints.map((h, i) => (
          <p key={i} className="pl-[1em]" style={{ ...C('text'), fontSize: '0.88em' }}>{h.map((f, j) => <Frag key={j} f={f} plan={plan} slot={slot} omni={omni} />)}</p>
        ))}
      </div>
    </div>
  )
}

function Frag({ f, plan, slot, omni }: { f: Fragment; plan: GemPlan | null; slot: Slot; omni: Omni }) {
  const area = (id: string) => AREAS[id]
  const w = 'whitespace-nowrap'
  switch (f.t) {
    case 'text': return <>{f.v}</>
    case 'kill': return <span style={C('kill')}>{f.v}</span>
    case 'enter': return <span className={w}>{area(f.area)?.t ? <StepIcon kind="town" /> : null}<span style={C('enter')}>{area(f.area)?.n ?? f.area}</span></span>
    case 'area': return <span className={w}>{area(f.area)?.t ? <StepIcon kind="town" /> : null}<span style={C('area')}>{area(f.area)?.n ?? f.area}</span></span>
    case 'waypoint': return <span className={w}><StepIcon kind="waypoint" /><span style={C('waypoint')}>{f.area ? area(f.area)?.n ?? f.area : 'Waypoint'}</span></span>
    case 'logout': return <span className={w}><StepIcon kind="logout" /><span style={C('muted')}>Log out</span></span>
    case 'portal': return <span className={w}><StepIcon kind="portal" /><span style={C('waypoint')}>{f.use ? 'Portal' : 'a Portal'}</span></span>
    case 'quest': return <Quest id={f.id} offer={f.offer} plan={plan} slot={slot} omni={omni} />
    case 'questText': return <span style={C('item')}>{f.v}</span>
    case 'generic': case 'arena': return <span style={C('text')}>{f.v}</span>
    case 'dir': return <DirectionIcon deg={f.deg} />
    case 'crafting': return <span className={w}><StepIcon kind="crafting" /><span style={C('enter')}>Crafting recipe</span></span>
    case 'trial': return <span className={w}><StepIcon kind="trial" /><span style={C('trial')}>Trial of Ascendancy</span></span>
    case 'ascend': return <span className={w}><StepIcon kind="ascend" /><span style={C('trial')}>{f.v[0]?.toUpperCase()}{f.v.slice(1)} Labyrinth</span></span>
  }
}

const ATTR: Record<string, string> = { s: 'str', d: 'dex', i: 'int' }

function Quest({ id, offer, plan, slot, omni }: { id: string; offer: string; plan: GemPlan | null; slot: Slot; omni: Omni }) {
  const q = QUESTS[id]
  const npc = q?.r[offer]?.npc
  const name = <span className={'whitespace-nowrap'}><StepIcon kind="quest" />{npc && <span style={C('text')}>{npc}: </span>}<span style={C('quest')}>{q?.n ?? id}</span></span>
  const gem = (g: string, cost = false) => (
    <span key={g} className="whitespace-nowrap" style={{ color: `var(--g-${ATTR[GEMS[g]?.c ?? ''] ?? 'text'})` }}>
      {GEMS[g]?.n ?? g}{cost && GEMS[g] && <GemCost level={GEMS[g]!.l} />}
    </span>
  )
  const sub = (children: React.ReactNode) => <span className="block pl-[1em]" style={{ fontSize: '0.88em' }}>{children}</span>
  if (slot.gemQuests === 'off') return name
  if (plan) {
    const p = plan.byQuest[`${id}|${offer}`]
    if (!p || (!p.take && !p.buy.length)) return name
    return (
      <>
        {name}
        {p.take && sub(<><span style={C('text')}>{A.take}: </span>{gem(p.take)}</>)}
        {p.buy.length > 0 && sub(<>
          <span style={C('buy')}>{A.buy}{omni ? ` (${A.omniHold(omni)})` : ''}: </span>
          {p.buy.map((b, i) => <span key={b.gem} className={plan.libraryGems.includes(b.gem) ? 'underline' : ''}>{i > 0 && ', '}{gem(b.gem, true)}</span>)}
          <span style={C('muted')}> · {p.buy[0]!.npc}</span>
        </>)}
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
    return <>{name}{sub(options.map((g, i) => <span key={g}>{i > 0 && ', '}{gem(g)}</span>))}</>
  }
  return name
}
