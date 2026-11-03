import type { CripsApi } from '../../preload/index'
declare global {
  interface Window { crips: CripsApi }
}
export {}
