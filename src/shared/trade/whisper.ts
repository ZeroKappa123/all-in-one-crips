/**
 * Trade whispers and related game messages from Client.txt (PoE 1, English client).
 * The whisper wording is the one the official trade site generates:
 *
 *   @From <GLD> Buyer: Hi, I would like to buy your Tabula Rasa Simple Robe listed for 10 chaos in Mercenaries (stash tab "Sale"; position: left 5, top 3) see you
 *   @From Buyer: Hi, I'd like to buy your 50 Chaos Orb for my 1 Divine Orb in Mercenaries.
 *   @To Seller: Hi, I would like to buy your ...                     (an offer you sent)
 *   : Buyer has joined the area.   : Buyer has left the area.
 *   : Trade accepted.   : Trade cancelled.   : 12 monsters remain.
 */
export interface TradeOffer {
  direction: 'incoming' | 'outgoing'
  player: string
  item: string
  quantity: number | null // bulk: amount of the item
  price: { amount: number; currency: string } | null // currency: trade id (chaos, divine) or full name for bulk
  league: string
  stash: { tab: string; left: number; top: number } | null
  note: string // anything the player wrote after the generated text
  raw: string // the full message, used to resend an offer
  at: number
}

export type TradeLogEvent =
  | { kind: 'offer'; offer: TradeOffer }
  | { kind: 'joined'; player: string; at: number }
  | { kind: 'left'; player: string; at: number }
  | { kind: 'tradeAccepted'; at: number }
  | { kind: 'tradeCancelled'; at: number }
  | { kind: 'monsters'; count: number; more: boolean; at: number }

const STAMP = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/
const WHISPER = /\] @(From|To) (?:<[^>]*> )?([^:]+): (.*)$/
// With a stash position the league ends at "(stash tab"; anything after ")" is the buyer's own note.
const SINGLE_STASH = /^Hi, I would like to buy your (.+?)(?: listed for ([\d.,]+) (\S+))? in (.+?) \(stash tab "(.*)"; position: left (\d+), top (\d+)\)\s*(.*)$/
// Without one, the rest of the line is the league (league names contain spaces).
const SINGLE_PLAIN = /^Hi, I would like to buy your (.+?)(?: listed for ([\d.,]+) (\S+))? in (.+?)[.!]?$/
const BULK = /^Hi, I'd like to buy your ([\d.,]+) (.+?) for my ([\d.,]+) (.+?) in (.+?)\.\s*(.*)$/
const JOINED = /\] : (\S+) has joined the area\.$/
const LEFT = /\] : (\S+) has left the area\.$/
const MONSTERS = /\] : (More than )?(\d+) monsters? remains?\.$/

function time(line: string): number {
  const s = STAMP.exec(line)
  if (!s) return 0
  return new Date(+s[1]!, +s[2]! - 1, +s[3]!, +s[4]!, +s[5]!, +s[6]!).getTime()
}

const num = (s: string) => Number(s.replace(',', '.'))

/** Parses only the text after "@From Name: " / "@To Name: ". */
export function parseOfferText(direction: TradeOffer['direction'], player: string, text: string, at = 0): TradeOffer | null {
  let m = BULK.exec(text)
  if (m) {
    return {
      direction, player, item: m[2]!, quantity: num(m[1]!), price: { amount: num(m[3]!), currency: m[4]! },
      league: m[5]!, stash: null, note: m[6]!.trim(), raw: text, at
    }
  }
  m = SINGLE_STASH.exec(text)
  if (m) {
    return {
      direction, player, item: m[1]!, quantity: null,
      price: m[2] ? { amount: num(m[2]), currency: m[3]! } : null,
      league: m[4]!, stash: { tab: m[5]!, left: Number(m[6]), top: Number(m[7]) },
      note: m[8]!.trim(), raw: text, at
    }
  }
  m = SINGLE_PLAIN.exec(text)
  if (!m) return null
  return {
    direction, player, item: m[1]!, quantity: null,
    price: m[2] ? { amount: num(m[2]), currency: m[3]! } : null,
    league: m[4]!, stash: null, note: '', raw: text, at
  }
}

export function parseTradeLine(line: string): TradeLogEvent | null {
  const at = time(line)
  if (!at) return null
  let m: RegExpExecArray | null
  if ((m = WHISPER.exec(line))) {
    const offer = parseOfferText(m[1] === 'From' ? 'incoming' : 'outgoing', m[2]!.trim(), m[3]!, at)
    return offer ? { kind: 'offer', offer } : null
  }
  if ((m = JOINED.exec(line))) return { kind: 'joined', player: m[1]!, at }
  if ((m = LEFT.exec(line))) return { kind: 'left', player: m[1]!, at }
  if (line.endsWith('] : Trade accepted.')) return { kind: 'tradeAccepted', at }
  if (line.endsWith('] : Trade cancelled.')) return { kind: 'tradeCancelled', at }
  if ((m = MONSTERS.exec(line))) return { kind: 'monsters', count: Number(m[2]), more: !!m[1], at }
  return null
}

/** A whisper the trade site copied to the clipboard: "@Seller Hi, I would like to buy …". */
export function clipboardWhisper(text: string): { player: string; message: string } | null {
  const m = /^@(\S+) (Hi, I(?: would|'d) like to buy your .+)$/s.exec(text.trim())
  if (!m || m[2]!.length > 400 || m[2]!.includes('\n')) return null
  return { player: m[1]!, message: text.trim() }
}

/** Fills {Buyer} {Seller} {Item} {Price} {League} in a message template. */
export function fillTemplate(template: string, o: TradeOffer): string {
  const price = o.price ? `${o.price.amount} ${o.price.currency}` : ''
  const item = o.quantity ? `${o.quantity} ${o.item}` : o.item
  return template
    .replace(/\{Buyer\}|\{Seller\}|\{Player\}/g, o.player)
    .replace(/\{Item\}/g, item)
    .replace(/\{Price\}/g, price)
    .replace(/\{League\}/g, o.league)
}

/** Stash cell to highlight: normal tabs are 12×12, quad tabs 24×24 (positions above 12 imply a quad tab). */
export function stashGrid(stash: { left: number; top: number }, quad: boolean | 'auto'): { size: 12 | 24; col: number; row: number } {
  const size = quad === true || (quad === 'auto' && (stash.left > 12 || stash.top > 12)) ? 24 : 12
  return { size, col: Math.min(size, Math.max(1, stash.left)) - 1, row: Math.min(size, Math.max(1, stash.top)) - 1 }
}

export const DEFAULT_MESSAGES = {
  busy: "I'm busy right now, I'll send you a party invite when I'm ready.",
  sold: 'Sorry, my {Item} is already sold.',
  stillInterested: 'Are you still interested in my {Item} listed for {Price}?',
  thanks: 'Thank you, good luck!'
}
