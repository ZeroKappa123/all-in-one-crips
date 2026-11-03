import { useEffect, useMemo, useRef, useState } from 'react'
import treeJson from '@shared/act/data/tree.json'
import { bounds, diffSpecs, F, isMain, type TreeData, type TreeNode } from '@shared/act/tree'
import { useAct } from '../act/useAct'
import { S } from '../strings'

const A = S.act
const TREE = treeJson as unknown as TreeData

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Skill-tree overlay. Lay it over the open in-game tree and align once (right-drag, wheel);
 * the alignment is remembered. Without a build it shows the player's own screenshots instead.
 */
export function Tree() {
  const act = useAct()
  const slot = act?.store.slots[act.store.activeSlot]
  const specs = slot?.pob?.specs ?? []
  const images = act?.store.treeImages ?? []
  const [mode, setMode] = useState<'pob' | 'images'>('pob')
  const [spec, setSpec] = useState(0)
  const [held, setHeld] = useState<string | null>(null) // '1'..'4' or 'W'
  const [view, setView] = useState<{ x: number; y: number; scale: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  useEffect(() => { if (act && !view) setView(act.store.treeView) }, [act, view])
  useEffect(() => { if (specs.length) setSpec(s => Math.min(s, specs.length - 1)) }, [specs.length])
  useEffect(() => { if (act && !specs.length && images.length) setMode('images') }, [act, specs.length, images.length])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.crips.act.hideTree()
      else if (e.key === 'q' || e.key === 'Q') setSpec(s => Math.max(0, s - 1))
      else if (e.key === 'e' || e.key === 'E') setSpec(s => Math.min(specs.length - 1, s + 1))
      else if (['1', '2', '3', '4'].includes(e.key)) setHeld(e.key)
      else if (e.key === 'w' || e.key === 'W') setHeld('W')
    }
    const up = (e: KeyboardEvent) => { if (['1', '2', '3', '4', 'w', 'W'].includes(e.key)) setHeld(null) }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up) }
  }, [specs.length])

  const current = specs[spec]
  const states = useMemo(() => current ? diffSpecs(current.nodes, spec > 0 ? specs[spec - 1]!.nodes : null) : new Map(), [current, spec, specs])

  useEffect(() => {
    const c = canvas.current
    if (!c || mode !== 'pob' || !view) return
    c.width = innerWidth * devicePixelRatio
    c.height = innerHeight * devicePixelRatio
    const ctx = c.getContext('2d')!
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    const colors = { faint: cssVar('--c-border'), kept: cssVar('--c-accent'), added: cssVar('--c-success'), removed: cssVar('--c-danger'), text: cssVar('--c-text') }

    let filter: (n: TreeNode) => boolean = isMain
    let tf = { ...view }
    if (held && held !== 'W' && current?.ascendancy) {
      // Ascendancy view: the nodes of this spec's ascendancy, the first 2 per lab held (1 = normal … 4 = uber).
      const asc = current.ascendancy
      filter = n => n[3] === asc
      const b = bounds(TREE, filter)
      tf = fit(b)
    } else if (held === 'W') {
      tf = fit(bounds(TREE, isMain))
    }
    const P = (n: TreeNode) => [n[0] * tf.scale + tf.x, n[1] * tf.scale + tf.y] as const
    const ascLimit = held && held !== 'W' ? Number(held) * 2 : Infinity
    let ascCount = 0
    const ascAllowed = new Set<number>()
    if (held && held !== 'W' && current?.ascendancy) {
      // order ascendancy nodes by the first spec they appear in, so earlier labs come first
      const order: number[] = []
      for (const s of specs) for (const id of s.nodes) if (TREE.nodes[id]?.[3] === current.ascendancy && !order.includes(id) && !(TREE.nodes[id]![2] & F.ascStart)) order.push(id)
      for (const id of order) if (ascCount++ < ascLimit) ascAllowed.add(id)
    }
    const stateOf = (id: number) => {
      const s = states.get(id)
      if (held && held !== 'W' && s && s !== 'removed') return ascAllowed.has(id) ? s : 'none'
      return s ?? 'none'
    }

    ctx.lineCap = 'round'
    for (const [a, b] of TREE.edges) {
      const na = TREE.nodes[a], nb = TREE.nodes[b]
      if (!na || !nb || !filter(na) || !filter(nb)) continue
      const sa = stateOf(a), sb = stateOf(b)
      const both = sa !== 'none' && sb !== 'none' && sa !== 'removed' && sb !== 'removed'
      ctx.strokeStyle = both ? (sa === 'added' || sb === 'added' ? colors.added : colors.kept) : colors.faint
      ctx.lineWidth = both ? 3 : 1
      ctx.globalAlpha = both ? 0.95 : 0.35
      const [x1, y1] = P(na), [x2, y2] = P(nb)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    for (const [id, n] of Object.entries(TREE.nodes)) {
      if (!filter(n)) continue
      const st = stateOf(Number(id))
      const [x, y] = P(n)
      if (x < -20 || y < -20 || x > innerWidth + 20 || y > innerHeight + 20) continue
      const r = (n[2] & F.keystone ? 9 : n[2] & F.notable ? 6.5 : n[2] & F.jewel ? 6 : 3.5) * Math.max(0.6, Math.min(2.5, tf.scale * 12))
      ctx.globalAlpha = st === 'none' ? 0.35 : 1
      ctx.fillStyle = st === 'added' ? colors.added : st === 'removed' ? colors.removed : st === 'kept' ? colors.kept : colors.faint
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      if (st === 'removed') { ctx.strokeStyle = colors.removed; ctx.lineWidth = 2; ctx.stroke() }
    }
    ctx.globalAlpha = 1
  }, [view, held, current, states, mode, specs])

  if (!act) return null
  const save = (v: typeof view) => { if (v) void window.crips.act.update({ treeView: v }) }

  return (
    <div
      data-theme="dark" className="fixed inset-0 select-none"
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (e.button === 1 && view) {
          // middle click: put the class start under the cursor
          const start = Object.values(TREE.nodes).find(n => n[5] === classIndex(slot?.pob?.className))
          if (start) { const v = { ...view, x: e.clientX - start[0] * view.scale, y: e.clientY - start[1] * view.scale }; setView(v); save(v) }
          return
        }
        if (e.button !== 2 || !view) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
      }}
      onPointerMove={e => { if (drag.current && view) setView({ ...view, x: drag.current.vx + e.clientX - drag.current.x, y: drag.current.vy + e.clientY - drag.current.y }) }}
      onPointerUp={() => { if (drag.current) { drag.current = null; save(view) } }}
      onWheel={e => {
        if (mode === 'images') { void window.crips.act.update({ treeImageIndex: Math.max(0, Math.min(images.length - 1, act.store.treeImageIndex + (e.deltaY > 0 ? 1 : -1))) }); return }
        if (!view) return
        const k = e.deltaY > 0 ? 0.92 : 1.08
        const v = { scale: view.scale * k, x: e.clientX - (e.clientX - view.x) * k, y: e.clientY - (e.clientY - view.y) * k }
        setView(v); save(v)
      }}
    >
      {mode === 'pob' && <canvas ref={canvas} className="absolute inset-0 w-full h-full" />}
      {mode === 'images' && <Screenshot index={act.store.treeImageIndex} total={images.length} caption={images[act.store.treeImageIndex]?.caption ?? ''} />}
      <div className="absolute top-0 inset-x-0 flex justify-center pt-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4 rounded-full material-hud px-6 py-3 text-base text-text">
          {specs.length > 0 && images.length > 0 && (
            <button onClick={() => setMode(m => (m === 'pob' ? 'images' : 'pob'))} className="text-accent">{mode === 'pob' ? A.images : A.pobTree}</button>
          )}
          {mode === 'pob' && current && <strong>{current.title} <span className="text-text-muted font-normal">({spec + 1}/{specs.length})</span></strong>}
          {mode === 'pob' && !current && <span className="text-text-muted">{A.noTree}</span>}
          {held && held !== 'W' && <span className="text-rarity-magic">{current?.ascendancy} · {['Normal', 'Cruel', 'Merciless', 'Uber'][Number(held) - 1]}</span>}
          <span className="text-xs text-text-muted">{A.treeHelp}</span>
        </div>
      </div>
    </div>
  )
}

function fit(b: { minX: number; minY: number; maxX: number; maxY: number }) {
  const pad = 60
  const scale = Math.min((innerWidth - pad * 2) / (b.maxX - b.minX || 1), (innerHeight - pad * 2) / (b.maxY - b.minY || 1))
  return { scale, x: pad - b.minX * scale + (innerWidth - pad * 2 - (b.maxX - b.minX) * scale) / 2, y: pad - b.minY * scale + (innerHeight - pad * 2 - (b.maxY - b.minY) * scale) / 2 }
}

function classIndex(name: string | undefined): number {
  const i = TREE.classes.findIndex(c => c.name === name)
  return i < 0 ? 0 : i
}

function Screenshot({ index, total, caption }: { index: number; total: number; caption: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => { void window.crips.act.treeImage(index).then(setSrc) }, [index])
  if (!total) return <p className="absolute inset-0 flex items-center justify-center text-text-muted">{A.noTree}</p>
  return (
    <figure className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
      {src && <img src={src} alt={caption || `Tree screenshot ${index + 1}`} className="max-w-full max-h-[80vh] rounded-md shadow-pop" />}
      <figcaption className="text-sm">{caption}</figcaption>
      <div className="w-[320px] h-[4px] rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
        <div className="h-full bg-accent" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </figure>
  )
}
