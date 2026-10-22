import { useEffect } from 'react'
import {
  addChildToSelected,
  addSiblingToSelected,
  deleteSelected,
  getState,
  moveSelection,
  newMap,
  redo,
  reorderSelected,
  requestFit,
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
          e.preventDefault()
          moveSelection('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveSelection('right')
          break
        case 'ArrowUp':
          e.preventDefault()
          if (e.altKey) reorderSelected(-1)
          else moveSelection('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          if (e.altKey) reorderSelected(1)
          else moveSelection('down')
          break
        case 'Escape':
          selectNode(null)
          break
        default:
          if (key === 'c' && !e.altKey && !e.shiftKey) toggleCollapse()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
