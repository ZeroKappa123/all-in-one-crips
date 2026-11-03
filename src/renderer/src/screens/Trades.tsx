import { useEffect, useRef, useState } from 'react'
import { Check, Clock, GripHorizontal, Home, MapPin, Search, Send, Skull, UserPlus, X, ArrowLeftRight, Hand, Repeat } from 'lucide-react'
import type { TradeCard, TradeAction } from '../../../main/trades'
import { currencyIcon, iconByName, loadIcons, onIcons } from '../pricecheck/icons'
import { S } from '../strings'

const T = S.trades

const hot = {
  onMouseEnter: () => window.crips.trades.interactive(true),
  onMouseLeave: () => window.crips.trades.interactive(false)
}

/** Short tone for a new incoming trade, generated here (no sound files shipped). */
function chime(): void {
  try {
    const ctx = new AudioContext()
    for (const [i, f] of [880, 1318.5].entries()) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12)
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.35)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.4)
    }
  } catch { /* audio not available */ }
}

export function Trades() {
  const [state, setState] = useState<{ cards: TradeCard[]; monsters: { count: number; more: boolean; at: number } | null }>({ cards: [], monsters: null })
  const [sound, setSound] = useState(true)
  const [, tick] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.crips.trades.get().then(setState)
    void loadIcons()
    const offs = [window.crips.trades.onState(setState), onIcons(() => tick(n => n + 1))]
    void window.crips.getConfig().then(r => setSound(r.config.trades.sound))
    offs.push(window.crips.onConfig(c => setSound(c.trades.sound)))
    return () => offs.forEach(o => o())
  }, [])
  useEffect(() => window.crips.trades.onNew(() => { if (sound) chime() }), [sound])
  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(([e]) => { if (e) window.crips.trades.resize(e.target.getBoundingClientRect().height) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])

  const incoming = state.cards.filter(c => c.direction === 'incoming')
  const outgoing = state.cards.filter(c => c.direction === 'outgoing')
  const show = incoming.length + outgoing.length > 0
  const act = (c: TradeCard, a: TradeAction) => void window.crips.trades.action(c.id, a)

  return (
    <div ref={root} className="flex flex-col gap-3 p-2">
      {show && (
        <div className="flex items-center gap-3 px-3">
          <span {...hot} aria-hidden className="cursor-move text-text-muted" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} title={T.drag}>
            <GripHorizontal className="h-[14px] w-[14px]" />
          </span>
          <span className="text-xs font-semibold text-text-muted">{T.title}</span>
          {state.monsters && <span className="ml-auto text-xs text-text-muted tabular" title={T.monstersTitle}><Skull aria-hidden className="inline h-[11px] w-[11px] mr-1" />{state.monsters.more ? '>' : ''}{state.monsters.count}</span>}
        </div>
      )}
      {incoming.map(c => <Incoming key={c.id} c={c} act={a => act(c, a)} />)}
      {outgoing.length > 0 && <p className="px-3 pt-1 text-xs font-semibold text-text-muted">{T.outgoing}</p>}
      {outgoing.map(c => <Outgoing key={c.id} c={c} act={a => act(c, a)} />)}
    </div>
  )
}

/* --------------------------------------------------------------- price with the game's currency icon */

const SHORT: Record<string, string> = { chaos: 'chaos', divine: 'div', exalted: 'ex', alch: 'alch', mirror: 'mirror' }

function Currency({ name }: { name: string }) {
  const icon = currencyIcon(name) ?? (iconByName(name) ? { name, url: iconByName(name)! } : undefined)
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading')
  const label = <span className="text-text-muted">{SHORT[name] ?? name}</span>
  if (!icon || state === 'broken') return label
  return (
    <>
      {state === 'loading' && label}
      <img src={icon.url} alt={icon.name} title={icon.name} draggable={false} className={state === 'ok' ? 'inline-block h-[18px] w-[18px] object-contain align-[-4px]' : 'hidden'}
        onLoad={() => setState('ok')} onError={() => setState('broken')} />
    </>
  )
}

function Price({ c }: { c: TradeCard }) {
  if (!c.price) return <span className="text-sm text-text-muted">{T.noPrice}</span>
  return <span className="inline-flex items-center gap-2 text-lg tabular whitespace-nowrap"><strong>{c.price.amount}</strong><Currency name={c.price.currency} /></span>
}

/* --------------------------------------------------------------- cards */

function Btn({ label, onClick, children, tone = 'plain', className = '' }: { label: string; onClick: () => void; children: React.ReactNode; tone?: 'plain' | 'primary' | 'danger' | 'success'; className?: string }) {
  const c = { plain: 'bg-fill text-text hover:bg-fill-strong', primary: 'bg-accent text-on-accent hover:brightness-110', danger: 'bg-fill text-danger hover:bg-danger/20', success: 'bg-success text-black/80 hover:brightness-110' }[tone]
  return <button type="button" {...hot} aria-label={label} title={label} onClick={onClick} className={`inline-flex items-center justify-center gap-2 h-[26px] px-4 rounded-md text-sm font-medium ${c} ${className}`}>{children}</button>
}

function Incoming({ c, act }: { c: TradeCard; act: (a: TradeAction) => void }) {
  const next: { a: TradeAction; label: string; icon: React.ReactNode } =
    c.state === 'new' ? { a: 'invite', label: T.invite, icon: <UserPlus aria-hidden className="h-[13px] w-[13px]" /> }
      : c.state === 'invited' ? { a: 'trade', label: T.trade, icon: <ArrowLeftRight aria-hidden className="h-[13px] w-[13px]" /> }
        : c.state === 'trading' ? { a: 'trade', label: T.tradeAgain, icon: <Repeat aria-hidden className="h-[13px] w-[13px]" /> }
          : { a: 'kick', label: T.kick, icon: <Check aria-hidden className="h-[13px] w-[13px]" /> }
  return (
    <article
      aria-label={`${T.from} ${c.player}: ${c.quantity ? `${c.quantity} ` : ''}${c.item}`}
      {...hot}
      onContextMenu={e => { e.preventDefault(); act('whois') }}
      onClick={e => {
        if ((e.target as HTMLElement).closest('button')) return
        if (e.ctrlKey && e.shiftKey) act('stillInterested')
        else if (e.ctrlKey) act('sold')
        else if (e.altKey) act('activate')
      }}
      className={`rounded-xl material-hud text-text px-5 py-4 animate-pop ${c.active ? 'ring-2 ring-accent/70' : ''} ${c.state === 'done' ? 'ring-2 ring-success/70' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-[18px] break-words">{c.quantity ? <span className="tabular">{c.quantity}× </span> : null}{c.item}</p>
          <p className="text-sm text-text-muted truncate">
            {c.player}
            {c.inArea && <span className="ml-2 inline-flex items-center gap-1 text-success"><MapPin aria-hidden className="h-[11px] w-[11px]" />{T.inArea}</span>}
          </p>
        </div>
        <Price c={c} />
      </div>
      {(c.stash || c.note) && (
        <p className="mt-2 text-sm text-text-muted">
          {c.stash && <button type="button" {...hot} onClick={() => act('highlight')} className="inline-flex items-center gap-1 text-accent-text hover:underline" title={T.highlight}><Search aria-hidden className="h-[11px] w-[11px]" />{c.stash.tab} · {T.cell(c.stash.left, c.stash.top)}</button>}
          {c.note && <span className="block italic">“{c.note}”</span>}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Btn tone={c.state === 'done' ? 'success' : 'primary'} label={next.label} onClick={() => act(next.a)}>{next.icon}{next.label}</Btn>
        {c.state === 'done' && <Btn label={T.thanks} onClick={() => act('thanks')}><Hand aria-hidden className="h-[13px] w-[13px]" />{T.thanks}</Btn>}
        {c.state !== 'done' && <Btn label={T.busy} onClick={() => act('busy')}><Clock aria-hidden className="h-[13px] w-[13px]" />{T.busy}</Btn>}
        <span className="flex-1" />
        <Btn tone="danger" label={T.dismiss} onClick={() => act('dismiss')}><X aria-hidden className="h-[13px] w-[13px]" /></Btn>
      </div>
    </article>
  )
}

function Outgoing({ c, act }: { c: TradeCard; act: (a: TradeAction) => void }) {
  return (
    <article aria-label={`${T.to} ${c.player}: ${c.item}`} {...hot} onContextMenu={e => { e.preventDefault(); act('whois') }}
      className={`rounded-xl material-hud text-text px-5 py-3 animate-pop ${c.inArea ? 'ring-2 ring-success/60' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium truncate">{c.item}</p>
          <p className="text-sm text-text-muted truncate">{c.player}</p>
        </div>
        <Price c={c} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Btn tone="primary" label={T.visit} onClick={() => act('hideout')}><Home aria-hidden className="h-[13px] w-[13px]" />{T.visit}</Btn>
        <Btn label={T.trade} onClick={() => act('trade')}><ArrowLeftRight aria-hidden className="h-[13px] w-[13px]" />{T.trade}</Btn>
        <Btn label={T.resend} onClick={() => act('resend')}><Send aria-hidden className="h-[13px] w-[13px]" /></Btn>
        <span className="flex-1" />
        <Btn tone="danger" label={T.dismiss} onClick={() => act('dismiss')}><X aria-hidden className="h-[13px] w-[13px]" /></Btn>
      </div>
    </article>
  )
}
