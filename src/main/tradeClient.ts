import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RateLimiter } from '@shared/trade/rateLimiter'
import { toListings, type SearchBody } from '@shared/trade/query'
import { currencyUrl, divinePrice, findCurrency, findItem, itemUrl } from '@shared/prices/ninja'
import type { League, Listing, ParsedItem, PriceSnapshot, TradeStat } from '@shared/types'
import { dataDir } from './configStore'
import { log } from './log'

const TRADE = 'https://www.pathofexile.com'
// Identifiable, no personal data. GGG asks third-party tools to identify themselves.
const USER_AGENT = 'Assay/0.1.0 (learning project; price-check overlay)'
const DAY = 24 * 60 * 60 * 1000

export class TradeError extends Error {
  constructor(public kind: 'rate-limited' | 'network', message: string, public retryInSec = 0) {
    super(message)
  }
}

const limiter = new RateLimiter()

/** Offline mode for tests and demos: ASSAY_FIXTURES points at a folder of canned responses. */
const fixtures = () => process.env.ASSAY_FIXTURES

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures()!, name), 'utf8')) as T
}

async function request(policy: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const wait = limiter.waitMs(policy)
  if (wait > 0) throw new TradeError('rate-limited', `${policy} limited`, Math.ceil(wait / 1000))
  limiter.record(policy)
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(10_000)
    })
  } catch (e) {
    log('warn', `network ${policy}: ${String(e)}`)
    throw new TradeError('network', String(e))
  }
  const headers: Record<string, string> = {}
  res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
  limiter.update(policy, headers, res.status)
  if (res.status === 429) {
    const retry = Math.ceil(limiter.waitMs(policy) / 1000)
    log('warn', `429 on ${policy}, retry in ${retry}s`)
    throw new TradeError('rate-limited', '429', retry)
  }
  if (!res.ok) {
    log('warn', `${policy} HTTP ${res.status}`)
    throw new TradeError('network', `HTTP ${res.status}`)
  }
  return res.json()
}

async function cached<T>(name: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const path = join(dataDir(), `cache-${name}.json`)
  if (existsSync(path)) {
    try {
      const { at, data } = JSON.parse(readFileSync(path, 'utf8')) as { at: number; data: T }
      if (Date.now() - at < ttl) return data
    } catch { /* refetch */ }
  }
  try {
    const data = await load()
    writeFileSync(path, JSON.stringify({ at: Date.now(), data }))
    return data
  } catch (e) {
    // stale cache beats nothing
    if (existsSync(path)) return (JSON.parse(readFileSync(path, 'utf8')) as { data: T }).data
    throw e
  }
}

export async function getStats(): Promise<TradeStat[]> {
  type Raw = { result: { entries: TradeStat[] }[] }
  if (fixtures()) return fixture<Raw>('stats.json').result.flatMap(g => g.entries)
  return cached('stats', DAY, async () => {
    const raw = (await request('data', `${TRADE}/api/trade/data/stats`)) as Raw
    return raw.result.flatMap(g => g.entries.map(e => ({ id: e.id, text: e.text, type: e.type })))
  })
}

export async function getLeagues(): Promise<League[]> {
  type Raw = { result: { id: string; text: string; realm?: string }[] }
  if (fixtures()) return fixture<Raw>('leagues.json').result
  return cached('leagues', DAY, async () => {
    const raw = (await request('data', `${TRADE}/api/trade/data/leagues`)) as Raw
    return raw.result.filter(l => !l.realm || l.realm === 'pc').map(l => ({ id: l.id, text: l.text }))
  })
}

export async function search(league: string, body: SearchBody): Promise<{ id: string; total: number; result: string[] }> {
  if (fixtures()) return fixture('search.json')
  return (await request('search', `${TRADE}/api/trade/search/${encodeURIComponent(league)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })) as { id: string; total: number; result: string[] }
}

/** Fetches at most 10 listings, the trade site's own limit per call. */
export async function fetchListings(searchId: string, ids: string[]): Promise<Listing[]> {
  const batch = ids.slice(0, 10)
  if (batch.length === 0) return []
  if (fixtures()) return toListings(fixture<{ result: never[] }>('fetch.json').result)
  const raw = (await request('fetch', `${TRADE}/api/trade/fetch/${batch.join(',')}?query=${encodeURIComponent(searchId)}`)) as { result: never[] }
  return toListings(raw.result)
}

const ninjaMem = new Map<string, { at: number; data: unknown }>()

async function ninja(url: string): Promise<{ lines: never[] }> {
  const hit = ninjaMem.get(url)
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data as { lines: never[] }
  const data = (await request('ninja', url)) as { lines: never[] }
  ninjaMem.set(url, { at: Date.now(), data })
  return data
}

export async function aggregatorPrice(base: string, league: string, item: ParsedItem, kind: 'currency' | 'item', type: string): Promise<PriceSnapshot | null> {
  try {
    const cur = fixtures() ? fixture<{ lines: never[] }>('ninja-currency.json') : await ninja(currencyUrl(base, league, 'Currency'))
    const div = divinePrice(cur.lines)
    if (kind === 'currency') return findCurrency(cur.lines, item.baseType, div)
    const items = fixtures() ? fixture<{ lines: never[] }>('ninja-items.json') : await ninja(itemUrl(base, league, type))
    return findItem(items.lines, item)
  } catch (e) {
    log('warn', `aggregator unavailable: ${String(e)}`)
    return null
  }
}
