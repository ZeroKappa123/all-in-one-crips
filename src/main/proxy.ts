import { app, ipcMain } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { log } from './log'

/**
 * Network and data access for the price-check modules running in the renderer.
 * Only these hosts are reachable; requests carry an identifiable User-Agent and no personal data.
 */
const ALLOWED_HOSTS = new Set(['www.pathofexile.com', 'poe.ninja', 'pobb.in'])
const USER_AGENT = 'All-In-One-CRIPS/1.0.0 (price-check overlay)'

export interface ProxyResponse { status: number; headers: Record<string, string>; body: string }

export function dataRoot(): string {
  const packaged = join(process.resourcesPath ?? '', 'apt-data')
  if (app.isPackaged && existsSync(packaged)) return packaged
  // development: out/main/index.js -> project/resources/apt-data
  return join(__dirname, '..', '..', 'resources', 'apt-data')
}

/** Offline answers for tests and demos (CRIPS_FIXTURES), keyed by the request path. */
function fixtureFor(url: string): ProxyResponse | null {
  const dir = process.env.CRIPS_FIXTURES
  if (!dir) return null
  const table: [RegExp, string][] = [
    [/\/api\/trade\/search\//, 'apt-search.json'],
    [/\/api\/trade\/fetch\//, 'apt-fetch.json'],
    [/\/api\/trade\/exchange\//, 'apt-exchange.json'],
    [/\/api\/leagues/, 'apt-leagues.json'],
    [/poe\.ninja\//, 'apt-ninja.json']
  ]
  const hit = table.find(([re]) => re.test(url))
  if (!hit || !existsSync(join(dir, hit[1]))) return { status: 404, headers: {}, body: '{"error":{"message":"no fixture"}}' }
  return {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-rate-limit-rules': 'Ip', 'x-rate-limit-ip': '8:10:60,15:60:120', 'x-rate-limit-ip-state': '1:10:0,1:60:0', 'x-rate-limit-policy': 'trade-search-request-limit' },
    body: readFileSync(join(dir, hit[1]), 'utf8')
  }
}

export async function proxy(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<ProxyResponse> {
  const fixture = fixtureFor(url)
  if (fixture) return fixture
  const host = url.split('/')[0] ?? ''
  if (!ALLOWED_HOSTS.has(host)) {
    log('warn', `blocked request to ${host}`)
    return { status: 403, headers: {}, body: '{"error":{"message":"host not allowed"}}' }
  }
  try {
    const res = await fetch(`https://${url}`, {
      method: init.method ?? 'GET',
      headers: { ...init.headers, 'User-Agent': USER_AGENT },
      body: init.body,
      signal: AbortSignal.timeout(15_000)
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    if (res.status === 429) log('warn', `rate limited by ${host}`)
    return { status: res.status, headers, body: await res.text() }
  } catch (e) {
    log('warn', `network error for ${host}: ${String(e)}`)
    return { status: 599, headers: {}, body: `{"error":{"message":"Couldn't reach ${host}."}}` }
  }
}

export function registerProxyIpc(): void {
  ipcMain.handle('crips:proxy', (_e, url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => proxy(url, init ?? {}))
  ipcMain.handle('crips:data', (_e, path: string, kind: 'text' | 'binary') => {
    if (path.includes('..')) throw new Error('bad path')
    const buf = readFileSync(join(dataRoot(), path))
    return kind === 'text' ? buf.toString('utf8') : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
}
