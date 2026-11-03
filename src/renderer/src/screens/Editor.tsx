import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, RotateCcw, Save } from 'lucide-react'
import { AREAS, DEFAULT_ROUTE } from '@shared/act/data'
import { parseRoute, DEFAULT_OPTIONS } from '@shared/act/route'
import { Button, StatusBanner } from '../components/ui'
import { useAct } from '../act/useAct'
import { StepPreview } from './GuidePreview'
import { S } from '../strings'

const A = S.act
const MOVE = /\{enter\||\{waypoint\|[^}]|\{logout\}|\{portal\|use\}/

/** Splits guide text into pages the same way the overlay does: a page ends with a move and its hints. */
export function splitPages(text: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  let moved = false
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    const isHint = t.startsWith('#sub') || t === '#endif' || t === ''
    if (moved && !isHint) { out.push(cur.join('\n')); cur = []; moved = false }
    cur.push(line)
    if (!t.startsWith('#') && MOVE.test(t)) moved = true
  }
  if (cur.some(l => l.trim())) out.push(cur.join('\n'))
  return out
}

function validate(chunk: string): string[] {
  const plain = chunk.split('\n').filter(l => !/^\s*#(if|endif|section)/.test(l)).join('\n')
  const problems: string[] = []
  const r = parseRoute(plain, DEFAULT_OPTIONS, AREAS)
  for (const id of r.unknownAreas) problems.push(A.unknownArea(id))
  if (!MOVE.test(plain) && !/#section/.test(chunk)) problems.push(A.missingArea)
  return problems
}

export function Editor({ slotIndex }: { slotIndex: number }) {
  const act = useAct()
  const slot = act?.store.slots[slotIndex]
  const original = slot?.guide ?? DEFAULT_ROUTE
  const [pages, setPages] = useState<string[] | null>(null)
  const [dirty, setDirty] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState<number | null>(null)
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])

  useEffect(() => { if (slot && pages === null) setPages(splitPages(original)) }, [slot, original, pages])
  const problems = useMemo(() => (pages ?? []).map(validate), [pages])
  if (!act || !slot || !pages) return null

  const wrap = (kind: string) => {
    const i = refs.current.findIndex(el => el === document.activeElement)
    const el = refs.current[i]
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    if (a === b) return
    const next = value.slice(0, a) + `{${kind}|${value.slice(a, b)}}` + value.slice(b)
    setPages(p => p!.map((x, j) => (j === i ? next : x)))
    setDirty(d => new Set(d).add(i))
  }

  const save = async () => {
    await window.assay.act.updateSlot(slotIndex, { guide: pages.join('\n'), page: Math.min(slot.page, pages.length) })
    setDirty(new Set())
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <header className="flex items-center gap-4 px-7 py-5 border-b border-border">
        <h1 className="text-xl flex-1">{A.editorTitle} – {slot.name}</h1>
        {dirty.size > 0 && <span className="text-xs text-accent">{A.unsaved}</span>}
        <Button variant="ghost" size="sm" onClick={async () => { await window.assay.act.updateSlot(slotIndex, { guide: null }); setPages(splitPages(DEFAULT_ROUTE)); setDirty(new Set()) }}>
          <RotateCcw aria-hidden className="h-[12px] w-[12px]" />{A.revert}
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={dirty.size === 0}><Save aria-hidden className="h-[14px] w-[14px]" />{A.save}</Button>
      </header>
      <div className="flex items-center gap-3 px-7 py-3 border-b border-border text-xs text-text-muted">
        Mark selection as:
        <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={() => wrap('kill')}>kill</Button>
        <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={() => wrap('quest_text')}>item</Button>
        <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={() => wrap('arena')}>arena</Button>
        <Button size="sm" onMouseDown={e => e.preventDefault()} onClick={() => wrap('enter')}>area id</Button>
        <span className="ml-4">Conditions: <code>#ifdef LEAGUE_START</code> … <code>#endif</code>, also <code>BANDIT_KILL</code>, <code>LIBRARY</code>, <code>OPTIONAL</code></span>
      </div>
      <ol className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
        {pages.map((text, i) => (
          <li key={i} className="flex gap-5">
            <div className="w-[72px] shrink-0 pt-2 text-xs text-text-muted">{A.page(i + 1)}</div>
            <div className="flex-1 space-y-2">
              <textarea
                ref={el => { refs.current[i] = el }}
                aria-label={A.page(i + 1)}
                aria-invalid={problems[i]!.length > 0 || undefined}
                value={text}
                spellCheck={false}
                rows={Math.min(12, text.split('\n').length + 1)}
                onChange={e => { const v = e.target.value; setPages(p => p!.map((x, j) => (j === i ? v : x))); setDirty(d => new Set(d).add(i)) }}
                className={`w-full rounded-sm bg-surface p-3 font-mono text-sm border ${problems[i]!.length ? 'border-danger' : dirty.has(i) ? 'border-accent' : 'border-border'}`}
              />
              {problems[i]!.map(p => <p key={p} role="alert" className="text-xs text-danger">{p}</p>)}
              <Button size="sm" variant="ghost" aria-expanded={preview === i} onClick={() => setPreview(preview === i ? null : i)}><Eye aria-hidden className="h-[12px] w-[12px]" />{A.preview}</Button>
              {preview === i && <StepPreview text={text} slot={slot} />}
            </div>
          </li>
        ))}
      </ol>
      {problems.some(p => p.length) && <div className="px-7 pb-4"><StatusBanner tone="warning">{problems.filter(p => p.length).length} pages need a look.</StatusBanner></div>}
    </div>
  )
}
