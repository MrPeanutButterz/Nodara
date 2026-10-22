import { countDescendants } from './tree'
import type { Direction, MindMap, NodeShape } from './types'

export const NODE_H = 34
export const ROOT_H = 44
export const H_GAP = 64
export const V_GAP = 10

const ROW_GAP = 56 // between levels in the top-down layout
const SIBLING_GAP = 18 // between neighbours in the top-down layout
const RING_GAP = 48 // between rings in the radial layout
const MIN_ARC = 62 // room each idea needs along its ring
const OVERLAP_PAD = 8
const AXIS_GAP = 36 // timeline: axis to the first box
const EVENT_GAP = 64 // timeline: between events on the same side
const TICK_STEP = 44 // timeline: closest two events may sit along the axis
const INDENT = 20 // timeline: indent per level of detail
const DETAIL_GAP = 8

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
  /** Flowchart nodes only. */
  shape?: NodeShape
}

export interface EdgeLabel {
  x: number
  y: number
  text: string
}

export interface Edge {
  id: string
  /** SVG path data, so every layout draws its own kind of line. */
  d: string
  /** Links in concept maps and flowcharts always have one, even when the text is empty. */
  label?: EdgeLabel
  directed?: boolean
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  nodes: Placed[]
  byId: Record<string, Placed>
  edges: Edge[]
  bounds: Bounds
  /** The axis siblings run along. Decides where "before" and "after" are when dragging. */
  axis: 'x' | 'y'
}

export const round = (n: number): number => Math.round(n * 10) / 10

/** Width from text length. Estimating avoids measuring the DOM, which keeps layout instant and testable. */
export function nodeWidth(text: string, isRoot: boolean): number {
  const chars = Math.max(text.length, 8)
  const width = chars * (isRoot ? 8.2 : 7.2) + (isRoot ? 44 : 36)
  return Math.round(Math.min(isRoot ? 340 : 300, Math.max(isRoot ? 120 : 80, width)))
}

// All edges are written as one cubic curve (or a polyline) so they can glide between layouts.
const curveH = (x1: number, y1: number, x2: number, y2: number): string => {
  const mx = (x1 + x2) / 2
  return `M ${round(x1)} ${round(y1)} C ${round(mx)} ${round(y1)}, ${round(mx)} ${round(y2)}, ${round(x2)} ${round(y2)}`
}
const curveV = (x1: number, y1: number, x2: number, y2: number): string => {
  const my = (y1 + y2) / 2
  return `M ${round(x1)} ${round(y1)} C ${round(x1)} ${round(my)}, ${round(x2)} ${round(my)}, ${round(x2)} ${round(y2)}`
}
const straight = (x1: number, y1: number, x2: number, y2: number): string =>
  `M ${round(x1)} ${round(y1)} C ${round(x1 + (x2 - x1) / 3)} ${round(y1 + (y2 - y1) / 3)}, ${round(x1 + ((x2 - x1) * 2) / 3)} ${round(y1 + ((y2 - y1) * 2) / 3)}, ${round(x2)} ${round(y2)}`

/** Where a line from the centre of `p` towards (tx, ty) leaves the rectangle. */
function rectEdgePoint(p: Placed, tx: number, ty: number): { x: number; y: number } {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scale = Math.min(dx === 0 ? Infinity : p.w / 2 / Math.abs(dx), dy === 0 ? Infinity : p.h / 2 / Math.abs(dy))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

export function finishLayout(nodes: Placed[], edges: Edge[], axis: 'x' | 'y', extraRight = -Infinity): Layout {
  const byId: Record<string, Placed> = {}
  let minX = Infinity
  let minY = Infinity
  let maxX = extraRight
  let maxY = -Infinity
  for (const n of nodes) {
    byId[n.id] = n
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  const bounds =
    nodes.length === 0
      ? { x: -100, y: -60, w: 200, h: 120 }
      : { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  return { nodes, byId, edges, bounds, axis }
}

interface Context {
  map: MindMap
  textOf(id: string): string
  kids(id: string): string[]
  heightOf(id: string): number
  widthOf(id: string): number
  make(id: string, x: number, y: number, depth: number): Placed
}

function createContext(map: MindMap, draft?: { id: string; text: string }): Context {
  const textOf = (id: string): string => (draft && draft.id === id ? draft.text : map.nodes[id].text)
  const isRoot = (id: string): boolean => id === map.rootId
  return {
    map,
    textOf,
    kids: (id) => (map.nodes[id].collapsed ? [] : map.nodes[id].children),
    heightOf: (id) => (isRoot(id) ? ROOT_H : NODE_H),
    widthOf: (id) => nodeWidth(textOf(id), isRoot(id)),
    make: (id, x, y, depth) => ({
      id,
      x,
      y,
      w: nodeWidth(textOf(id), isRoot(id)),
      h: isRoot(id) ? ROOT_H : NODE_H,
      depth,
      hasChildren: map.nodes[id].children.length > 0,
      hiddenCount: map.nodes[id].collapsed ? countDescendants(map, id) : 0,
    }),
  }
}

type Partial_ = { nodes: Placed[]; edges: Edge[]; extraRight?: number }

/** Right (one side) and both (ideas split over left and right): a tree growing sideways from the root. */
function layoutHorizontal(c: Context, both: boolean): Partial_ {
  const { map } = c
  const heights = new Map<string, number>()
  const stack = (ids: string[]): number =>
    ids.reduce((sum, id, i) => sum + (heights.get(id) as number) + (i > 0 ? V_GAP : 0), 0)
  const measure = (id: string): void => {
    const children = c.kids(id)
    for (const child of children) measure(child)
    heights.set(id, Math.max(c.heightOf(id), stack(children)))
  }

  const rootKids = c.kids(map.rootId)
  for (const id of rootKids) measure(id)

  const right: string[] = []
  const left: string[] = []
  if (!both) {
    right.push(...rootKids)
  } else {
    // Hand each branch to whichever side is shorter so far, so the map stays balanced.
    let rightHeight = 0
    let leftHeight = 0
    for (const id of rootKids) {
      const h = heights.get(id) as number
      if (rightHeight <= leftHeight) {
        right.push(id)
        rightHeight += h + V_GAP
      } else {
        left.push(id)
        leftHeight += h + V_GAP
      }
    }
  }

  const root = c.make(map.rootId, 0, -ROOT_H / 2, 0)
  if (both) root.x = -root.w / 2
  const nodes: Placed[] = [root]
  const direction = new Map<string, 1 | -1>()

  const placeSubtree = (id: string, anchor: number, top: number, depth: number, dir: 1 | -1): void => {
    const block = heights.get(id) as number
    const w = c.widthOf(id)
    const x = dir > 0 ? anchor : anchor - w
    nodes.push(c.make(id, x, top + (block - c.heightOf(id)) / 2, depth))
    direction.set(id, dir)
    const children = c.kids(id)
    let cursor = top + (block - stack(children)) / 2
    const next = dir > 0 ? x + w + H_GAP : x - H_GAP
    for (const child of children) {
      placeSubtree(child, next, cursor, depth + 1, dir)
      cursor += (heights.get(child) as number) + V_GAP
    }
  }
  const placeSide = (ids: string[], dir: 1 | -1): void => {
    let cursor = -stack(ids) / 2
    const anchor = dir > 0 ? root.x + root.w + H_GAP : root.x - H_GAP
    for (const id of ids) {
      placeSubtree(id, anchor, cursor, 1, dir)
      cursor += (heights.get(id) as number) + V_GAP
    }
  }
  placeSide(right, 1)
  placeSide(left, -1)

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges: Edge[] = []
  for (const n of nodes) {
    const parentId = map.nodes[n.id].parentId
    const parent = parentId ? byId.get(parentId) : undefined
    if (!parent) continue
    const dir = direction.get(n.id) as 1 | -1
    const x1 = dir > 0 ? parent.x + parent.w : parent.x
    const x2 = dir > 0 ? n.x : n.x + n.w
    edges.push({ id: n.id, d: curveH(x1, parent.y + parent.h / 2, x2, n.y + n.h / 2) })
  }
  return { nodes, edges }
}

/** Org chart: the root on top, every level a row below it. */
function layoutDown(c: Context): Partial_ {
  const { map } = c
  const widths = new Map<string, number>()
  const total = (ids: string[]): number =>
    ids.reduce((sum, id, i) => sum + (widths.get(id) as number) + (i > 0 ? SIBLING_GAP : 0), 0)
  const measure = (id: string): void => {
    const children = c.kids(id)
    for (const child of children) measure(child)
    widths.set(id, Math.max(c.widthOf(id), total(children)))
  }
  measure(map.rootId)

  const rowY = (depth: number): number => (depth === 0 ? 0 : ROOT_H + ROW_GAP + (depth - 1) * (NODE_H + ROW_GAP))
  const nodes: Placed[] = []
  const place = (id: string, left: number, depth: number): void => {
    const block = widths.get(id) as number
    nodes.push(c.make(id, left + (block - c.widthOf(id)) / 2, rowY(depth), depth))
    const children = c.kids(id)
    let cursor = left + (block - total(children)) / 2
    for (const child of children) {
      place(child, cursor, depth + 1)
      cursor += (widths.get(child) as number) + SIBLING_GAP
    }
  }
  place(map.rootId, -(widths.get(map.rootId) as number) / 2, 0)

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges: Edge[] = []
  for (const n of nodes) {
    const parentId = map.nodes[n.id].parentId
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent) edges.push({ id: n.id, d: curveV(parent.x + parent.w / 2, parent.y + parent.h, n.x + n.w / 2, n.y) })
  }
  return { nodes, edges }
}

/** Ideas spread around the root in rings, each branch getting a slice of the circle. */
function layoutRadial(c: Context): Partial_ {
  const { map } = c
  const levels: string[][] = []
  const leaves = new Map<string, number>()
  const collect = (id: string, depth: number): number => {
    ;(levels[depth] ??= []).push(id)
    const children = c.kids(id)
    const count = children.length ? children.reduce((sum, child) => sum + collect(child, depth + 1), 0) : 1
    leaves.set(id, count)
    return count
  }
  collect(map.rootId, 0)

  // Ring radius: wide enough for the boxes on both sides of the gap and for every idea on the ring.
  const radii: number[] = [0]
  for (let d = 1; d < levels.length; d++) {
    const widest = (depth: number): number => Math.max(...levels[depth].map((id) => c.widthOf(id)))
    const byBoxes = radii[d - 1] + ((widest(d - 1) + widest(d)) / 2) * 0.85 + RING_GAP
    const byCount = (levels[d].length * MIN_ARC) / (2 * Math.PI)
    radii.push(Math.max(byBoxes, byCount, radii[d - 1] + 60))
  }

  const centres = new Map<string, { x: number; y: number; depth: number }>()
  const assign = (id: string, from: number, to: number, depth: number): void => {
    const angle = (from + to) / 2
    centres.set(id, { x: radii[depth] * Math.cos(angle), y: radii[depth] * Math.sin(angle), depth })
    const children = c.kids(id)
    const sum = children.reduce((s, child) => s + (leaves.get(child) as number), 0)
    let cursor = from
    for (const child of children) {
      const span = ((to - from) * (leaves.get(child) as number)) / sum
      assign(child, cursor, cursor + span, depth + 1)
      cursor += span
    }
  }
  assign(map.rootId, -Math.PI / 2, (3 * Math.PI) / 2, 0)

  const ids = [...centres.keys()]
  const boxes = ids.map((id) => {
    const centre = centres.get(id) as { x: number; y: number; depth: number }
    const placed = c.make(id, 0, 0, centre.depth)
    return { placed, cx: centre.x, cy: centre.y }
  })

  // Boxes are wider than they are tall, so neighbours on a ring can still collide. Nudge them apart.
  for (let round_ = 0; round_ < 200; round_++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const dx = b.cx - a.cx
        const dy = b.cy - a.cy
        const overlapX = (a.placed.w + b.placed.w) / 2 + OVERLAP_PAD - Math.abs(dx)
        const overlapY = (a.placed.h + b.placed.h) / 2 + OVERLAP_PAD - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue
        moved = true
        const alongX = overlapX < overlapY
        const push = alongX ? overlapX * (dx >= 0 ? 1 : -1) : overlapY * (dy >= 0 ? 1 : -1)
        const share = i === 0 ? 1 : 0.5 // the root stays put
        if (alongX) {
          b.cx += push * share
          if (i !== 0) a.cx -= push * share
        } else {
          b.cy += push * share
          if (i !== 0) a.cy -= push * share
        }
      }
    }
    if (!moved) break
  }

  const nodes = boxes.map(({ placed, cx, cy }) => {
    placed.x = round(cx - placed.w / 2)
    placed.y = round(cy - placed.h / 2)
    return placed
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges: Edge[] = []
  for (const n of nodes) {
    const parentId = map.nodes[n.id].parentId
    const parent = parentId ? byId.get(parentId) : undefined
    if (!parent) continue
    const from = rectEdgePoint(parent, n.x + n.w / 2, n.y + n.h / 2)
    const to = rectEdgePoint(n, parent.x + parent.w / 2, parent.y + parent.h / 2)
    edges.push({ id: n.id, d: straight(from.x, from.y, to.x, to.y) })
  }
  return { nodes, edges }
}

/** Events alternate above and below an axis; details stack away from the axis under each event. */
function layoutTimeline(c: Context): Partial_ {
  const { map } = c
  const root = c.make(map.rootId, 0, -ROOT_H / 2, 0)
  const nodes: Placed[] = [root]
  const edges: Edge[] = []
  const events = c.kids(map.rootId)
  const firstTick = root.w + 56

  const nextFree: Record<string, number> = { '-1': firstTick, '1': firstTick }
  let previousStart = firstTick - TICK_STEP
  let lastTick = root.w

  events.forEach((eventId, index) => {
    const side: 1 | -1 = index % 2 === 0 ? -1 : 1 // -1 is above the axis
    const items: { id: string; level: number; parentId: string | null }[] = []
    const walk = (id: string, level: number, parentId: string | null): void => {
      items.push({ id, level, parentId })
      for (const child of c.kids(id)) walk(child, level + 1, id)
    }
    walk(eventId, 1, null)

    const width = Math.max(...items.map((it) => (it.level - 1) * INDENT + c.widthOf(it.id)))
    const start = Math.max(previousStart + TICK_STEP, nextFree[String(side)])
    previousStart = start
    nextFree[String(side)] = start + width + EVENT_GAP

    const placed = new Map<string, Placed>()
    let cursor = side < 0 ? -AXIS_GAP : AXIS_GAP
    for (const item of items) {
      const y = side < 0 ? cursor - NODE_H : cursor
      const p = c.make(item.id, start + (item.level - 1) * INDENT, y, item.level)
      nodes.push(p)
      placed.set(item.id, p)
      cursor = side < 0 ? y - DETAIL_GAP : y + NODE_H + DETAIL_GAP

      if (item.parentId === null) {
        // A tick from the axis up (or down) to the event.
        const tickX = start + 14
        const nearEdge = side < 0 ? p.y + p.h : p.y
        edges.push({ id: p.id, d: `M ${round(tickX)} 0 L ${round(tickX)} ${round(nearEdge)}` })
        lastTick = Math.max(lastTick, tickX)
      } else {
        const parent = placed.get(item.parentId) as Placed
        const px = parent.x + 10
        const py = side < 0 ? parent.y : parent.y + parent.h
        edges.push({ id: p.id, d: `M ${round(px)} ${round(py)} L ${round(px)} ${round(p.y + p.h / 2)} L ${round(p.x)} ${round(p.y + p.h / 2)}` })
      }
    }
  })

  let extraRight: number | undefined
  if (events.length > 0) {
    extraRight = lastTick + 48
    edges.unshift({ id: '__axis', d: `M ${round(root.w)} 0 L ${round(extraRight)} 0` })
  }
  return { nodes, edges, extraRight }
}

/** Lays the map out in the style it is set to. `draft` swaps in text that is being typed right now. */
export function layoutMap(map: MindMap, draft?: { id: string; text: string }): Layout {
  const c = createContext(map, draft)
  switch (map.layout) {
    case 'both': {
      const r = layoutHorizontal(c, true)
      return finishLayout(r.nodes, r.edges, 'y')
    }
    case 'down': {
      const r = layoutDown(c)
      return finishLayout(r.nodes, r.edges, 'x')
    }
    case 'radial': {
      const r = layoutRadial(c)
      return finishLayout(r.nodes, r.edges, 'y')
    }
    case 'timeline': {
      const r = layoutTimeline(c)
      return finishLayout(r.nodes, r.edges, 'x', r.extraRight)
    }
    default: {
      const r = layoutHorizontal(c, false)
      return finishLayout(r.nodes, r.edges, 'y')
    }
  }
}

// ---------------------------------------------------------------------------
// Navigation and handles

const UNIT: Record<Direction, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

/**
 * The idea an arrow key should select, judged by where things are on screen so it works in every layout.
 * `relatives` (parent, siblings, children, linked ideas) get a head start over strangers.
 */
export function navigateSpatial(layout: Layout, id: string, direction: Direction, relatives: string[] = []): string {
  const from = layout.byId[id]
  if (!from) return id
  const v = UNIT[direction]
  const cx = from.x + from.w / 2
  const cy = from.y + from.h / 2
  const related = new Set(relatives)

  let best = id
  let bestScore = Infinity
  for (const other of layout.nodes) {
    if (other.id === id) continue
    const dx = other.x + other.w / 2 - cx
    const dy = other.y + other.h / 2 - cy
    const along = dx * v.x + dy * v.y
    const across = Math.abs(dx * v.y - dy * v.x)
    const isRelative = related.has(other.id)
    // Relatives may sit well off to the side; strangers must be roughly straight ahead.
    if (along <= 0 || across > along * (isRelative ? 2 : 1)) continue
    const score = (across * 2 + along) * (isRelative ? 0.6 : 1)
    if (score < bestScore) {
      best = other.id
      bestScore = score
    }
  }
  return best
}

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'

/** Which side of an idea the "add child" handle sits on: the side facing away from the root. */
export function handleSide(layout: MindMap['layout'], placed: Placed, root: Placed): HandleSide {
  if (placed.id === root.id) return 'right'
  const dx = placed.x + placed.w / 2 - (root.x + root.w / 2)
  const dy = placed.y + placed.h / 2 - (root.y + root.h / 2)
  switch (layout) {
    case 'both':
      return dx < 0 ? 'left' : 'right'
    case 'down':
      return 'bottom'
    case 'timeline':
      return dy < 0 ? 'top' : 'bottom'
    case 'radial':
      return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom'
    default:
      return 'right'
  }
}
