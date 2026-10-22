import { createGraph, graphToMarkdown, renameGraph, sanitizeGraph } from './graph'
import { createMap, renameNode, sanitizeMap, toMarkdown } from './tree'
import type { AnyMap, MapKind } from './types'

// Helpers that work on any kind of map, so callers need not care which one they hold.

export function mapTitle(doc: AnyMap): string {
  const title = doc.kind === 'tree' ? doc.nodes[doc.rootId]?.text : doc.title
  return title?.trim() || 'Untitled map'
}

export const nodeCount = (doc: AnyMap): number => Object.keys(doc.nodes).length

/** What kind the map is, for icons and wording. */
export function kindOf(doc: AnyMap): MapKind {
  if (doc.kind === 'graph') return doc.variant
  return doc.layout === 'timeline' ? 'timeline' : 'mindmap'
}

export function createDoc(kind: MapKind): AnyMap {
  switch (kind) {
    case 'concept':
      return createGraph('concept')
    case 'flowchart':
      return createGraph('flowchart')
    case 'timeline':
      return createMap('Timeline', 'timeline')
    default:
      return createMap()
  }
}

/** The idea a new or freshly opened map starts on. */
export function entryNodeId(doc: AnyMap): string | null {
  return doc.kind === 'tree' ? doc.rootId : (Object.keys(doc.nodes)[0] ?? null)
}

/** Renames a map: the root idea of a tree, or the title of a graph. */
export function renameDoc(doc: AnyMap, title: string): AnyMap {
  return doc.kind === 'tree' ? renameNode(doc, doc.rootId, title) : renameGraph(doc, title)
}

/** Rebuilds any map from untrusted data. Files without a kind come from the first version: trees. */
export function sanitizeDoc(raw: unknown): AnyMap | null {
  if (typeof raw === 'object' && raw !== null && (raw as { kind?: unknown }).kind === 'graph') return sanitizeGraph(raw)
  return sanitizeMap(raw)
}

export const docToMarkdown = (doc: AnyMap): string => (doc.kind === 'tree' ? toMarkdown(doc) : graphToMarkdown(doc))

export const KIND_LABEL: Record<MapKind, string> = {
  mindmap: 'Mind map',
  concept: 'Concept map',
  flowchart: 'Flowchart',
  timeline: 'Timeline',
}

export const KIND_HINT: Record<MapKind, string> = {
  mindmap: 'Ideas branching from one root',
  concept: 'Ideas anywhere, joined by labelled links',
  flowchart: 'Steps and decisions joined by arrows',
  timeline: 'Events along an axis, with details',
}

export const LAYOUT_LABEL = {
  right: 'Right',
  both: 'Left and right',
  down: 'Top down',
  radial: 'Radial',
  timeline: 'Timeline',
} as const

export const LAYOUT_HINT = {
  right: 'Ideas grow to the right',
  both: 'Ideas on both sides of the root',
  down: 'Like an organisation chart',
  radial: 'Ideas in rings around the root',
  timeline: 'Events along an axis',
} as const
