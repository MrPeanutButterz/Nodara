import { useEffect, useRef, useState } from 'react'
import { KIND_LABEL, LAYOUT_HINT, LAYOUT_LABEL, kindOf, mapTitle } from '../model/doc'
import { TREE_LAYOUTS } from '../model/tree'
import { MOD } from '../platform'
import { redo, renameMap, selectActiveDoc, setPalette, setTreeLayout, startRenameMap, toggleSidebar, undo, useStore } from '../store'
import { ChevronDownIcon, ChevronIcon, KindIcon, RedoIcon, SearchIcon, SidebarIcon, UndoIcon } from './icons'
import { Kbd } from './Kbd'
import { Menu } from './Menu'

export function Topbar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const doc = useStore(selectActiveDoc)
  const renaming = useStore((s) => s.renamingTitle)
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)

  return (
    <header className="topbar drag">
      {!sidebarOpen && (
        <button
          className="icon-btn nodrag"
          onClick={toggleSidebar}
          title={`Show sidebar (${MOD}+\\)`}
          aria-label="Show sidebar"
        >
          <SidebarIcon />
        </button>
      )}

      <div className="crumbs">
        <span className="crumb-dim">Maps</span>
        <ChevronIcon />
        {doc && renaming ? (
          <TitleInput initial={mapTitle(doc)} />
        ) : (
          <span className="crumb-title nodrag" title="Double-click to rename" onDoubleClick={startRenameMap}>
            {doc ? mapTitle(doc) : ''}
          </span>
        )}
        {doc && <span className="kind-chip">{KIND_LABEL[kindOf(doc)]}</span>}
      </div>

      <div className="topbar-actions nodrag">
        {doc?.kind === 'tree' && (
          <Menu
            label="Layout"
            buttonClassName="layout-btn"
            trigger={
              <>
                <span>{LAYOUT_LABEL[doc.layout]}</span>
                <ChevronDownIcon />
              </>
            }
            items={TREE_LAYOUTS.map((layout) => ({
              id: layout,
              label: LAYOUT_LABEL[layout],
              description: LAYOUT_HINT[layout],
              checked: doc.layout === layout,
              onSelect: () => setTreeLayout(layout),
            }))}
          />
        )}
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title={`Undo (${MOD}+Z)`} aria-label="Undo">
          <UndoIcon />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title={`Redo (${MOD}+Shift+Z)`} aria-label="Redo">
          <RedoIcon />
        </button>
        <button className="cmd-btn" onClick={() => setPalette(true)}>
          <SearchIcon />
          <span>Commands</span>
          <Kbd keys={[MOD, 'K']} />
        </button>
      </div>
    </header>
  )
}

/** Renames a concept map or flowchart. Enter saves, Escape or clicking away keeps the old name. */
function TitleInput({ initial }: { initial: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (save: boolean): void => {
    done.current = true
    renameMap(save ? value : '')
  }
  return (
    <input
      ref={ref}
      className="title-input nodrag"
      value={value}
      maxLength={200}
      aria-label="Map name"
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => {
        if (!done.current) finish(true)
      }}
    />
  )
}
