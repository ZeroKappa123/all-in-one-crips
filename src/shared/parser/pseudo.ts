import type { ParsedMod } from '../types'

/**
 * Pseudo stats sum related mods into one searchable total, the way players think about them.
 * Rules are written against mod text, so they work regardless of stat IDs.
 * Each rule names the trade site's pseudo stat ID; the caller drops rules whose ID is not in the
 * loaded stat list, so a renamed pseudo stat fails safe instead of sending a bad query.
 */
export interface PseudoRule {
  id: string
  label: string
  parts: { re: RegExp; factor: number }[]
  /** mods consumed by this rule are hidden from the individual stat list */
  hides: boolean
}

const RES = (el: string) => new RegExp(`^\\+?(\\d+)% to ${el} Resistance$`)
const ALL_ELE = { re: /^\+?(\d+)% to all Elemental Resistances$/, factor: 1 }
const DUAL = (a: string, b: string) => new RegExp(`^\\+?(\\d+)% to (?:${a} and ${b}|${b} and ${a}) Resistances$`)

export const PSEUDO_RULES: PseudoRule[] = [
  {
    id: 'pseudo.pseudo_total_life',
    label: '+# total maximum Life',
    parts: [
      { re: /^\+?(\d+) to maximum Life$/, factor: 1 },
      { re: /^\+?(\d+) to Strength$/, factor: 0.5 },
      { re: /^\+?(\d+) to Strength and (?:Dexterity|Intelligence)$/, factor: 0.5 },
      { re: /^\+?(\d+) to all Attributes$/, factor: 0.5 }
    ],
    hides: false
  },
  {
    id: 'pseudo.pseudo_total_elemental_resistance',
    label: '+#% total Elemental Resistance',
    parts: [
      { re: RES('Fire'), factor: 1 }, { re: RES('Cold'), factor: 1 }, { re: RES('Lightning'), factor: 1 },
      { re: ALL_ELE.re, factor: 3 },
      { re: DUAL('Fire', 'Cold'), factor: 2 }, { re: DUAL('Fire', 'Lightning'), factor: 2 },
      { re: DUAL('Cold', 'Lightning'), factor: 2 }
    ],
    hides: true
  },
  {
    id: 'pseudo.pseudo_total_chaos_resistance',
    label: '+#% total Chaos Resistance',
    parts: [{ re: RES('Chaos'), factor: 1 }],
    hides: true
  },
  {
    id: 'pseudo.pseudo_total_energy_shield',
    label: '+# total maximum Energy Shield',
    parts: [{ re: /^\+?(\d+) to maximum Energy Shield$/, factor: 1 }],
    hides: false
  },
  {
    id: 'pseudo.pseudo_increased_movement_speed',
    label: '#% increased Movement Speed',
    parts: [{ re: /^(\d+)% increased Movement Speed$/, factor: 1 }],
    hides: true
  }
]

export interface PseudoResult {
  id: string
  label: string
  value: number
  consumed: ParsedMod[]
}

export function computePseudo(mods: ParsedMod[], rules: PseudoRule[] = PSEUDO_RULES): PseudoResult[] {
  const out: PseudoResult[] = []
  for (const rule of rules) {
    let total = 0
    const consumed: ParsedMod[] = []
    for (const mod of mods) {
      for (const part of rule.parts) {
        const m = mod.text.match(part.re)
        if (m?.[1]) {
          total += Number(m[1]) * part.factor
          consumed.push(mod)
          break
        }
      }
    }
    // A single source mod is only worth a pseudo filter when it is not a plain copy of itself
    const worthIt = consumed.length > 1 || rule.parts.some(p => p.factor !== 1 && consumed.some(c => p.re.test(c.text)))
    if (consumed.length > 0 && (worthIt || rule.hides)) {
      out.push({ id: rule.id, label: rule.label, value: Math.floor(total), consumed: rule.hides ? consumed : [] })
    }
  }
  return out
}
