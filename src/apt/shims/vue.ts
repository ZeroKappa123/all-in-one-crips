/**
 * Minimal stand-in for the few Vue reactivity helpers the ported modules use.
 * Values are plain objects; every write notifies `onAptChange` subscribers so the
 * React UI can re-render (used for the rate-limiter state and price data).
 */
type Fn = () => void
const listeners = new Set<Fn>()
let queued = false
export function notify(): void {
  if (queued) return
  queued = true
  queueMicrotask(() => { queued = false; listeners.forEach(l => l()) })
}
export function onAptChange(fn: Fn): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export interface Ref<T> { value: T }
export type ShallowRef<T> = Ref<T>
export interface ComputedRef<T> { readonly value: T }

export function shallowRef<T>(v: T): Ref<T>
export function shallowRef<T = undefined>(): Ref<T | undefined>
export function shallowRef<T>(v?: T): Ref<T | undefined> {
  let inner = v
  return { get value() { return inner }, set value(n) { inner = n; notify() } }
}
export const ref = shallowRef

export function shallowReactive<T extends object>(o: T): T {
  // Sets and Maps break behind a Proxy (their methods check the receiver); hand them out as they are.
  if (o instanceof Set || o instanceof Map) return o
  return new Proxy(o, { set(t, k, v) { (t as any)[k] = v; notify(); return true } })
}
export const reactive = shallowReactive
export function readonly<T>(v: T): T { return v }
export function toRaw<T>(v: T): T { return v }
export function triggerRef(_r: Ref<unknown>): void { notify() }
export interface WritableComputedRef<T> { value: T }
export function computed<T>(get: () => T): ComputedRef<T>
export function computed<T>(opts: { get: () => T; set: (v: T) => void }): WritableComputedRef<T>
export function computed<T>(arg: (() => T) | { get: () => T; set: (v: T) => void }): WritableComputedRef<T> {
  if (typeof arg === 'function') return { get value() { return arg() }, set value(_v: T) { /* read-only */ } }
  return { get value() { return arg.get() }, set value(v: T) { arg.set(v); notify() } }
}
export function watch(_src: unknown, _cb: unknown): void { /* callers re-read on demand */ }
