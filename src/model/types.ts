/** How a tree map is drawn. The ideas themselves are the same in every layout. */
export type TreeLayout = 'right' | 'both' | 'down' | 'radial' | 'timeline'
export type GraphVariant = 'concept' | 'flowchart'
export type NodeShape = 'process' | 'decision' | 'terminal'

/** What the person picks in "New map". A timeline is a tree drawn along an axis. */
export type MapKind = 'mindmap' | 'concept' | 'flowchart' | 'timeline'

export interface MapNode {
  id: string
  text: string
  parentId: string | null
  children: string[]
  collapsed: boolean
}

/** A tree of ideas growing from one root: mind maps and timelines. */
export interface MindMap {
  kind: 'tree'
  id: string
  layout: TreeLayout
  rootId: string
  nodes: Record<string, MapNode>
  updatedAt: number
}

export interface GraphNode {
  id: string
  text: string
  /** Centre of the node on the canvas. */
  x: number
  y: number
  /** Only flowcharts draw shapes; concept maps always use the same rounded box. */
  shape: NodeShape
}

export interface GraphLink {
  id: string
  from: string
  to: string
  label: string
  directed: boolean
}

/** Freely placed ideas joined by links that can carry a label: concept maps and flowcharts. */
export interface GraphMap {
  kind: 'graph'
  id: string
  variant: GraphVariant
  title: string
  nodes: Record<string, GraphNode>
  links: Record<string, GraphLink>
  updatedAt: number
}

export type AnyMap = MindMap | GraphMap

export interface Workspace {
  maps: AnyMap[]
  activeMapId: string | null
}

export type Direction = 'left' | 'right' | 'up' | 'down'
export type DropMode = 'child' | 'before' | 'after'
