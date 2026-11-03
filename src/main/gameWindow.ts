import type { Rect } from '@shared/widescreen'
import { log } from './log'

/**
 * Moves and resizes the game's window through the Windows API (user32.dll).
 * Only the window frame is touched – never the game process or its memory.
 * On other systems every call reports that the feature isn't available.
 */
export interface GameWindowApi {
  find(className: string, title: string): bigint | null
  rect(hwnd: bigint): Rect | null
  style(hwnd: bigint): number
  setStyle(hwnd: bigint, style: number): void
  move(hwnd: bigint, r: Rect): boolean
}

let api: GameWindowApi | null | undefined

export function gameWindowApi(): GameWindowApi | null {
  if (api !== undefined) return api
  if (process.platform !== 'win32') { api = null; return api }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi')
    const user32 = koffi.load('user32.dll')
    const RECT = koffi.struct('CRIPS_RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
    const FindWindowW = user32.func('intptr __stdcall FindWindowW(str16 cls, str16 title)')
    const GetWindowRect = user32.func('bool __stdcall GetWindowRect(intptr hwnd, _Out_ CRIPS_RECT *rect)')
    const GetWindowLongPtrW = user32.func('intptr __stdcall GetWindowLongPtrW(intptr hwnd, int index)')
    const SetWindowLongPtrW = user32.func('intptr __stdcall SetWindowLongPtrW(intptr hwnd, int index, intptr value)')
    const SetWindowPos = user32.func('bool __stdcall SetWindowPos(intptr hwnd, intptr after, int x, int y, int cx, int cy, uint flags)')
    void RECT
    const GWL_STYLE = -16
    const SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010, SWP_FRAMECHANGED = 0x0020
    api = {
      find(cls, title) {
        const h = BigInt(FindWindowW(cls, null) || 0) || BigInt(FindWindowW(null, title) || 0)
        return h === 0n ? null : h
      },
      rect(hwnd) {
        const r = { left: 0, top: 0, right: 0, bottom: 0 }
        if (!GetWindowRect(hwnd, r)) return null
        return { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }
      },
      style(hwnd) { return Number(BigInt(GetWindowLongPtrW(hwnd, GWL_STYLE)) & 0xffffffffn) },
      setStyle(hwnd, style) { SetWindowLongPtrW(hwnd, GWL_STYLE, style) },
      move(hwnd, r) { return !!SetWindowPos(hwnd, 0, r.x, r.y, r.width, r.height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED) }
    }
  } catch (e) {
    log('warn', `window control unavailable: ${String(e)}`)
    api = null
  }
  return api
}

/** For tests: replace the Windows API with a fake. */
export function setGameWindowApi(fake: GameWindowApi | null): void {
  api = fake
}
