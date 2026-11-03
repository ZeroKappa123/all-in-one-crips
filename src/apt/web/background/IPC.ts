// Network bridge: the ported modules call Host.proxy(url) the way the original did;
// here the request runs in the main process (allow-listed hosts only).
type Bridge = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; headers: Record<string, string>; body: string }>

export const Host = {
  async proxy(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    const bridge = typeof window !== 'undefined' ? (window as unknown as { crips?: { proxy?: Bridge } }).crips?.proxy : undefined
    if (!bridge) return fetch(`https://${String(url)}`, init)
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v })
    const r = await bridge(String(url), { method: init?.method, headers, body: typeof init?.body === 'string' ? init.body : undefined })
    return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers })
  },
  isElectron: true
}
