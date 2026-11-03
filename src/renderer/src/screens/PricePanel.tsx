import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Pin, PinOff, SearchX, X, Clipboard } from 'lucide-react'
import { parseItem, ParseError } from '@shared/parser/parseItem'
import { StatIndex } from '@shared/parser/matchStats'
import { buildFilters, type FilterSet } from '@shared/parser/buildFilters'
import { buildSearch, canSearch, tradeSiteUrl } from '@shared/trade/query'
import type { Config } from '@shared/config'
import type { Listing, ParsedItem, PriceSnapshot, PropertyFilters, StatFilter } from '@shared/types'
import { Button, EmptyState, ItemHeader, ListingRow, NumberInput, Spinner, StatusBanner, fmt } from '../components/ui'
import { S } from '../strings'

type Phase =
  | { kind: 'idle' }
  | { kind: 'error'; message: string; retryAt?: number }
  | { kind: 'ready' }
  | { kind: 'searching' }
  | { kind: 'results'; listings: Listing[]; total: number; searchId: string }

let statIndex: Promise<StatIndex | null> | null = null
function loadIndex(): Promise<StatIndex | null> {
  if (!statIndex) {
    statIndex = window.assay.stats().then(r => (r.ok ? new StatIndex(r.data) : null))
    void statIndex.then(i => { if (!i) statIndex = null }) // retry on next check
  }
  return statIndex
}

const AUTO_SEARCH: ParsedItem['rarity'][] = ['unique', 'gem', 'currency', 'divination', 'rare', 'magic']

export function PricePanel() {
  const [config, setConfig] = useState<Config | null>(null)
  const [item, setItem] = useState<ParsedItem | null>(null)
  const [filters, setFilters] = useState<FilterSet | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [locked, setLocked] = useState(false)
  const [market, setMarket] = useState<PriceSnapshot | null | 'loading'>(null)
  const [, tick] = useState(0)
  const entered = useRef(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(([e]) => { if (e) window.assay.resizePanel(e.target.getBoundingClientRect().height) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])
  const checkSeq = useRef(0)

  useEffect(() => {
    void window.assay.getConfig().then(r => setConfig(r.config))
    return window.assay.onConfig(setConfig)
  }, [])

  // countdown for rate limits
  useEffect(() => {
    if (phase.kind !== 'error' || !phase.retryAt) return
    const t = setInterval(() => tick(n => n + 1), 500)
    return () => clearInterval(t)
  }, [phase])

  const runSearch = useCallback(async (it: ParsedItem, f: FilterSet, cfg: Config) => {
    if (!canSearch(it, f.stats)) { setPhase({ kind: 'ready' }); return }
    setPhase({ kind: 'searching' })
    const body = buildSearch(it, f.stats, f.props, cfg.onlineOnly)
    const s = await window.assay.search(cfg.leagueId, body)
    if (!s.ok) { setPhase(errorPhase(s.error)); return }
    if (s.data.total === 0 || s.data.result.length === 0) {
      setPhase({ kind: 'results', listings: [], total: 0, searchId: s.data.id })
      return
    }
    const l = await window.assay.fetch(s.data.id, s.data.result)
    if (!l.ok) { setPhase(errorPhase(l.error)); return }
    setPhase({ kind: 'results', listings: l.data, total: s.data.total, searchId: s.data.id })
  }, [])

  const onItem = useCallback(async (text: string, lockedOpen: boolean) => {
    const seq = ++checkSeq.current
    entered.current = false
    setLocked(lockedOpen)
    setMarket(null)
    let parsed: ParsedItem
    try {
      parsed = parseItem(text)
    } catch (e) {
      setItem(null); setFilters(null)
      const kind = e instanceof ParseError ? e.kind : 'unsupported'
      setPhase({ kind: 'error', message: kind === 'not-english' ? S.notEnglish : kind === 'clipboard-empty' ? S.clipboardEmpty : S.unsupported })
      return
    }
    setItem(parsed)
    const cfg = config ?? (await window.assay.getConfig()).config
    const index = await loadIndex()
    if (seq !== checkSeq.current) return
    if (!index) {
      setFilters(null)
      setPhase({ kind: 'error', message: S.statsFailed })
      return
    }
    const f = buildFilters(parsed, index, cfg.searchTolerancePct)
    setFilters(f)
    if (['unique', 'currency', 'divination'].includes(parsed.rarity)) {
      setMarket('loading')
      void window.assay.aggregate(parsed).then(r => { if (seq === checkSeq.current) setMarket(r.ok ? r.data : null) })
    }
    if (parsed.rarity === 'currency') { setPhase({ kind: 'ready' }); return } // bulk trade is out of scope; the market value answers it
    if (AUTO_SEARCH.includes(parsed.rarity)) await runSearch(parsed, f, cfg)
    else setPhase({ kind: 'ready' })
  }, [config, runSearch])

  useEffect(() => window.assay.onItem(p => void onItem(p.text, p.locked)), [onItem])

  // Close on Escape, and when the window loses focus unless pinned.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') window.assay.hidePanel() }
    const blur = () => { if (!locked) window.assay.hidePanel() }
    addEventListener('keydown', key)
    addEventListener('blur', blur)
    return () => { removeEventListener('keydown', key); removeEventListener('blur', blur) }
  }, [locked])

  const updateStat = (key: string, patch: Partial<StatFilter>) =>
    setFilters(f => f && { ...f, stats: f.stats.map(s => (s.key === key ? { ...s, ...patch } : s)) })
  const updateProps = (patch: Partial<PropertyFilters>) => setFilters(f => f && { ...f, props: { ...f.props, ...patch } })

  const searchable = useMemo(() => !!item && !!filters && canSearch(item, filters.stats), [item, filters])
  const retryIn = phase.kind === 'error' && phase.retryAt ? Math.max(0, Math.ceil((phase.retryAt - Date.now()) / 1000)) : 0

  return (
    <main
      ref={root}
      aria-label={item ? `Price check: ${item.name ?? item.baseType}` : 'Price check'}
      onMouseEnter={() => { entered.current = true }}
      onMouseLeave={() => { if (entered.current && !locked) window.assay.hidePanel() }}
      style={{ maxHeight: Math.floor(screen.availHeight * 0.85) }}
      className="w-panel flex flex-col bg-surface border border-border rounded-lg shadow-pop overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="flex-1 pl-3 text-xs text-text-muted">{config?.leagueId}</span>
        <Button variant="ghost" size="sm" aria-pressed={locked} aria-label={locked ? S.unpin : S.pin} title={locked ? S.unpin : S.pin} onClick={() => setLocked(l => !l)}>
          {locked ? <Pin className="h-[14px] w-[14px] text-accent" /> : <PinOff className="h-[14px] w-[14px]" />}
        </Button>
        <Button variant="ghost" size="sm" aria-label={S.close} title={S.close} onClick={() => window.assay.hidePanel()}>
          <X className="h-[14px] w-[14px]" />
        </Button>
      </div>

      {item && (
        <ItemHeader
          rarity={item.rarity}
          name={item.name}
          baseType={item.baseType}
          extra={<Properties item={item} props={filters?.props} onChange={updateProps} />}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {phase.kind === 'idle' && <EmptyState icon={<Clipboard className="h-[20px] w-[20px]" />}>{S.waiting}</EmptyState>}

        {phase.kind === 'error' && (
          <div className="p-5">
            <StatusBanner tone={phase.retryAt ? 'warning' : 'error'} action={
              phase.retryAt && item && filters && config
                ? <Button size="sm" disabled={retryIn > 0} onClick={() => void runSearch(item, filters, config)}>{S.retry}</Button>
                : undefined
            }>
              {phase.retryAt ? S.rateLimited(retryIn) : phase.message}
            </StatusBanner>
          </div>
        )}

        {market !== null && item && (
          <section aria-label={S.marketValue} className="mx-6 my-5 rounded-md bg-surface-raised px-5 py-4">
            <p className="text-xs text-text-muted">{S.marketValue}</p>
            {market === 'loading' ? <Spinner /> : market ? (
              <p className="flex items-baseline gap-4">
                <span className="text-xl font-mono">{fmt(market.chaosValue)}c</span>
                {market.divineValue !== null && market.divineValue >= 0.05 && <span className="text-sm text-text-muted font-mono">{fmt(market.divineValue)} div</span>}
                {market.changePct !== null && (
                  <span className={`text-xs ${market.changePct >= 0 ? 'text-success' : 'text-danger'}`}>{market.changePct >= 0 ? '+' : ''}{Math.round(market.changePct)}% (7 d)</span>
                )}
              </p>
            ) : <p className="text-sm text-text-muted">{S.noMarketValue}</p>}
          </section>
        )}

        {filters && item && item.rarity !== 'currency' && (
          <form
            onSubmit={e => { e.preventDefault(); if (config) void runSearch(item, filters, config) }}
            className="py-3"
          >
            <ul aria-label="Filters">
              {filters.stats.map(s => <FilterRow key={s.key} s={s} onChange={p => updateStat(s.key, p)} />)}
              {filters.unmatched.map((t, i) => (
                <li key={`u${i}`} className="flex items-center gap-4 px-6 h-row text-sm text-text-muted opacity-60" title={S.unmatched}>
                  <span className="w-[14px]" aria-hidden />
                  <span className="flex-1 truncate">{t}</span>
                  <span className="sr-only">{S.unmatched}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4 px-6 pt-4">
              <Button variant="primary" type="submit" loading={phase.kind === 'searching'} disabled={!searchable}>
                {phase.kind === 'searching' ? S.searching : S.search}
              </Button>
              {!searchable && <span className="text-xs text-text-muted">{S.pickStat}</span>}
              <span className="flex-1" />
              {phase.kind === 'results' && config && (
                <Button variant="ghost" size="sm" onClick={() => window.assay.openExternal(tradeSiteUrl(config.leagueId, phase.searchId))}>
                  <ExternalLink aria-hidden className="h-[12px] w-[12px]" /> {S.openOnSite}
                </Button>
              )}
            </div>
          </form>
        )}

        {phase.kind === 'results' && (
          phase.listings.length === 0
            ? <EmptyState icon={<SearchX className="h-[20px] w-[20px]" />}>{S.noResults}</EmptyState>
            : (
              <section aria-label="Listings" className="border-t border-border pb-3">
                <p className="px-6 py-3 text-xs text-text-muted">{S.results(phase.listings.reduce((a, l) => a + l.count, 0), phase.total)}</p>
                <ul>{phase.listings.map(l => <ListingRow key={l.id} l={l} />)}</ul>
              </section>
            )
        )}
      </div>
      <p className="sr-only" role="status">{phase.kind === 'searching' ? S.searching : ''}</p>
    </main>
  )
}

function errorPhase(e: { kind: string; retryInSec?: number }): Phase {
  if (e.kind === 'rate-limited') return { kind: 'error', message: '', retryAt: Date.now() + (e.retryInSec ?? 10) * 1000 }
  return { kind: 'error', message: S.network }
}

function FilterRow({ s, onChange }: { s: StatFilter; onChange: (p: Partial<StatFilter>) => void }) {
  const id = `f-${s.key}`
  return (
    <li className={`flex items-center gap-4 px-6 h-row hover:bg-surface-raised ${s.enabled ? '' : 'text-text-muted'}`}>
      <input id={id} type="checkbox" checked={s.enabled} onChange={e => onChange({ enabled: e.target.checked })} className="accent-[var(--c-accent)] h-[14px] w-[14px]" />
      <label htmlFor={id} className="flex-1 truncate text-sm cursor-pointer" title={s.label}>
        {s.pseudo && <span className="mr-3 inline-block rounded-sm border border-border px-2 text-xs text-accent" title={S.pseudoBadge}>Σ<span className="sr-only">{S.pseudoBadge}</span></span>}
        {s.source !== 'explicit' && s.source !== 'pseudo' && <span className="mr-3 text-xs text-text-muted">{s.source}</span>}
        {s.label}
      </label>
      {s.value !== null && (
        <>
          <NumberInput label={`Minimum for ${s.label}`} value={s.min} onChange={v => onChange({ min: v, enabled: true })} invalid={s.min !== null && s.max !== null && s.min > s.max} />
          <NumberInput label={`Maximum for ${s.label}`} value={s.max} onChange={v => onChange({ max: v, enabled: true })} invalid={s.min !== null && s.max !== null && s.min > s.max} />
        </>
      )}
    </li>
  )
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`h-[22px] px-4 rounded-full border text-xs ${on ? 'border-accent text-accent' : 'border-border text-text-muted hover:text-text'}`}>
      {children}
    </button>
  )
}

function Properties({ item, props, onChange }: { item: ParsedItem; props?: PropertyFilters; onChange: (p: Partial<PropertyFilters>) => void }) {
  if (!props) return null
  const chips: React.ReactNode[] = []
  if (item.itemLevel && (item.rarity === 'rare' || item.rarity === 'magic' || item.rarity === 'normal'))
    chips.push(<Chip key="il" on={props.itemLevelMin !== null} onClick={() => onChange({ itemLevelMin: props.itemLevelMin === null ? item.itemLevel! : null })}>{S.itemLevel(item.itemLevel)}</Chip>)
  if (item.links >= 5)
    chips.push(<Chip key="ln" on={props.linksMin !== null} onClick={() => onChange({ linksMin: props.linksMin === null ? item.links : null })}>{S.links(item.links)}</Chip>)
  if (item.gemLevel)
    chips.push(<Chip key="gl" on={props.gemLevelMin !== null} onClick={() => onChange({ gemLevelMin: props.gemLevelMin === null ? item.gemLevel! : null })}>{S.gemLevel(item.gemLevel)}</Chip>)
  if (item.rarity === 'gem' && item.quality)
    chips.push(<Chip key="q" on={props.qualityMin !== null} onClick={() => onChange({ qualityMin: props.qualityMin === null ? item.quality! : null })}>{S.quality(item.quality)}</Chip>)
  if (props.corrupted !== null || item.corrupted)
    chips.push(<Chip key="c" on={props.corrupted !== null} onClick={() => onChange({ corrupted: props.corrupted === null ? item.corrupted : null })}>{item.corrupted ? S.corrupted : S.notCorrupted}</Chip>)
  if (item.rarity === 'rare')
    chips.push(<Chip key="b" on={props.useBaseType} onClick={() => onChange({ useBaseType: !props.useBaseType })}>{S.baseType}</Chip>)
  if (!chips.length) return null
  return <div className="flex flex-wrap gap-3 pt-4">{chips}</div>
}
