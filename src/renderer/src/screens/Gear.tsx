import { Gem, Shield, Trash2 } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import { useAct } from '../act/useAct'
import { S } from '../strings'

const A = S.act

export function Gear() {
  const act = useAct()
  if (!act) return null
  const slot = act.store.slots[act.store.activeSlot]
  const level = slot?.character ? act.live.levels[slot.character] : undefined
  const items = [...act.store.gear].sort((a, b) => a.level - b.level)
  return (
    <div className="h-full flex flex-col bg-bg">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-xl">{A.gearTitle}</h1>
        {slot?.character && <p className="text-xs text-text-muted">{slot.character}{level ? ` · level ${level}` : ''}</p>}
        {!slot?.character && <p className="text-xs text-warning">{A.characterHelp}</p>}
      </header>
      {items.length === 0 && <EmptyState icon={<Shield className="h-[20px] w-[20px]" />}>{A.gearEmpty}</EmptyState>}
      <ul className="flex-1 overflow-y-auto py-2">
        {items.map(g => {
          const ready = level !== undefined && g.level <= level
          return (
            <li key={g.id} className="flex items-center gap-4 px-6 h-[32px] hover:bg-surface-raised text-sm">
              {g.kind === 'gem' ? <Gem aria-hidden className="h-[14px] w-[14px] text-rarity-gem" /> : <Shield aria-hidden className="h-[14px] w-[14px] text-text-muted" />}
              <span className={`flex-1 truncate ${ready ? 'text-success' : ''}`}>{g.name}</span>
              <span className="text-xs font-mono text-text-muted">{A.needLevel(g.level)}</span>
              {ready && <span className="text-xs text-success">{A.gearReadyTag}</span>}
              <Button variant="ghost" size="sm" aria-label={`${S.remove} ${g.name}`} onClick={() => void window.assay.act.removeGear(g.id)}><Trash2 aria-hidden className="h-[12px] w-[12px]" /></Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
