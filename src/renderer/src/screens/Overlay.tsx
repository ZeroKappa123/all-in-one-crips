import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, GripVertical, ImagePlus, Images, Settings as Cog, Timer, Map as MapIcon, Network, Package, RectangleHorizontal, X } from 'lucide-react'
import type { Config } from '@shared/config'
import { Button } from '../components/ui'
import { S } from '../strings'

type Widget = Config['widgets'][number]

/** Transparent fullscreen layer; click empty space or press Esc to return to the game. */
export function Overlay() {
  const [config, setConfig] = useState<Config | null>(null)
  const [editing, setEditing] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const viewingRef = useRef<string | null>(null)
  viewingRef.current = viewing
  useEffect(() => {
    void window.crips.getConfig().then(r => setConfig(r.config))
    const off = window.crips.onConfig(setConfig)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !viewingRef.current) window.crips.hideOverlay() }
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
              <Button aria-pressed={config.widgets.find(x => x.type === 'images')?.visible} aria-label={S.images.toggle} title={S.images.toggle}
                onClick={() => void window.crips.setConfig({ widgets: config.widgets.map(x => (x.type === 'images' ? { ...x, visible: !x.visible } : x)) })}>
                <Images aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.actions.guideToggle} title={S.actions.guideToggle} onClick={async () => { const a = await window.crips.act.get(); await window.crips.act.update({ overlay: { ...a.store.overlay, visible: !a.store.overlay.visible } }) }}>
                <MapIcon aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.actions.treeOverlay} title={S.actions.treeOverlay} onClick={() => { window.crips.hideOverlay(); window.crips.act.open('tree') }}>
                <Network aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.wide.wide} title={S.wide.wide} aria-pressed={config.widescreen.enabled && config.widescreen.wide}
                className={config.widescreen.enabled && config.widescreen.wide ? '!bg-accent !text-on-accent' : ''}
                onClick={() => void window.crips.widescreen.setWide(!(config.widescreen.enabled && config.widescreen.wide))}>
                <RectangleHorizontal aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.trades.settings.show} title={S.trades.settings.show} onClick={() => window.crips.trades.show()}>
                <ArrowLeftRight aria-hidden className="h-[16px] w-[16px]" />
              </Button>
              <Button aria-label={S.act.gear} title={S.act.gear} onClick={() => window.crips.act.open('gear')}>
                <Package aria-hidden className="h-[16px] w-[16px]" />
              </Button>
            </div>
          )}
          {w.type === 'stopwatch' && w.visible && <Stopwatch />}
          {w.type === 'images' && w.visible && <ImageStrip config={config} editing={editing} onOpen={setViewing} />}
        </Draggable>
      ))}
      {viewing && <ImageViewer images={config.images} id={viewing} onChange={setViewing} />}
    </div>
  )
}

function Draggable({ w, editing, onMove, onDrop, children }: { w: Widget; editing: boolean; onMove: (x: number, y: number) => void; onDrop: (x: number, y: number) => void; children: React.ReactNode }) {
  const start = useRef<{ dx: number; dy: number } | null>(null)
  if (w.type !== 'settings' && !w.visible) return null
  return (
    <div className={`absolute flex items-center gap-2 material-hud p-2 ${w.type === 'images' ? 'rounded-xl' : 'rounded-full'} ${editing ? 'outline-dashed outline-1 outline-border-input' : ''}`} style={{ left: w.x, top: w.y }}>
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

type Img = Config['images'][number]
const imageCache = new Map<string, Promise<string | null>>()
function useImage(id: string): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!imageCache.has(id)) imageCache.set(id, window.crips.images.get(id))
    void imageCache.get(id)!.then(s => { if (live) setSrc(s) })
    return () => { live = false }
  }, [id])
  return src
}

/** Your own pictures in a row, like Awakened PoE Trade's image strip; click one to show it large. */
function ImageStrip({ config, editing, onOpen }: { config: Config; editing: boolean; onOpen: (id: string) => void }) {
  const I = S.images
  const imgs = config.images
  const move = (i: number, d: -1 | 1) => {
    const next = [...imgs]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x!)
    void window.crips.setConfig({ images: next })
  }
  return (
    <div className="px-2 pb-1">
      <p className="text-sm font-semibold text-text-muted text-center pb-2">{I.title}</p>
      <div className="flex gap-3">
        {imgs.map((img, i) => (
          <div key={img.id} className="relative">
            <Thumb img={img} disabled={editing} onOpen={() => onOpen(img.id)} />
            {editing && (
              <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
                <Button size="sm" aria-label={I.left(img.name)} disabled={i === 0} onClick={() => move(i, -1)}><ChevronLeft aria-hidden className="h-[12px] w-[12px]" /></Button>
                <Button size="sm" variant="danger" className="!bg-fill" aria-label={I.remove(img.name)} onClick={() => { imageCache.delete(img.id); void window.crips.images.remove(img.id) }}><X aria-hidden className="h-[12px] w-[12px]" /></Button>
                <Button size="sm" aria-label={I.right(img.name)} disabled={i === imgs.length - 1} onClick={() => move(i, 1)}><ChevronRight aria-hidden className="h-[12px] w-[12px]" /></Button>
              </div>
            )}
          </div>
        ))}
        {(editing || imgs.length === 0) && (
          <button type="button" onClick={() => void window.crips.images.add()}
            className="flex flex-col items-center justify-center gap-1 w-[192px] h-[104px] rounded-lg border border-dashed border-border-input text-text-muted hover:text-text hover:bg-fill">
            <ImagePlus aria-hidden className="h-[18px] w-[18px]" />
            <span className="text-base">{I.add}</span>
            <span className="text-xs">{I.addHelp}</span>
          </button>
        )}
      </div>
      {imgs.length === 0 && !editing && <p className="pt-2 text-xs text-text-muted text-center max-w-[192px]">{I.empty}</p>}
    </div>
  )
}

function Thumb({ img, disabled, onOpen }: { img: Img; disabled: boolean; onOpen: () => void }) {
  const src = useImage(img.id)
  return (
    <button type="button" disabled={disabled} onClick={onOpen} aria-label={S.images.open(img.name)} title={img.name}
      className="block w-[192px] h-[104px] rounded-lg overflow-hidden bg-fill hover:ring-2 hover:ring-accent disabled:hover:ring-0">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="text-sm text-text-muted">{img.name}</span>}
    </button>
  )
}

/** The picture large in the middle of the screen. Click or Esc closes, arrow keys flip. */
function ImageViewer({ images, id, onChange }: { images: Img[]; id: string; onChange: (id: string | null) => void }) {
  const i = images.findIndex(x => x.id === id)
  const img = images[i]
  const src = useImage(id)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      else if (e.key === 'ArrowRight' && images.length > 1) onChange(images[(i + 1) % images.length]!.id)
      else if (e.key === 'ArrowLeft' && images.length > 1) onChange(images[(i - 1 + images.length) % images.length]!.id)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [i, images])
  if (!img) return null
  return (
    <div role="dialog" aria-label={img.name} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(0,0,0,.6)' }}
      onMouseDown={e => { e.stopPropagation(); onChange(null) }}>
      {src && <img src={src} alt={img.name} className="max-w-[90vw] max-h-[86vh] object-contain rounded-lg shadow-pop" />}
      <p className="rounded-full material-hud text-text text-sm px-5 py-2">{img.name} · {S.images.close}</p>
    </div>
  )
}
