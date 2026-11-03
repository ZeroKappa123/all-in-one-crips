import { useState } from 'react'
import { Copy, FileText, ImagePlus, Package, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { GEMS, CHARACTERS } from '@shared/act/data'
import { buildGems } from '@shared/act/pob'
import { resolveGem } from '@shared/act/gems'
import type { ActStore, Slot } from '@shared/act/state'
import { Badge, Button, Group, Popup, Row, Segmented, Spinner, StatusBanner, Switch, TextField } from '../components/ui'
import { useAct, useGemPlan } from '../act/useAct'
import { S } from '../strings'

const A = S.act

export function ActSettings() {
  const act = useAct()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!act) return <Spinner />
  const { store, live } = act
  const update = (patch: Partial<ActStore>) => void window.crips.act.update(patch)

  return (
    <>
      <Group>
        <Row label={A.enabled} htmlFor="act-on">
          <Switch id="act-on" label={A.enabled} checked={store.enabled} onChange={v => update({ enabled: v })} />
        </Row>
        <Row label={A.log} detail={live.logStatus === 'ok' ? <span className="font-mono break-all">{live.logPath}</span> : <span className="text-warning">{A.logMissing}</span>}>
          <Button size="sm" onClick={() => void window.crips.act.pickLog()}><FileText aria-hidden className="h-[12px] w-[12px]" />{A.pick}</Button>
        </Row>
      </Group>

      <div className="space-y-3">
        <div className="flex items-center gap-4 px-5">
          <h3 className="flex-1 text-sm font-semibold text-text-muted">{A.slots}</h3>
          <Button variant="plain" size="sm" onClick={() => void window.crips.act.addSlot()}><Plus aria-hidden className="h-[12px] w-[12px]" />{A.addSlot}</Button>
        </div>
        {store.slots.length > 1 && (
          <div className="px-5">
            <Segmented label={A.slots} value={store.slots[store.activeSlot]!.id} onChange={id => update({ activeSlot: store.slots.findIndex(s => s.id === id) })}
              options={store.slots.map((s, i) => ({ value: s.id, label: s.name || `Guide ${i + 1}` }))} />
          </div>
        )}
        <SlotEditor key={store.slots[store.activeSlot]?.id} index={store.activeSlot} slot={store.slots[store.activeSlot]!} canRemove={store.slots.length > 1} onMessage={setMsg} />
        {msg && <StatusBanner tone={msg.ok ? 'info' : 'error'}>{msg.text}</StatusBanner>}
      </div>

      <Group title={A.overlayGroup}>
        <Row label={A.timer} htmlFor="timer-on"><Switch id="timer-on" label={A.timer} checked={store.timerEnabled} onChange={v => update({ timerEnabled: v })} /></Row>
        <Row label={A.hideoutPause} htmlFor="timer-ho"><Switch id="timer-ho" label={A.hideoutPause} checked={store.timerHideoutPause} onChange={v => update({ timerHideoutPause: v })} /></Row>
        <Row label={A.textSize} htmlFor="font">
          <input id="font" type="range" min={0.7} max={1.6} step={0.05} value={store.overlay.fontScale} onChange={e => update({ overlay: { ...store.overlay, fontScale: Number(e.target.value) } })} className="w-[140px] accent-[var(--c-accent)]" />
          <span className="text-sm tabular text-text-muted w-[36px] text-right">{Math.round(store.overlay.fontScale * 100)}%</span>
        </Row>
        <Row label={A.opacity} htmlFor="opa">
          <input id="opa" type="range" min={0.4} max={1} step={0.02} value={store.overlay.opacity} onChange={e => update({ overlay: { ...store.overlay, opacity: Number(e.target.value) } })} className="w-[140px] accent-[var(--c-accent)]" />
          <span className="text-sm tabular text-text-muted w-[36px] text-right">{Math.round(store.overlay.opacity * 100)}%</span>
        </Row>
      </Group>

      <Group title={A.tools} footer={A.thirdParty}>
        <Row label={A.treeImages} detail={`${store.treeImages.length}`}>
          <Button size="sm" onClick={() => void window.crips.act.addTreeImages()}><ImagePlus aria-hidden className="h-[12px] w-[12px]" />{A.addImages}</Button>
        </Row>
        <Row label={A.gearTitle} detail={`${store.gear.length}`}>
          <Button size="sm" onClick={() => window.crips.act.open('gear')}><Package aria-hidden className="h-[12px] w-[12px]" />{A.gear}</Button>
        </Row>
      </Group>
    </>
  )
}

function SlotEditor({ index, slot, canRemove, onMessage }: { index: number; slot: Slot; canRemove: boolean; onMessage: (m: { ok: boolean; text: string }) => void }) {
  const [name, setName] = useState(slot.name)
  const [info, setInfo] = useState(slot.info)
  const [char, setChar] = useState(slot.character)
  const [showPlan, setShowPlan] = useState(false)
  const upd = (patch: Partial<Slot>) => void window.crips.act.updateSlot(index, patch)
  const opt = (patch: Partial<Slot['options']>) => upd({ options: { ...slot.options, ...patch } })

  return (
    <>
      <Group>
        <Row label={A.name} htmlFor="slot-name"><TextField id="slot-name" value={name} onChange={e => setName(e.target.value)} onBlur={() => upd({ name })} className="w-[220px]" /></Row>
        <Row label={A.info} htmlFor="slot-info"><TextField id="slot-info" value={info} onChange={e => setInfo(e.target.value)} onBlur={() => upd({ info })} className="w-[220px]" /></Row>
        <Row label={A.character} detail={A.characterHelp} htmlFor="slot-char"><TextField id="slot-char" value={char} onChange={e => setChar(e.target.value)} onBlur={() => upd({ character: char.trim() })} className="w-[220px]" /></Row>
      </Group>
      <Group title={A.route}>
        <Row label={A.leagueStart} detail={A.leagueStartHelp} htmlFor="ls"><Switch id="ls" label={A.leagueStart} checked={slot.options.leagueStart} onChange={v => opt({ leagueStart: v })} /></Row>
        <Row label={A.optionals} htmlFor="opt"><Switch id="opt" label={A.optionals} checked={slot.options.optionals} onChange={v => opt({ optionals: v })} /></Row>
        <Row label={A.library} htmlFor="lib"><Switch id="lib" label={A.library} checked={slot.options.library} onChange={v => opt({ library: v })} /></Row>
        <Row label={A.bandit} htmlFor="bandit">
          <Popup id="bandit" label={A.bandit} value={slot.options.bandit} onChange={v => opt({ bandit: v as Slot['options']['bandit'] })}>
            {Object.entries(A.bandits).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Popup>
        </Row>
        <Row label={A.gemQuests} htmlFor="gq">
          <Popup id="gq" label={A.gemQuests} value={slot.gemQuests} onChange={v => upd({ gemQuests: v as Slot['gemQuests'] })}>
            {Object.entries(A.gemQuestModes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Popup>
        </Row>
      </Group>
      <Group title={A.buildGroup} footer={A.importHelp}>
        <Row label={slot.pob ? A.build(slot.pob.className, slot.pob.ascendancy) : A.noBuild}>
          <Button size="sm" onClick={async () => { const r = await window.crips.act.importInto(index); onMessage({ ok: r.ok, text: r.message }) }}><Upload aria-hidden className="h-[12px] w-[12px]" />{A.importLabel}</Button>
        </Row>
        {slot.pob && <Row label={A.gemPlan} onClick={() => setShowPlan(s => !s)} />}
        {showPlan && slot.pob && <GemPlanner index={index} slot={slot} />}
        <Row label={A.edit} onClick={() => window.crips.act.open('editor', index)} icon={<Pencil aria-hidden className="h-[14px] w-[14px] text-text-muted" />} />
        <Row label={A.exportLabel} onClick={async () => { await window.crips.act.exportGuide(index); onMessage({ ok: true, text: A.exported }) }} icon={<Copy aria-hidden className="h-[14px] w-[14px] text-text-muted" />} />
        {canRemove && <div className="px-5 py-3"><Button variant="danger" size="sm" onClick={() => void window.crips.act.removeSlot(index)}><Trash2 aria-hidden className="h-[12px] w-[12px]" />{A.removeSlot}</Button></div>}
      </Group>
    </>
  )
}

/** Gem-pickup configurator: when to pick up each gem, or not at all. Library-first gems are underlined. */
function GemPlanner({ index, slot }: { index: number; slot: Slot }) {
  const plan = useGemPlan(slot)
  const ch = CHARACTERS[slot.pob!.className]
  const starting = new Set(ch ? [ch.start_gem_id, ch.chest_gem_id] : [])
  const gems = buildGems(slot.pob!).map(g => resolveGem(g, GEMS)).filter((x): x is string => !!x)
  const setOverride = (id: string, o: { removed?: boolean; notBeforeAct?: number }) =>
    void window.crips.act.updateSlot(index, { gemOverrides: { ...slot.gemOverrides, [id]: { ...slot.gemOverrides[id], ...o } } })
  return (
    <table className="w-full text-base">
      <thead><tr className="text-left text-xs text-text-muted"><th className="font-medium px-5 py-2">Gem</th><th className="font-medium">{A.notBefore}</th><th className="font-medium pr-5 text-right">{A.skip}</th></tr></thead>
      <tbody>
        {gems.map(id => {
          const o = slot.gemOverrides[id] ?? {}
          const lib = plan?.libraryGems.includes(id)
          const missing = plan?.notAvailable.includes(id)
          return (
            <tr key={id} className="border-t hairline">
              <td className={`px-5 py-2 ${lib ? 'underline' : ''} ${o.removed ? 'line-through text-text-muted' : 'text-rarity-gem'}`} title={lib ? A.libraryHint : undefined}>
                {GEMS[id]!.n}
                {starting.has(id) && <> <Badge>{A.startingGem}</Badge></>}
                {missing && !o.removed && <> <Badge tone="warning">{A.notOffered}</Badge></>}
              </td>
              <td>
                <Popup label={`${A.notBefore} ${GEMS[id]!.n}`} value={String(o.notBeforeAct ?? 0)} onChange={v => setOverride(id, { notBeforeAct: Number(v) || undefined })}>
                  <option value="0">{A.anyAct}</option>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>Act {i + 1}</option>)}
                </Popup>
              </td>
              <td className="pr-5 text-right"><Switch size="sm" label={`${A.skip} ${GEMS[id]!.n}`} checked={!!o.removed} onChange={v => setOverride(id, { removed: v })} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
