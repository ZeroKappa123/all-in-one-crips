import type { AssayApi } from '../../preload/index'
declare global {
  interface Window { assay: AssayApi }
}
export {}
