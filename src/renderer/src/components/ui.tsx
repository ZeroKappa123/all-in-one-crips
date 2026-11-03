import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Info, Loader2, OctagonAlert } from 'lucide-react'
import { S } from '../strings'

/* ------------------------------------------------------------------ buttons */

type BtnVariant = 'primary' | 'secondary' | 'plain' | 'ghost' | 'danger'

/** Push button in the macOS style: filled blue, gray fill, or text-only. */
export function Button({ variant = 'secondary', size = 'md', loading, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-on-accent shadow-card hover:brightness-110 active:brightness-95',
    secondary: 'bg-fill text-text hover:bg-fill-strong active:brightness-95',
    plain: 'text-accent-text hover:opacity-80',
    ghost: 'text-text-muted hover:text-text hover:bg-fill',
    danger: 'text-danger hover:bg-fill'
  }
  const h = size === 'sm' ? 'h-[24px] px-4 text-sm font-medium' : size === 'lg' ? 'h-[36px] px-7 text-lg' : 'h-[28px] px-5 text-base font-medium'
  return (
    <button
      type="button"
      {...rest}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-3 rounded-md transition-[background,filter,opacity] duration-fast disabled:opacity-40 disabled:cursor-default ${h} ${v[variant]} ${className}`}
    >
      {loading && <Loader2 aria-hidden className="h-[14px] w-[14px] animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ size = 16 }: { size?: 12 | 16 | 20 }) {
  return <Loader2 aria-hidden className="animate-spin text-text-muted" style={{ width: size, height: size }} />
}

/* ------------------------------------------------------------------ controls */

/** iOS/macOS switch. Renders a real checkbox with role=switch for keyboard and screen readers. */
export function Switch({ checked, onChange, label, id, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 32 : 42, hgt = size === 'sm' ? 18 : 24, k = hgt - 4
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer" style={{ width: w, height: hgt }}>
      <input id={id} type="checkbox" role="switch" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)} className="peer absolute inset-0 z-10 m-0 opacity-0 cursor-pointer" />
      <span aria-hidden className={`absolute inset-0 rounded-full transition-colors duration-base ${checked ? 'bg-[var(--c-switch-on)]' : 'bg-fill-strong'} peer-focus-visible:ring-[3px] peer-focus-visible:ring-focus/50`} />
      <span aria-hidden className="absolute top-[2px] left-[2px] rounded-full bg-white shadow-card transition-transform duration-base" style={{ width: k, height: k, transform: checked ? `translateX(${w - hgt}px)` : 'none' }} />
    </label>
  )
}

/** Segmented control (radio group). */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex(o => o.value === value)
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-md bg-fill p-[2px] ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el }}
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={e => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            const n = (idx + d + options.length) % options.length
            onChange(options[n]!.value); refs.current[n]?.focus()
          }}
          className={`${size === 'sm' ? 'h-[20px] px-4' : 'h-[24px] px-5'} rounded-[6px] font-medium transition-colors duration-fast ${o.value === value ? 'bg-surface-raised text-text shadow-card' : 'text-text-muted hover:text-text'}`}
        >{o.label}</button>
      ))}
    </div>
  )
}

/** Pop-up button: native select styled like macOS. */
export function Popup({ value, onChange, label, children, id, className = '' }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode; id?: string; className?: string }) {
  return (
    <select id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value)}
      className={`h-[24px] rounded-md bg-surface-raised text-text text-base pl-4 pr-6 shadow-card border-0 ${className}`}>
      {children}
    </select>
  )
}

export function TextField({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`h-[24px] rounded-md bg-surface-raised text-text text-base px-4 shadow-card border-0 placeholder:text-text-muted ${className}`} />
}

export function NumberInput({ value, onChange, label, invalid, placeholder, className = '' }: { value: number | null | ''; onChange: (v: number | null) => void; label: string; invalid?: boolean; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value === null || value === '' ? '' : String(value))
  useEffect(() => { setText(value === null || value === '' ? '' : String(value)) }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      value={text}
      onChange={e => {
        setText(e.target.value)
        const n = e.target.value === '' ? null : Number(e.target.value)
        if (n === null || !Number.isNaN(n)) onChange(n)
      }}
      onWheel={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.blur() }}
      className={`w-[54px] h-[22px] rounded-sm px-3 text-right tabular text-base text-text border-0 ${invalid ? 'bg-danger/20 ring-1 ring-danger' : 'bg-fill'} placeholder:text-text-muted ${className}`}
    />
  )
}

/* ------------------------------------------------------------------ grouped lists (System Settings style) */

export function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      {title && <h3 className="px-5 text-sm font-semibold text-text-muted">{title}</h3>}
      <div className="rounded-lg bg-surface shadow-card overflow-hidden divide-y divide-border [&>*]:border-border">{children}</div>
      {footer && <p className="px-5 text-sm text-text-muted">{footer}</p>}
    </section>
  )
}

export function Row({ label, detail, htmlFor, children, onClick, icon }: { label: ReactNode; detail?: ReactNode; htmlFor?: string; children?: ReactNode; onClick?: () => void; icon?: ReactNode }) {
  const inner = (
    <>
      {icon}
      <div className="flex-1 min-w-0 py-[7px]">
        <label htmlFor={htmlFor} className="block text-base text-text">{label}</label>
        {detail && <p className="text-sm text-text-muted">{detail}</p>}
      </div>
      <div className="flex items-center gap-4 shrink-0">{children}</div>
      {onClick && <ChevronRight aria-hidden className="h-[14px] w-[14px] text-text-muted" />}
    </>
  )
  if (onClick) return <button type="button" onClick={onClick} className="w-full flex items-center gap-5 px-5 min-h-[40px] text-left hover:bg-fill/60">{inner}</button>
  return <div className="flex items-center gap-5 px-5 min-h-[40px]">{inner}</div>
}

/** Rounded-square icon tile like the ones in macOS System Settings. */
export function IconTile({ color, children }: { color: string; children: ReactNode }) {
  return <span aria-hidden className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-white shadow-card" style={{ background: color }}>{children}</span>
}

/* ------------------------------------------------------------------ feedback */

export function StatusBanner({ tone, children, action }: { tone: 'info' | 'warning' | 'error'; children: ReactNode; action?: ReactNode }) {
  const Icon = tone === 'error' ? OctagonAlert : tone === 'warning' ? AlertTriangle : Info
  const color = tone === 'error' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-accent-text'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex items-start gap-4 rounded-lg bg-fill/70 px-5 py-4 text-base">
      <Icon aria-hidden className={`h-[16px] w-[16px] mt-[1px] shrink-0 ${color}`} />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-9 px-7 text-center text-base text-text-muted">
      <span aria-hidden className="opacity-70">{icon}</span>
      {children}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; title?: string }) {
  const c = { neutral: 'bg-fill text-text-muted', accent: 'bg-accent/20 text-accent-text', success: 'bg-success/20 text-success', warning: 'bg-warning/20 text-warning', danger: 'bg-danger/20 text-danger' }[tone]
  return <span title={title} className={`inline-flex items-center h-[16px] px-3 rounded-full text-xs font-semibold tabular ${c}`}>{children}</span>
}

/* ------------------------------------------------------------------ misc */

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Record<T, string>; active: T; onChange: (t: T) => void }) {
  return <Segmented label="Sections" value={active} onChange={onChange} options={(Object.keys(tabs) as T[]).map(k => ({ value: k, label: tabs[k] }))} />
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
        if (!key) return
        const mods = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt'].filter(Boolean)
        onChange([...mods, key].join('+'))
        setListening(false)
      }}
      className={`min-w-[132px] h-[24px] px-4 rounded-md text-base text-center tabular shadow-card ${conflict ? 'bg-danger/15 text-danger' : listening ? 'bg-accent text-on-accent' : 'bg-surface-raised text-text'}`}
    >
      {listening ? S.pressKeys : value ? <Keys combo={value} /> : <span className="text-text-muted">—</span>}
    </button>
  )
}

const KEY_GLYPH: Record<string, string> = { Ctrl: '⌃', Shift: '⇧', Alt: '⌥', Space: 'Space', Wheel: 'Wheel', Up: '↑', Down: '↓' }
export function Keys({ combo }: { combo: string }) {
  return <span className="tracking-wide">{combo.split('+').map(k => KEY_GLYPH[k] ?? k).join(' ')}</span>
}

export function normaliseKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-2])$/.test(code)) return code
  if (code === 'Space') return 'Space'
  if (code === 'ArrowUp') return 'Up'
  if (code === 'ArrowDown') return 'Down'
  return null
}
