export interface MapNode {
  id: string
  text: string
  parentId: string | null
  children: string[]
  collapsed: boolean
}

export interface MindMap {
  id: string
  rootId: string
  nodes: Record<string, MapNode>
  updatedAt: number
}

export interface Workspace {
  maps: MindMap[]
  activeMapId: string | null
}

export type Direction = 'left' | 'right' | 'up' | 'down'
export type DropMode = 'child' | 'before' | 'after'
