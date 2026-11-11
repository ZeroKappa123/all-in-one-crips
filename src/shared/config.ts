import { z } from 'zod'
import { DEFAULT_MESSAGES } from './trade/whisper'

export const HOTKEY_ACTIONS = ['priceCheck', 'priceCheckLocked', 'overlay', 'wiki', 'stashScroll', 'guideToggle', 'guidePrev', 'guideNext', 'treeOverlay', 'gemSearch', 'wideToggle', 'wideUp', 'wideDown', 'wideUpFine', 'wideDownFine'] as const
export type HotkeyAction = (typeof HOTKEY_ACTIONS)[number]

/** Keys are written as "Ctrl+Alt+D": modifiers first (Ctrl, Shift, Alt), then one key. */
/**
 * Vendor search strings that help while levelling. Path of Exile's search box takes regular
 * expressions in quotes and checks each line of an item (case does not matter).
 */
export const DEFAULT_OMNI_STRINGS = [
  { name: 'Movement speed', regex: '"nt speed"', enabled: true },
  { name: '3-link or more', regex: '"-\\w-"', enabled: true },
  { name: '4-link or more', regex: '"-\\w-\\w-"', enabled: true },
  { name: 'Red-green-blue link', regex: '"r-g-b|r-b-g|g-r-b|g-b-r|b-r-g|b-g-r"', enabled: true },
  { name: '+1 to gem levels', regex: '"to level of all"', enabled: true },
  { name: 'Physical damage weapon', regex: '"adds.*physical"', enabled: true }
]

export const KeyCombo = z.string().regex(/^((Ctrl|Shift|Alt)\+){0,3}([A-Z0-9]|F([1-9]|1[0-2])|Space|Wheel|Up|Down)$/)

const Hotkey = z.object({ action: z.enum(HOTKEY_ACTIONS), keys: KeyCombo, enabled: z.boolean() })
const ChatCommand = z.object({ text: z.string().min(1).max(200), keys: KeyCombo })

export const ConfigSchema = z.object({
  version: z.literal(1),
  leagueId: z.string(),
  windowTitle: z.string().min(1),
  searchTolerancePct: z.number().min(0).max(50),
  onlineOnly: z.boolean(),
  autoSearch: z.boolean().default(true),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  trades: z.object({
    enabled: z.boolean(),
    autoWhisper: z.boolean(),
    sound: z.boolean(),
    messages: z.object({ busy: z.string(), sold: z.string(), stillInterested: z.string(), thanks: z.string() }),
    stash: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(),
    quad: z.enum(['auto', 'normal', 'quad']),
    position: z.object({ x: z.number(), y: z.number() }).nullable()
  }).default({ enabled: true, autoWhisper: false, sound: true, messages: { ...DEFAULT_MESSAGES }, stash: null, quad: 'auto', position: null }),
  widescreen: z.object({ enabled: z.boolean(), wide: z.boolean(), zoom: z.number().min(1.05).max(2), anchorTop: z.boolean() })
    .default({ enabled: false, wide: false, zoom: 1.35, anchorTop: false }),
  dataUpdates: z.object({ auto: z.boolean() }).default({ auto: true }),
  /** Omni key (after Exile-UI): hold it at a vendor to pick a search string for the shop window. */
  omni: z.object({
    button: z.enum(['middle', 'mouse4', 'mouse5', 'off']),
    anywhere: z.boolean(), // also outside towns and hideouts
    strings: z.array(z.object({ name: z.string().min(1).max(40), regex: z.string().min(1).max(250), enabled: z.boolean() })).max(30)
  }).default({ button: 'middle', anywhere: false, strings: DEFAULT_OMNI_STRINGS }),
  showSellerStatus: z.boolean().default(true),
  ninjaBase: z.string().url(),
  hotkeys: z.array(Hotkey),
  chatCommands: z.array(ChatCommand),
  widgets: z.array(z.object({ type: z.enum(['stopwatch', 'settings', 'images']), x: z.number(), y: z.number(), visible: z.boolean() })),
  /** Pictures for the overlay's image strip (cheat sheets); files live in the data folder under images/. */
  images: z.array(z.object({ id: z.string(), file: z.string().regex(/^[a-z0-9-]+\.(png|jpg|jpeg|webp|gif)$/), name: z.string() })).default([])
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  version: 1,
  leagueId: 'Standard',
  windowTitle: 'Path of Exile',
  searchTolerancePct: 10,
  onlineOnly: true,
  autoSearch: true,
  theme: 'dark',
  widescreen: { enabled: false, wide: false, zoom: 1.35, anchorTop: false },
  dataUpdates: { auto: true },
  omni: { button: 'middle', anywhere: false, strings: DEFAULT_OMNI_STRINGS },
  trades: { enabled: true, autoWhisper: false, sound: true, messages: { ...DEFAULT_MESSAGES }, stash: null, quad: 'auto', position: null },
  showSellerStatus: true,
  ninjaBase: 'https://poe.ninja/api/data',
  hotkeys: [
    { action: 'priceCheck', keys: 'Ctrl+D', enabled: true },
    { action: 'priceCheckLocked', keys: 'Ctrl+Alt+D', enabled: true },
    { action: 'overlay', keys: 'Shift+Space', enabled: true },
    { action: 'wiki', keys: 'Alt+W', enabled: true },
    { action: 'stashScroll', keys: 'Ctrl+Wheel', enabled: true },
    { action: 'guideToggle', keys: 'Alt+G', enabled: true },
    { action: 'guidePrev', keys: 'F3', enabled: false },
    { action: 'guideNext', keys: 'F4', enabled: false },
    { action: 'treeOverlay', keys: 'Alt+T', enabled: true },
    { action: 'gemSearch', keys: 'Alt+S', enabled: true },
    { action: 'wideToggle', keys: 'F2', enabled: true },
    { action: 'wideUp', keys: 'Ctrl+Up', enabled: true },
    { action: 'wideDown', keys: 'Ctrl+Down', enabled: true },
    { action: 'wideUpFine', keys: 'Shift+Up', enabled: true },
    { action: 'wideDownFine', keys: 'Shift+Down', enabled: true }
  ],
  chatCommands: [
    { text: '/hideout', keys: 'F5' },
    { text: '/exit', keys: 'F9' }
  ],
  widgets: [
    { type: 'settings', x: 16, y: 16, visible: true },
    { type: 'stopwatch', x: 16, y: 72, visible: false },
    { type: 'images', x: 16, y: 128, visible: true }
  ],
  images: []
}

/** Accepts any stored JSON; anything invalid falls back to defaults, field by field where possible. */
export function loadConfig(raw: unknown): { config: Config; repaired: boolean } {
  const full = ConfigSchema.safeParse(raw)
  if (full.success) return { config: withNewHotkeys(full.data), repaired: false }
  const merged = { ...DEFAULT_CONFIG, ...(typeof raw === 'object' && raw ? raw : {}) }
  const second = ConfigSchema.safeParse(merged)
  if (second.success) return { config: withNewHotkeys(second.data), repaired: true }
  return { config: structuredClone(DEFAULT_CONFIG), repaired: true }
}

/** Settings saved by an older version get the hotkeys added since, with their defaults. */
function withNewHotkeys(c: Config): Config {
  const missing = DEFAULT_CONFIG.hotkeys.filter(d => !c.hotkeys.some(h => h.action === d.action))
  const widgets = DEFAULT_CONFIG.widgets.filter(d => !c.widgets.some(w => w.type === d.type))
  return missing.length || widgets.length ? { ...c, hotkeys: [...c.hotkeys, ...missing], widgets: [...c.widgets, ...widgets] } : c
}

/** Returns the action already bound to these keys, if any (chat commands included). */
export function findConflict(config: Config, keys: string, except?: { action?: HotkeyAction; chatIndex?: number }): string | null {
  for (const h of config.hotkeys) {
    if (h.enabled && h.keys === keys && h.action !== except?.action) return h.action
  }
  for (const [i, c] of config.chatCommands.entries()) {
    if (c.keys === keys && i !== except?.chatIndex) return `chat: ${c.text}`
  }
  return null
}

/** "@last" is replaced by the last whisper partner. Only one message per keypress, never chains. */
export function expandChatCommand(text: string, lastWhisper: string | null): string | null {
  if (!text.includes('@last')) return text
  if (!lastWhisper) return null
  if (text.startsWith('@last')) return '@' + lastWhisper + text.slice(5)
  return text.replace(/@last\b/g, lastWhisper)
}
