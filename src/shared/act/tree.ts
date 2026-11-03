/** Compact passive tree: id -> [x, y, flags, ascendancy, name, classStartIndex] */
export type TreeNode = [number, number, number, string, string, number]
export interface TreeData {
  version: string
  classes: { name: string; asc: string[] }[]
  nodes: Record<string, TreeNode>
  edges: [number, number][]
}

export const F = { notable: 1, keystone: 2, mastery: 4, classStart: 8, jewel: 16, ascStart: 32 } as const

export type NodeState = 'kept' | 'added' | 'removed' | 'none'

/** Compares one spec with the one before it: new nodes green, respecs red. */
export function diffSpecs(current: number[], previous: number[] | null): Map<number, NodeState> {
  const out = new Map<number, NodeState>()
  const prev = new Set(previous ?? [])
  const cur = new Set(current)
  for (const n of cur) out.set(n, previous && !prev.has(n) ? 'added' : 'kept')
  if (previous) for (const n of prev) if (!cur.has(n)) out.set(n, 'removed')
  return out
}

export interface Box { minX: number; minY: number; maxX: number; maxY: number }

export function bounds(tree: TreeData, filter: (n: TreeNode) => boolean): Box {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const n of Object.values(tree.nodes)) {
    if (!filter(n)) continue
    b.minX = Math.min(b.minX, n[0]); b.maxX = Math.max(b.maxX, n[0])
    b.minY = Math.min(b.minY, n[1]); b.maxY = Math.max(b.maxY, n[1])
  }
  return b
}

export const isMain = (n: TreeNode) => !n[3] && !(n[2] & F.mastery)
export const isAscendancy = (name: string) => (n: TreeNode) => n[3] === name
