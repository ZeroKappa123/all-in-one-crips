import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { type Config, findConflict, HOTKEY_ACTIONS, KeyCombo } from '@shared/config'
import type { League } from '@shared/types'
import { Button, HotkeyRecorder, NumberInput, Spinner, StatusBanner, Tabs } from '../components/ui'
import { S } from '../strings'

type Tab = keyof typeof S.tabs

export function Settings() {
  const [state, setState] = useState<{ config: Config; repaired: boolean; inputMode: string; dataDir: string } | null>(null)
  const [tab, setTab] = useState<Tab>('general')
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    void window.assay.getConfig().then(setState)
    return window.assay.onConfig(c => setState(s => s && { ...s, config: c }))
  }, [])

  if (!state) return <div className="p-8"><Spinner /></div>
  const save = async (patch: Partial<Config>) => {
    const next = await window.assay.setConfig(patch)
    setState(s => s && { ...s, config: next })
    setSavedAt(Date.now())
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <header className="flex items-center px-7 pt-6 pb-4">
        <h1 className="text-xl flex-1">{S.settingsTitle}</h1>
        <span role="status" className="text-xs text-success">{Date.now() - savedAt < 2500 ? S.saved : ''}</span>
      </header>
      <Tabs tabs={S.tabs} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-7 space-y-6" role="tabpanel">
        {state.repaired && <StatusBanner tone="warning">{S.configRepaired}</StatusBanner>}
        {state.inputMode === 'fallback' && <StatusBanner tone="warning">{S.fallbackInput}</StatusBanner>}
        {tab === 'general' && <General config={state.config} save={save} />}
        {tab === 'hotkeys' && <Hotkeys config={state.config} save={save} />}
        {tab === 'chat' && <Chat config={state.config} save={save} />}
        {tab === 'debug' && <Debug dataDir={state.dataDir} />}
      </div>
      <footer className="flex items-center gap-4 px-7 py-4 border-t border-border text-xs text-text-muted">
        <span className="flex-1">{S.thirdParty}</span>
        <Button variant="danger" size="sm" onClick={() => window.assay.quit()}>{S.quit}</Button>
      </footer>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 min-h-[36px]">
      <label htmlFor={htmlFor} className="w-[260px] text-sm text-text-muted">{label}</label>
      <div className="flex-1 flex items-center gap-4">{children}</div>
    </div>
  )
}

function General({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [leagues, setLeagues] = useState<League[] | 'loading' | 'error'>('loading')
  const load = () => {
    setLeagues('loading')
    void window.assay.leagues().then(r => setLeagues(r.ok ? r.data : 'error'))
  }
  useEffect(load, [])
  const [title, setTitle] = useState(config.windowTitle)

  return (
    <section className="space-y-4">
      <Field label={S.league} htmlFor="league">
        {leagues === 'loading' && <Spinner />}
        {leagues === 'error' && (
          <StatusBanner tone="error" action={<Button size="sm" onClick={load}><RefreshCw aria-hidden className="h-[12px] w-[12px]" />{S.retry}</Button>}>{S.leagueFailed}</StatusBanner>
        )}
        {Array.isArray(leagues) && (
          <select id="league" value={config.leagueId} onChange={e => void save({ leagueId: e.target.value })}
            className="h-[30px] min-w-[240px] bg-surface border border-border-input rounded-sm px-3 text-sm text-text">
            {!leagues.some(l => l.id === config.leagueId) && <option value={config.leagueId}>{config.leagueId}</option>}
            {leagues.map(l => <option key={l.id} value={l.id}>{l.text}</option>)}
          </select>
        )}
      </Field>
      <Field label={`${S.tolerance} (%)`}>
        <NumberInput label={S.tolerance} value={config.searchTolerancePct} onChange={v => { if (v !== null && v >= 0 && v <= 50) void save({ searchTolerancePct: v }) }} />
      </Field>
      <Field label={S.onlineOnly} htmlFor="online">
        <input id="online" type="checkbox" checked={config.onlineOnly} onChange={e => void save({ onlineOnly: e.target.checked })} className="accent-[var(--c-accent)] h-[16px] w-[16px]" />
      </Field>
      <Field label={S.windowTitle} htmlFor="wt">
        <input id="wt" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (title.trim()) void save({ windowTitle: title.trim() }) }}
          className="h-[30px] min-w-[240px] bg-surface border border-border-input rounded-sm px-3 text-sm" />
      </Field>
    </section>
  )
}

function Hotkeys({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [conflicts, setConflicts] = useState<Record<string, string | null>>({})
  return (
    <section className="space-y-3">
      {HOTKEY_ACTIONS.map(action => {
        const hk = config.hotkeys.find(h => h.action === action)
        if (!hk) return null
        const id = `hk-${action}`
        return (
          <div key={action}>
            <Field label={S.actions[action]} htmlFor={id}>
              <input id={id} type="checkbox" aria-label={`Enable ${S.actions[action]}`} checked={hk.enabled}
                onChange={e => void save({ hotkeys: config.hotkeys.map(h => (h.action === action ? { ...h, enabled: e.target.checked } : h)) })}
                className="accent-[var(--c-accent)] h-[16px] w-[16px]" />
              <HotkeyRecorder label={S.actions[action]} value={hk.keys} conflict={conflicts[action]} allowWheel={action === 'stashScroll'}
                onChange={keys => {
                  if (!keys || !KeyCombo.safeParse(keys).success) return
                  const c = findConflict(config, keys, { action })
                  setConflicts(x => ({ ...x, [action]: c }))
                  if (!c) void save({ hotkeys: config.hotkeys.map(h => (h.action === action ? { ...h, keys } : h)) })
                }} />
            </Field>
            {conflicts[action] && <p role="alert" className="pl-[284px] text-xs text-danger">{S.conflict(conflicts[action]!)}</p>}
          </div>
        )
      })}
    </section>
  )
}

function Chat({ config, save }: { config: Config; save: (p: Partial<Config>) => Promise<void> }) {
  const [rows, setRows] = useState(config.chatCommands)
  const [conflict, setConflict] = useState<string | null>(null)
  useEffect(() => setRows(config.chatCommands), [config.chatCommands])
  const commit = (next: typeof rows) => {
    const valid = next.filter(r => r.text.trim() && KeyCombo.safeParse(r.keys).success)
    void save({ chatCommands: valid })
  }
  return (
    <section className="space-y-4">
      <p className="text-sm text-text-muted">{S.chatHelp}</p>
      {conflict && <p role="alert" className="text-xs text-danger">{S.conflict(conflict)}</p>}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-4">
            <input aria-label={`Chat command ${i + 1}`} value={r.text} maxLength={200}
              onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              onBlur={() => commit(rows)}
              className="flex-1 h-[30px] bg-surface border border-border-input rounded-sm px-3 font-mono text-sm" />
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
          </li>
        ))}
      </ul>
      <Button size="sm" onClick={() => setRows([...rows, { text: '', keys: '' }])}><Plus aria-hidden className="h-[12px] w-[12px]" />{S.addCommand}</Button>
    </section>
  )
}

function Debug({ dataDir }: { dataDir: string }) {
  const [logs, setLogs] = useState<{ at: string; level: string; msg: string }[] | null>(null)
  useEffect(() => { void window.assay.logs().then(setLogs) }, [])
  return (
    <section className="space-y-4">
      <Field label={S.dataFolder}><code className="text-xs font-mono break-all">{dataDir}</code></Field>
      <Button size="sm" onClick={() => void window.assay.logs().then(setLogs)}><RefreshCw aria-hidden className="h-[12px] w-[12px]" />{S.retry}</Button>
      {logs && logs.length === 0 && <p className="text-sm text-text-muted">{S.logsEmpty}</p>}
      <ol className="font-mono text-xs space-y-1">
        {logs?.slice().reverse().map((l, i) => (
          <li key={i} className={l.level === 'error' ? 'text-danger' : l.level === 'warn' ? 'text-warning' : 'text-text-muted'}>
            {l.at.slice(11, 19)} {l.level.toUpperCase()} {l.msg}
          </li>
        ))}
      </ol>
    </section>
  )
}
