import { XMLParser } from 'fast-xml-parser'

/**
 * Path of Building export codes are base64url-encoded, zlib-compressed XML.
 * Decompression needs zlib, so the main process inflates and hands the XML to parsePobXml().
 */
export interface PobGem { name: string; gemId: string | null; level: number; quality: number; enabled: boolean }
export interface PobGroup { label: string; slot: string; enabled: boolean; gems: PobGem[] }
export interface PobSkillSet { title: string; groups: PobGroup[] }
export interface PobSpec { title: string; nodes: number[]; ascendancy: string | null }
export interface PobBuild {
  className: string
  ascendancy: string | null
  level: number
  specs: PobSpec[]
  skillSets: PobSkillSet[]
}

export function codeToBytes(code: string): Uint8Array {
  const clean = code.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  return Uint8Array.from(Buffer.from(padded, 'base64'))
}

/** Accepts a raw PoB code or a pobb.in link; returns either the code or the link id. */
export function classifyImport(text: string): { kind: 'pobbin'; id: string } | { kind: 'code'; code: string } | { kind: 'guide'; text: string } | null {
  const t = text.trim()
  const link = t.match(/^https?:\/\/pobb\.in\/([A-Za-z0-9_-]+)\/?$/)
  if (link) return { kind: 'pobbin', id: link[1]! }
  if (/^[A-Za-z0-9+/=_-]{60,}$/.test(t)) return { kind: 'code', code: t }
  if (/\{enter\|/.test(t) || /^#section/m.test(t)) return { kind: 'guide', text: t }
  return null
}

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

const ASCENDANCY_BY_CLASS: Record<string, string[]> = {
  Scion: ['Ascendant'], Marauder: ['Juggernaut', 'Berserker', 'Chieftain'], Ranger: ['Raider', 'Deadeye', 'Pathfinder'],
  Witch: ['Occultist', 'Elementalist', 'Necromancer'], Duelist: ['Slayer', 'Gladiator', 'Champion'],
  Templar: ['Inquisitor', 'Hierophant', 'Guardian'], Shadow: ['Assassin', 'Trickster', 'Saboteur']
}

export function parsePobXml(xml: string): PobBuild {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false })
  const doc = p.parse(xml)
  const root = doc.PathOfBuilding
  if (!root?.Build) throw new Error('not a Path of Building export')
  const b = root.Build
  const className = String(b.className ?? '')
  const ascendancy = b.ascendClassName && b.ascendClassName !== 'None' ? String(b.ascendClassName) : null

  const parseGroup = (s: any): PobGroup => ({
    label: String(s.label ?? ''),
    slot: String(s.slot ?? ''),
    enabled: s.enabled !== 'false',
    gems: arr(s.Gem).map((g: any) => ({
      name: String(g.nameSpec ?? g.skillId ?? ''),
      gemId: g.gemId ? String(g.gemId) : null,
      level: Number(g.level ?? 1),
      quality: Number(g.quality ?? 0),
      enabled: g.enabled !== 'false'
    })).filter((g: PobGem) => g.name)
  })

  const skills = root.Skills ?? {}
  const sets = arr(skills.SkillSet)
  const skillSets: PobSkillSet[] = sets.length
    ? sets.map((s: any, i: number) => ({ title: String(s.title ?? `Set ${i + 1}`), groups: arr(s.Skill).map(parseGroup) }))
    : [{ title: 'Default', groups: arr(skills.Skill).map(parseGroup) }]

  const specs: PobSpec[] = arr(root.Tree?.Spec).map((s: any, i: number) => {
    const ascId = Number(s.ascendClassId ?? 0)
    return {
      title: String(s.title ?? `Tree ${i + 1}`),
      nodes: String(s.nodes ?? '').split(',').map(Number).filter(n => Number.isFinite(n) && n > 0),
      ascendancy: ascId > 0 ? ASCENDANCY_BY_CLASS[className]?.[ascId - 1] ?? ascendancy : null
    }
  })
  return { className, ascendancy, level: Number(b.level ?? 1), specs, skillSets }
}

/** Every distinct gem in the build, in the order it first appears. */
export function buildGems(b: PobBuild): PobGem[] {
  const seen = new Map<string, PobGem>()
  for (const set of b.skillSets) for (const g of set.groups) for (const gem of g.gems) {
    const key = gem.gemId ?? gem.name
    if (!seen.has(key)) seen.set(key, gem)
  }
  return [...seen.values()]
}

/** Skill groups (across all skill sets) that contain a gem with this name. */
export function groupsWithGem(b: PobBuild, gemName: string): { set: string; group: PobGroup }[] {
  const norm = (s: string) => s.toLowerCase().replace(/ support$/, '').trim()
  const target = norm(gemName)
  const out: { set: string; group: PobGroup }[] = []
  for (const set of b.skillSets) for (const group of set.groups) {
    if (group.gems.some(g => norm(g.name) === target)) out.push({ set: set.title, group })
  }
  return out
}
