import { z } from 'zod'

export const HOTKEY_ACTIONS = ['priceCheck', 'priceCheckLocked', 'overlay', 'wiki', 'stashScroll', 'guideToggle', 'guidePrev', 'guideNext', 'treeOverlay', 'gemSearch'] as const
export type HotkeyAction = (typeof HOTKEY_ACTIONS)[number]

/** Keys are written as "Ctrl+Alt+D": modifiers first (Ctrl, Shift, Alt), then one key. */
export const KeyCombo = z.string().regex(/^((Ctrl|Shift|Alt)\+){0,3}([A-Z0-9]|F([1-9]|1[0-2])|Space|Wheel)$/)

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
  showSellerStatus: z.boolean().default(true),
  ninjaBase: z.string().url(),
  hotkeys: z.array(Hotkey),
  chatCommands: z.array(ChatCommand),
  widgets: z.array(z.object({ type: z.enum(['stopwatch', 'settings']), x: z.number(), y: z.number(), visible: z.boolean() }))
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
    { action: 'gemSearch', keys: 'Alt+S', enabled: true }
  ],
  chatCommands: [
    { text: '/hideout', keys: 'F5' },
    { text: '/exit', keys: 'F9' }
  ],
  widgets: [
    { type: 'settings', x: 16, y: 16, visible: true },
    { type: 'stopwatch', x: 16, y: 72, visible: false }
  ]
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
  return missing.length ? { ...c, hotkeys: [...c.hotkeys, ...missing] } : c
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
