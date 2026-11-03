/**
 * Widescreen mode for the game window: borderless full screen, or a lower window that shows
 * a wider picture. Idea and default values after the "PoE Widescreen" AutoHotkey script by Mikey;
 * this is an independent implementation without AutoHotkey.
 */
export interface Rect { x: number; y: number; width: number; height: number }
export interface Screen { x: number; y: number; width: number; height: number }

export interface WidescreenOptions {
  zoom: number // window height = screen height / zoom (higher = wider picture)
  anchorTop: boolean // put the narrow window at the top edge instead of slightly below it
}

export const DEFAULT_ZOOM = 1.35
export const ZOOM_RANGE = { min: 1.05, max: 2 }

/** Borderless window covering the whole screen. */
export function fullRect(s: Screen): Rect {
  return { x: s.x, y: s.y, width: s.width, height: s.height }
}

/** The lower, wide window: full width, height divided by the zoom factor. */
export function wideRect(s: Screen, o: WidescreenOptions): Rect {
  const zoom = clamp(o.zoom, ZOOM_RANGE.min, ZOOM_RANGE.max)
  const height = Math.round(s.height / zoom)
  const offset = o.anchorTop ? 0 : Math.round(s.height / 12)
  return { x: s.x, y: s.y + Math.min(offset, s.height - height), width: s.width, height }
}

/** A window as tall as the screen counts as normal; anything lower counts as wide. */
export function isWide(current: Rect, s: Screen): boolean {
  return current.height < s.height - 1
}

/** The rect after pressing the toggle key. */
export function toggleRect(current: Rect, s: Screen, o: WidescreenOptions): Rect {
  return isWide(current, s) ? fullRect(s) : wideRect(s, o)
}

/** Move the window up or down; big steps are 1/36 of the screen height, small steps 1 pixel. Stays on screen. */
export function moveRect(current: Rect, s: Screen, direction: 'up' | 'down', fine: boolean): Rect {
  const step = fine ? 1 : Math.round(s.height / 36)
  const y = current.y + (direction === 'up' ? -step : step)
  return { ...current, y: clamp(y, s.y, s.y + s.height - current.height) }
}

/** Window style bits for the title bar and resizable border (WS_CAPTION | WS_THICKFRAME). */
export const FRAME_BITS = 0x00c00000 | 0x00040000

export function hasFrame(style: number): boolean {
  return (style & FRAME_BITS) !== 0
}

export function withoutFrame(style: number): number {
  return style & ~FRAME_BITS
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
