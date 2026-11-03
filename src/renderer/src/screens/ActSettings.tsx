import { useState } from 'react'
import { FileText, ImagePlus, Package, Pencil, Plus, Trash2, Upload, Copy } from 'lucide-react'
import { GEMS, CHARACTERS } from '@shared/act/data'
import { buildGems } from '@shared/act/pob'
import { resolveGem } from '@shared/act/gems'
import type { ActStore, Slot } from '@shared/act/state'
import { Button, Spinner, StatusBanner } from '../components/ui'
import { useAct, useGemPlan } from '../act/useAct'
import { S } from '../strings'

const A = S.act

function Row({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 min-h-[34px]">
      <label htmlFor={htmlFor} className="w-[220px] pt-[6px] text-sm text-text-muted">{label}</label>
      <div className="flex-1">
        <div className="flex items-center gap-4 flex-wrap">{children}</div>
        {help && <p className="text-xs text-text-muted mt-1">{help}</p>}
      </div>
    </div>
  )
}

const inputCls = 'h-[30px] bg-surface border border-border-input rounded-sm px-3 text-sm text-text'
const check = 'accent-[var(--c-accent)] h-[16px] w-[16px]'

export function ActSettings() {
  const act = useAct()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!act) return <Spinner />
  const { store, live } = act
  const update = (patch: Partial<ActStore>) => void window.assay.act.update(patch)

  return (
    <section className="space-y-6">
      <Row label={A.enabled} htmlFor="act-on">
        <input id="act-on" type="checkbox" className={check} checked={store.enabled} onChange={e => update({ enabled: e.target.checked })} />
      </Row>
      <Row label={A.log}>
        {live.logStatus === 'ok'
          ? <code className="text-xs font-mono break-all text-text-muted">{A.logFound}: {live.logPath}</code>
          : <StatusBanner tone="warning">{A.logMissing}</StatusBanner>}
        <Button size="sm" onClick={() => void window.assay.act.pickLog()}><FileText aria-hidden className="h-[12px] w-[12px]" />{A.pick}</Button>
      </Row>

      <div className="border-t border-border pt-5 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg flex-1">{A.slots}</h2>
          <Button size="sm" onClick={() => void window.assay.act.addSlot()}><Plus aria-hidden className="h-[12px] w-[12px]" />{A.addSlot}</Button>
        </div>
        <div role="radiogroup" aria-label={A.slots} className="flex gap-3 flex-wrap">
          {store.slots.map((s, i) => (
            <button key={s.id} role="radio" aria-checked={i === store.activeSlot} onClick={() => update({ activeSlot: i })}
              className={`h-[28px] px-5 rounded-full border text-sm ${i === store.activeSlot ? 'border-accent text-accent' : 'border-border text-text-muted hover:text-text'}`}>
              {s.name || `Guide ${i + 1}`}
            </button>
          ))}
        </div>
        <SlotEditor key={store.slots[store.activeSlot]?.id} index={store.activeSlot} slot={store.slots[store.activeSlot]!} canRemove={store.slots.length > 1} onMessage={setMsg} />
        {msg && <StatusBanner tone={msg.ok ? 'info' : 'error'}>{msg.text}</StatusBanner>}
      </div>

      <div className="border-t border-border pt-5 space-y-4">
        <Row label={A.timer} htmlFor="timer-on">
          <input id="timer-on" type="checkbox" className={check} checked={store.timerEnabled} onChange={e => update({ timerEnabled: e.target.checked })} />
        </Row>
        <Row label={A.hideoutPause} htmlFor="timer-ho">
          <input id="timer-ho" type="checkbox" className={check} checked={store.timerHideoutPause} onChange={e => update({ timerHideoutPause: e.target.checked })} />
        </Row>
        <Row label={A.textSize} htmlFor="font">
          <input id="font" type="range" min={0.7} max={1.6} step={0.05} value={store.overlay.fontScale} onChange={e => update({ overlay: { ...store.overlay, fontScale: Number(e.target.value) } })} />
          <span className="text-xs font-mono">{Math.round(store.overlay.fontScale * 100)}%</span>
        </Row>
        <Row label={A.opacity} htmlFor="opa">
          <input id="opa" type="range" min={0.4} max={1} step={0.02} value={store.overlay.opacity} onChange={e => update({ overlay: { ...store.overlay, opacity: Number(e.target.value) } })} />
          <span className="text-xs font-mono">{Math.round(store.overlay.opacity * 100)}%</span>
        </Row>
        <Row label={A.treeImages}>
          <span className="text-sm text-text-muted">{store.treeImages.length}</span>
          <Button size="sm" onClick={() => void window.assay.act.addTreeImages()}><ImagePlus aria-hidden className="h-[12px] w-[12px]" />{A.addImages}</Button>
        </Row>
        <Row label={A.gearTitle}>
          <span className="text-sm text-text-muted">{store.gear.length}</span>
          <Button size="sm" onClick={() => window.assay.act.open('gear')}><Package aria-hidden className="h-[12px] w-[12px]" />{A.gear}</Button>
        </Row>
      </div>
      <p className="text-xs text-text-muted">{A.thirdParty}</p>
    </section>
  )
}

function SlotEditor({ index, slot, canRemove, onMessage }: { index: number; slot: Slot; canRemove: boolean; onMessage: (m: { ok: boolean; text: string }) => void }) {
  const [name, setName] = useState(slot.name)
  const [info, setInfo] = useState(slot.info)
  const [char, setChar] = useState(slot.character)
  const [showPlan, setShowPlan] = useState(false)
  const upd = (patch: Partial<Slot>) => void window.assay.act.updateSlot(index, patch)
  const opt = (patch: Partial<Slot['options']>) => upd({ options: { ...slot.options, ...patch } })

  return (
    <div className="space-y-3 rounded-md border border-border p-6">
      <Row label={A.name} htmlFor="slot-name"><input id="slot-name" className={inputCls} value={name} onChange={e => setName(e.target.value)} onBlur={() => upd({ name })} /></Row>
      <Row label={A.info} htmlFor="slot-info"><input id="slot-info" className={`${inputCls} w-full`} value={info} onChange={e => setInfo(e.target.value)} onBlur={() => upd({ info })} /></Row>
      <Row label={A.character} htmlFor="slot-char" help={A.characterHelp}><input id="slot-char" className={inputCls} value={char} onChange={e => setChar(e.target.value)} onBlur={() => upd({ character: char.trim() })} /></Row>
      <Row label={A.leagueStart} htmlFor="ls" help={A.leagueStartHelp}><input id="ls" type="checkbox" className={check} checked={slot.options.leagueStart} onChange={e => opt({ leagueStart: e.target.checked })} /></Row>
      <Row label={A.optionals} htmlFor="opt"><input id="opt" type="checkbox" className={check} checked={slot.options.optionals} onChange={e => opt({ optionals: e.target.checked })} /></Row>
      <Row label={A.library} htmlFor="lib"><input id="lib" type="checkbox" className={check} checked={slot.options.library} onChange={e => opt({ library: e.target.checked })} /></Row>
      <Row label={A.bandit} htmlFor="bandit">
        <select id="bandit" className={inputCls} value={slot.options.bandit} onChange={e => opt({ bandit: e.target.value as Slot['options']['bandit'] })}>
          {Object.entries(A.bandits).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Row>
      <Row label={A.gemQuests} htmlFor="gq">
        <select id="gq" className={inputCls} value={slot.gemQuests} onChange={e => upd({ gemQuests: e.target.value as Slot['gemQuests'] })}>
          {Object.entries(A.gemQuestModes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {slot.pob && <Button size="sm" variant="ghost" aria-expanded={showPlan} onClick={() => setShowPlan(s => !s)}>{A.gemPlan}</Button>}
      </Row>
      <Row label={slot.pob ? A.build(slot.pob.className, slot.pob.ascendancy) : A.noBuild} help={A.importHelp}>
        <Button size="sm" onClick={async () => { const r = await window.assay.act.importInto(index); onMessage({ ok: r.ok, text: r.message }) }}><Upload aria-hidden className="h-[12px] w-[12px]" />{A.importLabel}</Button>
        <Button size="sm" onClick={() => window.assay.act.open('editor', index)}><Pencil aria-hidden className="h-[12px] w-[12px]" />{A.edit}</Button>
        <Button size="sm" variant="ghost" onClick={async () => { await window.assay.act.exportGuide(index); onMessage({ ok: true, text: A.exported }) }}><Copy aria-hidden className="h-[12px] w-[12px]" />{A.exportLabel}</Button>
        {canRemove && <Button size="sm" variant="danger" onClick={() => void window.assay.act.removeSlot(index)}><Trash2 aria-hidden className="h-[12px] w-[12px]" />{A.removeSlot}</Button>}
      </Row>
      {showPlan && slot.pob && <GemPlanner index={index} slot={slot} />}
    </div>
  )
}

/** Gem-pickup configurator: when to pick up each gem, or not at all. Library-first gems are underlined. */
function GemPlanner({ index, slot }: { index: number; slot: Slot }) {
  const plan = useGemPlan(slot)
  const ch = CHARACTERS[slot.pob!.className]
  const starting = new Set(ch ? [ch.start_gem_id, ch.chest_gem_id] : [])
  const gems = buildGems(slot.pob!).map(g => ({ g, id: resolveGem(g, GEMS) })).filter((x): x is { g: typeof x.g; id: string } => !!x.id)
  const setOverride = (id: string, o: { removed?: boolean; notBeforeAct?: number }) =>
    void window.assay.act.updateSlot(index, { gemOverrides: { ...slot.gemOverrides, [id]: { ...slot.gemOverrides[id], ...o } } })
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-text-muted"><th className="py-2">Gem</th><th>Not before act</th><th>Skip</th></tr></thead>
      <tbody>
        {gems.map(({ id }) => {
          const o = slot.gemOverrides[id] ?? {}
          const lib = plan?.libraryGems.includes(id)
          const missing = plan?.notAvailable.includes(id)
          return (
            <tr key={id} className="border-t border-border">
              <td className={`py-2 ${lib ? 'underline' : ''} ${o.removed ? 'line-through text-text-muted' : 'text-rarity-gem'}`} title={lib ? 'First available in the Act 3 library' : undefined}>
                {GEMS[id]!.n}{starting.has(id) && <span className="ml-3 text-xs text-text-muted no-underline">starting gem</span>}{missing && !o.removed && <span className="ml-3 text-xs text-warning">not offered in the campaign</span>}
              </td>
              <td>
                <select aria-label={`Not before act for ${GEMS[id]!.n}`} className={`${inputCls} h-[24px]`} value={o.notBeforeAct ?? 0} onChange={e => setOverride(id, { notBeforeAct: Number(e.target.value) || undefined })}>
                  <option value={0}>any</option>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </td>
              <td><input type="checkbox" aria-label={`Skip ${GEMS[id]!.n}`} className={check} checked={!!o.removed} onChange={e => setOverride(id, { removed: e.target.checked })} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
