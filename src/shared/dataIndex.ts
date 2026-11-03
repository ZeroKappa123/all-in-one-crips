/**
 * Lookup indexes for the game data files (items.ndjson, stats.ndjson), built the same way as
 * Awakened PoE Trade's index script (MIT): sorted pairs of [fnv1a-32 hash, line start].
 * Line starts are string offsets, matching how the parser slices the file text.
 */
const PRIME = 16777619
const OFFSET = 2166136261
const encoder = new TextEncoder()

/** FNV-1a, 32 bit, over the UTF-8 bytes of the string. */
export function fnv1a32(s: string): number {
  let h = OFFSET
  for (const b of encoder.encode(s)) {
    h ^= b
    h = Math.imul(h, PRIME) >>> 0
  }
  return h >>> 0
}

type Entry = { hash: number; start: number }

function pack(entries: Entry[]): Uint32Array {
  entries.sort((a, b) => a.hash - b.hash)
  const out = new Uint32Array(entries.length * 2)
  entries.forEach((e, i) => { out[i * 2] = e.hash; out[i * 2 + 1] = e.start })
  return out
}

function lines(ndjson: string, each: (json: any, start: number) => void): number {
  let start = 0, count = 0
  while (start < ndjson.length) {
    let end = ndjson.indexOf('\n', start)
    if (end === -1) end = ndjson.length
    const line = ndjson.slice(start, end)
    if (line.trim()) { each(JSON.parse(line), start); count++ }
    start = end + 1
  }
  return count
}

export interface DataIndexes {
  statsRef: Uint32Array
  statsMatcher: Uint32Array
  itemsName: Uint32Array
  itemsRef: Uint32Array
  counts: { stats: number; items: number }
}

/** Throws on malformed lines, which is part of validating a downloaded data set. */
export function buildIndexes(statsNdjson: string, itemsNdjson: string): DataIndexes {
  const byRef: Entry[] = [], matchers: Entry[] = []
  const statCount = lines(statsNdjson, (g, start) => {
    const stats = 'stats' in g ? g.stats : [g]
    for (const st of stats) {
      if (typeof st.ref !== 'string' || !Array.isArray(st.matchers)) throw new Error('bad stat line')
      byRef.push({ hash: fnv1a32(st.ref), start })
      for (const m of st.matchers) matchers.push({ hash: fnv1a32(m.advanced ? m.advanced : m.string), start })
    }
  })
  const seen = new Map<string, { name: number; ref: number; start: number }>()
  const itemCount = lines(itemsNdjson, (it, start) => {
    if (typeof it.name !== 'string' || typeof it.refName !== 'string' || typeof it.namespace !== 'string') throw new Error('bad item line')
    const key = `${it.namespace}::${it.refName}`
    if (!seen.has(key)) seen.set(key, { name: fnv1a32(`${it.namespace}::${it.name}`), ref: fnv1a32(key), start })
  })
  const items = [...seen.values()]
  return {
    statsRef: pack(byRef),
    statsMatcher: pack(matchers),
    itemsName: pack(items.map(i => ({ hash: i.name, start: i.start }))),
    itemsRef: pack(items.map(i => ({ hash: i.ref, start: i.start }))),
    counts: { stats: statCount, items: itemCount }
  }
}
