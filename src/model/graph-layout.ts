import { finishLayout, nodeWidth, round } from './layout'
import type { Edge, Layout, Placed } from './layout'
import type { GraphMap, NodeShape } from './types'

const BOX_H = 38
const DECISION_H = 76
const LINK_BOW = 40 // how far parallel links between the same two ideas fan out

export function graphNodeSize(text: string, shape: NodeShape): { w: number; h: number } {
  const w = nodeWidth(text, false)
  if (shape === 'decision') return { w: Math.min(Math.round(w * 1.55), 440), h: DECISION_H }
  if (shape === 'terminal') return { w: w + 8, h: BOX_H }
  return { w, h: BOX_H }
}

/** Where a line from the centre of `p` towards (tx, ty) leaves the node's outline. */
function outlinePoint(p: Placed, tx: number, ty: number): { x: number; y: number } {
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  if (p.shape === 'decision') {
    const t = 1 / (Math.abs(dx) / (p.w / 2) + Math.abs(dy) / (p.h / 2))
    return { x: cx + dx * t, y: cy + dy * t }
  }
  const scale = Math.min(dx === 0 ? Infinity : p.w / 2 / Math.abs(dx), dy === 0 ? Infinity : p.h / 2 / Math.abs(dy))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

export interface GraphLayoutOptions {
  /** Text being typed into an idea right now, so its box can grow with it. */
  draft?: { id: string; text: string }
  /** An idea being dragged: where its centre is at the moment. */
  moving?: { id: string; x: number; y: number }
}

export function layoutGraph(map: GraphMap, options: GraphLayoutOptions = {}): Layout {
  const nodes: Placed[] = []
  for (const node of Object.values(map.nodes)) {
    const text = options.draft?.id === node.id ? options.draft.text : node.text
    const shape: NodeShape = map.variant === 'concept' ? 'process' : node.shape
    const { w, h } = graphNodeSize(text, shape)
    const cx = options.moving?.id === node.id ? options.moving.x : node.x
    const cy = options.moving?.id === node.id ? options.moving.y : node.y
    nodes.push({ id: node.id, x: round(cx - w / 2), y: round(cy - h / 2), w, h, depth: 0, hasChildren: false, hiddenCount: 0, shape })
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Links between the same two ideas, in either direction, fan out so none hides another.
  const groups = new Map<string, string[]>()
  const links = Object.values(map.links).filter((link) => byId.has(link.from) && byId.has(link.to))
  for (const link of links) {
    const key = link.from < link.to ? `${link.from}|${link.to}` : `${link.to}|${link.from}`
    groups.set(key, [...(groups.get(key) ?? []), link.id])
  }

  const edges: Edge[] = []
  for (const link of links) {
    const a = byId.get(link.from) as Placed
    const b = byId.get(link.to) as Placed
    const key = link.from < link.to ? `${link.from}|${link.to}` : `${link.to}|${link.from}`
    const group = groups.get(key) as string[]
    const bow = (group.indexOf(link.id) - (group.length - 1) / 2) * LINK_BOW

    const ax = a.x + a.w / 2
    const ay = a.y + a.h / 2
    const bx = b.x + b.w / 2
    const by = b.y + b.h / 2
    // The bow is measured against a fixed direction (low id to high id) so the sides stay consistent.
    const [lx, ly, hx, hy] = link.from < link.to ? [ax, ay, bx, by] : [bx, by, ax, ay]
    const length = Math.hypot(hx - lx, hy - ly) || 1
    const cx = (ax + bx) / 2 + (-(hy - ly) / length) * bow
    const cy = (ay + by) / 2 + ((hx - lx) / length) * bow

    const p1 = outlinePoint(a, cx, cy)
    const p2 = outlinePoint(b, cx, cy)
    edges.push({
      id: link.id,
      d: `M ${round(p1.x)} ${round(p1.y)} Q ${round(cx)} ${round(cy)} ${round(p2.x)} ${round(p2.y)}`,
      // The middle of the curve, where the label sits.
      label: {
        x: round(0.25 * p1.x + 0.5 * cx + 0.25 * p2.x),
        y: round(0.25 * p1.y + 0.5 * cy + 0.25 * p2.y),
        text: link.label,
      },
      directed: link.directed,
    })
  }

  return finishLayout(nodes, edges, 'y')
}
