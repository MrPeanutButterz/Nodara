import { useSyncExternalStore } from 'react'
import * as tree from './model/tree'
import type { Direction, MindMap, Workspace } from './model/types'
import { loadWorkspace, saveWorkspace } from './persistence'

interface History {
  past: MindMap[]
  future: MindMap[]
}

export interface State {
  workspace: Workspace
  selectedId: string | null
  editingId: string | null
  /** True while editing a node that was just created and has no text yet. */
  editingIsNew: boolean
  /** Text being typed, so the layout can follow along before it is committed. */
  draft: string
  sidebarOpen: boolean
  paletteOpen: boolean
  history: History
  toast: string | null
}

const HISTORY_LIMIT = 100
const EMPTY_HISTORY: History = { past: [], future: [] }
export const FIT_EVENT = 'nodara:fit'

function initialState(): State {
  let workspace = loadWorkspace()
  let fresh = false
  if (workspace.maps.length === 0) {
    const map = tree.createMap()
    workspace = { maps: [map], activeMapId: map.id }
    fresh = true
  }
  const map = workspace.maps.find((m) => m.id === workspace.activeMapId) ?? workspace.maps[0]
  return {
    workspace: { ...workspace, activeMapId: map.id },
    selectedId: map.rootId,
    // First launch: let the person name the first idea straight away.
    editingId: fresh ? map.rootId : null,
    editingIsNew: false,
    draft: fresh ? map.nodes[map.rootId].text : '',
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

export const selectActiveMap = (s: State): MindMap | undefined =>
  s.workspace.maps.find((map) => map.id === s.workspace.activeMapId)

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

function replaceMap(next: MindMap): Workspace {
  return {
    ...state.workspace,
    maps: state.workspace.maps.map((map) => (map.id === next.id ? next : map)),
  }
}

function commit(next: MindMap, record = true): void {
  const current = selectActiveMap(state)
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
  set({ selectedId: id })
}

export function startEdit(id: string | null = state.selectedId): void {
  const map = selectActiveMap(state)
  if (!map || !id || !map.nodes[id]) return
  set({ selectedId: id, editingId: id, editingIsNew: false, draft: map.nodes[id].text })
}

export function setDraft(text: string): void {
  set({ draft: text })
}

/** Saves the text being edited. An empty new node is discarded; an empty existing one is left unchanged. */
export function commitEdit(text: string): void {
  const map = selectActiveMap(state)
  const id = state.editingId
  if (!id || !map) return
  const node = map.nodes[id]
  const done = { editingId: null, editingIsNew: false, draft: '' }
  if (!node) {
    set(done)
    return
  }

  const value = text.trim()
  if (state.editingIsNew) {
    if (!value) {
      // The node's creation was the last history step; undo it instead of adding another.
      discardLastChange()
      set({ ...done, selectedId: node.parentId ?? id })
      return
    }
    // Creating and naming a node is one undo step.
    commit(tree.renameNode(map, id, value), false)
  } else if (value && value !== node.text) {
    commit(tree.renameNode(map, id, value))
  }
  set(done)
}

export const cancelEdit = (): void => commitEdit('')

function createAndEdit(make: (map: MindMap, from: string) => { map: MindMap; id: string }): void {
  const map = selectActiveMap(state)
  if (!map) return
  const from = state.selectedId && map.nodes[state.selectedId] ? state.selectedId : map.rootId
  const created = make(map, from)
  commit(created.map)
  set({ selectedId: created.id, editingId: created.id, editingIsNew: true, draft: '' })
}

export const addChildToSelected = (): void => createAndEdit((map, from) => tree.addChild(map, from))
export const addSiblingToSelected = (): void => createAndEdit((map, from) => tree.addSibling(map, from))

export function deleteSelected(): void {
  const map = selectActiveMap(state)
  const id = state.selectedId
  if (!map || !id || id === map.rootId || !map.nodes[id]) return
  const removed = tree.removeNode(map, id)
  commit(removed.map)
  set({ selectedId: removed.selectId, editingId: null, editingIsNew: false, draft: '' })
}

export function toggleCollapse(id: string | null = state.selectedId): void {
  const map = selectActiveMap(state)
  if (map && id) commit(tree.toggleCollapse(map, id))
}

export function reorderSelected(delta: -1 | 1): void {
  const map = selectActiveMap(state)
  if (map && state.selectedId) commit(tree.reorderNode(map, state.selectedId, delta))
}

export function moveNodeTo(id: string, parentId: string, index?: number): void {
  const map = selectActiveMap(state)
  if (map) commit(tree.moveNode(map, id, parentId, index))
}

export function moveSelection(direction: Direction): void {
  const map = selectActiveMap(state)
  if (!map) return
  const current = state.selectedId
  if (!current || !map.nodes[current]) {
    set({ selectedId: map.rootId })
    return
  }
  // Stepping right into a collapsed branch opens it first.
  if (direction === 'right' && map.nodes[current].collapsed) {
    toggleCollapse(current)
    return
  }
  const next = tree.navigate(map, current, direction)
  if (next !== current) set({ selectedId: next })
}

function restore(snapshot: MindMap, history: History): void {
  const selectedId = state.selectedId && snapshot.nodes[state.selectedId] ? state.selectedId : snapshot.rootId
  set({ workspace: replaceMap(snapshot), history, selectedId, editingId: null, editingIsNew: false, draft: '' })
}

export function undo(): void {
  const current = selectActiveMap(state)
  const previous = state.history.past[state.history.past.length - 1]
  if (!current || !previous) return
  restore(previous, { past: state.history.past.slice(0, -1), future: [current, ...state.history.future] })
}

export function redo(): void {
  const current = selectActiveMap(state)
  const [next, ...rest] = state.history.future
  if (!current || !next) return
  restore(next, { past: [...state.history.past, current], future: rest })
}

// ---------------------------------------------------------------------------
// Maps

function activate(map: MindMap, maps: MindMap[], editRoot: boolean): void {
  set({
    workspace: { maps, activeMapId: map.id },
    selectedId: map.rootId,
    editingId: editRoot ? map.rootId : null,
    editingIsNew: false,
    draft: editRoot ? map.nodes[map.rootId].text : '',
    history: EMPTY_HISTORY,
  })
}

export function newMap(): void {
  const map = tree.createMap()
  activate(map, [map, ...state.workspace.maps], true)
}

export function openMap(id: string): void {
  const map = state.workspace.maps.find((m) => m.id === id)
  if (map && map.id !== state.workspace.activeMapId) activate(map, state.workspace.maps, false)
}

export function deleteMap(id: string): void {
  const remaining = state.workspace.maps.filter((map) => map.id !== id)
  if (remaining.length === state.workspace.maps.length) return
  if (remaining.length === 0) {
    const map = tree.createMap()
    activate(map, [map], true)
    return
  }
  const next = id === state.workspace.activeMapId ? remaining[0] : selectActiveMap(state) ?? remaining[0]
  activate(next, remaining, false)
}

/** Adds a map from a file. It gets a fresh id if one with the same id is already here. */
export function importMap(map: MindMap): void {
  const taken = state.workspace.maps.some((m) => m.id === map.id)
  const incoming = taken ? { ...map, id: tree.newId({}) } : map
  activate(incoming, [incoming, ...state.workspace.maps], false)
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
