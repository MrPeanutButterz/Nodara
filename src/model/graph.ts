import { newId } from './tree'
import type { GraphLink, GraphMap, GraphNode, GraphVariant, NodeShape } from './types'

// Same rules as tree.ts: pure functions, new maps out, nothing mutated.

const MAX_TEXT = 500
const MAX_LABEL = 200
const MAX_ITEMS = 2000
const MAX_COORD = 100_000

export const SHAPES: NodeShape[] = ['process', 'decision', 'terminal']
export const SNAP = 8

const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key)

function touch(map: GraphMap, patch: Partial<Pick<GraphMap, 'nodes' | 'links' | 'title'>>): GraphMap {
  return { ...map, ...patch, updatedAt: Date.now() }
}

export const snap = (n: number): number => Math.round(n / SNAP) * SNAP

export function createGraph(variant: GraphVariant): GraphMap {
  const flow = variant === 'flowchart'
  const nodeId = newId({})
  return {
    kind: 'graph',
    id: newId({}),
    variant,
    title: flow ? 'Untitled flowchart' : 'Untitled concept map',
    updatedAt: Date.now(),
    links: {},
    nodes: {
      [nodeId]: { id: nodeId, text: flow ? 'Start' : 'Main idea', x: 0, y: 0, shape: flow ? 'terminal' : 'process' },
    },
  }
}

export function addGraphNode(map: GraphMap, x: number, y: number, text = '', shape: NodeShape = 'process'): { map: GraphMap; id: string } {
  const id = newId(map.nodes)
  const node: GraphNode = { id, text, x: snap(x), y: snap(y), shape }
  return { id, map: touch(map, { nodes: { ...map.nodes, [id]: node } }) }
}

/** A spot to the right of `from`, moved down until it is clear of other ideas. */
function freeSpotRight(map: GraphMap, from: GraphNode): { x: number; y: number } {
  const x = from.x + 240
  let y = from.y
  const nodes = Object.values(map.nodes)
  for (let i = 0; i < 60; i++) {
    const taken = nodes.some((n) => Math.abs(n.x - x) < 200 && Math.abs(n.y - y) < 60)
    if (!taken) break
    y += 64
  }
  return { x, y }
}

/** A new idea next to `from`, joined to it by a link. One step, so undo removes both. */
export function addConnected(map: GraphMap, fromId: string): { map: GraphMap; id: string; linkId: string } | null {
  const from = map.nodes[fromId]
  if (!from) return null
  const spot = freeSpotRight(map, from)
  const added = addGraphNode(map, spot.x, spot.y, '', from.shape === 'terminal' ? 'process' : from.shape)
  const linked = connect(added.map, fromId, added.id)
  return linked ? { map: linked.map, id: added.id, linkId: linked.linkId } : null
}

/** A new idea at a chosen spot, joined to `fromId`. */
export function addConnectedAt(map: GraphMap, fromId: string, x: number, y: number): { map: GraphMap; id: string; linkId: string } | null {
  if (!map.nodes[fromId]) return null
  const added = addGraphNode(map, x, y)
  const linked = connect(added.map, fromId, added.id)
  return linked ? { map: linked.map, id: added.id, linkId: linked.linkId } : null
}

/** A new idea below `from`, not joined to anything. */
export function addBelow(map: GraphMap, fromId: string): { map: GraphMap; id: string } | null {
  const from = map.nodes[fromId]
  if (!from) return null
  let y = from.y + 72
  const nodes = Object.values(map.nodes)
  for (let i = 0; i < 60; i++) {
    if (!nodes.some((n) => Math.abs(n.x - from.x) < 200 && Math.abs(n.y - y) < 60)) break
    y += 64
  }
  return addGraphNode(map, from.x, y, '', from.shape)
}

export function moveGraphNode(map: GraphMap, id: string, x: number, y: number): GraphMap {
  const node = map.nodes[id]
  if (!node) return map
  const nx = snap(x)
  const ny = snap(y)
  if (node.x === nx && node.y === ny) return map
  return touch(map, { nodes: { ...map.nodes, [id]: { ...node, x: nx, y: ny } } })
}

export function nudgeGraphNode(map: GraphMap, id: string, dx: number, dy: number): GraphMap {
  const node = map.nodes[id]
  return node ? moveGraphNode(map, id, node.x + dx, node.y + dy) : map
}

export function renameGraphNode(map: GraphMap, id: string, text: string): GraphMap {
  const node = map.nodes[id]
  if (!node || node.text === text) return map
  return touch(map, { nodes: { ...map.nodes, [id]: { ...node, text: text.slice(0, MAX_TEXT) } } })
}

export function renameGraph(map: GraphMap, title: string): GraphMap {
  return map.title === title ? map : touch(map, { title: title.slice(0, MAX_TEXT) })
}

export function setShape(map: GraphMap, id: string, shape: NodeShape): GraphMap {
  const node = map.nodes[id]
  if (!node || node.shape === shape) return map
  return touch(map, { nodes: { ...map.nodes, [id]: { ...node, shape } } })
}

export function cycleShape(map: GraphMap, id: string): GraphMap {
  const node = map.nodes[id]
  if (!node) return map
  return setShape(map, id, SHAPES[(SHAPES.indexOf(node.shape) + 1) % SHAPES.length])
}

/** Removes an idea and every link that touched it. Selects a neighbour if there was one. */
export function removeGraphNode(map: GraphMap, id: string): { map: GraphMap; selectId: string | null } {
  if (!map.nodes[id]) return { map, selectId: null }
  const nodes = { ...map.nodes }
  delete nodes[id]
  const links: Record<string, GraphLink> = {}
  let selectId: string | null = null
  for (const link of Object.values(map.links)) {
    if (link.from === id || link.to === id) {
      selectId ??= link.from === id ? link.to : link.from
    } else {
      links[link.id] = link
    }
  }
  return { map: touch(map, { nodes, links }), selectId }
}

/** Joins two ideas. Returns null for a link to itself or one that already exists in that direction. */
export function connect(map: GraphMap, from: string, to: string): { map: GraphMap; linkId: string } | null {
  if (from === to || !map.nodes[from] || !map.nodes[to]) return null
  if (Object.values(map.links).some((link) => link.from === from && link.to === to)) return null
  const id = newId(map.links)
  const link: GraphLink = { id, from, to, label: '', directed: true }
  return { linkId: id, map: touch(map, { links: { ...map.links, [id]: link } }) }
}

function patchLink(map: GraphMap, id: string, patch: Partial<GraphLink>): GraphMap {
  const link = map.links[id]
  return link ? touch(map, { links: { ...map.links, [id]: { ...link, ...patch } } }) : map
}

export function setLinkLabel(map: GraphMap, id: string, label: string): GraphMap {
  const link = map.links[id]
  return link && link.label !== label ? patchLink(map, id, { label: label.slice(0, MAX_LABEL) }) : map
}

export function toggleLinkArrow(map: GraphMap, id: string): GraphMap {
  const link = map.links[id]
  return link ? patchLink(map, id, { directed: !link.directed }) : map
}

export function reverseLink(map: GraphMap, id: string): GraphMap {
  const link = map.links[id]
  return link ? patchLink(map, id, { from: link.to, to: link.from }) : map
}

export function removeLink(map: GraphMap, id: string): GraphMap {
  if (!map.links[id]) return map
  const links = { ...map.links }
  delete links[id]
  return touch(map, { links })
}

/** Ideas joined to this one, in either direction. Arrow keys prefer them. */
export function graphNeighbours(map: GraphMap, id: string): string[] {
  const out = new Set<string>()
  for (const link of Object.values(map.links)) {
    if (link.from === id) out.add(link.to)
    else if (link.to === id) out.add(link.from)
  }
  return [...out]
}

export function graphToMarkdown(map: GraphMap): string {
  const text = (id: string): string => map.nodes[id]?.text.trim() || 'Untitled'
  const lines = [`# ${map.title.trim() || 'Untitled map'}`, '', '## Ideas']
  for (const node of Object.values(map.nodes)) lines.push(`- ${text(node.id)}`)
  const links = Object.values(map.links)
  if (links.length) {
    lines.push('', '## Connections')
    for (const link of links) {
      const arrow = link.directed ? '→' : '—'
      lines.push(`- ${text(link.from)} ${arrow} ${text(link.to)}${link.label.trim() ? `: ${link.label.trim()}` : ''}`)
    }
  }
  return lines.join('\n') + '\n'
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const coord = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-MAX_COORD, Math.min(MAX_COORD, value)) : 0

/** Rebuilds a graph map from untrusted data. Links to missing ideas and links to themselves are dropped. */
export function sanitizeGraph(raw: unknown): GraphMap | null {
  if (!isObject(raw) || !isObject(raw.nodes)) return null
  const rawNodes = raw.nodes
  const rawLinks = isObject(raw.links) ? raw.links : {}

  const nodes: Record<string, GraphNode> = {}
  for (const id of Object.keys(rawNodes).slice(0, MAX_ITEMS)) {
    const source = rawNodes[id]
    if (id === '__proto__' || !isObject(source)) continue
    nodes[id] = {
      id,
      text: typeof source.text === 'string' ? source.text.slice(0, MAX_TEXT) : '',
      x: coord(source.x),
      y: coord(source.y),
      shape: SHAPES.includes(source.shape as NodeShape) ? (source.shape as NodeShape) : 'process',
    }
  }

  const links: Record<string, GraphLink> = {}
  for (const id of Object.keys(rawLinks).slice(0, MAX_ITEMS)) {
    const source = rawLinks[id]
    if (id === '__proto__' || !isObject(source)) continue
    const { from, to } = source
    if (typeof from !== 'string' || typeof to !== 'string' || from === to) continue
    if (!own(nodes, from) || !own(nodes, to)) continue
    links[id] = {
      id,
      from,
      to,
      label: typeof source.label === 'string' ? source.label.slice(0, MAX_LABEL) : '',
      directed: source.directed !== false,
    }
  }

  return {
    kind: 'graph',
    id: typeof raw.id === 'string' && raw.id !== '__proto__' ? raw.id : newId({}),
    variant: raw.variant === 'flowchart' ? 'flowchart' : 'concept',
    title: typeof raw.title === 'string' ? raw.title.slice(0, MAX_TEXT) : '',
    nodes,
    links,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}
