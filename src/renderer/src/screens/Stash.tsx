import { useEffect, useRef, useState } from 'react'
import type { Config } from '@shared/config'
import { stashGrid } from '@shared/trade/whisper'
import { Button } from '../components/ui'
import { S } from '../strings'

const T = S.trades
type Rect = { x: number; y: number; width: number; height: number }
const DEFAULT_RECT: Rect = { x: 16, y: 126, width: 634, height: 634 } // a starting frame; calibrate once for your resolution

/** Outlines the traded item's cell in the open stash tab, or lets you fit the frame to the stash grid once. */
export function Stash() {
  const [config, setConfig] = useState<Config | null>(null)
  const [hl, setHl] = useState<{ stash: { tab: string; left: number; top: number }; item: string } | null>(null)
  const [calibrating, setCalibrating] = useState(false)
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT)
  const drag = useRef<{ mode: 'move' | 'size'; x: number; y: number; r: Rect } | null>(null)

  useEffect(() => {
    void window.crips.getConfig().then(r => { setConfig(r.config); if (r.config.trades.stash) setRect(r.config.trades.stash) })
    const offs = [
      window.crips.onConfig(c => { setConfig(c); if (c.trades.stash) setRect(c.trades.stash) }),
      window.crips.trades.onHighlight(p => setHl(p)),
      window.crips.trades.onCalibrate(on => setCalibrating(on))
    ]
    return () => offs.forEach(o => o())
  }, [])

  // a highlight disappears by itself after a few seconds
  useEffect(() => {
    if (!hl) return
    const t = setTimeout(() => { setHl(null); window.crips.trades.hideStash() }, 6000)
    return () => clearTimeout(t)
  }, [hl])

  if (!config) return null
  const quad = config.trades.quad === 'auto' ? 'auto' : config.trades.quad === 'quad'
  const save = () => { void window.crips.setConfig({ trades: { ...config.trades, stash: rect } }); setCalibrating(false); window.crips.trades.calibrate(false); window.crips.trades.hideStash() }

  if (calibrating) {
    return (
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,.25)' }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x, dy = e.clientY - d.y
          setRect(d.mode === 'move' ? { ...d.r, x: d.r.x + dx, y: d.r.y + dy } : { ...d.r, width: Math.max(120, d.r.width + dx), height: Math.max(120, d.r.height + dy) })
        }}
        onPointerUp={() => { drag.current = null }}>
        <Grid rect={rect} size={12} />
        <div className="absolute border-2 border-accent rounded-sm cursor-move" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'move', x: e.clientX, y: e.clientY, r: rect } }}>
          <span aria-label={T.resize} className="absolute -right-2 -bottom-2 h-[16px] w-[16px] rounded-full bg-accent cursor-nwse-resize"
            onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'size', x: e.clientX, y: e.clientY, r: rect } }} />
        </div>
        <div className="absolute left-1/2 top-6 -translate-x-1/2 flex items-center gap-4 rounded-full material-hud text-text px-6 py-3">
          <span className="text-base">{T.calibrateHelp}</span>
          <Button variant="primary" onClick={save}>{T.save}</Button>
          <Button onClick={() => { setCalibrating(false); window.crips.trades.calibrate(false); window.crips.trades.hideStash() }}>{T.cancel}</Button>
        </div>
      </div>
    )
  }

  if (!hl) return null
  const g = stashGrid(hl.stash, quad)
  const r = config.trades.stash ?? DEFAULT_RECT
  const cw = r.width / g.size, ch = r.height / g.size
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div aria-label={`${hl.item}: ${T.cell(hl.stash.left, hl.stash.top)}`} role="img"
        className="absolute rounded-[3px] border-2 border-accent animate-pulse"
        style={{ left: r.x + g.col * cw, top: r.y + g.row * ch, width: cw, height: ch, boxShadow: '0 0 0 9999px rgba(0,0,0,.25), 0 0 14px 2px var(--c-accent)' }} />
      <div className="absolute rounded-full material-hud text-text px-5 py-2 text-sm" style={{ left: r.x, top: Math.max(8, r.y - 40) }}>
        {hl.stash.tab} · {hl.item}
      </div>
    </div>
  )
}

function Grid({ rect, size }: { rect: Rect; size: number }) {
  const lines = Array.from({ length: size - 1 }, (_, i) => (i + 1) / size)
  return (
    <svg aria-hidden className="absolute pointer-events-none" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} viewBox="0 0 1 1" preserveAspectRatio="none">
      {lines.map(p => <line key={`v${p}`} x1={p} y1={0} x2={p} y2={1} stroke="var(--c-accent)" strokeWidth={0.002} opacity={0.6} />)}
      {lines.map(p => <line key={`h${p}`} x1={0} y1={p} x2={1} y2={p} stroke="var(--c-accent)" strokeWidth={0.002} opacity={0.6} />)}
    </svg>
  )
}
