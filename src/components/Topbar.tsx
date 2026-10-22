import { mapTitle } from '../model/tree'
import { MOD } from '../platform'
import { redo, selectActiveMap, setPalette, toggleSidebar, undo, useStore } from '../store'
import { ChevronIcon, RedoIcon, SearchIcon, SidebarIcon, UndoIcon } from './icons'
import { Kbd } from './Kbd'

export function Topbar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const map = useStore(selectActiveMap)
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
        <span className="crumb-title">{map ? mapTitle(map) : ''}</span>
      </div>

      <div className="topbar-actions nodrag">
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
