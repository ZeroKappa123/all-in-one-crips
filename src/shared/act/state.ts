import { z } from 'zod'
import type { PobBuild } from './pob'
import { newTimer, type TimerState } from './timer'

const RouteOptionsSchema = z.object({
  leagueStart: z.boolean(),
  optionals: z.boolean(),
  bandit: z.enum(['kill', 'alira', 'kraityn', 'oak']),
  library: z.boolean()
})

const SlotSchema = z.object({
  id: z.string(),
  name: z.string(),
  info: z.string(),
  guide: z.string().nullable(), // null = shipped default route
  options: RouteOptionsSchema,
  gemQuests: z.enum(['off', 'build', 'all']),
  character: z.string(),
  pob: z.any().nullable(),
  gemOverrides: z.record(z.object({ removed: z.boolean().optional(), notBeforeAct: z.number().optional() })),
  page: z.number().int().min(0)
})

export const ActStoreSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  logPath: z.string().nullable(),
  activeSlot: z.number().int().min(0),
  slots: z.array(SlotSchema),
  timerEnabled: z.boolean(),
  timerHideoutPause: z.boolean(),
  timer: z.any(),
  overlay: z.object({ x: z.number().nullable(), y: z.number().nullable(), visible: z.boolean(), fontScale: z.number().min(0.7).max(1.6), opacity: z.number().min(0.4).max(1) }),
  gear: z.array(z.object({ id: z.string(), name: z.string(), level: z.number(), kind: z.enum(['item', 'gem']) })),
  treeImages: z.array(z.object({ file: z.string(), caption: z.string() })),
  treeImageIndex: z.number().int().min(0),
  treeView: z.object({ x: z.number(), y: z.number(), scale: z.number() })
})

export type Slot = Omit<z.infer<typeof SlotSchema>, 'pob'> & { pob: PobBuild | null }
export type ActStore = Omit<z.infer<typeof ActStoreSchema>, 'slots' | 'timer'> & { slots: Slot[]; timer: TimerState }

export function newSlot(n: number): Slot {
  return {
    id: `slot-${Date.now().toString(36)}-${n}`,
    name: `Guide ${n}`,
    info: '',
    guide: null,
    options: { leagueStart: true, optionals: false, bandit: 'kill', library: true },
    gemQuests: 'build',
    character: '',
    pob: null,
    gemOverrides: {},
    page: 0
  }
}

export function defaultActStore(): ActStore {
  return {
    version: 1,
    enabled: true,
    logPath: null,
    activeSlot: 0,
    slots: [newSlot(1)],
    timerEnabled: true,
    timerHideoutPause: true,
    timer: newTimer(),
    overlay: { x: null, y: null, visible: true, fontScale: 1, opacity: 0.92 },
    gear: [],
    treeImages: [],
    treeImageIndex: 0,
    treeView: { x: 0, y: 0, scale: 0.08 }
  }
}

export function loadActStore(raw: unknown): ActStore {
  const merged = { ...defaultActStore(), ...(raw && typeof raw === 'object' ? raw : {}) }
  const r = ActStoreSchema.safeParse(merged)
  if (!r.success) return defaultActStore()
  const s = r.data as ActStore
  if (!s.slots.length) s.slots = [newSlot(1)]
  s.activeSlot = Math.min(s.activeSlot, s.slots.length - 1)
  return s
}

/** What the log tells us right now; not persisted. */
export interface ActLive {
  logStatus: 'ok' | 'missing' | 'searching'
  logPath: string | null
  areaId: string | null
  areaLevel: number | null
  levels: Record<string, number>
  afk: boolean
  idle: boolean
  lastWhisper: string | null
}
