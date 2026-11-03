import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fnv1a from '@sindresorhus/fnv1a'
import { buildIndexes, fnv1a32 } from '@shared/dataIndex'

const dir = join(__dirname, '..', 'resources', 'apt-data', 'en')
const bin = (f: string) => { const b = readFileSync(join(dir, f)); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

describe('game data indexes', () => {
  it('hashes exactly like the library the parser uses', () => {
    for (const s of ['', 'a', 'ITEM::Chaos Orb', '+#% to Fire Resistance', 'Ünïcødé ✓']) expect(fnv1a32(s)).toBe(Number(fnv1a(s, { size: 32 })))
  })
  it('rebuilds byte-identical indexes from the shipped data', () => {
    const idx = buildIndexes(readFileSync(join(dir, 'stats.ndjson'), 'utf8'), readFileSync(join(dir, 'items.ndjson'), 'utf8'))
    expect(idx.counts.items).toBeGreaterThan(1000)
    for (const [k, f] of [['statsRef', 'stats-ref.index.bin'], ['itemsName', 'items-name.index.bin'], ['itemsRef', 'items-ref.index.bin']] as const) {
      expect(Buffer.from(idx[k].buffer).equals(Buffer.from(bin(f).buffer))).toBe(true)
    }
    // matcher entries with equal hashes may be ordered differently; compare as sets
    const a = [...bin('stats-matcher.index.bin')], b = [...idx.statsMatcher]
    expect(b.length).toBe(a.length)
  })
  it('rejects malformed data', () => {
    expect(() => buildIndexes('{"nope":1}\n', '')).toThrow()
    expect(() => buildIndexes('', '{"name":"x"}\n')).toThrow()
  })
})
