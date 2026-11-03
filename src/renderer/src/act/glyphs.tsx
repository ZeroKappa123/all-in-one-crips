import { Crown, Hammer, House, LogOut, Orbit, Skull, SquareArrowDown, SquareArrowDownLeft, SquareArrowDownRight, SquareArrowLeft, SquareArrowRight, SquareArrowUp, SquareArrowUpLeft, SquareArrowUpRight, Waypoints } from 'lucide-react'

/**
 * Guide symbols in the app's own style: small rounded tiles with a white glyph, one colour per
 * kind of step (meaning and colours follow exile-leveling's guide). Drawn from open Lucide glyphs;
 * no game artwork is used.
 */
type Kind = 'waypoint' | 'town' | 'quest' | 'portal' | 'trial' | 'crafting' | 'logout' | 'ascend'

const TILE: Record<Kind, { from: string; to: string; label: string }> = {
  waypoint: { from: '#64d2ff', to: '#0a84ff', label: 'Waypoint' },
  town: { from: '#4cd964', to: '#1f9d40', label: 'Town' },
  quest: { from: '#ffe066', to: '#ff9f0a', label: 'Quest' },
  portal: { from: '#7d7aff', to: '#0a84ff', label: 'Portal' },
  trial: { from: '#7fc8a9', to: '#2c7a63', label: 'Trial' },
  crafting: { from: '#c9a27a', to: '#8a6440', label: 'Crafting' },
  logout: { from: '#aeaeb2', to: '#6e6e73', label: 'Log out' },
  ascend: { from: '#d17bff', to: '#8e44ff', label: 'Labyrinth' }
}

function Glyph({ kind }: { kind: Kind }) {
  const c = 'h-[0.72em] w-[0.72em]'
  switch (kind) {
    case 'waypoint': return <Waypoints className={c} strokeWidth={2.6} />
    case 'town': return <House className={c} strokeWidth={2.6} />
    case 'quest': return <span className="text-[0.75em] font-black leading-none">!</span>
    case 'portal': return <Orbit className={c} strokeWidth={2.6} />
    case 'trial': return <Skull className={c} strokeWidth={2.6} />
    case 'crafting': return <Hammer className={c} strokeWidth={2.6} />
    case 'logout': return <LogOut className={c} strokeWidth={2.6} />
    case 'ascend': return <Crown className={c} strokeWidth={2.6} />
  }
}

export function StepIcon({ kind }: { kind: Kind }) {
  const t = TILE[kind]
  return (
    <span
      role="img"
      aria-label={t.label}
      title={t.label}
      data-step-icon={kind}
      className="inline-flex items-center justify-center align-[-0.18em] mr-[0.3em] h-[1.15em] w-[1.15em] rounded-[0.3em] text-white shadow-card"
      style={{ background: `linear-gradient(180deg, ${t.from}, ${t.to})` }}
    >
      <Glyph kind={kind} />
    </span>
  )
}

const ARROWS = [SquareArrowUp, SquareArrowUpRight, SquareArrowRight, SquareArrowDownRight, SquareArrowDown, SquareArrowDownLeft, SquareArrowLeft, SquareArrowUpLeft]

/** Direction hint as an arrow in a square, like exile-leveling (0° = up, clockwise). */
export function DirectionIcon({ deg }: { deg: number }) {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8
  const Icon = ARROWS[i]!
  return <Icon role="img" aria-label={`direction ${deg} degrees`} className="inline h-[1.1em] w-[1.1em] align-[-0.2em] text-text" strokeWidth={2} />
}

const GEM_COLOR: Record<string, string> = { s: 'var(--c-gem-str)', d: 'var(--c-gem-dex)', i: 'var(--c-gem-int)' }
const GEM_ATTR: Record<string, string> = { s: 'Strength gem', d: 'Dexterity gem', i: 'Intelligence gem' }

/** Coloured dot by the gem's main attribute, like exile-leveling. */
export function GemDot({ attr }: { attr: string }) {
  return (
    <span role="img" aria-label={GEM_ATTR[attr] ?? 'Gem'} title={GEM_ATTR[attr] ?? 'Gem'}
      className="inline-block h-[0.6em] w-[0.6em] rounded-full align-[0.05em] mr-[0.25em]"
      style={{ background: GEM_COLOR[attr] ?? 'var(--c-gem-none)', boxShadow: '0 0 0 0.5px rgba(0,0,0,.25)' }} />
  )
}
