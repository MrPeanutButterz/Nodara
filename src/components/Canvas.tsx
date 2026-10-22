import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { layoutMap } from '../model/layout'
import { dropPlacement } from '../model/tree'
import type { DropMode, MindMap } from '../model/types'
import { MOD } from '../platform'
import {
  FIT_EVENT,
  addChildToSelected,
  cancelEdit,
  commitEdit,
  moveNodeTo,
  selectActiveMap,
  selectNode,
  setDraft,
  startEdit,
  toggleCollapse,
  useStore,
} from '../store'
import { FitIcon, MinusIcon, PlusIcon } from './icons'
import { Kbd } from './Kbd'

interface View {
  x: number
  y: number
  k: number
}

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

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5
const DRAG_THRESHOLD = 5
const DOUBLE_CLICK_MS = 350
const GRID = 24

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

export function Canvas() {
  const map = useStore(selectActiveMap)
  // Keyed by map id: opening another map starts with a fresh view that fits it.
  return map ? <MapCanvas key={map.id} map={map} /> : null
}

function MapCanvas({ map }: { map: MindMap }) {
  const selectedId = useStore((s) => s.selectedId)
  const editingId = useStore((s) => s.editingId)
  const draft = useStore((s) => s.draft)

  const layout = useMemo(
    () => layoutMap(map, editingId ? { id: editingId, text: draft } : undefined),
    [map, editingId, draft],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [drag, setDrag] = useState<DragInfo | null>(null)

  // Handlers read these, so they always see the latest values without re-subscribing.
  const viewRef = useRef(view)
  viewRef.current = view
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const dragRef = useRef<DragInfo | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ id: string; time: number } | null>(null)

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const bounds = layoutRef.current.bounds
    const pad = 96
    const k = clamp(Math.min((width - pad * 2) / bounds.w, (height - pad * 2) / bounds.h), MIN_ZOOM, 1)
    setView({
      k,
      x: width / 2 - (bounds.x + bounds.w / 2) * k,
      y: height / 2 - (bounds.y + bounds.h / 2) * k,
    })
  }, [])

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const v = viewRef.current
    const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM)
    const ratio = k / v.k
    setView({ k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio })
  }, [])

  const zoomFromCenter = (factor: number): void => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    zoomAt(factor, width / 2, height / 2)
  }

  useLayoutEffect(() => {
    fit()
  }, [fit])

  useEffect(() => {
    window.addEventListener(FIT_EVENT, fit)
    return () => window.removeEventListener(FIT_EVENT, fit)
  }, [fit])

  // Trackpad scrolling pans; pinching or holding Cmd/Ctrl while scrolling zooms.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        zoomAt(Math.exp(-clamp(e.deltaY, -30, 30) * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        const v = viewRef.current
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Keep the selected idea on screen when arrow keys move past the edge.
  useEffect(() => {
    const el = containerRef.current
    const placed = selectedId ? layoutRef.current.byId[selectedId] : undefined
    if (!el || !placed) return
    const { width, height } = el.getBoundingClientRect()
    const v = viewRef.current
    const left = placed.x * v.k + v.x
    const top = placed.y * v.k + v.y
    const right = left + placed.w * v.k
    const bottom = top + placed.h * v.k
    const margin = 72
    let dx = 0
    let dy = 0
    if (left < margin) dx = margin - left
    else if (right > width - margin) dx = width - margin - right
    if (top < margin) dy = margin - top
    else if (bottom > height - margin) dy = height - margin - bottom
    if (dx || dy) setView({ ...v, x: v.x + dx, y: v.y + dy })
  }, [selectedId])

  const findDropTarget = (x: number, y: number, dragId: string): DropTarget | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-node-id]')
    const id = el?.dataset.nodeId
    if (!el || !id || id === dragId) return null
    const rect = el.getBoundingClientRect()
    const relative = (y - rect.top) / rect.height
    // Top quarter inserts before, bottom quarter after, the middle nests inside.
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

  return (
    <div
      ref={containerRef}
      className="canvas"
      style={{
        backgroundSize: `${GRID * view.k}px ${GRID * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishGesture(e, false)}
      onPointerCancel={(e) => finishGesture(e, true)}
    >
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="edges" width="1" height="1" aria-hidden="true">
          {layout.edges.map((edge) => {
            const mid = (edge.x1 + edge.x2) / 2
            const d = `M ${edge.x1} ${edge.y1} C ${mid} ${edge.y1}, ${mid} ${edge.y2}, ${edge.x2} ${edge.y2}`
            // The CSS `d` property lets branches glide to their new shape when the layout changes.
            const style = { d: `path("${d}")` } as unknown as CSSProperties
            return <path key={edge.id} d={d} style={style} className={edge.id === selectedId ? 'edge active' : 'edge'} />
          })}
        </svg>

        {layout.nodes.map((placed) => {
          const node = map.nodes[placed.id]
          const isRoot = placed.id === map.rootId
          const isSelected = placed.id === selectedId
          const isEditing = placed.id === editingId
          const dropMode = drag?.target?.id === placed.id ? drag.target.mode : null
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
                <NodeInput initial={node.text} />
              ) : (
                <span className="node-text">{node.text || <span className="placeholder">New idea</span>}</span>
              )}
              {placed.hiddenCount > 0 && (
                <span className="collapse-badge" data-collapse title="Expand branch">
                  {placed.hiddenCount}
                </span>
              )}
              {isSelected && !isEditing && !drag && placed.hiddenCount === 0 && (
                <span className="add-child" data-add title="Add child (Tab)">
                  <PlusIcon size={12} />
                </span>
              )}
            </div>
          )
        })}
      </div>

      {drag && containerRect && (
        <div className="ghost" style={{ transform: `translate(${drag.x - containerRect.left + 14}px, ${drag.y - containerRect.top + 14}px)` }}>
          {draggedText}
        </div>
      )}

      {layout.nodes.length <= 3 && !editingId && (
        <div className="hint">
          <span>
            <Kbd keys={['Tab']} /> Add child
          </span>
          <span>
            <Kbd keys={['Enter']} /> Add sibling
          </span>
          <span>
            <Kbd keys={['Space']} /> Rename
          </span>
          <span>
            <Kbd keys={[MOD, 'K']} /> Commands
          </span>
        </div>
      )}

      <div className="zoom-controls">
        <button className="icon-btn" onClick={() => zoomFromCenter(1 / 1.2)} aria-label="Zoom out" title="Zoom out">
          <MinusIcon />
        </button>
        <span className="zoom-level">{Math.round(view.k * 100)}%</span>
        <button className="icon-btn" onClick={() => zoomFromCenter(1.2)} aria-label="Zoom in" title="Zoom in">
          <PlusIcon />
        </button>
        <button className="icon-btn" onClick={fit} aria-label="Fit map to screen" title={`Fit to screen (${MOD}+0)`}>
          <FitIcon />
        </button>
      </div>
    </div>
  )
}

function NodeInput({ initial }: { initial: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initial)
  // Enter, Tab and Escape end the edit themselves; the blur that follows must not save a second time.
  const finished = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (save: boolean): void => {
    finished.current = true
    if (save) commitEdit(value)
    else cancelEdit()
  }

  return (
    <input
      ref={inputRef}
      className="node-input"
      value={value}
      placeholder="New idea"
      spellCheck={false}
      maxLength={500}
      aria-label="Idea text"
      onChange={(e) => {
        setValue(e.target.value)
        setDraft(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          finish(false)
        } else if (e.key === 'Tab' && !e.shiftKey && value.trim()) {
          // Save this idea and branch straight off it.
          e.preventDefault()
          finish(true)
          addChildToSelected()
        } else if (e.key === 'Tab') {
          e.preventDefault()
        }
      }}
      onBlur={() => {
        if (!finished.current) commitEdit(value)
      }}
    />
  )
}
