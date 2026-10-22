import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmDeleteMap, exportMarkdown, openMapFromFile, saveMapToFile } from '../actions'
import { KIND_LABEL, LAYOUT_LABEL, kindOf, mapTitle } from '../model/doc'
import { TREE_LAYOUTS } from '../model/tree'
import type { MapKind } from '../model/types'
import { MOD, SHIFT } from '../platform'
import {
  addChildToSelected,
  addSiblingToSelected,
  deleteSelected,
  getState,
  newMap,
  openMap,
  cycleSelectedShape,
  redo,
  requestFit,
  reverseSelectedLink,
  selectActiveDoc,
  setPalette,
  setTreeLayout,
  startEdit,
  startEditLink,
  startRenameMap,
  toggleSelectedLinkArrow,
  toggleCollapse,
  toggleSidebar,
  undo,
} from '../store'
import { ChevronIcon, KindIcon } from './icons'
import { Kbd } from './Kbd'

type Step = 'kind' | 'layout'

interface Command {
  id: string
  title: string
  group: 'Actions' | 'Maps' | 'New map' | 'Layout'
  /** Opens a second step in the palette instead of running right away. */
  opensStep?: Step
  /** Only listed in that second step (and found by typing in the main list). */
  inStep?: Step
  keys?: string[]
  kind?: MapKind
  run: () => void
}

const NEW_KINDS: MapKind[] = ['mindmap', 'concept', 'flowchart', 'timeline']

/** Built once when the palette opens, so it only lists what makes sense for the current selection. */
function buildCommands(): Command[] {
  const state = getState()
  const doc = selectActiveDoc(state)
  const commands: Command[] = [
    { id: 'new-map', title: 'New map', group: 'Actions', opensStep: 'kind', run: () => undefined },
  ]

  if (doc) {
    const isGraph = doc.kind === 'graph'
    const selected = state.selectedId ? doc.nodes[state.selectedId] : undefined
    commands.push(
      { id: 'rename-map', title: 'Rename map', group: 'Actions', run: startRenameMap },
      {
        id: 'add-child',
        title: isGraph ? 'Add connected idea' : doc.layout === 'timeline' ? 'Add detail' : 'Add child idea',
        group: 'Actions',
        keys: ['Tab'],
        run: addChildToSelected,
      },
      {
        id: 'add-sibling',
        title: isGraph ? 'Add idea below' : doc.layout === 'timeline' ? 'Add event' : 'Add sibling idea',
        group: 'Actions',
        keys: ['Enter'],
        run: addSiblingToSelected,
      },
    )
    if (doc.kind === 'tree') {
      commands.push({ id: 'layout', title: 'Layout', group: 'Actions', opensStep: 'layout', run: () => undefined })
      for (const layout of TREE_LAYOUTS) {
        if (layout === doc.layout) continue
        commands.push({
          id: `layout-${layout}`,
          title: `Layout: ${LAYOUT_LABEL[layout]}`,
          group: 'Layout',
          inStep: 'layout',
          run: () => setTreeLayout(layout),
        })
      }
    }
    if (selected) {
      commands.push({ id: 'rename', title: 'Rename idea', group: 'Actions', keys: ['Space'], run: () => startEdit() })
      const isRoot = doc.kind === 'tree' && selected.id === doc.rootId
      if (!isRoot) commands.push({ id: 'delete-idea', title: 'Delete idea', group: 'Actions', keys: ['Del'], run: deleteSelected })
      if ('children' in selected && selected.children.length > 0) {
        commands.push({
          id: 'collapse',
          title: selected.collapsed ? 'Expand branch' : 'Collapse branch',
          group: 'Actions',
          keys: ['C'],
          run: () => toggleCollapse(),
        })
      }
      if (doc.kind === 'graph' && doc.variant === 'flowchart') {
        commands.push({ id: 'shape', title: 'Change shape', group: 'Actions', keys: ['S'], run: cycleSelectedShape })
      }
    }
    if (doc.kind === 'graph' && state.selectedLinkId) {
      commands.push(
        { id: 'link-label', title: 'Edit link label', group: 'Actions', keys: ['Space'], run: () => startEditLink(state.selectedLinkId as string) },
        { id: 'link-arrow', title: 'Toggle link arrow', group: 'Actions', run: toggleSelectedLinkArrow },
        { id: 'link-reverse', title: 'Reverse link direction', group: 'Actions', run: reverseSelectedLink },
        { id: 'delete-link', title: 'Delete link', group: 'Actions', keys: ['Del'], run: deleteSelected },
      )
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
  if (doc) {
    commands.push(
      { id: 'save-file', title: 'Save map to file', group: 'Actions', run: () => void saveMapToFile() },
      { id: 'export-md', title: 'Export map as Markdown', group: 'Actions', run: () => void exportMarkdown() },
      { id: 'delete-map', title: 'Delete map', group: 'Actions', run: () => confirmDeleteMap(doc) },
    )
  }
  for (const m of state.workspace.maps) {
    commands.push({ id: `map-${m.id}`, title: mapTitle(m), group: 'Maps', kind: kindOf(m), run: () => openMap(m.id) })
  }
  return commands
}

/** The second step after "New map": one row per kind of map. */
const KIND_COMMANDS: Command[] = NEW_KINDS.map((kind) => ({
  inStep: 'kind' as const,
  id: `new-${kind}`,
  title: KIND_LABEL[kind],
  group: 'New map' as const,
  kind,
  keys: kind === 'mindmap' ? [MOD, 'N'] : undefined,
  run: () => newMap(kind),
}))

export function CommandPalette() {
  const commands = useMemo(buildCommands, [])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    // Typing in the main list still finds "New flowchart" and the like directly.
    const direct = KIND_COMMANDS.map((c) => ({ ...c, title: `New ${c.title.toLowerCase()}`, group: 'Actions' as const, keys: undefined }))
    const pool = step
      ? step === 'kind'
        ? KIND_COMMANDS
        : commands.filter((c) => c.inStep === step)
      : words.length > 0
        ? [...commands, ...direct]
        : commands
    const matches = pool.filter((command) => {
      const title = command.title.toLowerCase()
      return words.every((word) => title.includes(word))
    })
    if (words.length > 0 || step) return matches
    // With no query, list every action but only a few maps; the rest are one search away.
    return [...matches.filter((c) => c.group === 'Actions'), ...matches.filter((c) => c.group === 'Maps').slice(0, 6)]
  }, [commands, query, step])

  const active = Math.min(index, Math.max(0, results.length - 1))

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const run = (command: Command | undefined): void => {
    if (!command) return
    if (command.opensStep) {
      setStep(command.opensStep)
      setQuery('')
      setIndex(0)
      return
    }
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
          placeholder={step === 'kind' ? 'Choose a kind of map' : step === 'layout' ? 'Choose a layout' : 'Type a command or search maps'}
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
            } else if (e.key === 'Escape' || (e.key === 'Backspace' && step && query === '')) {
              e.preventDefault()
              // From the list of kinds, one step back; from anywhere else, close.
              if (step) {
                setStep(null)
                setQuery('')
                setIndex(0)
              } else setPalette(false)
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
                  {command.kind && <KindIcon kind={command.kind} />}
                  <span className="palette-title">{step === 'layout' ? command.title.replace(/^Layout: /, '') : command.title}</span>
                  {command.keys && <Kbd keys={command.keys} />}
                  {command.opensStep && <ChevronIcon />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
