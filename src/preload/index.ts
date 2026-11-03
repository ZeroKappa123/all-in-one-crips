import { contextBridge, ipcRenderer } from 'electron'
import type { Config } from '@shared/config'
import type { ActLive, ActStore, Slot } from '@shared/act/state'
import type { TradeCard, TradeAction } from '../main/trades'
import type { DataStatus } from '../main/dataUpdate'

export type Result<T> = { ok: true; data: T } | { ok: false; error: { kind: string; detail?: string; retryInSec?: number } }

const api = {
  proxy: (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; headers: Record<string, string>; body: string }> => ipcRenderer.invoke('crips:proxy', url, init),
  readData: (path: string, kind: 'text' | 'binary'): Promise<string | ArrayBuffer> => ipcRenderer.invoke('crips:data', path, kind),
  trades: {
    get: (): Promise<{ cards: TradeCard[]; monsters: { count: number; more: boolean; at: number } | null }> => ipcRenderer.invoke('trades:get'),
    action: (id: string, action: TradeAction): Promise<void> => ipcRenderer.invoke('trades:action', id, action),
    clearDone: (): Promise<void> => ipcRenderer.invoke('trades:clearDone'),
    interactive: (on: boolean) => ipcRenderer.send('trades:interactive', on),
    resize: (h: number) => ipcRenderer.send('trades:resize', h),
    show: () => ipcRenderer.send('trades:show'),
    isCalibrating: (): Promise<boolean> => ipcRenderer.invoke('stash:calibrating'),
    calibrate: (on: boolean) => ipcRenderer.send('stash:calibrate', on),
    hideStash: () => ipcRenderer.send('stash:hide'),
    onState: (cb: (s: { cards: TradeCard[]; monsters: { count: number; more: boolean; at: number } | null }) => void) => {
      const fn = (_: unknown, s: { cards: TradeCard[]; monsters: { count: number; more: boolean; at: number } | null }) => cb(s)
      ipcRenderer.on('trades:state', fn)
      return () => { ipcRenderer.removeListener('trades:state', fn) }
    },
    onNew: (cb: () => void) => { const fn = () => cb(); ipcRenderer.on('trades:new', fn); return () => { ipcRenderer.removeListener('trades:new', fn) } },
    onHighlight: (cb: (p: { stash: { tab: string; left: number; top: number }; item: string }) => void) => {
      const fn = (_: unknown, p: { stash: { tab: string; left: number; top: number }; item: string }) => cb(p)
      ipcRenderer.on('stash:highlight', fn)
      return () => { ipcRenderer.removeListener('stash:highlight', fn) }
    },
    onCalibrate: (cb: (on: boolean) => void) => { const fn = (_: unknown, on: boolean) => cb(on); ipcRenderer.on('stash:calibrate', fn); return () => { ipcRenderer.removeListener('stash:calibrate', fn) } }
  },
  widescreen: {
    status: (): Promise<{ supported: boolean; found: boolean; wide: boolean; enabled: boolean }> => ipcRenderer.invoke('widescreen:status'),
    setWide: (wide: boolean): Promise<{ supported: boolean; found: boolean; wide: boolean; enabled: boolean }> => ipcRenderer.invoke('widescreen:wide', wide),
    update: (patch: Partial<Config['widescreen']>): Promise<{ supported: boolean; found: boolean; wide: boolean; enabled: boolean }> => ipcRenderer.invoke('widescreen:update', patch)
  },
  images: {
    add: (): Promise<{ added: number; skipped: string[] }> => ipcRenderer.invoke('images:add'),
    get: (id: string): Promise<string | null> => ipcRenderer.invoke('images:get', id),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('images:remove', id)
  },
  data: {
    status: (): Promise<DataStatus> => ipcRenderer.invoke('data:status'),
    check: (): Promise<'updated' | 'current' | 'failed'> => ipcRenderer.invoke('data:check'),
    failed: (reason: string): void => ipcRenderer.send('data:failed', reason),
    onChanged: (cb: (s: DataStatus) => void) => { const h = (_: unknown, s: DataStatus) => cb(s); ipcRenderer.on('data:changed', h); return () => { ipcRenderer.off('data:changed', h) } }
  },
  getConfig: (): Promise<{ config: Config; repaired: boolean; inputMode: 'hook' | 'fallback'; dataDir: string }> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:set', patch),
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
  act: {
    get: (): Promise<{ store: ActStore; live: ActLive }> => ipcRenderer.invoke('act:get'),
    update: (patch: Partial<ActStore>): Promise<ActStore> => ipcRenderer.invoke('act:update', patch),
    updateSlot: (i: number, patch: Partial<Slot>): Promise<ActStore> => ipcRenderer.invoke('act:slot:update', i, patch),
    addSlot: (): Promise<ActStore> => ipcRenderer.invoke('act:slot:add'),
    removeSlot: (i: number): Promise<ActStore> => ipcRenderer.invoke('act:slot:remove', i),
    page: (cmd: 'prev' | 'next' | 'reset' | 'jump'): Promise<void> => ipcRenderer.invoke('act:page', cmd),
    timer: (cmd: 'toggle' | 'reset'): Promise<void> => ipcRenderer.invoke('act:timer', cmd),
    importInto: (i: number, text?: string): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('act:import', i, text),
    exportGuide: (i: number): Promise<string> => ipcRenderer.invoke('act:export', i),
    pickLog: (): Promise<ActStore> => ipcRenderer.invoke('act:logpath:pick'),
    addGear: (g: { name: string; level: number; kind: 'item' | 'gem' }): Promise<ActStore> => ipcRenderer.invoke('act:gear:add', g),
    removeGear: (id: string): Promise<ActStore> => ipcRenderer.invoke('act:gear:remove', id),
    addTreeImages: (): Promise<ActStore> => ipcRenderer.invoke('act:treeimg:add'),
    treeImage: (i: number): Promise<string | null> => ipcRenderer.invoke('act:treeimg:get', i),
    searchStrings: (): Promise<string[]> => ipcRenderer.invoke('act:searchStrings'),
    interactive: (on: boolean) => ipcRenderer.send('act:interactive', on),
    open: (what: 'tree' | 'gear' | 'editor', arg?: number) => ipcRenderer.send('act:open', what, arg),
    resizeGuide: (h: number) => ipcRenderer.send('guide:resize', h),
    hideTree: () => ipcRenderer.send('tree:hide'),
    onState: (cb: (s: { store: ActStore; live: ActLive }) => void) => {
      const fn = (_: unknown, s: { store: ActStore; live: ActLive }) => cb(s)
      ipcRenderer.on('act:state', fn)
      return () => { ipcRenderer.removeListener('act:state', fn) }
    }
  },
  onConfig: (cb: (c: Config) => void) => {
    const fn = (_: unknown, c: Config) => cb(c)
    ipcRenderer.on('config:changed', fn)
    return () => { ipcRenderer.removeListener('config:changed', fn) }
  }
}

contextBridge.exposeInMainWorld('crips', api)
export type CripsApi = typeof api
