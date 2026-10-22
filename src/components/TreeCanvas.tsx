import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { handleSide, layoutMap } from '../model/layout'
import { dropPlacement } from '../model/tree'
import type { DropMode, MindMap } from '../model/types'
import { MOD } from '../platform'
import { addChildToSelected, moveNodeTo, selectNode, startEdit, toggleCollapse, useStore } from '../store'
import { CanvasShell } from './CanvasShell'
import { EdgeLayer } from './EdgeLayer'
import { InlineInput } from './InlineInput'
import { PlusIcon } from './icons'
import { Kbd } from './Kbd'
import { useViewport } from './useViewport'

interface DropTarget {
  id: string
  mode: DropMode
}

interface DragInfo {
  id: string
  x: number
  y: number
  target: DropTarget | null
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean; deselect: boolean }
  | { kind: 'node'; id: string; sx: number; sy: number; active: boolean }

const DRAG_THRESHOLD = 5
const DOUBLE_CLICK_MS = 350

/** Mind maps and timelines: one tree of ideas, drawn in whichever layout the map uses. */
export function TreeCanvas({ map }: { map: MindMap }) {
  const selectedId = useStore((s) => s.selectedId)
  const editingId = useStore((s) => s.editingId)
  const draft = useStore((s) => s.draft)

  const layout = useMemo(
    () => layoutMap(map, editingId ? { id: editingId, text: draft } : undefined),
    [map, editingId, draft],
  )
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  // A stable box, so the view only re-fits when asked to and not on every render.
  const boundsRef = useRef(layout.bounds)
  boundsRef.current = layout.bounds

  const viewport = useViewport(boundsRef)
  const { containerRef, viewRef, setView, reveal } = viewport

  const [drag, setDrag] = useState<DragInfo | null>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ id: string; time: number } | null>(null)

  // Keep the selected idea on screen when arrow keys move past the edge.
  useEffect(() => {
    const placed = selectedId ? layoutRef.current.byId[selectedId] : undefined
    if (placed) reveal(placed)
  }, [selectedId, reveal])

  const axis = layout.axis

  const findDropTarget = (x: number, y: number, dragId: string): DropTarget | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-node-id]')
    const id = el?.dataset.nodeId
    if (!el || !id || id === dragId) return null
    const rect = el.getBoundingClientRect()
    // Along the axis the siblings run on: the first quarter inserts before, the last quarter after.
    const relative = axis === 'y' ? (y - rect.top) / rect.height : (x - rect.left) / rect.width
    const preferred: DropMode = relative < 0.25 ? 'before' : relative > 0.75 ? 'after' : 'child'
    const modes: DropMode[] = preferred === 'child' ? ['child'] : [preferred, 'child']
    for (const mode of modes) {
      if (dropPlacement(map, dragId, id, mode)) return { id, mode }
    }
    return null
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.closest('.zoom-controls') || target.tagName === 'INPUT') return
    if (e.button !== 0 && e.button !== 1) return
    const view = viewRef.current

    const nodeEl = e.button === 0 ? target.closest<HTMLElement>('[data-node-id]') : null
    if (!nodeEl) {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, deselect: true }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    const id = nodeEl.dataset.nodeId as string
    if (target.closest('[data-collapse]')) {
      toggleCollapse(id)
      return
    }
    if (target.closest('[data-add]')) {
      addChildToSelected()
      return
    }

    selectNode(id)
    const now = performance.now()
    const last = lastTap.current
    if (last && last.id === id && now - last.time < DOUBLE_CLICK_MS) {
      lastTap.current = null
      startEdit(id)
      return
    }
    lastTap.current = { id, time: now }

    // The root cannot be moved, so dragging it pans the canvas instead.
    gesture.current =
      id === map.rootId
        ? { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, deselect: false }
        : { kind: 'node', id, sx: e.clientX, sy: e.clientY, active: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (!g.moved && Math.hypot(dx, dy) < 3) return
      g.moved = true
      setView({ ...viewRef.current, x: g.vx + dx, y: g.vy + dy })
      return
    }
    if (!g.active) {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_THRESHOLD) return
      g.active = true
    }
    const info: DragInfo = { id: g.id, x: e.clientX, y: e.clientY, target: findDropTarget(e.clientX, e.clientY, g.id) }
    dragRef.current = info
    setDrag(info)
  }

  const finishGesture = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean): void => {
    const g = gesture.current
    gesture.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const dropped = dragRef.current?.target
    dragRef.current = null
    setDrag(null)
    if (!g || cancelled) return

    if (g.kind === 'pan' && !g.moved && g.deselect) selectNode(null)
    if (g.kind === 'node' && g.active && dropped) {
      const placement = dropPlacement(map, g.id, dropped.id, dropped.mode)
      if (placement) moveNodeTo(g.id, placement.parentId, placement.index)
    }
  }

  const containerRect = containerRef.current?.getBoundingClientRect()
  const draggedText = drag ? map.nodes[drag.id]?.text || 'New idea' : ''
  const rootPlaced = layout.byId[map.rootId]
  const isTimeline = map.layout === 'timeline'

  return (
    <CanvasShell
      viewport={viewport}
      handlers={{
        onPointerDown,
        onPointerMove,
        onPointerUp: (e) => finishGesture(e, false),
        onPointerCancel: (e) => finishGesture(e, true),
      }}
      overlay={
        <>
          {drag && containerRect && (
            <div
              className="ghost"
              style={{ transform: `translate(${drag.x - containerRect.left + 14}px, ${drag.y - containerRect.top + 14}px)` }}
            >
              {draggedText}
            </div>
          )}

          {layout.nodes.length <= 3 && !editingId && (
            <div className="hint">
              <span>
                <Kbd keys={['Tab']} /> {isTimeline ? 'Add detail' : 'Add child'}
              </span>
              <span>
                <Kbd keys={['Enter']} /> {isTimeline ? 'Add event' : 'Add sibling'}
              </span>
              <span>
                <Kbd keys={['Space']} /> Rename
              </span>
              <span>
                <Kbd keys={[MOD, 'K']} /> Commands
              </span>
            </div>
          )}
        </>
      }
    >
      <div className={`tree axis-${axis}`}>
        <EdgeLayer layout={layout} activeId={selectedId} />

        {layout.nodes.map((placed) => {
          const node = map.nodes[placed.id]
          const isRoot = placed.id === map.rootId
          const isSelected = placed.id === selectedId
          const isEditing = placed.id === editingId
          const dropMode = drag?.target?.id === placed.id ? drag.target.mode : null
          const side = handleSide(map.layout, placed, rootPlaced)
          const className = [
            'node',
            isRoot && 'root',
            isSelected && 'selected',
            drag?.id === placed.id && 'dragging',
            dropMode && `drop-${dropMode}`,
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={placed.id}
              className={className}
              data-node-id={placed.id}
              style={{ transform: `translate(${placed.x}px, ${placed.y}px)`, width: placed.w, height: placed.h }}
            >
              {isEditing ? (
                <InlineInput
                  initial={node.text}
                  className="node-input"
                  placeholder="New idea"
                  label="Idea text"
                  onTab={addChildToSelected}
                />
              ) : (
                <span className="node-text">{node.text || <span className="placeholder">New idea</span>}</span>
              )}
              {placed.hiddenCount > 0 && (
                <span className={`collapse-badge side-${side}`} data-collapse title="Expand branch">
                  {placed.hiddenCount}
                </span>
              )}
              {isSelected && !isEditing && !drag && placed.hiddenCount === 0 && (
                <span className={`add-child side-${side}`} data-add title="Add child (Tab)">
                  <PlusIcon size={12} />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </CanvasShell>
  )
}
