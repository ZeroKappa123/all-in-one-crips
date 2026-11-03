/**
 * PoE 1 experience penalty, as documented on the community wiki:
 *   safeZone = 3 + floor(playerLevel / 16)
 *   diff     = max(|playerLevel - areaLevel| - safeZone, 0)
 *   factor   = ((playerLevel + 5) / (playerLevel + 5 + diff^2.5))^1.5
 * Campaign areas stay below level 70, so the high-level monster adjustments don't apply here.
 */
export interface ExpInfo {
  factor: number // 0..1
  min: number // lowest area level with full exp
  max: number // highest area level with full exp
  offBy: number // 0 inside the window, negative = area too low, positive = area too high
}

export function expInfo(playerLevel: number, areaLevel: number): ExpInfo {
  const safe = 3 + Math.floor(playerLevel / 16)
  const diff = Math.max(Math.abs(playerLevel - areaLevel) - safe, 0)
  const factor = Math.pow((playerLevel + 5) / (playerLevel + 5 + Math.pow(diff, 2.5)), 1.5)
  const min = Math.max(1, playerLevel - safe)
  const max = playerLevel + safe
  const offBy = areaLevel < min ? areaLevel - min : areaLevel > max ? areaLevel - max : 0
  return { factor, min, max, offBy }
}
