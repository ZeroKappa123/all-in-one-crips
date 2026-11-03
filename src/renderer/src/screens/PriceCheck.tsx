import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowUpRight, Clipboard, Pin, PinOff, SearchX, X, TrendingUp, TrendingDown } from 'lucide-react'
import { parseClipboard, ItemRarity, ItemCategory, type ParsedItem } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import type { FilterOrGroup, FilterPreset, ItemFilters, StatFilter, FilterNumeric } from '@/web/price-check/filters/interfaces'
import { FilterTag } from '@/web/price-check/filters/interfaces'
import { CATEGORY_TO_TRADE_ID, createTradeRequest, requestResults, requestTradeResultList, type PricingResult, type SearchResult } from '@/web/price-check/trade/pathofexile-trade'
import { execBulkSearch, type BulkSearch } from '@/web/price-check/trade/pathofexile-bulk'
import { apiToSatisfySearch, getTradeEndpoint } from '@/web/price-check/trade/common'
import { getDetailsId, isValuableBasetype } from '@/web/price-check/trends/getDetailsId'
import { usePoeninja, displayRounding } from '@/web/background/Prices'
import { AppConfig } from '@/web/Config'
import { onAptChange } from 'vue'
import { groupsWithGem } from '@shared/act/pob'
import { Badge, Button, EmptyState, NumberInput, Segmented, Spinner, StatusBanner } from '../components/ui'
import { bootstrapPriceCheck } from '../pricecheck/bootstrap'
import { useAct } from '../act/useAct'
import { S } from '../strings'
import { aptText } from '../pricecheck/i18n'
import { currencyIcon, iconByName, loadIcons, onIcons, safeIcon } from '../pricecheck/icons'

const P = S.pc

const PRESET_LABEL: Record<string, string> = {
  'filters.preset_exact': P.presetExact,
  'filters.preset_pseudo': P.presetPseudo,
  'filters.preset_base_item': P.presetBase,
  'filters.preset_bulk': P.presetBulk
}

type Presets = { active: string; presets: FilterPreset[] }

/** Re-render on demand: the ported filter objects are mutated in place, like in the original. */
function useBump(): [number, () => void] {
  return useReducer((n: number) => n + 1, 0)
}

export function PriceCheck() {
  const [ready, setReady] = useState<'loading' | 'ok' | 'error'>('loading')
  const [item, setItem] = useState<ParsedItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [presets, setPresets] = useState<Presets | null>(null)
  const [locked, setLocked] = useState(false)
  const [doSearch, setDoSearch] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const [, bump] = useBump()
  const root = useRef<HTMLElement>(null)
  const entered = useRef(false)

  useEffect(() => { bootstrapPriceCheck().then(() => setReady('ok'), () => setReady('error')) }, [])
  useEffect(() => onAptChange(bump), [])
  useEffect(() => onIcons(bump), [])
  const [itemIcon, setItemIcon] = useState<string | undefined>()
  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(([e]) => { if (e) window.crips.resizePanel(e.target.getBoundingClientRect().height) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])

  const onItem = useCallback(async (text: string, lock: boolean) => {
    await bootstrapPriceCheck()
    entered.current = false
    setLocked(lock)
    const r = parseClipboard(text)
    if (r.isErr()) {
      setItem(null); setPresets(null)
      setError(!text.trim() ? P.errors.clipboard : /unknown/i.test(r.error) ? P.errors.UNKNOWN_ITEM : P.errors.unknown)
      return
    }
    const it = r.value
    const cfg = AppConfig<{ merchantOnly: boolean; collapseListings: 'app' | 'api'; activateStockFilter: boolean; searchStatRange: number; defaultCurrency: string | null; smartInitialSearch: boolean; lockedInitialSearch: boolean }>('price-check')!
    const p = createPresets(it, {
      league: AppConfig().leagueId!,
      merchantOnly: cfg.merchantOnly,
      collapseListings: cfg.collapseListings,
      activateStockFilter: cfg.activateStockFilter,
      searchStatRange: cfg.searchStatRange,
      useEn: true,
      currency: cfg.defaultCurrency
    })
    setError(null)
    setItemIcon(undefined)
    void loadIcons()
    setItem(it)
    setPresets(p)
    // Same initial-search rules as the original: search right away when the result needs no choices.
    const auto = (lock ? cfg.lockedInitialSearch : cfg.smartInitialSearch) && Boolean(
      it.rarity === ItemRarity.Unique || p.active === 'filters.preset_bulk' || it.mapCompletionReward ||
      it.category === ItemCategory.HeistContract || it.category === ItemCategory.HeistBlueprint ||
      it.category === ItemCategory.SanctumRelic || it.category === ItemCategory.Charm || it.category === ItemCategory.Idol ||
      (!CATEGORY_TO_TRADE_ID.has(it.category!) && it.info.refName !== 'Mercenary Warrant') || it.isUnidentified || it.isVeiled)
    setDoSearch(auto)
    setSearchKey(k => k + 1)
    usePoeninja().queuePricesFetch()
  }, [])

  useEffect(() => window.crips.onItem(p => void onItem(p.text, p.locked)), [onItem])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') window.crips.hidePanel() }
    const blur = () => { if (!locked) window.crips.hidePanel() }
    addEventListener('keydown', key)
    addEventListener('blur', blur)
    return () => { removeEventListener('keydown', key); removeEventListener('blur', blur) }
  }, [locked])

  const preset = presets?.presets.find(p => p.id === presets.active)
  const api = item && preset ? apiToSatisfySearch(item, preset.stats, preset.filters) : 'trade'
  const changed = () => { setDoSearch(false); bump() }
  const search = () => { setDoSearch(true); setSearchKey(k => k + 1) }

  return (
    <main
      ref={root}
     
      aria-label={item ? `${P.title}: ${item.info.name}` : P.title}
      onMouseEnter={() => { entered.current = true }}
      onMouseLeave={() => { if (entered.current && !locked) window.crips.hidePanel() }}
      style={{ maxHeight: Math.floor(screen.availHeight * 0.85) }}
      className="w-panel flex flex-col rounded-xl material-hud text-text overflow-hidden animate-pop"
    >
      <TitleBar locked={locked} setLocked={setLocked} filters={preset?.filters} onChange={() => { changed(); search() }} />

      <div className="flex-1 overflow-y-auto">
        {ready === 'loading' && <div className="flex justify-center py-8"><Spinner size={20} /></div>}
        {ready === 'error' && <div className="p-6"><StatusBanner tone="error">{P.errors.data}</StatusBanner></div>}
        {ready === 'ok' && !item && !error && <EmptyState icon={<Clipboard className="h-[24px] w-[24px]" />}>{S.waiting}</EmptyState>}
        {error && <div className="p-6"><StatusBanner tone="error">{error}</StatusBanner></div>}

        {item && presets && preset && (
          <>
            <ItemTitle item={item} icon={itemIcon ?? iconByName(item.info.refName)} />
            {presets.presets.length > 1 && (
              <div className="px-6 pb-4">
                <Segmented size="sm" label={P.presets} value={presets.active}
                  options={presets.presets.map(p => ({ value: p.id, label: PRESET_LABEL[p.id] ?? aptText(p.id) ?? p.id }))}
                  onChange={id => { setPresets({ ...presets, active: id }); setDoSearch(false) }} />
              </div>
            )}
            <Trend item={item} />
            <ItemFilterChips item={item} filters={preset.filters} onChange={changed} />
            <StatList item={item} stats={preset.stats} onChange={changed} />
            <div className="flex items-center gap-4 px-6 py-5">
              {!doSearch && <Button variant="primary" onClick={search}>{S.search}</Button>}
              {item.unknownModifiers.length > 0 && <span className="text-sm text-warning">{P.unknownMods(item.unknownModifiers.length)}</span>}
            </div>
            {doSearch && api === 'trade' && <TradeListing key={searchKey} item={item} filters={preset.filters} stats={preset.stats} onIcon={setItemIcon} />}
            {doSearch && api === 'bulk' && <TradeBulk key={searchKey} item={item} filters={preset.filters} />}
            <BuildInfo item={item} />
          </>
        )}
      </div>
      <footer className="px-6 py-3 text-xs text-text-muted border-t hairline">{P.poweredBy}</footer>
    </main>
  )
}

/* ------------------------------------------------------------------ title bar */

function TitleBar({ locked, setLocked, filters, onChange }: { locked: boolean; setLocked: (f: (l: boolean) => boolean) => void; filters?: ItemFilters; onChange: () => void }) {
  const status = !filters ? 'online' : filters.trade.offline ? 'any' : filters.trade.onlineInLeague ? 'league' : 'online'
  return (
    <div className="flex items-center gap-4 px-5 pt-4 pb-2">
      <span className="text-xs font-semibold text-text-muted truncate max-w-[140px]" title={AppConfig().leagueId}>{AppConfig().leagueId}</span>
      {filters && (
        <Segmented size="sm" label={P.sellers} value={status} onChange={v => {
          filters.trade.offline = v === 'any'
          filters.trade.onlineInLeague = v === 'league'
          onChange()
        }} options={[{ value: 'online', label: P.online }, { value: 'league', label: P.inLeague }, { value: 'any', label: P.any }]} />
      )}
      <span className="flex-1" />
      <Button variant="ghost" size="sm" aria-pressed={locked} aria-label={locked ? S.unpin : S.pin} title={locked ? S.unpin : S.pin} onClick={() => setLocked(l => !l)}>
        {locked ? <Pin className="h-[14px] w-[14px] text-accent-text" /> : <PinOff className="h-[14px] w-[14px]" />}
      </Button>
      <Button variant="ghost" size="sm" aria-label={S.close} title={S.close} onClick={() => window.crips.hidePanel()}>
        <X className="h-[14px] w-[14px]" />
      </Button>
    </div>
  )
}

const RARITY_CLASS: Record<string, string> = {
  [ItemRarity.Normal]: 'text-rarity-normal', [ItemRarity.Magic]: 'text-rarity-magic', [ItemRarity.Rare]: 'text-rarity-rare',
  [ItemRarity.Unique]: 'text-rarity-unique'
}

/** Gems and currency have no rarity in the parsed item; colour them by kind. */
function titleClass(item: ParsedItem): string {
  if (item.category === ItemCategory.Gem) return 'text-rarity-gem'
  if (item.info.namespace === 'ITEM' && !item.rarity) return 'text-rarity-currency'
  return RARITY_CLASS[item.rarity ?? ''] ?? 'text-text'
}

function ItemTitle({ item, icon }: { item: ParsedItem; icon?: string }) {
  const name = item.info.name
  const base = item.rarity === ItemRarity.Unique ? item.info.unique?.base : undefined
  return (
    <header className="flex items-center gap-5 px-6 pt-2 pb-4">
      <ItemArt url={icon} />
      <div className="min-w-0 flex-1">
      <h2 className={`text-xl leading-[25px] truncate ${titleClass(item)}`}>{name}</h2>
      <p className="text-sm text-text-muted truncate">
        {[base, item.category, item.itemLevel ? `${P.ilvl} ${item.itemLevel}` : null].filter(Boolean).join(' · ')}
      </p>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ trend (poe.ninja) */

function Trend({ item }: { item: ParsedItem }) {
  const { findPriceByQuery, autoCurrency, xchgRate } = usePoeninja()
  const id = getDetailsId(item)
  const trend = id ? findPriceByQuery(id) : null
  if (!trend || (item.rarity === ItemRarity.Rare && !isValuableBasetype(item)) || item.rarity === ItemRarity.Magic) return null
  const v = autoCurrency(trend.chaos)
  const graph = trend.graph.filter((x): x is number => x !== null)
  const change = graph.length ? graph[graph.length - 1]! : null
  return (
    <section aria-label={P.marketValue} className="mx-6 mb-4 flex items-center gap-5 rounded-lg bg-fill/60 px-5 py-4">
      <div className="flex-1">
        <p className="text-xs text-text-muted">{P.marketValue}</p>
        <p className="flex items-center gap-2 text-xl tabular">{displayRounding(v.min)} <CurrencyMark id={v.currency === 'div' ? 'divine' : 'chaos'} size={20} /></p>
        {v.currency === 'chaos' && xchgRate.value && trend.chaos > 20 && <p className="text-xs text-text-muted tabular">≈ {displayRounding(trend.chaos / xchgRate.value)} div</p>}
      </div>
      {change !== null && (
        <Badge tone={change >= 0 ? 'success' : 'danger'} title={P.sevenDays}>
          {change >= 0 ? <TrendingUp aria-hidden className="h-[10px] w-[10px] mr-1" /> : <TrendingDown aria-hidden className="h-[10px] w-[10px] mr-1" />}
          {change >= 0 ? '+' : ''}{Math.round(change)}%
        </Badge>
      )}
      <Sparkline values={trend.graph} />
      <Button variant="plain" size="sm" aria-label={P.openNinja} title={P.openNinja} onClick={() => window.crips.openExternal(trend.url)}><ArrowUpRight className="h-[14px] w-[14px]" /></Button>
    </section>
  )
}

function Sparkline({ values }: { values: Array<number | null> }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (pts.length < 2) return null
  const ys = pts.map(p => p[1])
  const min = Math.min(...ys), max = Math.max(...ys)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x / (values.length - 1)) * 80},${22 - ((y - min) / (max - min || 1)) * 20}`).join(' ')
  const up = ys[ys.length - 1]! >= ys[0]!
  return <svg aria-hidden width="80" height="24" viewBox="0 0 80 24"><path d={d} fill="none" stroke={up ? 'var(--c-success)' : 'var(--c-danger)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ------------------------------------------------------------------ item filters */

const NUMERIC: [keyof ItemFilters, string][] = [
  ['itemLevel', P.ilvl], ['quality', P.quality], ['linkedSockets', P.links], ['whiteSockets', P.whiteSockets], ['gemLevel', P.gemLevel],
  ['mapTier', P.mapTier], ['areaLevel', P.areaLevel], ['stackSize', P.stack], ['sentinelCharge', P.charge]
]

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" aria-pressed={on} title={title} onClick={onClick}
      className={`inline-flex items-center gap-2 h-[24px] px-4 rounded-full text-sm font-medium transition-colors duration-fast ${on ? 'bg-accent text-on-accent' : 'bg-fill text-text-muted hover:text-text'}`}>
      {children}
    </button>
  )
}

function ItemFilterChips({ item, filters, onChange }: { item: ParsedItem; filters: ItemFilters; onChange: () => void }) {
  const chips: React.ReactNode[] = []
  if (filters.searchRelaxed) {
    chips.push(<Chip key="relaxed" on={filters.searchRelaxed.disabled} onClick={() => { filters.searchRelaxed!.disabled = !filters.searchRelaxed!.disabled; onChange() }}
      title={P.exactBaseHelp}>{filters.searchExact.baseType ?? filters.searchExact.name ?? P.exactBase}</Chip>)
  }
  for (const [key, label] of NUMERIC) {
    const f = filters[key] as FilterNumeric | undefined
    if (!f) continue
    chips.push(<NumericChip key={key} label={label} f={f} onChange={onChange} />)
  }
  if (filters.corrupted) {
    chips.push(<Chip key="corr" on={filters.corrupted.value} onClick={() => { filters.corrupted!.value = !filters.corrupted!.value; onChange() }}>{filters.corrupted.value ? P.corrupted : P.notCorrupted}</Chip>)
  }
  for (const inf of filters.influences ?? []) {
    chips.push(<Chip key={inf.value} on={!inf.disabled} onClick={() => { inf.disabled = !inf.disabled; onChange() }}>{inf.value}</Chip>)
  }
  if (filters.unidentified) chips.push(<Chip key="unid" on={!filters.unidentified.disabled} onClick={() => { filters.unidentified!.disabled = !filters.unidentified!.disabled; onChange() }}>{P.unidentified}</Chip>)
  if (filters.mirrored && !filters.mirrored.hidden) chips.push(<Chip key="mir" on={!filters.mirrored.disabled} onClick={() => { filters.mirrored!.disabled = !filters.mirrored!.disabled; onChange() }}>{P.mirrored}</Chip>)
  if (filters.rarity) chips.push(<Chip key="rar" on={!filters.rarity.disabled} onClick={() => { filters.rarity!.disabled = !filters.rarity!.disabled; onChange() }}>{P.rarity(filters.rarity.value)}</Chip>)
  void item
  if (!chips.length) return null
  return <div className="flex flex-wrap gap-3 px-6 pb-4" role="group" aria-label={P.itemFilters}>{chips}</div>
}

function NumericChip({ label, f, onChange }: { label: string; f: FilterNumeric; onChange: () => void }) {
  return (
    <span className={`inline-flex items-center gap-2 h-[24px] pl-4 pr-1 rounded-full text-sm font-medium ${f.disabled ? 'bg-fill text-text-muted' : 'bg-accent text-on-accent'}`}>
      <button type="button" aria-pressed={!f.disabled} onClick={() => { f.disabled = !f.disabled; onChange() }}>{label}</button>
      <input type="number" aria-label={`${label} minimum`} value={f.value} onChange={e => { f.value = Number(e.target.value); f.disabled = false; onChange() }}
        className="w-[38px] h-[18px] rounded-full bg-black/25 text-center tabular text-sm border-0 text-inherit" />
    </span>
  )
}

/* ------------------------------------------------------------------ stat filters */

const TAG_LABEL: Record<string, { text: string; tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }> = {
  [FilterTag.Pseudo]: { text: 'Σ', tone: 'accent' },
  [FilterTag.Implicit]: { text: 'implicit', tone: 'neutral' },
  [FilterTag.Crafted]: { text: 'crafted', tone: 'neutral' },
  [FilterTag.Enchant]: { text: 'enchant', tone: 'neutral' },
  [FilterTag.Fractured]: { text: 'fractured', tone: 'warning' },
  [FilterTag.Scourge]: { text: 'scourge', tone: 'danger' },
  [FilterTag.Veiled]: { text: 'veiled', tone: 'neutral' },
  [FilterTag.Property]: { text: 'property', tone: 'neutral' },
  [FilterTag.Synthesised]: { text: 'synth', tone: 'neutral' }
}

function tierBadges(f: StatFilter, item: ParsedItem): number[] {
  const out: number[] = []
  for (const s of f.sources) {
    const tier = s.modifier.info.tier
    if (!tier) continue
    const ranked = (f.tag === FilterTag.Explicit || f.tag === FilterTag.Pseudo || f.tag === FilterTag.Property) &&
      item.category !== ItemCategory.Jewel && item.category !== ItemCategory.ClusterJewel && item.category !== ItemCategory.MemoryLine && item.category !== ItemCategory.Idol
    if (!ranked || tier <= 2) out.push(tier)
  }
  return out.sort((a, b) => a - b)
}

function StatList({ item, stats, onChange }: { item: ParsedItem; stats: FilterOrGroup[]; onChange: () => void }) {
  if (!stats.length) return null
  return (
    <ul aria-label={P.modifiers} className="mx-4 mb-2 rounded-lg bg-fill/40 py-2">
      {stats.map((s, i) => s.group
        ? (
          <li key={i}>
            <StatRow item={item} f={s.meta} onChange={onChange} />
            {s.expanded && <ul className="ml-7 border-l hairline">{s.stats.map((x, j) => <StatRow key={j} item={item} f={x} onChange={onChange} />)}</ul>}
          </li>
        )
        : <StatRow key={i} item={item} f={s} onChange={onChange} />)}
    </ul>
  )
}

function StatRow({ item, f, onChange }: { item: ParsedItem; f: StatFilter; onChange: () => void }) {
  const tag = TAG_LABEL[f.tag]
  const tiers = tierBadges(f, item)
  const id = useMemo(() => `f-${Math.random().toString(36).slice(2)}`, [])
  const roll = f.roll
  const pct = roll?.bounds && roll.bounds.max !== roll.bounds.min ? Math.max(0, Math.min(1, (roll.value - roll.bounds.min) / (roll.bounds.max - roll.bounds.min))) : null
  return (
    <li className={`group flex items-center gap-4 px-4 min-h-[30px] rounded-md hover:bg-fill/50 ${f.disabled ? 'text-text-muted' : 'text-text'} ${f.hidden ? 'opacity-50' : ''}`} title={aptText(f.hidden)}>
      <input id={id} type="checkbox" checked={!f.disabled} disabled={!!f.hidden} onChange={e => { f.disabled = !e.target.checked; onChange() }}
        className="h-[14px] w-[14px] rounded-[4px] accent-[var(--c-accent)]" />
      <label htmlFor={id} className="flex-1 min-w-0 py-[5px] text-base leading-[17px]">
        {tag && <Badge tone={tag.tone}>{tag.text}</Badge>}{tag && ' '}
        {tiers.map(t => <span key={t}><Badge tone={t === 1 ? 'warning' : t === 2 ? 'accent' : 'neutral'} title={`Tier ${t}`}>T{t}</Badge> </span>)}
        <span className="break-words">{roll ? f.text.trim().replace('#', roll.dp ? roll.value.toFixed(2) : String(roll.value)) : f.text}</span>
        {pct !== null && (
          <span aria-hidden className="block mt-1 h-[2px] w-full rounded-full bg-fill overflow-hidden">
            <span className="block h-full rounded-full bg-accent-text" style={{ width: `${pct * 100}%` }} />
          </span>
        )}
      </label>
      {roll && (
        <span className="flex items-center gap-2">
          <NumberInput label={`${P.min} ${f.text}`} placeholder={P.min} value={roll.min ?? ''} onChange={v => { roll.min = v ?? ''; f.disabled = false; onChange() }} />
          <NumberInput label={`${P.max} ${f.text}`} placeholder={P.max} value={roll.max ?? ''} onChange={v => { roll.max = v ?? ''; f.disabled = false; onChange() }} />
        </span>
      )}
      {f.option && (
        <NumberInput label={f.text} value={f.option.value} onChange={v => { if (v !== null) { f.option!.value = v; f.disabled = false; onChange() } }} />
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ results: listings */

type Grouped = PricingResult & { listedTimes: number }

function groupResults(results: PricingResult[], collapseMerchant: boolean): Grouped[] {
  const out: Grouped[] = []
  for (const r of results) {
    if (out.length === 0 || (r.hasFee && !collapseMerchant)) { out.push({ listedTimes: 1, ...r }); continue }
    const existing = out.find((a, idx) =>
      (a.accountName === r.accountName && a.priceCurrency === r.priceCurrency && a.priceAmount === r.priceAmount) ||
      (a.accountName === r.accountName && (out.length - idx) <= 2))
    if (existing) { if (existing.stackSize) existing.stackSize += r.stackSize!; else existing.listedTimes += 1 }
    else out.push({ listedTimes: 1, ...r })
  }
  return out
}

function TradeListing({ item, filters, stats, onIcon }: { item: ParsedItem; filters: ItemFilters; stats: FilterOrGroup[]; onIcon: (url: string | undefined) => void }) {
  const [list, setList] = useState<SearchResult | null>(null)
  const [results, setResults] = useState<PricingResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sr = await requestTradeResultList(createTradeRequest(filters, stats), filters.trade.league)
        if (cancelled) return
        setList(sr)
        const acc: PricingResult[] = []
        for (let from = 0; from < Math.min(sr.result.length, 40); from += 10) {
          const batch = await requestResults(sr.id, sr.result.slice(from, from + 10), { accountName: '' })
          if (cancelled) return
          acc.push(...batch)
          setResults([...acc])
          if (from === 0) onIcon(safeIcon(batch.find(b => b.icon)?.icon))
          if (groupResults(acc, filters.trade.collapseMerchant).length >= 10) break
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (error) return <div className="px-6 pb-5"><StatusBanner tone="error">{error}</StatusBanner></div>
  const grouped = groupResults(results, filters.trade.collapseMerchant)
  const url = list ? `https://${getTradeEndpoint()}/trade/search/${encodeURIComponent(filters.trade.league)}/${list.id}` : null
  return (
    <section aria-label={P.listings} className="pb-4">
      <div className="flex items-center gap-4 px-6 pb-3 text-sm text-text-muted">
        <span>{P.matched}</span>
        {list ? <span className="tabular text-text">{list.total}{list.inexact ? '+' : ''}</span> : <Spinner size={12} />}
        <span className="flex-1" />
        {url && <Button variant="plain" size="sm" onClick={() => window.crips.openExternal(url)}>{P.openTrade}<ArrowUpRight aria-hidden className="h-[12px] w-[12px]" /></Button>}
      </div>
      {list && list.total === 0 && <EmptyState icon={<SearchX className="h-[22px] w-[22px]" />}>{S.noResults}</EmptyState>}
      {grouped.length > 0 && (
        <table className="w-full text-base">
          <thead>
            <tr className="text-left text-xs text-text-muted">
              <th className="font-medium px-6 py-2">{P.price}</th>
              {item.stackSize && <th className="font-medium px-3 text-right">{P.stock}</th>}
              {filters.itemLevel && <th className="font-medium px-3 text-right">{P.ilvl}</th>}
              {item.category === ItemCategory.Gem && <th className="font-medium px-3 text-right">{P.gemLevel}</th>}
              {(filters.quality || item.category === ItemCategory.Gem) && <th className="font-medium px-3 text-right">{P.quality}</th>}
              <th className="font-medium px-6 w-full">{P.listed}</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(r => (
              <tr key={r.id} className="odd:bg-fill/30">
                <td className="px-6 py-[5px] whitespace-nowrap tabular">
                  <Price amount={r.priceAmount} currency={r.priceCurrency} />
                  {r.listedTimes > 2 && <> <Badge>×{r.listedTimes}</Badge></>}
                  {!r.hasFee && !r.hasNote && <> <Badge tone="warning" title={S.tabPriced}>?</Badge></>}
                </td>
                {item.stackSize && <td className="px-3 text-right tabular">{r.stackSize}</td>}
                {filters.itemLevel && <td className="px-3 text-right tabular">{r.itemLevel}</td>}
                {item.category === ItemCategory.Gem && <td className="px-3 text-right tabular">{r.level}</td>}
                {(filters.quality || item.category === ItemCategory.Gem) && <td className="px-3 text-right tabular text-accent-text">{r.quality}</td>}
                <td className="px-6 whitespace-nowrap"><Status status={r.accountStatus} /> <span className="text-sm text-text-muted">{r.relativeDate}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

const CURRENCY: Record<string, string> = { chaos: 'chaos', divine: 'div', exalted: 'ex', alch: 'alch', 'mirror': 'mirror' }

function Price({ amount, currency }: { amount: number; currency: string }) {
  return <span className={`inline-flex items-center gap-2 ${currency === 'exalted' ? 'line-through' : ''}`}><span className="font-semibold">{amount}</span> <CurrencyMark id={currency} /></span>
}

/** Currency icon from GGG's image server, or its short name until the icon list has loaded (or offline). */
function CurrencyMark({ id, size = 16 }: { id: string; size?: number }) {
  const icon = currencyIcon(id)
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading')
  const text = <span className={id === 'divine' ? 'text-rarity-currency' : 'text-text-muted'}>{CURRENCY[id] ?? id}</span>
  if (!icon || state === 'broken') return text
  return (
    <>
      {state === 'loading' && text}
      <img src={icon.url} alt={icon.name} title={icon.name} width={size} height={size} draggable={false}
        className={state === 'ok' ? 'inline-block object-contain' : 'hidden'} style={{ width: size, height: size }}
        onLoad={() => setState('ok')} onError={() => setState('broken')} />
    </>
  )
}

/** The item's own art next to its name, when the trade site or the currency list provides it. */
function ItemArt({ url }: { url?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setLoaded(false); setBroken(false) }, [url])
  const safe = safeIcon(url)
  if (!safe || broken) return null
  return (
    <span className={`shrink-0 h-[52px] w-[52px] rounded-lg bg-fill/60 items-center justify-center overflow-hidden ${loaded ? 'flex' : 'hidden'}`}>
      <img src={safe} alt="" className="max-h-[48px] max-w-[48px] object-contain" onLoad={() => setLoaded(true)} onError={() => setBroken(true)} draggable={false} />
    </span>
  )
}

function Status({ status }: { status: 'online' | 'afk' | 'offline' }) {
  const c = status === 'online' ? 'bg-success' : status === 'afk' ? 'bg-warning' : 'bg-danger'
  return <span role="img" aria-label={S.status[status]} title={S.status[status]} className={`inline-block h-[7px] w-[7px] rounded-full align-middle ${c}`} />
}

/* ------------------------------------------------------------------ results: bulk exchange */

function TradeBulk({ item, filters }: { item: ParsedItem; filters: ItemFilters }) {
  const have = item.info.refName === 'Chaos Orb' ? ['divine'] : item.info.refName === 'Divine Orb' ? ['chaos'] : ['chaos', 'divine']
  const [res, setRes] = useState<Array<BulkSearch | null> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState(have[0]!)
  useEffect(() => {
    let cancelled = false
    execBulkSearch(item, filters, have, { accountName: '' }).then(r => { if (!cancelled) setRes(r) }, e => { if (!cancelled) setError((e as Error).message) })
    return () => { cancelled = true }
  }, [])
  if (error) return <div className="px-6 pb-5"><StatusBanner tone="error">{error}</StatusBanner></div>
  if (!res) return <div className="flex justify-center py-5"><Spinner /></div>
  const current = res[have.indexOf(tab)]
  const url = current ? `https://${getTradeEndpoint()}/trade/exchange/${encodeURIComponent(filters.trade.league)}/${current.queryId}` : null
  return (
    <section aria-label={P.bulk} className="pb-4">
      <div className="flex items-center gap-4 px-6 pb-3">
        {have.length > 1 && <Segmented size="sm" label={P.payWith} value={tab} onChange={setTab} options={have.map(h => ({ value: h, label: <span className="inline-flex items-center gap-2"><CurrencyMark id={h} size={14} /> {res[have.indexOf(h)]?.total ?? 0}</span> }))} />}
        <span className="flex-1" />
        {url && <Button variant="plain" size="sm" onClick={() => window.crips.openExternal(url)}>{P.openTrade}<ArrowUpRight aria-hidden className="h-[12px] w-[12px]" /></Button>}
      </div>
      {!current || current.listed.length === 0
        ? <EmptyState icon={<SearchX className="h-[22px] w-[22px]" />}>{S.noResults}</EmptyState>
        : (
          <table className="w-full text-base">
            <thead><tr className="text-left text-xs text-text-muted"><th className="font-medium px-6 py-2">{P.rate}</th><th className="font-medium px-3 text-right">{P.stock}</th><th className="font-medium px-6 w-full">{P.listed}</th></tr></thead>
            <tbody>
              {current.listed.map(r => (
                <tr key={r.id} className="odd:bg-fill/30">
                  <td className="px-6 py-[5px] whitespace-nowrap tabular">
                    <span className="inline-flex items-center gap-2"><span className="font-semibold">{displayRounding(r.exchangeAmount / r.itemAmount, true)}</span> <CurrencyMark id={tab} /></span>
                    <span className="text-xs text-text-muted"> ({r.exchangeAmount}:{r.itemAmount})</span>
                  </td>
                  <td className="px-3 text-right tabular">{r.stock}</td>
                  <td className="px-6 whitespace-nowrap"><Status status={r.accountStatus} /> <span className="text-sm text-text-muted">{r.relativeDate}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  )
}

/* ------------------------------------------------------------------ act tracker extras */

function BuildInfo({ item }: { item: ParsedItem }) {
  const act = useAct()
  if (!act) return null
  const slot = act.store.slots[act.store.activeSlot]
  const isGem = item.category === ItemCategory.Gem
  const name = isGem ? item.info.refName.replace(/^Vaal /, '') : null
  const groups = name && slot?.pob ? groupsWithGem(slot.pob, name) : []
  const req = item.rawText.match(/Requirements:\r?\n(?:.*\r?\n)*?Level: (\d+)/)
  const level = req ? Number(req[1]) : isGem ? 1 : undefined
  const label = item.info.name
  const tracked = act.store.gear.some(g => g.name === label)
  if (!(name && slot?.pob) && level === undefined) return null
  return (
    <section className="mx-6 mb-5 space-y-3">
      {name && slot?.pob && (
        <div className="rounded-lg bg-fill/50 px-5 py-4">
          <p className="text-xs text-text-muted pb-2">{S.act.inBuild}</p>
          {groups.length === 0 && <p className="text-base text-text-muted">{S.act.notInBuild}</p>}
          {groups.map(({ set, group }, i) => (
            <div key={i} className="text-base py-1">
              <p className="text-xs text-text-muted">{[set, group.label, group.slot].filter(Boolean).join(' · ')}</p>
              <p>{group.gems.map((g, j) => (
                <span key={j} className={g.name.toLowerCase().replace(/ support$/, '') === name.toLowerCase().replace(/ support$/, '') ? 'text-rarity-gem font-semibold' : ''}>{j > 0 && ' – '}{g.name}</span>
              ))}</p>
            </div>
          ))}
        </div>
      )}
      {level !== undefined && (
        <Button size="sm" disabled={tracked} onClick={() => void window.crips.act.addGear({ name: label, level, kind: isGem ? 'gem' : 'item' })}>
          {tracked ? S.act.tracked : `${S.act.track} (${S.act.needLevel(level)})`}
        </Button>
      )}
    </section>
  )
}
