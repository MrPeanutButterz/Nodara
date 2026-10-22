import { confirmDeleteMap } from '../actions'
import { KIND_HINT, KIND_LABEL, kindOf, mapTitle, nodeCount } from '../model/doc'
import type { MapKind } from '../model/types'
import { MOD } from '../platform'
import { newMap, openMap, toggleSidebar, useStore } from '../store'
import { KindIcon, MapIcon, PlusIcon, SidebarIcon, TrashIcon } from './icons'
import { Kbd } from './Kbd'
import { Menu } from './Menu'

const KINDS: MapKind[] = ['mindmap', 'concept', 'flowchart', 'timeline']

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
        <Menu
          label="New map"
          buttonClassName="side-action"
          trigger={
            <>
              <PlusIcon />
              <span>New map</span>
              <Kbd keys={[MOD, 'N']} />
            </>
          }
          items={KINDS.map((kind) => ({
            id: kind,
            label: KIND_LABEL[kind],
            description: KIND_HINT[kind],
            icon: <KindIcon kind={kind} />,
            onSelect: () => newMap(kind),
          }))}
        />

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
                  <KindIcon kind={kindOf(map)} />
                  <span className="map-title">{mapTitle(map)}</span>
                  <span className="map-count" title="Ideas in this map">
                    {nodeCount(map)}
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
