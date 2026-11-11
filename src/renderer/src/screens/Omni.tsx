import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { OmniMenu } from '../../../main/omni'
import { S } from '../strings'

const O = S.omni

/** The omni key's menu: one row per search string, styled like the leveling guide. */
export function Omni() {
  const [menu, setMenu] = useState<OmniMenu | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    void window.crips.omni.get().then(m => { if (m.entries.length) setMenu(m) })
    return window.crips.omni.onMenu(setMenu)
  }, [])
  useEffect(() => {
    if (!root.current) return
    const ro = new ResizeObserver(([e]) => { if (e) window.crips.omni.resize(e.target.getBoundingClientRect().height + 2) })
    ro.observe(root.current)
    return () => ro.disconnect()
  }, [])
  const label = (id: string, l: string) => id === 'page' ? O.pageGems : id === 'all' ? O.allGems : l

  return (
    <div ref={root} className="guide-classic w-full" style={{ background: 'rgba(var(--g-bg), 0.94)', border: '1px solid var(--g-frame)', fontSize: '15px' }}>
      <div className="flex items-center px-3 h-[2em]" style={{ borderBottom: '1px solid var(--g-frame)' }}>
        <span className="flex-1" style={{ color: 'var(--g-quest)' }}>{O.title}</span>
        <button className="g-btn" aria-label="Close" onClick={() => window.crips.omni.close()}><X aria-hidden className="h-[0.9em] w-[0.9em]" /></button>
      </div>
      <ul className="py-1">
        {menu?.entries.map(e => (
          <li key={e.id} className="flex items-center gap-2 px-3 py-[0.2em] hover:bg-[#1c1c1c]">
            <span aria-hidden className="text-[0.7em]">◆</span>
            {e.parts.length === 1
              ? <button className="flex-1 text-left truncate" style={{ color: e.kind === 'gems' ? 'var(--g-buy)' : 'var(--g-text)' }} title={e.parts[0]} onClick={() => window.crips.omni.pick(e.id, 0)}>{label(e.id, e.label)}</button>
              : <>
                <span className="flex-1 truncate" style={{ color: 'var(--g-buy)' }}>{label(e.id, e.label)}</span>
                {e.parts.map((p, i) => <button key={i} className="g-btn" title={p} aria-label={`${label(e.id, e.label)}, ${O.part(i + 1, e.parts.length)}`} onClick={() => window.crips.omni.pick(e.id, i)}>{i + 1}</button>)}
              </>}
          </li>
        ))}
      </ul>
      {menu?.noBuild && <p className="px-3 pb-2" style={{ color: 'var(--g-muted)', fontSize: '0.8em' }}>{O.noBuild}</p>}
      <p className="px-3 pb-2" style={{ color: 'var(--g-muted)', fontSize: '0.75em' }}>{O.hint}</p>
    </div>
  )
}
