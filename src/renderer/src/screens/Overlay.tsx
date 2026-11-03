import { useEffect, useRef, useState } from 'react'
import { GripVertical, Settings as Cog, Timer, Map as MapIcon, Network, Package } from 'lucide-react'
import type { Config } from '@shared/config'
import { Button } from '../components/ui'
import { S } from '../strings'

type Widget = Config['widgets'][number]

/** Transparent fullscreen layer; click empty space or press Esc to return to the game. */
export function Overlay() {
  const [config, setConfig] = useState<Config | null>(null)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    void window.crips.getConfig().then(r => setConfig(r.config))
    const off = window.crips.onConfig(setConfig)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') window.crips.hideOverlay() }
    addEventListener('keydown', key)
    return () => { off(); removeEventListener('keydown', key) }
  }, [])
  if (!config) return null

  const move = (i: number, x: number, y: number) => {
    const widgets = config.widgets.map((w, j) => (j === i ? { ...w, x: Math.max(0, x), y: Math.max(0, y) } : w))
    setConfig({ ...config, widgets })
    return widgets
  }

  return (
    <div className="fixed inset-0 text-text" style={{ background: 'rgba(0,0,0,.25)' }} onMouseDown={e => { if (e.target === e.currentTarget && !editing) window.crips.hideOverlay() }}>
      {config.widgets.map((w, i) => (
        <Draggable key={w.type} w={w} editing={editing} onMove={(x, y) => move(i, x, y)} onDrop={(x, y) => void window.crips.setConfig({ widgets: move(i, x, y) })}>
          {w.type === 'settings' && (
            <div className="flex gap-2">
              <Button aria-label={S.settingsTitle} title={S.settingsTitle} onClick={() => window.crips.openSettings()}><Cog aria-hidden className="h-[16px] w-[16px]" /></Button>
              <Button aria-pressed={editing} onClick={() => setEditing(e => !e)}>{editing ? S.doneEditing : S.editWidgets}</Button>
              <Button aria-pressed={config.widgets.find(x => x.type === 'stopwatch')?.visible} aria-label={S.stopwatch} title={S.stopwatch}
                onClick={() => void window.crips.setConfig({ widgets: config.widgets.map(x => (x.type === 'stopwatch' ? { ...x, visible: !x.visible } : x)) })}>
                <Timer aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.actions.guideToggle} title={S.actions.guideToggle} onClick={async () => { const a = await window.crips.act.get(); await window.crips.act.update({ overlay: { ...a.store.overlay, visible: !a.store.overlay.visible } }) }}>
                <MapIcon aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.actions.treeOverlay} title={S.actions.treeOverlay} onClick={() => { window.crips.hideOverlay(); window.crips.act.open('tree') }}>
                <Network aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.act.gear} title={S.act.gear} onClick={() => window.crips.act.open('gear')}>
                <Package aria-hidden className="h-[16px] w-[16px]" />
              </Button>
            </div>
          )}
          {w.type === 'stopwatch' && w.visible && <Stopwatch />}
        </Draggable>
      ))}
    </div>
  )
}

function Draggable({ w, editing, onMove, onDrop, children }: { w: Widget; editing: boolean; onMove: (x: number, y: number) => void; onDrop: (x: number, y: number) => void; children: React.ReactNode }) {
  const start = useRef<{ dx: number; dy: number } | null>(null)
  if (w.type !== 'settings' && !w.visible) return null
  return (
    <div className={`absolute flex items-center gap-2 rounded-full material-hud p-2 ${editing ? 'outline-dashed outline-1 outline-border-input' : ''}`} style={{ left: w.x, top: w.y }}>
      {editing && (
        <span aria-hidden className="cursor-move text-text-muted"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { dx: e.clientX - w.x, dy: e.clientY - w.y } }}
          onPointerMove={e => { if (start.current) onMove(e.clientX - start.current.dx, e.clientY - start.current.dy) }}
          onPointerUp={e => { if (start.current) onDrop(e.clientX - start.current.dx, e.clientY - start.current.dy); start.current = null }}>
          <GripVertical className="h-[16px] w-[16px]" />
        </span>
      )}
      {children}
    </div>
  )
}

function Stopwatch() {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [, tick] = useState(0)
  useEffect(() => {
    if (startedAt === null) return
    const t = setInterval(() => tick(n => n + 1), 250)
    return () => clearInterval(t)
  }, [startedAt])
  const total = elapsed + (startedAt ? Date.now() - startedAt : 0)
  const s = Math.floor(total / 1000)
  const text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-lg tabular-nums px-3" aria-live="off">{text}</span>
      {startedAt === null
        ? <Button size="sm" onClick={() => setStartedAt(Date.now())}>{S.start}</Button>
        : <Button size="sm" onClick={() => { setElapsed(total); setStartedAt(null) }}>{S.stop}</Button>}
      <Button size="sm" variant="ghost" onClick={() => { setElapsed(0); setStartedAt(null) }}>{S.reset}</Button>
    </div>
  )
}
