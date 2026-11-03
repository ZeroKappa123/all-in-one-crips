import type { Page } from './route'

/**
 * Guide progress. Only the target of the current page moves the guide forward on its own;
 * the player never gets skipped ahead by walking through an area the route visits later.
 */
export interface GuideState { page: number }

export function onAreaEntered(pages: Page[], state: GuideState, area: string): GuideState {
  const p = pages[state.page]
  if (p?.target && p.target === area && state.page < pages.length - 1) return { page: state.page + 1 }
  return state
}

/** "Fast-forward": the page that follows the next visit of the current area. */
export function jumpToArea(pages: Page[], state: GuideState, area: string): GuideState {
  const find = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (pages[i]?.target === area) return i
    return -1
  }
  let i = find(state.page, pages.length)
  if (i < 0) i = find(0, state.page)
  if (i < 0) return state
  return { page: Math.min(i + 1, pages.length - 1) }
}

export function step(pages: Page[], state: GuideState, delta: number): GuideState {
  return { page: Math.max(0, Math.min(pages.length - 1, state.page + delta)) }
}

export function clampState(pages: Page[], state: GuideState): GuideState {
  return { page: Math.max(0, Math.min(Math.max(0, pages.length - 1), state.page)) }
}
