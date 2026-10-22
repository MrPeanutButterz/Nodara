import { confirmDeleteMap } from '../actions'
import { mapTitle } from '../model/tree'
import { MOD } from '../platform'
import { newMap, openMap, toggleSidebar, useStore } from '../store'
import { MapIcon, PlusIcon, SidebarIcon, TrashIcon } from './icons'
import { Kbd } from './Kbd'

export function Sidebar() {
  const maps = useStore((s) => s.workspace.maps)
  const activeId = useStore((s) => s.workspace.activeMapId)

  return (
    <aside className="sidebar">
      <div className="sidebar-head drag">
        <div className="brand">
          <span className="brand-mark">
            <MapIcon />
          </span>
          <span>Nodara</span>
        </div>
        <button
          className="icon-btn nodrag"
          onClick={toggleSidebar}
          title={`Hide sidebar (${MOD}+\\)`}
          aria-label="Hide sidebar"
        >
          <SidebarIcon />
        </button>
      </div>

      <div className="sidebar-body">
        <button className="side-action" onClick={newMap}>
          <PlusIcon />
          <span>New map</span>
          <Kbd keys={[MOD, 'N']} />
        </button>

        <nav aria-label="Maps">
          <div className="side-label">Maps</div>
          <ul className="map-list">
            {maps.map((map) => (
              <li key={map.id}>
                <button
                  className={map.id === activeId ? 'map-row active' : 'map-row'}
                  onClick={() => openMap(map.id)}
                  aria-current={map.id === activeId ? 'page' : undefined}
                >
                  <MapIcon />
                  <span className="map-title">{mapTitle(map)}</span>
                  <span className="map-count" title="Ideas in this map">
                    {Object.keys(map.nodes).length}
                  </span>
                </button>
                <button
                  className="icon-btn map-delete"
                  onClick={() => confirmDeleteMap(map)}
                  aria-label={`Delete ${mapTitle(map)}`}
                  title="Delete map"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
