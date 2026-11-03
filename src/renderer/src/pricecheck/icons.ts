import { Host } from '@/web/background/IPC'

/**
 * Path of Exile artwork is never bundled with the app: icons are shown straight from
 * Grinding Gear Games' own image server, the same way the official trade site shows them.
 * The trade site's static list maps currency ids ("chaos") and names ("Chaos Orb") to images.
 */
export const CDN = 'https://web.poecdn.com'

interface StaticEntry { id: string; text: string; image?: string }
let byId = new Map<string, { name: string; url: string }>()
let byName = new Map<string, string>()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

export function loadIcons(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await Host.proxy('www.pathofexile.com/api/trade/data/static')
      if (!res.ok) return
      const data = await res.json() as { result: Array<{ id: string; entries: StaticEntry[] }> }
      const ids = new Map<string, { name: string; url: string }>()
      const names = new Map<string, string>()
      for (const group of data.result ?? []) for (const e of group.entries ?? []) {
        if (!e.image) continue
        const url = toUrl(e.image)
        ids.set(e.id, { name: e.text, url })
        names.set(e.text, url)
      }
      byId = ids; byName = names
      listeners.forEach(l => l())
    } catch {
      loading = null // offline: try again on the next price check, show text meanwhile
    }
  })()
  return loading
}

export function toUrl(image: string): string {
  if (/^https:\/\/web\.poecdn\.com\//.test(image)) return image
  return CDN + (image.startsWith('/') ? image : `/${image}`)
}

/** Only images from GGG's CDN are ever displayed. */
export function safeIcon(url: string | undefined): string | undefined {
  return url && /^https:\/\/web\.poecdn\.com\//.test(url) ? url : undefined
}

export function currencyIcon(tradeId: string): { name: string; url: string } | undefined { return byId.get(tradeId) }
export function iconByName(name: string): string | undefined { return byName.get(name) }
export function onIcons(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn) } }
