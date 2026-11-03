import { contextBridge, ipcRenderer } from 'electron'
import type { Config } from '@shared/config'
import type { SearchBody } from '@shared/trade/query'
import type { League, Listing, ParsedItem, PriceSnapshot, TradeStat } from '@shared/types'

export type Result<T> = { ok: true; data: T } | { ok: false; error: { kind: string; detail?: string; retryInSec?: number } }

const api = {
  getConfig: (): Promise<{ config: Config; repaired: boolean; inputMode: 'hook' | 'fallback'; dataDir: string }> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
  stats: (): Promise<Result<TradeStat[]>> => ipcRenderer.invoke('data:stats'),
  leagues: (): Promise<Result<League[]>> => ipcRenderer.invoke('data:leagues'),
  search: (league: string, body: SearchBody): Promise<Result<{ id: string; total: number; result: string[] }>> => ipcRenderer.invoke('trade:search', league, body),
  fetch: (id: string, ids: string[]): Promise<Result<Listing[]>> => ipcRenderer.invoke('trade:fetch', id, ids),
  aggregate: (item: ParsedItem): Promise<Result<PriceSnapshot | null>> => ipcRenderer.invoke('prices:aggregate', item),
  logs: (): Promise<{ at: string; level: string; msg: string }[]> => ipcRenderer.invoke('logs:get'),
  hidePanel: () => ipcRenderer.send('panel:hide'),
  resizePanel: (h: number) => ipcRenderer.send('panel:resize', h),
  hideOverlay: () => ipcRenderer.send('overlay:hide'),
  openSettings: () => ipcRenderer.send('settings:open'),
  openExternal: (url: string) => ipcRenderer.send('shell:open', url),
  quit: () => ipcRenderer.send('app:quit'),
  onItem: (cb: (p: { text: string; locked: boolean }) => void) => {
    const fn = (_: unknown, p: { text: string; locked: boolean }) => cb(p)
    ipcRenderer.on('item:checked', fn)
    return () => { ipcRenderer.removeListener('item:checked', fn) }
  },
  onConfig: (cb: (c: Config) => void) => {
    const fn = (_: unknown, c: Config) => cb(c)
    ipcRenderer.on('config:changed', fn)
    return () => { ipcRenderer.removeListener('config:changed', fn) }
  }
}

contextBridge.exposeInMainWorld('assay', api)
export type AssayApi = typeof api
