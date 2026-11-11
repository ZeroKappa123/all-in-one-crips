import { useEffect, useState } from 'react'
import { ArrowLeftRight, Bug, Info, Keyboard, Map as MapIcon, MessageSquare, Plus, RectangleHorizontal, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { type Config, findConflict, HOTKEY_ACTIONS, KeyCombo } from '@shared/config'
import { useLeagues } from '@/web/background/Leagues'
import { onAptChange } from 'vue'
import { Button, Group, HotkeyRecorder, IconTile, NumberInput, Popup, Row, Segmented, Spinner, StatusBanner, Switch, TextField } from '../components/ui'
import { S } from '../strings'
import { ActSettings } from './ActSettings'

type Tab = 'general' | 'act' | 'trades' | 'window' | 'hotkeys' | 'chat' | 'debug' | 'about'

const NAV: { id: Tab; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'general', label: S.tabs.general, color: '#8e8e93', icon: <SlidersHorizontal className="h-[13px] w-[13px]" /> },
  { id: 'act', label: S.tabs.act, color: '#34c759', icon: <MapIcon className="h-[13px] w-[13px]" /> },
  { id: 'trades', label: S.tabs.trades, color: '#ff9500', icon: <ArrowLeftRight className="h-[13px] w-[13px]" /> },
  { id: 'window', label: S.tabs.window, color: '#30b0c7', icon: <RectangleHorizontal className="h-[13px] w-[13px]" /> },
  { id: 'hotkeys', label: S.tabs.hotkeys, color: '#0a84ff', icon: <Keyboard className="h-[13px] w-[13px]" /> },
  { id: 'chat', label: S.tabs.chat, color: '#ff9f0a', icon: <MessageSquare className="h-[13px] w-[13px]" /> },
  { id: 'debug', label: S.tabs.debug, color: '#ff375f', icon: <Bug className="h-[13px] w-[13px]" /> },
  { id: 'about', label: S.tabs.about, color: '#5e5ce6', icon: <Info className="h-[13px] w-[13px]" /> }
]

export function Settings() {
  const [state, setState] = useState<{ config: Config; repaired: boolean; inputMode: string; dataDir: string } | null>(null)
  const [tab, setTab] = useState<Tab>('general')
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    void window.crips.getConfig().then(setState)
    return window.crips.onConfig(c => setState(s => s && { ...s, config: c }))
  }, [])

  if (!state) return <div className="p-8"><Spinner /></div>
  const save = async (patch: Partial<Config>) => {
    const next = await window.crips.setConfig(patch)
    setState(s => s && { ...s, config: next })
    setSavedAt(Date.now())
  }
  const current = NAV.find(n => n.id === tab)!

  return (
    <div className="h-full flex bg-bg">
      <nav aria-label={S.settingsTitle} className="w-[208px] shrink-0 flex flex-col gap-1 px-4 py-6 bg-surface/60 border-r hairline">
        <div className="flex items-center gap-4 px-3 pb-5">
          <img src="./icon.png" alt="" className="h-[30px] w-[30px] rounded-[8px] shadow-card" />
          <div className="min-w-0">
            <p className="text-lg leading-[18px] truncate">{S.appName}</p>
            <p className="text-xs text-text-muted">{S.madeBy}</p>
          </div>
        </div>
        <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-1">
          {NAV.map(n => (
            <button key={n.id} role="tab" aria-selected={tab === n.id} onClick={() => setTab(n.id)}
              className={`flex items-center gap-4 h-[28px] px-3 rounded-md text-base text-left ${tab === n.id ? 'bg-accent text-on-accent' : 'text-text hover:bg-fill/70'}`}>
              <IconTile color={n.color}>{n.icon}</IconTile>{n.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center h-[52px] px-8 material-bar">
          <h1 className="text-lg flex-1">{current.label}</h1>
          <span role="status" className="text-sm text-text-muted">{Date.now() - savedAt < 2500 ? S.saved : ''}</span>
        </header>
        <div className="flex-1 overflow-y-auto px-8 py-7 space-y-7" role="tabpanel" aria-label={current.label}>
          {state.repaired && <StatusBanner tone="warning">{S.configRepaired}</StatusBanner>}
          {state.inputMode === 'fallback' && tab !== 'about' && <StatusBanner tone="warning">{S.fallbackInput}</StatusBanner>}
          {tab === 'general' && <General config={state.config} save={save} />}
          {tab === 'act' && <ActSettings />}
          {tab === 'trades' && <TradeSettings config={state.config} save={save} />}
          {tab === 'window' && <Widescreen config={state.config} />}
          {tab === 'hotkeys' && <Hotkeys config={state.config} save={save} />}
          {tab === 'chat' && <Chat config={state.config} save={save} />}
          {tab === 'debug' && <Debug dataDir={state.dataDir} />}
          {tab === 'about' && <About />}
        </div>
      </div>
    </div>
  )
}

function useLeagueList() {
  const leagues = useLeagues()
  const [, tick] = useState(0)
  useEffect(() => onAptChange(() => tick(n => n + 1)), [])
  useEffect(() => { if (!leagues.list.value.length && !leagues.isLoading.value) void leagues.load() }, [])
  return leagues
}

function General({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const leagues = useLeagueList()
  const [title, setTitle] = useState(config.windowTitle)
  const list = leagues.list.value
  return (
    <>
      <Group title={S.appearance.title} footer={S.appearance.help}>
        <Row label={S.appearance.label}>
          <Segmented label={S.appearance.label} value={config.theme} onChange={v => void save({ theme: v })}
            options={[{ value: 'dark', label: S.appearance.dark }, { value: 'light', label: S.appearance.light }, { value: 'system', label: S.appearance.system }]} />
        </Row>
      </Group>
      <Group title={S.pcSettings.trade} footer={S.pcSettings.leagueHelp}>
        <Row label={S.league} htmlFor="league">
          {leagues.isLoading.value && <Spinner size={12} />}
          {leagues.error.value && <Button size="sm" onClick={() => void leagues.load()}><RefreshCw aria-hidden className="h-[12px] w-[12px]" />{S.retry}</Button>}
          <Popup id="league" label={S.league} value={config.leagueId} onChange={v => void save({ leagueId: v })}>
            {!list.some(l => l.id === config.leagueId) && <option value={config.leagueId}>{config.leagueId}</option>}
            {list.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
          </Popup>
        </Row>
        <Row label={S.pcSettings.autoSearch} detail={S.pcSettings.autoSearchHelp} htmlFor="auto">
          <Switch id="auto" label={S.pcSettings.autoSearch} checked={config.autoSearch} onChange={v => void save({ autoSearch: v })} />
        </Row>
        <Row label={S.tolerance} detail={S.pcSettings.toleranceHelp}>
          <NumberInput label={S.tolerance} value={config.searchTolerancePct} onChange={v => { if (v !== null && v >= 0 && v <= 50) void save({ searchTolerancePct: v }) }} />
          <span className="text-text-muted">%</span>
        </Row>
      </Group>
      <Group title={S.pcSettings.game}>
        <Row label={S.windowTitle} htmlFor="wt">
          <TextField id="wt" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (title.trim()) void save({ windowTitle: title.trim() }) }} className="w-[200px]" />
        </Row>
      </Group>
      <GameData config={config} save={save} />
      {leagues.error.value && <StatusBanner tone="error">{S.leagueFailed}</StatusBanner>}
    </>
  )
}

type DataStatus = Awaited<ReturnType<typeof window.crips.data.status>>
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function GameData({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const G = S.gameData
  const [status, setStatus] = useState<DataStatus | null>(null)
  const [result, setResult] = useState<'updated' | 'current' | 'failed' | null>(null)
  useEffect(() => { void window.crips.data.status().then(setStatus); return window.crips.data.onChanged(setStatus) }, [])
  if (!status) return null
  const version = status.active ? G.downloaded(fmtDate(status.active.date)) : status.bundled ? G.shipped(fmtDate(status.bundled.date)) : '—'
  return (
    <Group title={G.title} footer={G.help}>
      <Row label={G.version} detail={<span data-testid="data-version">{version}</span>}>
        <Button size="sm" loading={status.checking} disabled={status.checking}
          onClick={async () => { setResult(null); setResult(await window.crips.data.check()) }}>
          <RefreshCw aria-hidden className="h-[12px] w-[12px]" />{status.checking ? G.checking : G.check}
        </Button>
      </Row>
      <Row label={G.lastCheck} detail={status.lastCheck ? fmtDate(status.lastCheck) : G.never} />
      <Row label={G.auto} detail={G.autoHelp} htmlFor="data-auto">
        <Switch id="data-auto" label={G.auto} checked={config.dataUpdates.auto} onChange={v => void save({ dataUpdates: { auto: v } })} />
      </Row>
      {result && (
        <div role="status" className={`px-5 py-3 text-sm ${result === 'failed' ? 'text-danger' : 'text-text-muted'}`}>
          {result === 'updated' ? G.updated : result === 'current' ? G.current : G.failed(status.lastError ?? '?')}
        </div>
      )}
    </Group>
  )
}

function Hotkeys({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [conflicts, setConflicts] = useState<Record<string, string | null>>({})
  const groups: { title: string; actions: (typeof HOTKEY_ACTIONS)[number][] }[] = [
    { title: S.pcSettings.priceGroup, actions: ['priceCheck', 'priceCheckLocked', 'wiki', 'overlay', 'stashScroll'] },
    { title: S.tabs.act, actions: ['guideToggle', 'guidePrev', 'guideNext', 'treeOverlay', 'gemSearch'] },
    { title: S.wide.title, actions: ['wideToggle', 'wideUp', 'wideDown', 'wideUpFine', 'wideDownFine'] }
  ]
  return (
    <>
      {groups.map(g => (
        <Group key={g.title} title={g.title}>
          {g.actions.map(action => {
            const hk = config.hotkeys.find(h => h.action === action)
            if (!hk) return null
            return (
              <Row key={action} label={S.actions[action]} detail={conflicts[action] ? <span role="alert" className="text-danger">{S.conflict(conflicts[action]!)}</span> : undefined}>
                <HotkeyRecorder label={S.actions[action]} value={hk.keys} conflict={conflicts[action]} allowWheel={action === 'stashScroll'}
                  onChange={keys => {
                    if (!keys || !KeyCombo.safeParse(keys).success) return
                    const c = findConflict(config, keys, { action })
                    setConflicts(x => ({ ...x, [action]: c }))
                    if (!c) void save({ hotkeys: config.hotkeys.map(h => (h.action === action ? { ...h, keys } : h)) })
                  }} />
                <Switch size="sm" label={`Enable ${S.actions[action]}`} checked={hk.enabled}
                  onChange={v => void save({ hotkeys: config.hotkeys.map(h => (h.action === action ? { ...h, enabled: v } : h)) })} />
              </Row>
            )
          })}
        </Group>
      ))}
    </>
  )
}

function Chat({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [rows, setRows] = useState(config.chatCommands)
  const [conflict, setConflict] = useState<string | null>(null)
  useEffect(() => setRows(config.chatCommands), [config.chatCommands])
  const commit = (next: typeof rows) => void save({ chatCommands: next.filter(r => r.text.trim() && KeyCombo.safeParse(r.keys).success) })
  return (
    <Group title={S.tabs.chat} footer={<>{S.chatHelp}{conflict && <span role="alert" className="block text-danger">{S.conflict(conflict)}</span>}</>}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-4 px-5 min-h-[40px]">
          <TextField aria-label={`Chat command ${i + 1}`} value={r.text} maxLength={200} className="flex-1 font-mono"
            onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} onBlur={() => commit(rows)} />
          <HotkeyRecorder label={`Key for chat command ${i + 1}`} value={r.keys} onChange={keys => {
            const c = findConflict({ ...config, chatCommands: rows }, keys, { chatIndex: i })
            setConflict(c)
            if (c) return
            const next = rows.map((x, j) => (j === i ? { ...x, keys } : x))
            setRows(next); commit(next)
          }} />
          <Button variant="ghost" size="sm" aria-label={`${S.remove} ${r.text}`} onClick={() => { const next = rows.filter((_, j) => j !== i); setRows(next); commit(next) }}>
            <Trash2 aria-hidden className="h-[14px] w-[14px]" />
          </Button>
        </div>
      ))}
      <div className="px-5 py-3"><Button variant="plain" size="sm" onClick={() => setRows([...rows, { text: '', keys: '' }])}><Plus aria-hidden className="h-[12px] w-[12px]" />{S.addCommand}</Button></div>
    </Group>
  )
}

function Debug({ dataDir }: { dataDir: string }) {
  const [logs, setLogs] = useState<{ at: string; level: string; msg: string }[] | null>(null)
  useEffect(() => { void window.crips.logs().then(setLogs) }, [])
  return (
    <>
      <Group title={S.dataFolder}><Row label={<code className="text-sm font-mono break-all">{dataDir}</code>} /></Group>
      <Group title="Log">
        <div className="flex justify-end px-5 py-2"><Button variant="plain" size="sm" onClick={() => void window.crips.logs().then(setLogs)}><RefreshCw aria-hidden className="h-[12px] w-[12px]" />{S.retry}</Button></div>
        {logs && logs.length === 0 && <p className="px-5 py-4 text-base text-text-muted">{S.logsEmpty}</p>}
        <ol className="px-5 py-3 font-mono text-sm space-y-1">
          {logs?.slice().reverse().map((l, i) => (
            <li key={i} className={l.level === 'error' ? 'text-danger' : l.level === 'warn' ? 'text-warning' : 'text-text-muted'}>
              {l.at.slice(11, 19)} {l.level.toUpperCase()} {l.msg}
            </li>
          ))}
        </ol>
      </Group>
    </>
  )
}

function About() {
  return (
    <>
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <img src="./icon.png" alt="" className="h-[84px] w-[84px] rounded-[20px] shadow-pop" />
        <h2 className="text-title">{S.appName}</h2>
        <p className="text-base text-text-muted">{S.madeBy} · Version 1.0.0</p>
      </div>
      <Group title={S.about.credits} footer={S.thirdParty}>
        <Row label="Awakened PoE Trade" detail={S.about.apt} />
        <Row label="exile-leveling" detail={S.about.leveling} />
        <Row label="Path of Exile skill tree data" detail={S.about.tree} />
        <Row label="Inter" detail={S.about.inter} />
        <Row label="Alegreya SC" detail={S.about.alegreya} />
        <Row label="Exile-UI (idea)" detail={S.about.exileUi} />
        <Row label="PoE Widescreen (idea)" detail={S.wide.credit} />
        <Row label="Poe-Lurker (idea)" detail={S.trades.settings.credit} />
        <Row label="Path of Exile icons" detail={S.iconsNote} />
      </Group>
      <div className="flex justify-center"><Button variant="danger" onClick={() => window.crips.quit()}>{S.quit}</Button></div>
    </>
  )
}

function Widescreen({ config }: { config: Config }) {
  const [st, setSt] = useState<{ supported: boolean; found: boolean; wide: boolean; enabled: boolean } | null>(null)
  const ws = config.widescreen
  useEffect(() => {
    const load = () => void window.crips.widescreen.status().then(setSt)
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [config.widescreen])
  const upd = async (patch: Partial<Config['widescreen']>) => setSt(await window.crips.widescreen.update(patch))
  return (
    <>
      {st && !st.supported && <StatusBanner tone="warning">{S.wide.unsupported}</StatusBanner>}
      {st?.supported && <StatusBanner tone="info">{st.found ? S.wide.running : S.wide.notRunning}</StatusBanner>}
      <Group footer={S.wide.admin}>
        <Row label={S.wide.enable} detail={S.wide.enableHelp} htmlFor="ws-on">
          <Switch id="ws-on" label={S.wide.enable} checked={ws.enabled} onChange={v => void upd({ enabled: v })} />
        </Row>
        <Row label={S.wide.wide} detail={S.wide.wideHelp} htmlFor="ws-wide">
          <Switch id="ws-wide" label={S.wide.wide} checked={ws.enabled && ws.wide} onChange={async v => setSt(await window.crips.widescreen.setWide(v))} />
        </Row>
      </Group>
      <Group footer={S.wide.keysHelp}>
        <Row label={S.wide.zoom} detail={S.wide.zoomHelp} htmlFor="ws-zoom">
          <input id="ws-zoom" type="range" min={1.05} max={2} step={0.01} value={ws.zoom} onChange={e => void upd({ zoom: Number(e.target.value) })} className="w-[160px] accent-[var(--c-accent)]" />
          <span className="text-sm tabular text-text-muted w-[40px] text-right">{ws.zoom.toFixed(2)}</span>
        </Row>
        <Row label={S.wide.top} detail={S.wide.topHelp} htmlFor="ws-top">
          <Switch id="ws-top" label={S.wide.top} checked={ws.anchorTop} onChange={v => void upd({ anchorTop: v })} />
        </Row>
      </Group>
      <p className="px-5 text-sm text-text-muted">{S.wide.credit}</p>
    </>
  )
}

function TradeSettings({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const t = config.trades
  const T = S.trades.settings
  const [msgs, setMsgs] = useState(t.messages)
  useEffect(() => setMsgs(t.messages), [t.messages])
  const upd = (patch: Partial<Config['trades']>) => void save({ trades: { ...t, ...patch } })
  return (
    <>
      <Group footer={T.clicks}>
        <Row label={T.enable} detail={T.enableHelp} htmlFor="tr-on"><Switch id="tr-on" label={T.enable} checked={t.enabled} onChange={v => upd({ enabled: v })} /></Row>
        <Row label={T.sound} htmlFor="tr-snd"><Switch id="tr-snd" label={T.sound} checked={t.sound} onChange={v => upd({ sound: v })} /></Row>
        <Row label={T.autoWhisper} detail={T.autoWhisperHelp} htmlFor="tr-aw"><Switch id="tr-aw" label={T.autoWhisper} checked={t.autoWhisper} onChange={v => upd({ autoWhisper: v })} /></Row>
        <Row label={T.show} onClick={() => window.crips.trades.show()} />
      </Group>
      <Group title={T.messages} footer={<>{T.tokens} {T.oneAction}</>}>
        {(['busy', 'sold', 'stillInterested', 'thanks'] as const).map(k => (
          <Row key={k} label={T[k]} htmlFor={`msg-${k}`}>
            <TextField id={`msg-${k}`} value={msgs[k]} maxLength={200} className="w-[320px]"
              onChange={e => setMsgs({ ...msgs, [k]: e.target.value })} onBlur={() => { if (msgs[k].trim()) upd({ messages: msgs }) }} />
          </Row>
        ))}
      </Group>
      <Group title={T.stash}>
        <Row label={T.calibrate} detail={t.stash ? T.calibrated : T.notCalibrated}>
          <Button size="sm" onClick={() => window.crips.trades.calibrate(true)}>{T.calibrate}</Button>
        </Row>
        <Row label={T.quad}>
          <Segmented label={T.quad} value={t.quad} onChange={v => upd({ quad: v })}
            options={[{ value: 'auto', label: T.quadAuto }, { value: 'normal', label: T.quadNormal }, { value: 'quad', label: T.quadQuad }]} />
        </Row>
      </Group>
    </>
  )
}
