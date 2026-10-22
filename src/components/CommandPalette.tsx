import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmDeleteMap, exportMarkdown, openMapFromFile, saveMapToFile } from '../actions'
import { mapTitle } from '../model/tree'
import { MOD, SHIFT } from '../platform'
import {
  addChildToSelected,
  addSiblingToSelected,
  deleteSelected,
  getState,
  newMap,
  openMap,
  redo,
  requestFit,
  selectActiveMap,
  setPalette,
  startEdit,
  toggleCollapse,
  toggleSidebar,
  undo,
} from '../store'
import { MapIcon } from './icons'
import { Kbd } from './Kbd'

interface Command {
  id: string
  title: string
  group: 'Actions' | 'Maps'
  keys?: string[]
  run: () => void
}

/** Built once when the palette opens, so it only lists what makes sense for the current selection. */
function buildCommands(): Command[] {
  const state = getState()
  const map = selectActiveMap(state)
  const selected = map && state.selectedId ? map.nodes[state.selectedId] : undefined
  const commands: Command[] = [{ id: 'new-map', title: 'New map', group: 'Actions', keys: [MOD, 'N'], run: newMap }]

  if (map) {
    commands.push(
      { id: 'add-child', title: 'Add child idea', group: 'Actions', keys: ['Tab'], run: addChildToSelected },
      { id: 'add-sibling', title: 'Add sibling idea', group: 'Actions', keys: ['Enter'], run: addSiblingToSelected },
    )
    if (selected) {
      commands.push({ id: 'rename', title: 'Rename idea', group: 'Actions', keys: ['Space'], run: () => startEdit() })
      if (selected.id !== map.rootId) {
        commands.push({ id: 'delete-idea', title: 'Delete idea', group: 'Actions', keys: ['Del'], run: deleteSelected })
      }
      if (selected.children.length > 0) {
        commands.push({
          id: 'collapse',
          title: selected.collapsed ? 'Expand branch' : 'Collapse branch',
          group: 'Actions',
          keys: ['C'],
          run: () => toggleCollapse(),
        })
      }
    }
  }
  if (state.history.past.length > 0) commands.push({ id: 'undo', title: 'Undo', group: 'Actions', keys: [MOD, 'Z'], run: undo })
  if (state.history.future.length > 0) {
    commands.push({ id: 'redo', title: 'Redo', group: 'Actions', keys: [MOD, SHIFT, 'Z'], run: redo })
  }
  commands.push(
    { id: 'fit', title: 'Fit map to screen', group: 'Actions', keys: [MOD, '0'], run: requestFit },
    { id: 'sidebar', title: state.sidebarOpen ? 'Hide sidebar' : 'Show sidebar', group: 'Actions', keys: [MOD, '\\'], run: toggleSidebar },
    { id: 'open-file', title: 'Open map from file', group: 'Actions', run: () => void openMapFromFile() },
  )
  if (map) {
    commands.push(
      { id: 'save-file', title: 'Save map to file', group: 'Actions', run: () => void saveMapToFile() },
      { id: 'export-md', title: 'Export map as Markdown', group: 'Actions', run: () => void exportMarkdown() },
      { id: 'delete-map', title: 'Delete map', group: 'Actions', run: () => confirmDeleteMap(map) },
    )
  }
  for (const m of state.workspace.maps) {
    commands.push({
      id: `map-${m.id}`,
      title: mapTitle(m),
      group: 'Maps',
      run: () => openMap(m.id),
    })
  }
  return commands
}

export function CommandPalette() {
  const commands = useMemo(buildCommands, [])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = commands.filter((command) => {
      const title = command.title.toLowerCase()
      return words.every((word) => title.includes(word))
    })
    if (words.length > 0) return matches
    // With no query, list every action but only a few maps; the rest are one search away.
    return [...matches.filter((c) => c.group === 'Actions'), ...matches.filter((c) => c.group === 'Maps').slice(0, 6)]
  }, [commands, query])

  const active = Math.min(index, Math.max(0, results.length - 1))

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const run = (command: Command | undefined): void => {
    if (!command) return
    setPalette(false)
    command.run()
  }

  return (
    <div
      className="palette-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setPalette(false)
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          className="palette-input"
          autoFocus
          value={query}
          placeholder="Type a command or search maps"
          spellCheck={false}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex(results.length ? (active + 1) % results.length : 0)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex(results.length ? (active - 1 + results.length) % results.length : 0)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(results[active])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setPalette(false)
            } else if (e.key === 'Tab') {
              e.preventDefault()
            }
          }}
        />

        {results.length === 0 ? (
          <div className="palette-empty">No commands or maps match. Try fewer words.</div>
        ) : (
          <ul className="palette-list" id="palette-list" role="listbox" ref={listRef}>
            {results.map((command, i) => (
              <li key={command.id} role="presentation">
                {(i === 0 || results[i - 1].group !== command.group) && <div className="palette-group">{command.group}</div>}
                <div
                  id={`cmd-${command.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  className={i === active ? 'palette-item active' : 'palette-item'}
                  onPointerMove={() => setIndex(i)}
                  onClick={() => run(command)}
                >
                  {command.group === 'Maps' && <MapIcon />}
                  <span className="palette-title">{command.title}</span>
                  {command.keys && <Kbd keys={command.keys} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
