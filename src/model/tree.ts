import type { DropMode, MapNode, MindMap, TreeLayout } from './types'

// Every function here is pure: it returns a new map and never mutates its input.
// That keeps undo/redo trivial (a history of snapshots) and makes the logic testable.

export const ROOT_TEXT = 'Central idea'
const MAX_TEXT = 500

// `in` would also match inherited names such as "constructor"; only own keys count as taken.
const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key)

export function newId(taken: Record<string, unknown>): string {
  // Starts with a letter: an all-digit key would be sorted ahead of the others by JavaScript objects,
  // which would scramble the order ideas were created in.
  const make = (): string => `n${globalThis.crypto.randomUUID().slice(0, 7)}`
  let id = make()
  while (own(taken, id)) id = make()
  return id
}

function touch(map: MindMap, nodes: Record<string, MapNode>): MindMap {
  return { ...map, nodes, updatedAt: Date.now() }
}

export const TREE_LAYOUTS: TreeLayout[] = ['right', 'both', 'down', 'radial', 'timeline']
export const isTreeLayout = (value: unknown): value is TreeLayout =>
  typeof value === 'string' && (TREE_LAYOUTS as string[]).includes(value)

export function createMap(rootText: string = ROOT_TEXT, layout: TreeLayout = 'right'): MindMap {
  const rootId = newId({})
  return {
    kind: 'tree',
    id: newId({}),
    layout,
    rootId,
    updatedAt: Date.now(),
    nodes: { [rootId]: { id: rootId, text: rootText, parentId: null, children: [], collapsed: false } },
  }
}

export function setLayout(map: MindMap, layout: TreeLayout): MindMap {
  return map.layout === layout ? map : { ...map, layout, updatedAt: Date.now() }
}

export function addChild(map: MindMap, parentId: string, text = ''): { map: MindMap; id: string } {
  const parent = map.nodes[parentId]
  if (!parent) return { map, id: parentId }
  const id = newId(map.nodes)
  const child: MapNode = { id, text, parentId, children: [], collapsed: false }
  return {
    id,
    map: touch(map, {
      ...map.nodes,
      [parentId]: { ...parent, collapsed: false, children: [...parent.children, id] },
      [id]: child,
    }),
  }
}

export function addSibling(map: MindMap, nodeId: string, text = ''): { map: MindMap; id: string } {
  const node = map.nodes[nodeId]
  if (!node || node.parentId === null) return addChild(map, nodeId, text)
  const parent = map.nodes[node.parentId]
  const id = newId(map.nodes)
  const children = [...parent.children]
  children.splice(children.indexOf(nodeId) + 1, 0, id)
  return {
    id,
    map: touch(map, {
      ...map.nodes,
      [parent.id]: { ...parent, children },
      [id]: { id, text, parentId: parent.id, children: [], collapsed: false },
    }),
  }
}

export function renameNode(map: MindMap, id: string, text: string): MindMap {
  const node = map.nodes[id]
  if (!node || node.text === text) return map
  return touch(map, { ...map.nodes, [id]: { ...node, text: text.slice(0, MAX_TEXT) } })
}

/** Ids of a node and everything below it. */
export function subtreeIds(map: MindMap, id: string): string[] {
  const out: string[] = []
  const stack = [id]
  while (stack.length) {
    const current = stack.pop() as string
    const node = map.nodes[current]
    if (!node) continue
    out.push(current)
    stack.push(...node.children)
  }
  return out
}

export function countDescendants(map: MindMap, id: string): number {
  return Math.max(0, subtreeIds(map, id).length - 1)
}

/** True when `id` is `ancestorId` itself or sits anywhere below it. */
export function isInSubtree(map: MindMap, ancestorId: string, id: string): boolean {
  let current: string | null = id
  let guard = 0
  while (current !== null && guard++ < 10_000) {
    if (current === ancestorId) return true
    current = map.nodes[current]?.parentId ?? null
  }
  return false
}

/** Removes a node and its branch. The root cannot be removed. */
export function removeNode(map: MindMap, id: string): { map: MindMap; selectId: string } {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return { map, selectId: id }
  const parent = map.nodes[node.parentId]
  const index = parent.children.indexOf(id)
  const remaining = parent.children.filter((child) => child !== id)
  const selectId = remaining[index] ?? remaining[index - 1] ?? parent.id

  const nodes = { ...map.nodes, [parent.id]: { ...parent, children: remaining } }
  for (const gone of subtreeIds(map, id)) delete nodes[gone]
  return { map: touch(map, nodes), selectId }
}

export function toggleCollapse(map: MindMap, id: string): MindMap {
  const node = map.nodes[id]
  if (!node || node.children.length === 0) return map
  return touch(map, { ...map.nodes, [id]: { ...node, collapsed: !node.collapsed } })
}

/** Where a dragged node would land: a parent and an index among that parent's other children. */
export function dropPlacement(
  map: MindMap,
  dragId: string,
  targetId: string,
  mode: DropMode,
): { parentId: string; index?: number } | null {
  const drag = map.nodes[dragId]
  const target = map.nodes[targetId]
  if (!drag || !target || drag.parentId === null || dragId === targetId) return null

  if (mode === 'child') {
    return isInSubtree(map, dragId, targetId) ? null : { parentId: targetId }
  }
  if (target.parentId === null || isInSubtree(map, dragId, target.parentId)) return null
  const siblings = map.nodes[target.parentId].children.filter((child) => child !== dragId)
  const at = siblings.indexOf(targetId)
  if (at < 0) return null
  return { parentId: target.parentId, index: mode === 'before' ? at : at + 1 }
}

/** Moves a node under a new parent. `index` counts among the new parent's other children. */
export function moveNode(map: MindMap, id: string, newParentId: string, index?: number): MindMap {
  const node = map.nodes[id]
  const newParent = map.nodes[newParentId]
  if (!node || !newParent || node.parentId === null) return map
  if (isInSubtree(map, id, newParentId)) return map

  const oldParent = map.nodes[node.parentId]
  const nodes = { ...map.nodes }
  const place = (list: string[]): string[] => {
    const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length))
    const copy = [...list]
    copy.splice(at, 0, id)
    return copy
  }

  if (oldParent.id === newParentId) {
    const others = oldParent.children.filter((child) => child !== id)
    const next = place(others)
    if (next.join() === oldParent.children.join()) return map
    nodes[oldParent.id] = { ...oldParent, children: next }
  } else {
    nodes[oldParent.id] = { ...oldParent, children: oldParent.children.filter((child) => child !== id) }
    nodes[newParentId] = { ...newParent, collapsed: false, children: place(newParent.children) }
    nodes[id] = { ...node, parentId: newParentId }
  }
  return touch(map, nodes)
}

/** Moves a node one step up or down among its siblings. */
export function reorderNode(map: MindMap, id: string, delta: -1 | 1): MindMap {
  const node = map.nodes[id]
  if (!node || node.parentId === null) return map
  const parent = map.nodes[node.parentId]
  const from = parent.children.indexOf(id)
  const to = from + delta
  if (to < 0 || to >= parent.children.length) return map
  const children = [...parent.children]
  ;[children[from], children[to]] = [children[to], children[from]]
  return touch(map, { ...map.nodes, [parent.id]: { ...parent, children } })
}

/** The ideas an arrow key should prefer to land on: parent, neighbouring siblings and visible children. */
export function treeRelatives(map: MindMap, id: string): string[] {
  const node = map.nodes[id]
  if (!node) return []
  const out: string[] = []
  if (node.parentId !== null) {
    out.push(node.parentId)
    const siblings = map.nodes[node.parentId].children
    const at = siblings.indexOf(id)
    if (at > 0) out.push(siblings[at - 1])
    if (at >= 0 && at < siblings.length - 1) out.push(siblings[at + 1])
  }
  if (!node.collapsed) out.push(...node.children)
  return out
}

/** An indented outline of the whole map, collapsed branches included. */
export function toMarkdown(map: MindMap): string {
  const lines: string[] = []
  const walk = (id: string, depth: number): void => {
    const node = map.nodes[id]
    if (!node) return
    const text = node.text.trim() || 'Untitled'
    lines.push(depth === 0 ? `# ${text}` : `${'  '.repeat(depth - 1)}- ${text}`)
    if (depth === 0) lines.push('')
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(map.rootId, 0)
  return lines.join('\n').trimEnd() + '\n'
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Rebuilds a map from untrusted data (a file, or storage written by an older version).
 * Only nodes reachable from the root survive; cycles, duplicates and bad fields are dropped.
 */
export function sanitizeMap(raw: unknown): MindMap | null {
  if (!isObject(raw) || typeof raw.rootId !== 'string' || !isObject(raw.nodes)) return null
  const rawNodes = raw.nodes
  const rootId = raw.rootId
  if (rootId === '__proto__' || !own(rawNodes, rootId) || !isObject(rawNodes[rootId])) return null

  const nodes: Record<string, MapNode> = {}
  const stack: { id: string; parentId: string | null }[] = [{ id: rootId, parentId: null }]
  while (stack.length) {
    const { id, parentId } = stack.pop() as { id: string; parentId: string | null }
    if (id === '__proto__' || own(nodes, id) || !own(rawNodes, id)) continue
    const source = rawNodes[id]
    if (!isObject(source)) continue

    nodes[id] = {
      id,
      text: typeof source.text === 'string' ? source.text.slice(0, MAX_TEXT) : '',
      parentId,
      children: [],
      collapsed: source.collapsed === true,
    }
    if (parentId !== null) nodes[parentId].children.push(id)

    const children = Array.isArray(source.children)
      ? source.children.filter((child): child is string => typeof child === 'string')
      : []
    for (let i = children.length - 1; i >= 0; i--) stack.push({ id: children[i], parentId: id })
  }

  return {
    kind: 'tree',
    id: typeof raw.id === 'string' && raw.id !== '__proto__' ? raw.id : newId({}),
    layout: isTreeLayout(raw.layout) ? raw.layout : 'right',
    rootId,
    nodes,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}
