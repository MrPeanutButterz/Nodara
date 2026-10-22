import { countDescendants } from './tree'
import type { MindMap } from './types'

export const NODE_H = 34
export const ROOT_H = 44
export const H_GAP = 64
export const V_GAP = 10

export interface Placed {
  id: string
  x: number
  y: number
  w: number
  h: number
  depth: number
  hasChildren: boolean
  /** How many nodes are tucked away when this branch is collapsed. */
  hiddenCount: number
}

export interface Edge {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Layout {
  nodes: Placed[]
  byId: Record<string, Placed>
  edges: Edge[]
  bounds: { x: number; y: number; w: number; h: number }
}

/** Width from text length. Estimating avoids measuring the DOM, which keeps layout instant and testable. */
export function nodeWidth(text: string, isRoot: boolean): number {
  const chars = Math.max(text.length, 8)
  const width = chars * (isRoot ? 8.2 : 7.2) + (isRoot ? 44 : 36)
  return Math.round(Math.min(isRoot ? 340 : 300, Math.max(isRoot ? 120 : 80, width)))
}

/** Lays the map out as a tree growing to the right. `draft` swaps in text that is being typed right now. */
export function layoutMap(map: MindMap, draft?: { id: string; text: string }): Layout {
  const heights = new Map<string, number>()
  const nodeHeight = (id: string): number => (id === map.rootId ? ROOT_H : NODE_H)
  const visibleChildren = (id: string): string[] => (map.nodes[id].collapsed ? [] : map.nodes[id].children)
  const textOf = (id: string): string => (draft && draft.id === id ? draft.text : map.nodes[id].text)

  const stackHeight = (ids: string[]): number =>
    ids.reduce((sum, id, i) => sum + (heights.get(id) as number) + (i > 0 ? V_GAP : 0), 0)

  const measure = (id: string): number => {
    const children = visibleChildren(id)
    for (const child of children) measure(child)
    const height = Math.max(nodeHeight(id), stackHeight(children))
    heights.set(id, height)
    return height
  }

  const nodes: Placed[] = []
  const byId: Record<string, Placed> = {}

  const place = (id: string, x: number, top: number, depth: number): void => {
    const node = map.nodes[id]
    const block = heights.get(id) as number
    const h = nodeHeight(id)
    const placed: Placed = {
      id,
      x,
      y: top + (block - h) / 2,
      w: nodeWidth(textOf(id), id === map.rootId),
      h,
      depth,
      hasChildren: node.children.length > 0,
      hiddenCount: node.collapsed ? countDescendants(map, id) : 0,
    }
    nodes.push(placed)
    byId[id] = placed

    const children = visibleChildren(id)
    let cursor = top + (block - stackHeight(children)) / 2
    for (const child of children) {
      place(child, x + placed.w + H_GAP, cursor, depth + 1)
      cursor += (heights.get(child) as number) + V_GAP
    }
  }

  const rootBlock = measure(map.rootId)
  place(map.rootId, 0, -rootBlock / 2, 0)

  const edges: Edge[] = []
  for (const child of nodes) {
    const parentId = map.nodes[child.id].parentId
    const parent = parentId ? byId[parentId] : undefined
    if (!parent) continue
    edges.push({
      id: child.id,
      x1: parent.x + parent.w,
      y1: parent.y + parent.h / 2,
      x2: child.x,
      y2: child.y + child.h / 2,
    })
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  return { nodes, byId, edges, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } }
}
