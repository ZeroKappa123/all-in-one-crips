import { fullRect, wideRect, toggleRect, moveRect, isWide, hasFrame, withoutFrame, FRAME_BITS } from '@shared/widescreen'
import { DEFAULT_CONFIG, KeyCombo, loadConfig, findConflict } from '@shared/config'

const screen = { x: 0, y: 0, width: 2560, height: 1440 }
const opts = { zoom: 1.35, anchorTop: false }

describe('widescreen geometry', () => {
  it('makes a lower, full-width window slightly below the top', () => {
    const r = wideRect(screen, opts)
    expect(r).toEqual({ x: 0, y: 120, width: 2560, height: 1067 })
    expect(wideRect(screen, { ...opts, anchorTop: true }).y).toBe(0)
  })
  it('toggles between full screen and wide', () => {
    const wide = toggleRect(fullRect(screen), screen, opts)
    expect(isWide(wide, screen)).toBe(true)
    expect(toggleRect(wide, screen, opts)).toEqual(fullRect(screen))
  })
  it('moves in 1/36 steps or single pixels and stays on screen', () => {
    const wide = wideRect(screen, opts)
    expect(moveRect(wide, screen, 'up', false).y).toBe(80)
    expect(moveRect(wide, screen, 'down', true).y).toBe(121)
    expect(moveRect({ ...wide, y: 0 }, screen, 'up', false).y).toBe(0)
    expect(moveRect({ ...wide, y: 373 }, screen, 'down', false).y).toBe(373)
  })
  it('works on a second monitor and clamps the wideness', () => {
    const right = { x: 2560, y: 0, width: 1920, height: 1080 }
    expect(wideRect(right, opts).x).toBe(2560)
    expect(wideRect(right, { ...opts, zoom: 9 }).height).toBe(540) // max factor 2
  })
  it('removes only title bar and border bits', () => {
    const style = 0x16cf0000
    expect(hasFrame(style)).toBe(true)
    expect(hasFrame(withoutFrame(style))).toBe(false)
    expect(withoutFrame(style) | FRAME_BITS).toBe(style | FRAME_BITS)
  })
})

describe('widescreen settings', () => {
  it('is off by default with the usual keys, and older settings get it added', () => {
    expect(DEFAULT_CONFIG.widescreen).toEqual({ enabled: false, wide: false, zoom: 1.35, anchorTop: false })
    const { widescreen: _w, ...old } = DEFAULT_CONFIG
    const loaded = loadConfig({ ...old, hotkeys: old.hotkeys.filter(h => !h.action.startsWith('wide')) }).config
    expect(loaded.widescreen.enabled).toBe(false)
    expect(loaded.hotkeys.find(h => h.action === 'wideToggle')?.keys).toBe('F2')
  })
  it('accepts arrow keys and finds conflicts', () => {
    expect(KeyCombo.safeParse('Ctrl+Up').success).toBe(true)
    expect(KeyCombo.safeParse('Shift+Down').success).toBe(true)
    expect(findConflict(DEFAULT_CONFIG, 'F2')).toBe('wideToggle')
  })
})
