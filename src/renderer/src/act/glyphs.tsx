import { useEffect, useState } from 'react'
import { currencyIcon, loadIcons, onIcons } from '../pricecheck/icons'
import { Crown, Hammer, House, LogOut, Orbit, Skull, SquareArrowDown, SquareArrowDownLeft, SquareArrowDownRight, SquareArrowLeft, SquareArrowRight, SquareArrowUp, SquareArrowUpLeft, SquareArrowUpRight, Waypoints } from 'lucide-react'

/**
 * Guide symbols: one glyph per kind of step, in that kind's colour, drawn without a tile so they
 * sit in the text like the guide's own symbols (meaning and colours follow exile-leveling's guide).
 * Drawn from open Lucide glyphs; no game artwork is bundled.
 */
type Kind = 'waypoint' | 'town' | 'quest' | 'portal' | 'trial' | 'crafting' | 'logout' | 'ascend'

const ICON: Record<Kind, { color: string; label: string }> = {
  waypoint: { color: 'var(--g-waypoint)', label: 'Waypoint' },
  town: { color: 'var(--g-item)', label: 'Town' },
  quest: { color: 'var(--g-quest)', label: 'Quest' },
  portal: { color: 'var(--g-waypoint)', label: 'Portal' },
  trial: { color: 'var(--g-trial)', label: 'Trial' },
  crafting: { color: 'var(--g-enter)', label: 'Crafting' },
  logout: { color: 'var(--g-muted)', label: 'Log out' },
  ascend: { color: 'var(--g-area)', label: 'Labyrinth' }
}

function Glyph({ kind }: { kind: Kind }) {
  const c = 'h-[1em] w-[1em]'
  switch (kind) {
    case 'waypoint': return <Waypoints className={c} strokeWidth={2.4} />
    case 'town': return <House className={c} strokeWidth={2.4} />
    case 'quest': return <span className="text-[1.15em] font-bold leading-none" style={{ fontFamily: 'Georgia, serif' }}>!</span>
    case 'portal': return <Orbit className={c} strokeWidth={2.4} />
    case 'trial': return <Skull className={c} strokeWidth={2.4} />
    case 'crafting': return <Hammer className={c} strokeWidth={2.4} />
    case 'logout': return <LogOut className={c} strokeWidth={2.4} />
    case 'ascend': return <Crown className={c} strokeWidth={2.4} />
  }
}

export function StepIcon({ kind }: { kind: Kind }) {
  const t = ICON[kind]
  return (
    <span role="img" aria-label={t.label} title={t.label} data-step-icon={kind}
      className="inline-flex items-center justify-center align-[-0.15em] mr-[0.25em] h-[1.05em] w-[1.05em]"
      style={{ color: t.color, filter: 'drop-shadow(0 0 1px #000) drop-shadow(0 1px 1px #000)' }}>
      <Glyph kind={kind} />
    </span>
  )
}

const ARROWS = [SquareArrowUp, SquareArrowUpRight, SquareArrowRight, SquareArrowDownRight, SquareArrowDown, SquareArrowDownLeft, SquareArrowLeft, SquareArrowUpLeft]

/** Direction hint as an arrow in a square, like exile-leveling (0° = up, clockwise). */
export function DirectionIcon({ deg }: { deg: number }) {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8
  const Icon = ARROWS[i]!
  return <Icon role="img" aria-label={`direction ${deg} degrees`} className="inline h-[1.1em] w-[1.1em] align-[-0.2em]" style={{ color: 'var(--g-waypoint, currentColor)' }} strokeWidth={2} />
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

/** What a gem costs at the vendor (by its required level), as the currency's own icon from GGG's image server. */
const COST: [number, string, string][] = [[8, 'wisdom', 'Scroll of Wisdom'], [16, 'transmute', 'Orb of Transmutation'], [28, 'alt', 'Orb of Alteration'], [38, 'chance', 'Orb of Chance'], [Infinity, 'alch', 'Orb of Alchemy']]
export function gemCost(requiredLevel: number): { id: string; name: string } {
  const c = COST.find(([max]) => requiredLevel < max)!
  return { id: c[1], name: c[2] }
}
export function GemCost({ level }: { level: number }) {
  const [, tick] = useState(0)
  useEffect(() => { void loadIcons(); return onIcons(() => tick(n => n + 1)) }, [])
  const cost = gemCost(level)
  const icon = currencyIcon(cost.id)
  const [ok, setOk] = useState(false)
  if (!icon) return null
  return <img src={icon.url} alt={cost.name} title={cost.name} onLoad={() => setOk(true)}
    className="inline-block h-[1.2em] w-[1.2em] align-[-0.25em] ml-[0.15em]" style={{ visibility: ok ? 'visible' : 'hidden' }} />
}
