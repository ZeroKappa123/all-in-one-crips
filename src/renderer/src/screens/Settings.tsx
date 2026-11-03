import { useEffect, useState } from 'react'
import { Bug, Info, Keyboard, Map as MapIcon, MessageSquare, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { type Config, findConflict, HOTKEY_ACTIONS, KeyCombo } from '@shared/config'
import { useLeagues } from '@/web/background/Leagues'
import { onAptChange } from 'vue'
import { Button, Group, HotkeyRecorder, IconTile, NumberInput, Popup, Row, Spinner, StatusBanner, Switch, TextField } from '../components/ui'
import { S } from '../strings'
import { ActSettings } from './ActSettings'

type Tab = 'general' | 'act' | 'hotkeys' | 'chat' | 'debug' | 'about'

const NAV: { id: Tab; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'general', label: S.tabs.general, color: '#8e8e93', icon: <SlidersHorizontal className="h-[13px] w-[13px]" /> },
  { id: 'act', label: S.tabs.act, color: '#34c759', icon: <MapIcon className="h-[13px] w-[13px]" /> },
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
      {leagues.error.value && <StatusBanner tone="error">{S.leagueFailed}</StatusBanner>}
    </>
  )
}

function Hotkeys({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [conflicts, setConflicts] = useState<Record<string, string | null>>({})
  const groups: { title: string; actions: (typeof HOTKEY_ACTIONS)[number][] }[] = [
    { title: S.pcSettings.priceGroup, actions: ['priceCheck', 'priceCheckLocked', 'wiki', 'overlay', 'stashScroll'] },
    { title: S.tabs.act, actions: ['guideToggle', 'guidePrev', 'guideNext', 'treeOverlay', 'gemSearch'] }
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
      </Group>
      <div className="flex justify-center"><Button variant="danger" onClick={() => window.crips.quit()}>{S.quit}</Button></div>
    </>
  )
}
