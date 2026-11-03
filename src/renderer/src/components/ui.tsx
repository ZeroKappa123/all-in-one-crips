import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, Loader2, OctagonAlert } from 'lucide-react'
import type { Listing, Rarity } from '@shared/types'
import { S } from '../strings'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({ variant = 'secondary', size = 'md', loading, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95',
    secondary: 'bg-surface-raised text-text border border-border hover:border-border-input',
    ghost: 'text-text-muted hover:text-text hover:bg-surface-raised',
    danger: 'text-danger border border-border hover:border-danger'
  }
  const h = size === 'sm' ? 'h-[24px] px-4 text-xs' : 'h-[30px] px-5 text-sm font-semibold'
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-3 rounded-md transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed ${h} ${v[variant]} ${className}`}
    >
      {loading && <Loader2 aria-hidden className="h-[14px] w-[14px] animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ size = 16 }: { size?: 12 | 16 }) {
  return <Loader2 aria-hidden className="animate-spin text-accent" style={{ width: size, height: size }} />
}

const rarityClass: Record<Rarity, string> = {
  normal: 'text-rarity-normal', magic: 'text-rarity-magic', rare: 'text-rarity-rare', unique: 'text-rarity-unique',
  gem: 'text-rarity-gem', currency: 'text-rarity-currency', divination: 'text-rarity-normal', other: 'text-text'
}

export function ItemHeader({ rarity, name, baseType, extra }: { rarity: Rarity; name?: string; baseType: string; extra?: ReactNode }) {
  return (
    <header className="px-6 pt-5 pb-4 border-b border-border">
      <h2 className={`text-lg ${rarityClass[rarity]} truncate`} title={name ?? baseType}>
        <span className="sr-only">{rarity} item: </span>
        {name ?? baseType}
      </h2>
      {name && <p className="text-sm text-text-muted truncate">{baseType}</p>}
      {extra}
    </header>
  )
}

export function StatusBanner({ tone, children, action }: { tone: 'info' | 'warning' | 'error'; children: ReactNode; action?: ReactNode }) {
  const bar = tone === 'error' ? 'border-l-danger' : tone === 'warning' ? 'border-l-warning' : 'border-l-accent'
  const Icon = tone === 'error' ? OctagonAlert : tone === 'warning' ? AlertTriangle : Info
  const color = tone === 'error' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-accent'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-4 bg-surface-raised border-l-[3px] ${bar} rounded-sm px-5 py-4 text-sm`}>
      <Icon aria-hidden className={`h-[16px] w-[16px] mt-[2px] shrink-0 ${color}`} />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 px-6 text-center text-sm text-text-muted">
      <span aria-hidden className="text-text-muted">{icon}</span>
      {children}
    </div>
  )
}

export function NumberInput({ value, onChange, label, invalid }: { value: number | null; onChange: (v: number | null) => void; label: string; invalid?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => { setText(value === null ? '' : String(value)) }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={e => {
        setText(e.target.value)
        const n = e.target.value === '' ? null : Number(e.target.value)
        if (n === null || !Number.isNaN(n)) onChange(n)
      }}
      onWheel={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.blur() }}
      className={`w-[52px] h-[22px] bg-bg border ${invalid ? 'border-danger' : 'border-border-input'} rounded-sm px-2 text-right font-mono text-sm text-text`}
    />
  )
}

const statusDot = { online: 'bg-success', afk: 'bg-warning', offline: 'bg-danger' } as const

export function ListingRow({ l }: { l: Listing }) {
  return (
    <li className="flex items-center gap-4 px-6 h-row hover:bg-surface-raised text-sm">
      <span className="font-mono font-semibold w-[72px] text-right tabular-nums">{fmt(l.amount)}</span>
      <CurrencyBadge currency={l.currency} />
      {l.tabPriced && (
        <span className="text-warning font-semibold cursor-help" title={S.tabPriced} aria-label={S.tabPriced}>?</span>
      )}
      {l.count > 1 && <span className="text-xs text-text-muted">×{l.count}</span>}
      <span className="flex-1" />
      <span className="text-xs text-text-muted tabular-nums">{age(l.indexedAt)}</span>
      <span className={`h-[8px] w-[8px] rounded-full ${statusDot[l.status]}`} title={S.status[l.status]} aria-label={S.status[l.status]} role="img" />
    </li>
  )
}

const CURRENCY_SHORT: Record<string, string> = { chaos: 'c', divine: 'div', exalted: 'ex', alch: 'alch', mirror: 'mir' }

export function CurrencyBadge({ currency }: { currency: string }) {
  const short = CURRENCY_SHORT[currency] ?? currency
  const tone = currency === 'divine' ? 'text-rarity-currency border-rarity-currency' : 'text-text-muted border-border'
  return <span className={`inline-flex items-center justify-center min-w-[28px] h-[18px] px-2 rounded-full border text-xs font-mono ${tone}`} title={currency}>{short}</span>
}

export function fmt(n: number): string {
  return n >= 100 ? String(Math.round(n)) : String(Math.round(n * 100) / 100)
}

export function age(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, (now - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return `${Math.floor(s / 86400)} d`
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Record<T, string>; active: T; onChange: (t: T) => void }) {
  const keys = Object.keys(tabs) as T[]
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div role="tablist" className="flex gap-6 border-b border-border px-7">
      {keys.map((k, i) => (
        <button
          key={k}
          ref={el => { refs.current[i] = el }}
          role="tab"
          aria-selected={k === active}
          tabIndex={k === active ? 0 : -1}
          onClick={() => onChange(k)}
          onKeyDown={e => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            const next = keys[(i + d + keys.length) % keys.length]!
            onChange(next)
            refs.current[(i + d + keys.length) % keys.length]?.focus()
          }}
          className={`h-[36px] text-sm border-b-2 -mb-[1px] ${k === active ? 'border-accent text-text font-semibold' : 'border-transparent text-text-muted hover:text-text'}`}
        >
          {tabs[k]}
        </button>
      ))}
    </div>
  )
}

/** Records a key combination like "Ctrl+Alt+D". Esc cancels, Backspace clears. */
export function HotkeyRecorder({ value, onChange, conflict, label, allowWheel }: { value: string; onChange: (keys: string) => void; conflict?: string | null; label: string; allowWheel?: boolean }) {
  const [listening, setListening] = useState(false)
  return (
    <button
      type="button"
      aria-label={`${label}: ${value || 'not set'}`}
      onClick={() => setListening(true)}
      onBlur={() => setListening(false)}
      onWheel={e => {
        if (!listening || !allowWheel) return
        const mods = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt'].filter(Boolean)
        onChange([...mods, 'Wheel'].join('+'))
        setListening(false)
      }}
      onKeyDown={e => {
        if (!listening) return
        e.preventDefault()
        if (e.key === 'Escape') { setListening(false); return }
        if (e.key === 'Backspace') { onChange(''); setListening(false); return }
        const key = normaliseKey(e.code)
        if (!key) return // modifier alone: keep listening
        const mods = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt'].filter(Boolean)
        onChange([...mods, key].join('+'))
        setListening(false)
      }}
      className={`min-w-[140px] h-[28px] px-4 rounded-sm border font-mono text-sm text-left ${conflict ? 'border-danger' : listening ? 'border-accent' : 'border-border-input'} bg-bg`}
    >
      {listening ? <span className="text-accent">{S.pressKeys}</span> : value || <span className="text-text-muted">—</span>}
    </button>
  )
}

export function normaliseKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-2])$/.test(code)) return code
  if (code === 'Space') return 'Space'
  return null
}
