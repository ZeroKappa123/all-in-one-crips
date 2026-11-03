/**
 * Client-side rate limiting driven by the server's own headers.
 *
 *   X-Rate-Limit-Rules: Ip,Account
 *   X-Rate-Limit-Ip: 8:10:60,15:60:120        hits:periodSec:restrictSec
 *   X-Rate-Limit-Ip-State: 1:10:0,1:60:0      currentHits:periodSec:activeRestrictionSec
 *
 * We keep our own timestamps per policy and refuse to send when a window is full,
 * so the user never triggers a restriction by pressing the hotkey repeatedly.
 */
export interface Rule { hits: number; periodMs: number }

export type Clock = () => number

export class RateLimiter {
  private rules = new Map<string, Rule[]>() // policy -> rules
  private sent = new Map<string, number[]>() // policy -> timestamps
  private blockedUntil = new Map<string, number>()

  constructor(private now: Clock = Date.now) {}

  /** Milliseconds to wait before a request under this policy may be sent (0 = go). */
  waitMs(policy: string): number {
    const t = this.now()
    let wait = Math.max(0, (this.blockedUntil.get(policy) ?? 0) - t)
    const stamps = this.prune(policy, t)
    for (const rule of this.rules.get(policy) ?? []) {
      const inWindow = stamps.filter(s => s > t - rule.periodMs)
      // leave one slot spare: other tools or the browser may share the IP
      const limit = Math.max(1, rule.hits - 1)
      if (inWindow.length >= limit) {
        const oldest = inWindow[inWindow.length - limit] ?? t
        wait = Math.max(wait, oldest + rule.periodMs - t)
      }
    }
    return wait
  }

  record(policy: string): void {
    const list = this.sent.get(policy) ?? []
    list.push(this.now())
    this.sent.set(policy, list)
  }

  /** Feed response headers (lower-case keys) back in. */
  update(policy: string, headers: Record<string, string | undefined>, status: number): void {
    const names = (headers['x-rate-limit-rules'] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const rules: Rule[] = []
    let restrictSec = 0
    for (const name of names) {
      rules.push(...parseRules(headers[`x-rate-limit-${name}`]))
      for (const st of parseState(headers[`x-rate-limit-${name}-state`])) restrictSec = Math.max(restrictSec, st)
    }
    if (rules.length) this.rules.set(policy, rules)
    const retryAfter = Number(headers['retry-after'] ?? 0)
    if (status === 429) restrictSec = Math.max(restrictSec, retryAfter || 60)
    if (restrictSec > 0) this.blockedUntil.set(policy, this.now() + restrictSec * 1000)
  }

  private prune(policy: string, t: number): number[] {
    const maxPeriod = Math.max(60_000, ...(this.rules.get(policy) ?? []).map(r => r.periodMs))
    const list = (this.sent.get(policy) ?? []).filter(s => s > t - maxPeriod)
    this.sent.set(policy, list)
    return list
  }
}

export function parseRules(v: string | undefined): Rule[] {
  if (!v) return []
  return v.split(',').map(r => r.split(':').map(Number)).filter(p => p.length >= 2 && p.every(n => !Number.isNaN(n)))
    .map(([hits, period]) => ({ hits: hits!, periodMs: period! * 1000 }))
}

function parseState(v: string | undefined): number[] {
  if (!v) return []
  return v.split(',').map(r => Number(r.split(':')[2] ?? 0)).filter(n => !Number.isNaN(n))
}
