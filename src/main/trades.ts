import { clipboard, ipcMain } from 'electron'
import { clipboardWhisper, fillTemplate, parseTradeLine, type TradeOffer } from '@shared/trade/whisper'
import { getConfig } from './configStore'
import { isShiftHeld, sendChat } from './input'
import { log } from './log'
import { allWindows, getTradesWindow, showStashHighlight } from './windows'

/**
 * Trade helper (idea and click scheme after Poe-Lurker by C1rdec, MIT; own implementation).
 * Every click sends at most one chat command – the app never sends anything on its own,
 * except the optional auto-whisper, which fires once per whisper you copy on a trade site.
 */
export interface TradeCard extends TradeOffer {
  id: string
  state: 'new' | 'invited' | 'trading' | 'done'
  inArea: boolean
  active: boolean
}

let cards: TradeCard[] = []
let monsters: { count: number; more: boolean; at: number } | null = null
let seq = 0

function broadcast(): void {
  for (const w of allWindows()) w.webContents.send('trades:state', { cards, monsters })
}

function key(o: TradeOffer): string {
  return `${o.direction}|${o.player}|${o.item}|${o.price?.amount ?? ''}`
}

export function onTradeLines(lines: string[]): void {
  if (!getConfig().trades.enabled) return
  let changed = false
  for (const line of lines) {
    const e = parseTradeLine(line)
    if (!e) continue
    changed = true
    if (e.kind === 'offer') {
      const existing = cards.find(c => key(c) === key(e.offer))
      if (existing) { existing.at = e.offer.at; continue } // repeated whisper: keep one card
      const card: TradeCard = { ...e.offer, id: `t${++seq}`, state: 'new', inArea: false, active: false }
      if (card.direction === 'incoming' && !cards.some(c => c.direction === 'incoming')) card.active = true
      cards.push(card)
      if (card.direction === 'incoming') getTradesWindow(true).webContents.send('trades:new')
      else getTradesWindow(true)
    } else if (e.kind === 'joined' || e.kind === 'left') {
      for (const c of cards) if (c.player === e.player) c.inArea = e.kind === 'joined'
    } else if (e.kind === 'tradeAccepted') {
      const c = cards.find(x => x.state === 'trading') ?? cards.find(x => x.active)
      if (c) c.state = 'done'
    } else if (e.kind === 'tradeCancelled') {
      const c = cards.find(x => x.state === 'trading')
      if (c) c.state = 'invited'
    } else if (e.kind === 'monsters') {
      monsters = { count: e.count, more: e.more, at: e.at }
    }
  }
  if (changed) broadcast()
}

export type TradeAction = 'invite' | 'trade' | 'busy' | 'sold' | 'stillInterested' | 'thanks' | 'kick' | 'whois' | 'hideout' | 'resend' | 'dismiss' | 'activate' | 'highlight'

/** One click = one action. */
export async function runTradeAction(id: string, action: TradeAction): Promise<void> {
  const c = cards.find(x => x.id === id)
  if (!c) return
  const msg = getConfig().trades.messages
  const whisper = (text: string) => `@${c.player} ${fillTemplate(text, c)}`
  switch (action) {
    case 'invite': await sendChat(`/invite ${c.player}`); c.state = 'invited'; break
    case 'trade': await sendChat(`/tradewith ${c.player}`); c.state = 'trading'; break
    case 'busy': await sendChat(whisper(msg.busy)); break
    case 'sold': await sendChat(whisper(msg.sold)); break
    case 'stillInterested': await sendChat(whisper(msg.stillInterested)); break
    case 'thanks': await sendChat(whisper(msg.thanks)); break
    case 'kick': await sendChat(`/kick ${c.player}`); remove(c.id); break
    case 'whois': await sendChat(`/whois ${c.player}`); break
    case 'hideout': await sendChat(`/hideout ${c.player}`); break
    case 'resend': await sendChat(`@${c.player} ${c.raw}`); break
    case 'dismiss': remove(c.id); break
    case 'activate': for (const x of cards) x.active = x.id === c.id; break
    case 'highlight': if (c.stash) showStashHighlight(c.stash, c.item); break
  }
  broadcast()
}

function remove(id: string): void {
  const wasActive = cards.find(c => c.id === id)?.active
  cards = cards.filter(c => c.id !== id)
  if (wasActive) { const next = cards.find(c => c.direction === 'incoming'); if (next) next.active = true }
}

/** Whispers copied on a trade site are sent into the game, unless Shift is held. */
let lastClip = ''
function watchClipboard(): void {
  setInterval(() => {
    const t = getConfig().trades
    if (!t.enabled || !t.autoWhisper) return
    const text = clipboard.readText()
    if (text === lastClip) return
    lastClip = text
    const w = clipboardWhisper(text)
    if (!w) return
    if (isShiftHeld()) { log('info', 'auto whisper skipped (Shift held)'); return }
    void sendChat(w.message)
  }, 400)
}

export function initTrades(): void {
  lastClip = clipboard.readText()
  watchClipboard()
  ipcMain.handle('trades:get', () => ({ cards, monsters }))
  ipcMain.handle('trades:action', (_e, id: string, action: TradeAction) => runTradeAction(id, action))
  ipcMain.handle('trades:clearDone', () => { cards = cards.filter(c => c.state !== 'done'); broadcast() })
  if (process.env.CRIPS_TRADES_DEMO) {
    // End-to-end tests: show cards as if whispers had arrived.
    setTimeout(() => onTradeLines(process.env.CRIPS_TRADES_DEMO!.split('\n')), 300)
  }
}
