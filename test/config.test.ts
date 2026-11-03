import { loadConfig, DEFAULT_CONFIG, findConflict, expandChatCommand } from '@shared/config'
import { looksLikeItem } from '../src/main/input'

describe('config', () => {
  it('repairs broken or partial config', () => {
    expect(loadConfig(DEFAULT_CONFIG).repaired).toBe(false)
    expect(loadConfig({ leagueId: 'Hardcore' })).toMatchObject({ repaired: true, config: { leagueId: 'Hardcore' } })
    expect(loadConfig('nonsense').config).toEqual(DEFAULT_CONFIG)
    expect(loadConfig({ ...DEFAULT_CONFIG, searchTolerancePct: 400 }).config.searchTolerancePct).toBe(10)
  })
  it('finds hotkey conflicts across actions and chat commands', () => {
    expect(findConflict(DEFAULT_CONFIG, 'Ctrl+D')).toBe('priceCheck')
    expect(findConflict(DEFAULT_CONFIG, 'Ctrl+D', { action: 'priceCheck' })).toBeNull()
    expect(findConflict(DEFAULT_CONFIG, 'F5')).toBe('chat: /hideout')
    expect(findConflict(DEFAULT_CONFIG, 'F6')).toBeNull()
  })
  it('expands @last for whispers and commands', () => {
    expect(expandChatCommand('@last Good luck!', 'Tom')).toBe('@Tom Good luck!')
    expect(expandChatCommand('/invite @last', 'Tom')).toBe('/invite Tom')
    expect(expandChatCommand('/invite @last', null)).toBeNull()
    expect(expandChatCommand('/hideout', null)).toBe('/hideout')
  })
})

describe('clipboard', () => {
  it('recognises item text', () => {
    expect(looksLikeItem('Item Class: Boots\nRarity: Rare\nX')).toBe(true)
    expect(looksLikeItem('hello')).toBe(false)
  })
})

import { toUrl, safeIcon } from '../src/renderer/src/pricecheck/icons'
describe('appearance and icons', () => {
  it('defaults to dark, keeps older settings working', () => {
    expect(DEFAULT_CONFIG.theme).toBe('dark')
    const { theme: _t, ...old } = DEFAULT_CONFIG
    expect(loadConfig(old)).toMatchObject({ repaired: false, config: { theme: 'dark' } })
    expect(loadConfig({ ...DEFAULT_CONFIG, theme: 'light' }).config.theme).toBe('light')
  })
  it('only ever shows images from GGG’s image server', () => {
    expect(toUrl('/image/Art/2DItems/Currency/X.png')).toBe('https://web.poecdn.com/image/Art/2DItems/Currency/X.png')
    expect(safeIcon('https://web.poecdn.com/gen/image/a.png')).toBe('https://web.poecdn.com/gen/image/a.png')
    expect(safeIcon('https://evil.example/a.png')).toBeUndefined()
    expect(safeIcon(undefined)).toBeUndefined()
  })
})
