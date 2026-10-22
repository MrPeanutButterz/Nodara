import { useEffect } from 'react'
import type { Direction } from './model/types'
import {
  addChildToSelected,
  addSiblingToSelected,
  cycleSelectedShape,
  deleteSelected,
  getState,
  moveSelection,
  newMap,
  nudgeSelected,
  redo,
  reorderSelected,
  requestFit,
  selectActiveDoc,
  selectNode,
  setPalette,
  startEdit,
  toggleCollapse,
  toggleSidebar,
  undo,
} from './store'

/** Keyboard control for the whole app. Typing in a node or in the palette is left alone. */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const state = getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'k') {
        e.preventDefault()
        setPalette(!state.paletteOpen)
        return
      }
      if (state.paletteOpen) return

      const target = e.target as HTMLElement | null
      // An open menu owns the arrow keys, Enter and Tab while it has focus.
      if (target?.closest('[role="menu"]')) return
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (mod) {
        if (key === 'n') {
          e.preventDefault()
          newMap()
        } else if (key === '\\') {
          e.preventDefault()
          toggleSidebar()
        } else if (key === '0') {
          e.preventDefault()
          requestFit()
        } else if (!typing && key === 'z') {
          // While typing, Cmd/Ctrl+Z undoes the text, not the map.
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (!typing && key === 'y') {
          e.preventDefault()
          redo()
        }
        return
      }
      if (typing) return

      const doc = selectActiveDoc(state)
      const isGraph = doc?.kind === 'graph'
      // Alt+arrow moves an idea in a graph, and reorders siblings in a tree (along the axis they run on).
      const altMove = (direction: Direction): void => {
        if (isGraph) nudgeSelected(direction)
        else if (doc?.kind === 'tree' && doc.layout === 'down') {
          if (direction === 'left') reorderSelected(-1)
          else if (direction === 'right') reorderSelected(1)
        } else if (direction === 'up') reorderSelected(-1)
        else if (direction === 'down') reorderSelected(1)
      }

      // Enter and Space on a focused button should still press it.
      const onButton = !!target?.closest('button')

      switch (e.key) {
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) moveSelection('left')
          else if (!e.repeat) addChildToSelected()
          break
        case 'Enter':
          if (onButton) return
          e.preventDefault()
          if (!e.repeat) addSiblingToSelected()
          break
        case 'F2':
          e.preventDefault()
          startEdit()
          break
        case ' ':
          if (onButton) return
          e.preventDefault()
          startEdit()
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          deleteSelected()
          break
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault()
          const direction = e.key.slice(5).toLowerCase() as Direction
          if (e.altKey) altMove(direction)
          else moveSelection(direction)
          break
        }
        case 'Escape':
          selectNode(null)
          break
        default:
          if (e.altKey || e.shiftKey) break
          if (key === 'c') toggleCollapse()
          else if (key === 's') cycleSelectedShape()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
