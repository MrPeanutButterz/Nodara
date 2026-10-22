import { useSyncExternalStore } from 'react'
import { createDoc, entryNodeId, renameDoc } from './model/doc'
import * as graph from './model/graph'
import { layoutGraph } from './model/graph-layout'
import { layoutMap, navigateSpatial } from './model/layout'
import * as tree from './model/tree'
import type { AnyMap, Direction, GraphMap, MapKind, MindMap, NodeShape, TreeLayout, Workspace } from './model/types'
import { loadWorkspace, saveWorkspace } from './persistence'

interface History {
  past: AnyMap[]
  future: AnyMap[]
}

export interface State {
  workspace: Workspace
  selectedId: string | null
  /** The selected link, in concept maps and flowcharts. Never set together with selectedId. */
  selectedLinkId: string | null
  editingId: string | null
  /** The link whose label is being typed. */
  editingLinkId: string | null
  /** True while editing an idea that was just created and has no text yet. */
  editingIsNew: boolean
  /** Text being typed, so the layout can follow along before it is committed. */
  draft: string
  /** The map title in the top bar is being renamed (graph maps; trees rename their root idea). */
  renamingTitle: boolean
  sidebarOpen: boolean
  paletteOpen: boolean
  history: History
  toast: string | null
}

const HISTORY_LIMIT = 100
const EMPTY_HISTORY: History = { past: [], future: [] }
export const FIT_EVENT = 'nodara:fit'
const NUDGE = 24

const NO_EDIT = { editingId: null, editingLinkId: null, editingIsNew: false, draft: '', renamingTitle: false }

function initialState(): State {
  let workspace = loadWorkspace()
  let fresh = false
  if (workspace.maps.length === 0) {
    const doc = createDoc('mindmap')
    workspace = { maps: [doc], activeMapId: doc.id }
    fresh = true
  }
  const doc = workspace.maps.find((m) => m.id === workspace.activeMapId) ?? workspace.maps[0]
  const entry = entryNodeId(doc)
  return {
    workspace: { ...workspace, activeMapId: doc.id },
    selectedId: entry,
    selectedLinkId: null,
    // First launch: let the person name the first idea straight away.
    ...NO_EDIT,
    editingId: fresh ? entry : null,
    draft: fresh && entry ? doc.nodes[entry].text : '',
    sidebarOpen: true,
    paletteOpen: false,
    history: EMPTY_HISTORY,
    toast: null,
  }
}

let state: State = initialState()
const listeners = new Set<() => void>()

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = (): State => state

/** Subscribe to a slice of state. The selector must return a stable reference (no fresh objects). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  )
}

export const selectActiveDoc = (s: State): AnyMap | undefined =>
  s.workspace.maps.find((map) => map.id === s.workspace.activeMapId)

const activeTree = (): MindMap | undefined => {
  const doc = selectActiveDoc(state)
  return doc?.kind === 'tree' ? doc : undefined
}
const activeGraph = (): GraphMap | undefined => {
  const doc = selectActiveDoc(state)
  return doc?.kind === 'graph' ? doc : undefined
}

// Persist the workspace shortly after it changes.
let lastSaved = state.workspace
let saveTimer: ReturnType<typeof setTimeout> | undefined
listeners.add(() => {
  if (state.workspace === lastSaved) return
  lastSaved = state.workspace
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveWorkspace(lastSaved), 300)
})
window.addEventListener('beforeunload', () => saveWorkspace(state.workspace))

// ---------------------------------------------------------------------------
// Editing the active map

function replaceMap(next: AnyMap): Workspace {
  return {
    ...state.workspace,
    maps: state.workspace.maps.map((map) => (map.id === next.id ? next : map)),
  }
}

function commit(next: AnyMap, record = true): void {
  const current = selectActiveDoc(state)
  if (!current || next === current) return
  set({
    workspace: replaceMap(next),
    history: record
      ? { past: [...state.history.past.slice(-(HISTORY_LIMIT - 1)), current], future: [] }
      : state.history,
  })
}

/** Throws away the most recent undo step without keeping it for redo. */
function discardLastChange(): void {
  const previous = state.history.past[state.history.past.length - 1]
  if (!previous) return
  set({
    workspace: replaceMap(previous),
    history: { past: state.history.past.slice(0, -1), future: state.history.future },
  })
}

export function selectNode(id: string | null): void {
  set({ selectedId: id, selectedLinkId: null })
}

export function selectLink(id: string | null): void {
  set({ selectedLinkId: id, selectedId: null })
}

export function startEditLink(id: string): void {
  const map = activeGraph()
  const link = map?.links[id]
  if (!link) return
  set({ selectedLinkId: id, selectedId: null, ...NO_EDIT, editingLinkId: id, draft: link.label })
}

/** Starts typing into the selected idea, or into the selected link's label. */
export function startEdit(id: string | null = state.selectedId): void {
  const doc = selectActiveDoc(state)
  if (!doc) return
  if (id === null) {
    if (state.selectedLinkId) startEditLink(state.selectedLinkId)
    return
  }
  const node = doc.nodes[id]
  if (!node) return
  set({ selectedId: id, selectedLinkId: null, ...NO_EDIT, editingId: id, draft: node.text })
}

export function setDraft(text: string): void {
  set({ draft: text })
}

const renameAny = (doc: AnyMap, id: string, text: string): AnyMap =>
  doc.kind === 'tree' ? tree.renameNode(doc, id, text) : graph.renameGraphNode(doc, id, text)

/**
 * Ends the current edit. With `save` false (Escape) nothing changes, except that an idea that was
 * just created and never named is thrown away. A link's label may be saved empty to clear it.
 */
export function commitEdit(text: string, save = true): void {
  const doc = selectActiveDoc(state)
  if (!doc) return

  if (state.editingLinkId) {
    if (save && doc.kind === 'graph') commit(graph.setLinkLabel(doc, state.editingLinkId, text.trim()))
    set(NO_EDIT)
    return
  }

  const id = state.editingId
  if (!id) return
  const node = doc.nodes[id]
  if (!node) {
    set(NO_EDIT)
    return
  }

  const value = text.trim()
  if (state.editingIsNew) {
    if (!save || !value) {
      // The idea's creation was the last history step; undo it instead of adding another.
      let back: string | null = null
      if (doc.kind === 'tree') back = (node as { parentId: string | null }).parentId ?? id
      else back = Object.values(doc.links).find((link) => link.to === id)?.from ?? null
      discardLastChange()
      set({ ...NO_EDIT, selectedId: back, selectedLinkId: null })
      return
    }
    // Creating and naming an idea is one undo step.
    commit(renameAny(doc, id, value), false)
  } else if (save && value && value !== node.text) {
    commit(renameAny(doc, id, value))
  }
  set(NO_EDIT)
}

export const cancelEdit = (): void => commitEdit('', false)

function startNewIdea(id: string): void {
  set({ selectedId: id, selectedLinkId: null, ...NO_EDIT, editingId: id, editingIsNew: true })
}

/** Tab: a child idea in a tree, an idea joined to the selected one in a graph. */
export function addChildToSelected(): void {
  const map = activeTree()
  if (map) {
    const from = state.selectedId && map.nodes[state.selectedId] ? state.selectedId : map.rootId
    const created = tree.addChild(map, from)
    commit(created.map)
    startNewIdea(created.id)
    return
  }
  const doc = activeGraph()
  if (!doc) return
  const from = state.selectedId && doc.nodes[state.selectedId] ? state.selectedId : undefined
  if (from) {
    const created = graph.addConnected(doc, from)
    if (created) {
      commit(created.map)
      startNewIdea(created.id)
    }
  } else {
    addIdeaAt(0, 0)
  }
}

/** Enter: a sibling in a tree, a loose idea below the selected one in a graph. */
export function addSiblingToSelected(): void {
  const map = activeTree()
  if (map) {
    const from = state.selectedId && map.nodes[state.selectedId] ? state.selectedId : map.rootId
    const created = tree.addSibling(map, from)
    commit(created.map)
    startNewIdea(created.id)
    return
  }
  const doc = activeGraph()
  if (!doc) return
  const from = state.selectedId && doc.nodes[state.selectedId] ? state.selectedId : undefined
  const created = from ? graph.addBelow(doc, from) : graph.addGraphNode(doc, 0, 0)
  if (created) {
    commit(created.map)
    startNewIdea(created.id)
  }
}

export function deleteSelected(): void {
  const doc = selectActiveDoc(state)
  if (!doc) return
  if (doc.kind === 'graph' && state.selectedLinkId) {
    commit(graph.removeLink(doc, state.selectedLinkId))
    set({ selectedLinkId: null, ...NO_EDIT })
    return
  }
  const id = state.selectedId
  if (!id || !doc.nodes[id]) return
  if (doc.kind === 'tree') {
    if (id === doc.rootId) return
    const removed = tree.removeNode(doc, id)
    commit(removed.map)
    set({ selectedId: removed.selectId, ...NO_EDIT })
  } else {
    const removed = graph.removeGraphNode(doc, id)
    commit(removed.map)
    set({ selectedId: removed.selectId, selectedLinkId: null, ...NO_EDIT })
  }
}

export function toggleCollapse(id: string | null = state.selectedId): void {
  const map = activeTree()
  if (map && id) commit(tree.toggleCollapse(map, id))
}

export function reorderSelected(delta: -1 | 1): void {
  const map = activeTree()
  if (map && state.selectedId) commit(tree.reorderNode(map, state.selectedId, delta))
}

export function moveNodeTo(id: string, parentId: string, index?: number): void {
  const map = activeTree()
  if (map) commit(tree.moveNode(map, id, parentId, index))
}

export function moveSelection(direction: Direction): void {
  const doc = selectActiveDoc(state)
  if (!doc) return
  const current = state.selectedId
  if (!current || !doc.nodes[current]) {
    const entry = entryNodeId(doc)
    if (entry) set({ selectedId: entry, selectedLinkId: null })
    return
  }
  if (doc.kind === 'tree') {
    if (doc.nodes[current].collapsed) {
      // Stepping towards the hidden children opens the branch instead of moving away from it.
      const open = tree.toggleCollapse(doc, current)
      const target = navigateSpatial(layoutMap(open), current, direction, tree.treeRelatives(open, current))
      if (open.nodes[current].children.includes(target)) {
        toggleCollapse(current)
        return
      }
    }
    const next = navigateSpatial(layoutMap(doc), current, direction, tree.treeRelatives(doc, current))
    if (next !== current) set({ selectedId: next })
    return
  }
  const next = navigateSpatial(layoutGraph(doc), current, direction, graph.graphNeighbours(doc, current))
  if (next !== current) set({ selectedId: next })
}

function restore(snapshot: AnyMap, history: History): void {
  const selectedId = state.selectedId && snapshot.nodes[state.selectedId] ? state.selectedId : entryNodeId(snapshot)
  const link = snapshot.kind === 'graph' && state.selectedLinkId && snapshot.links[state.selectedLinkId]
  set({
    workspace: replaceMap(snapshot),
    history,
    selectedId: link ? null : selectedId,
    selectedLinkId: link ? state.selectedLinkId : null,
    ...NO_EDIT,
  })
}

export function undo(): void {
  const current = selectActiveDoc(state)
  const previous = state.history.past[state.history.past.length - 1]
  if (!current || !previous) return
  restore(previous, { past: state.history.past.slice(0, -1), future: [current, ...state.history.future] })
}

export function redo(): void {
  const current = selectActiveDoc(state)
  const [next, ...rest] = state.history.future
  if (!current || !next) return
  restore(next, { past: [...state.history.past, current], future: rest })
}

// ---------------------------------------------------------------------------
// Tree layout

export function setTreeLayout(layout: TreeLayout): void {
  const map = activeTree()
  if (!map || map.layout === layout) return
  commit(tree.setLayout(map, layout))
  // Wait for the new layout to render before fitting the view to it.
  setTimeout(requestFit, 30)
}

// ---------------------------------------------------------------------------
// Concept maps and flowcharts

/** Adds an idea at a spot on the canvas and starts typing into it. */
export function addIdeaAt(x: number, y: number): void {
  const doc = activeGraph()
  if (!doc) return
  const created = graph.addGraphNode(doc, x, y)
  commit(created.map)
  startNewIdea(created.id)
}

/** Adds an idea at a spot, joined to `fromId`, and starts typing into it. */
export function addConnectedIdeaAt(fromId: string, x: number, y: number): void {
  const doc = activeGraph()
  const created = doc && graph.addConnectedAt(doc, fromId, x, y)
  if (!created) return
  commit(created.map)
  startNewIdea(created.id)
}

export function connectIdeas(from: string, to: string): void {
  const doc = activeGraph()
  const linked = doc && graph.connect(doc, from, to)
  if (!linked) return
  commit(linked.map)
  selectLink(linked.linkId)
}

export function moveIdeaTo(id: string, x: number, y: number): void {
  const doc = activeGraph()
  if (doc) commit(graph.moveGraphNode(doc, id, x, y))
}

export function nudgeSelected(direction: Direction): void {
  const doc = activeGraph()
  if (!doc || !state.selectedId) return
  const dx = direction === 'left' ? -NUDGE : direction === 'right' ? NUDGE : 0
  const dy = direction === 'up' ? -NUDGE : direction === 'down' ? NUDGE : 0
  commit(graph.nudgeGraphNode(doc, state.selectedId, dx, dy))
}

export function setSelectedShape(shape: NodeShape): void {
  const doc = activeGraph()
  if (doc && doc.variant === 'flowchart' && state.selectedId) commit(graph.setShape(doc, state.selectedId, shape))
}

export function cycleSelectedShape(): void {
  const doc = activeGraph()
  if (doc && doc.variant === 'flowchart' && state.selectedId) commit(graph.cycleShape(doc, state.selectedId))
}

export function toggleSelectedLinkArrow(): void {
  const doc = activeGraph()
  if (doc && state.selectedLinkId) commit(graph.toggleLinkArrow(doc, state.selectedLinkId))
}

export function reverseSelectedLink(): void {
  const doc = activeGraph()
  if (doc && state.selectedLinkId) commit(graph.reverseLink(doc, state.selectedLinkId))
}

// ---------------------------------------------------------------------------
// Maps

function activate(doc: AnyMap, maps: AnyMap[], startEditing: boolean): void {
  const entry = entryNodeId(doc)
  set({
    workspace: { maps, activeMapId: doc.id },
    selectedId: entry,
    selectedLinkId: null,
    ...NO_EDIT,
    editingId: startEditing ? entry : null,
    draft: startEditing && entry ? doc.nodes[entry].text : '',
    history: EMPTY_HISTORY,
  })
}

export function newMap(kind: MapKind = 'mindmap'): void {
  const doc = createDoc(kind)
  activate(doc, [doc, ...state.workspace.maps], true)
}

export function openMap(id: string): void {
  const doc = state.workspace.maps.find((m) => m.id === id)
  if (doc && doc.id !== state.workspace.activeMapId) activate(doc, state.workspace.maps, false)
}

export function deleteMap(id: string): void {
  const remaining = state.workspace.maps.filter((map) => map.id !== id)
  if (remaining.length === state.workspace.maps.length) return
  if (remaining.length === 0) {
    const doc = createDoc('mindmap')
    activate(doc, [doc], true)
    return
  }
  const next = id === state.workspace.activeMapId ? remaining[0] : selectActiveDoc(state) ?? remaining[0]
  activate(next, remaining, false)
}

/** Adds a map from a file. It gets a fresh id if one with the same id is already here. */
export function importMap(doc: AnyMap): void {
  const taken = state.workspace.maps.some((m) => m.id === doc.id)
  const incoming = taken ? { ...doc, id: tree.newId({}) } : doc
  activate(incoming, [incoming, ...state.workspace.maps], false)
}

/** Renaming a tree means renaming its root idea; a graph map has a title of its own. */
export function startRenameMap(): void {
  const doc = selectActiveDoc(state)
  if (!doc) return
  if (doc.kind === 'tree') startEdit(doc.rootId)
  else set({ ...NO_EDIT, renamingTitle: true })
}

export function renameMap(title: string): void {
  const doc = selectActiveDoc(state)
  const value = title.trim()
  if (doc && value) commit(renameDoc(doc, value))
  set({ renamingTitle: false })
}

// ---------------------------------------------------------------------------
// Interface

export const toggleSidebar = (): void => set({ sidebarOpen: !state.sidebarOpen })
export const setPalette = (open: boolean): void => set({ paletteOpen: open })
export const requestFit = (): void => {
  window.dispatchEvent(new Event(FIT_EVENT))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(message: string): void {
  clearTimeout(toastTimer)
  set({ toast: message })
  toastTimer = setTimeout(() => set({ toast: null }), 2800)
}
