import { parseTradeLine, parseOfferText, clipboardWhisper, fillTemplate, stashGrid } from '@shared/trade/whisper'

const L = (s: string) => `2026/11/03 18:00:00 1 a [INFO Client 1] ${s}`

describe('trade whispers', () => {
  it('reads an incoming single-item offer with stash position and a note', () => {
    const e = parseTradeLine(L('@From <GLD> Buyer_One: Hi, I would like to buy your Tabula Rasa Simple Robe listed for 10 chaos in Mercenaries (stash tab "Sale"; position: left 5, top 3) see you'))
    expect(e).toMatchObject({ kind: 'offer', offer: {
      direction: 'incoming', player: 'Buyer_One', item: 'Tabula Rasa Simple Robe', price: { amount: 10, currency: 'chaos' },
      league: 'Mercenaries', stash: { tab: 'Sale', left: 5, top: 3 }, note: 'see you'
    } })
  })
  it('reads bulk offers and offers without price or stash', () => {
    expect(parseOfferText('incoming', 'B', "Hi, I'd like to buy your 50 Chaos Orb for my 1 Divine Orb in Mercenaries.")).toMatchObject({
      item: 'Chaos Orb', quantity: 50, price: { amount: 1, currency: 'Divine Orb' }, league: 'Mercenaries'
    })
    expect(parseOfferText('incoming', 'B', 'Hi, I would like to buy your Goldrim Leather Cap in Standard')).toMatchObject({ item: 'Goldrim Leather Cap', price: null, stash: null })
    expect(parseOfferText('incoming', 'B', 'Hi, I would like to buy your Goldrim listed for 3 chaos in Hardcore Mercenaries')).toMatchObject({ league: 'Hardcore Mercenaries', note: '' })
    expect(parseOfferText('incoming', 'B', 'Hi, I would like to buy your Map listed for 1.5 divine in Standard (stash tab "~b/o 1.5 divine"; position: left 20, top 1)'))
      .toMatchObject({ price: { amount: 1.5, currency: 'divine' }, stash: { tab: '~b/o 1.5 divine', left: 20, top: 1 } })
  })
  it('reads offers you sent', () => {
    const e = parseTradeLine(L('@To Seller: Hi, I would like to buy your Goldrim Leather Cap listed for 3 chaos in Standard (stash tab "x"; position: left 1, top 1)'))
    expect(e).toMatchObject({ kind: 'offer', offer: { direction: 'outgoing', player: 'Seller' } })
  })
  it('ignores normal whispers and reads area and trade events', () => {
    expect(parseTradeLine(L('@From Friend: hey, party?'))).toBeNull()
    expect(parseTradeLine(L(': Buyer_One has joined the area.'))).toMatchObject({ kind: 'joined', player: 'Buyer_One' })
    expect(parseTradeLine(L(': Buyer_One has left the area.'))).toMatchObject({ kind: 'left' })
    expect(parseTradeLine(L(': Trade accepted.'))).toMatchObject({ kind: 'tradeAccepted' })
    expect(parseTradeLine(L(': Trade cancelled.'))).toMatchObject({ kind: 'tradeCancelled' })
    expect(parseTradeLine(L(': 12 monsters remain.'))).toMatchObject({ kind: 'monsters', count: 12, more: false })
    expect(parseTradeLine(L(': 1 monster remains.'))).toMatchObject({ count: 1 })
    expect(parseTradeLine(L(': More than 50 monsters remain.'))).toMatchObject({ count: 50, more: true })
    expect(parseTradeLine('no stamp')).toBeNull()
  })
  it('recognises whispers copied from trade sites', () => {
    expect(clipboardWhisper('@Seller Hi, I would like to buy your Goldrim listed for 3 chaos in Standard')).toMatchObject({ player: 'Seller' })
    expect(clipboardWhisper("@Seller Hi, I'd like to buy your 5 Chaos Orb for my 1 Divine Orb in Standard.")).not.toBeNull()
    expect(clipboardWhisper('@Friend hello')).toBeNull()
    expect(clipboardWhisper('Hi, I would like to buy your x')).toBeNull()
  })
  it('fills message templates and finds the stash cell', () => {
    const o = parseOfferText('incoming', 'Buyer', 'Hi, I would like to buy your Goldrim listed for 3 chaos in Standard')!
    expect(fillTemplate('{Buyer}: my {Item} for {Price} in {League}', o)).toBe('Buyer: my Goldrim for 3 chaos in Standard')
    expect(stashGrid({ left: 5, top: 3 }, 'auto')).toEqual({ size: 12, col: 4, row: 2 })
    expect(stashGrid({ left: 20, top: 1 }, 'auto')).toEqual({ size: 24, col: 19, row: 0 })
    expect(stashGrid({ left: 5, top: 3 }, true).size).toBe(24)
  })
})
