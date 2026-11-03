import routeText from './data/route.txt?raw'
import areasJson from './data/areas.json'
import questsJson from './data/quests.json'
import gemsJson from './data/gems.json'
import charactersJson from './data/characters.json'
import type { AreaInfo } from './route'
import type { GemInfo, QuestInfo } from './gems'

export const DEFAULT_ROUTE: string = routeText
export const AREAS = areasJson as Record<string, AreaInfo>
export const QUESTS = questsJson as unknown as Record<string, QuestInfo>
export const GEMS = gemsJson as Record<string, GemInfo>
export const CHARACTERS = charactersJson as Record<string, { start_gem_id: string; chest_gem_id: string }>
export const CLASSES = Object.keys(CHARACTERS)

/** Quest hand-ins ("quest|offer") in the order the route visits them. */
export function questOrder(route: string): string[] {
  return [...route.matchAll(/\{quest\|([^}|]+)(?:\|([^}]+))?\}/g)]
    .map(m => `${m[1]}|${m[2] ?? m[1]}`)
    .filter((q, i, a) => a.indexOf(q) === i)
}
