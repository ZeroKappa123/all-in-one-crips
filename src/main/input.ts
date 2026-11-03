import { clipboard, globalShortcut } from 'electron'
import type { Config, HotkeyAction } from '@shared/config'
import { log } from './log'

/**
 * Global input: hotkeys, the copy trick and chat commands.
 * The game is never touched directly – we only press keys a player could press and read the
 * clipboard. One keypress by the player causes at most one action in the game (game ToS).
 */
type Hook = typeof import('uiohook-napi')
let hook: Hook | null = null

export interface InputHandlers {
  onAction(action: HotkeyAction, ctx: { itemText?: string }): void
  onChat(index: number): void
}

interface Binding { ctrl: boolean; shift: boolean; alt: boolean; key: string }

export function parseCombo(keys: string): Binding {
  const parts = keys.split('+')
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: parts[parts.length - 1] ?? ''
  }
}

function keyName(h: Hook, keycode: number): string | null {
  for (const [name, code] of Object.entries(h.UiohookKey)) {
    if (code !== keycode) continue
    if (name === 'ArrowUp') return 'Up'
    if (name === 'ArrowDown') return 'Down'
    return name
  }
  return null
}

let config: Config | null = null
let lastInput = Date.now()
let shiftDown = false
export const lastInputAt = () => lastInput
/** Left/right Shift currently held (for cancelling automatic whispers). */
export const isShiftHeld = () => shiftDown
export const hookActive = () => !!hook
let handlers: InputHandlers | null = null
let busy = false

export function startInput(c: Config, h: InputHandlers): 'hook' | 'fallback' {
  config = c
  handlers = h
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hook = require('uiohook-napi') as Hook
    hook.uIOhook.on('keydown', e => { lastInput = Date.now(); shiftDown = !!e.shiftKey; onKey(e.keycode, !!e.ctrlKey, !!e.shiftKey, !!e.altKey) })
    hook.uIOhook.on('keyup', e => { shiftDown = !!e.shiftKey && e.keycode !== hook!.UiohookKey.Shift && e.keycode !== hook!.UiohookKey.ShiftRight })
    hook.uIOhook.on('wheel', e => { lastInput = Date.now(); onWheel(!!e.ctrlKey, e.rotation) })
    hook.uIOhook.on('mousedown', () => { lastInput = Date.now() })
    hook.uIOhook.on('mousemove', () => { lastInput = Date.now() })
    hook.uIOhook.start()
    log('info', 'input hook started')
    return 'hook'
  } catch (e) {
    log('warn', `input hook unavailable, using fallback shortcuts: ${String(e)}`)
    hook = null
    registerFallback()
    return 'fallback'
  }
}

export function updateInputConfig(c: Config): void {
  config = c
  if (!hook) registerFallback()
}

export function stopInput(): void {
  hook?.uIOhook.stop()
  globalShortcut.unregisterAll()
}

function matches(b: Binding, key: string, ctrl: boolean, shift: boolean, alt: boolean): boolean {
  return b.key === key && b.ctrl === ctrl && b.shift === shift && b.alt === alt
}

function onKey(keycode: number, ctrl: boolean, shift: boolean, alt: boolean): void {
  if (!hook || !config || !handlers) return
  const key = keyName(hook, keycode)
  if (!key) return
  for (const hk of config.hotkeys) {
    if (!hk.enabled || hk.action === 'stashScroll') continue
    if (matches(parseCombo(hk.keys), key, ctrl, shift, alt) && actionGate(hk.action)) { void runAction(hk.action, ctrl); return }
  }
  config.chatCommands.forEach((cmd, i) => {
    if (matches(parseCombo(cmd.keys), key, ctrl, shift, alt)) handlers!.onChat(i)
  })
}

function onWheel(ctrl: boolean, rotation: number): void {
  if (!hook || !config) return
  const hk = config.hotkeys.find(h => h.action === 'stashScroll')
  if (!hk?.enabled || !ctrl) return
  // Stash tabs switch with the arrow keys; one wheel notch = one tab.
  hook.uIOhook.keyTap(rotation > 0 ? hook.UiohookKey.ArrowRight : hook.UiohookKey.ArrowLeft)
}

async function runAction(action: HotkeyAction, ctrlHeld = false): Promise<void> {
  if (!handlers) return
  if (action === 'priceCheck' || action === 'priceCheckLocked' || action === 'wiki') {
    if (busy) return
    busy = true
    try {
      const itemText = await copyItemText(ctrlHeld)
      handlers.onAction(action, { itemText: itemText ?? undefined })
    } finally {
      busy = false
    }
    return
  }
  handlers.onAction(action, {})
}

/** Press Ctrl+C in the game, wait for the clipboard to change, read it, put the old content back. */
export async function copyItemText(ctrlHeld = false): Promise<string | null> {
  const before = clipboard.readText()
  clipboard.writeText('')
  if (hook) {
    const { uIOhook, UiohookKey } = hook
    // Alt or Shift held for the hotkey would turn Ctrl+C into something else in the game.
    uIOhook.keyToggle(UiohookKey.Alt, 'up')
    uIOhook.keyToggle(UiohookKey.Shift, 'up')
    // Ctrl+Alt+C copies the advanced item description (mod tiers and ranges), which the parser needs.
    // If the player already holds Ctrl (Ctrl+D), keep it; never release a Ctrl the player is still holding.
    if (!ctrlHeld) uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
    uIOhook.keyToggle(UiohookKey.Alt, 'down')
    uIOhook.keyTap(UiohookKey.C)
    uIOhook.keyToggle(UiohookKey.Alt, 'up')
    if (!ctrlHeld) uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  }
  let text = ''
  for (let i = 0; i < 15 && !text; i++) {
    await new Promise(r => setTimeout(r, 20))
    text = clipboard.readText()
  }
  // Without the hook (fallback mode) we can only read what the player copied themselves.
  if (!text && !hook) text = before
  if (text !== before) setTimeout(() => clipboard.writeText(before), 150)
  return text && looksLikeItem(text) ? text : null
}

/** Item text from the game always has a rarity line near the top. */
export function looksLikeItem(text: string): boolean {
  return /^(Item Class: .+\r?\n)?Rarity: /m.test(text.slice(0, 160))
}

/** Focuses the in-game search box (Ctrl+F) and pastes text into it. No server action involved. */
export async function pasteIntoSearch(text: string): Promise<void> {
  const before = clipboard.readText()
  clipboard.writeText(text)
  if (!hook) { log('warn', 'search paste needs the input hook; the string is on the clipboard'); return }
  const { uIOhook, UiohookKey } = hook
  for (const k of [UiohookKey.Shift, UiohookKey.Alt]) uIOhook.keyToggle(k, 'up')
  uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  uIOhook.keyTap(UiohookKey.F)
  uIOhook.keyTap(UiohookKey.A)
  uIOhook.keyTap(UiohookKey.V)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  setTimeout(() => clipboard.writeText(before), 200)
}

/** Opens chat, pastes one message, sends it. Never chains several messages. */
export async function sendChat(message: string): Promise<void> {
  if (!hook) { log('warn', 'chat commands need the input hook'); return }
  const before = clipboard.readText()
  clipboard.writeText(message)
  const { uIOhook, UiohookKey } = hook
  for (const k of [UiohookKey.Ctrl, UiohookKey.Shift, UiohookKey.Alt]) uIOhook.keyToggle(k, 'up')
  uIOhook.keyTap(UiohookKey.Enter)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  uIOhook.keyTap(UiohookKey.A) // replace anything already typed
  uIOhook.keyTap(UiohookKey.V)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  uIOhook.keyTap(UiohookKey.Enter)
  setTimeout(() => clipboard.writeText(before), 200)
}

function toAccelerator(keys: string): string {
  return keys.replace('Ctrl', 'CommandOrControl')
}

/** Actions that only exist while their feature is switched on (checked before they fire). */
let actionGate: (a: HotkeyAction) => boolean = () => true
export function setActionGate(fn: (a: HotkeyAction) => boolean): void { actionGate = fn }

function registerFallback(): void {
  globalShortcut.unregisterAll()
  if (!config || !handlers) return
  for (const hk of config.hotkeys) {
    if (!hk.enabled || hk.action === 'stashScroll' || !actionGate(hk.action)) continue // never grab keys of a switched-off feature
    try {
      globalShortcut.register(toAccelerator(hk.keys), () => void runAction(hk.action))
    } catch (e) {
      log('warn', `cannot register ${hk.keys}: ${String(e)}`)
    }
  }
}
