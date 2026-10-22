import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { snap } from '../model/graph'
import { layoutGraph } from '../model/graph-layout'
import type { GraphMap } from '../model/types'
import { MOD } from '../platform'
import {
  addChildToSelected,
  addConnectedIdeaAt,
  addIdeaAt,
  connectIdeas,
  moveIdeaTo,
  selectLink,
  selectNode,
  startEdit,
  startEditLink,
  useStore,
} from '../store'
import { CanvasShell } from './CanvasShell'
import { EdgeLayer } from './EdgeLayer'
import { InlineInput } from './InlineInput'
import { PlusIcon } from './icons'
import { Kbd } from './Kbd'
import { useViewport } from './useViewport'

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean; background: boolean }
  | { kind: 'move'; id: string; sx: number; sy: number; offX: number; offY: number; active: boolean }
  | { kind: 'link'; from: string; sx: number; sy: number; active: boolean }
  /** Runs on release. Starting an edit on press would lose focus again when the press finishes. */
  | { kind: 'action'; run: () => void }

/** What is being dragged right now, kept in state so the canvas redraws while the pointer moves. */
type Live =
  | { kind: 'move'; id: string; x: number; y: number }
  | { kind: 'link'; from: string; x: number; y: number; target: string | null }
  | null

const DRAG_THRESHOLD = 5
const DOUBLE_CLICK_MS = 350

/** Concept maps and flowcharts: ideas placed freely and joined by links. */
export function GraphCanvas({ map }: { map: GraphMap }) {
  const selectedId = useStore((s) => s.selectedId)
  const selectedLinkId = useStore((s) => s.selectedLinkId)
  const editingId = useStore((s) => s.editingId)
  const editingLinkId = useStore((s) => s.editingLinkId)
  const draft = useStore((s) => s.draft)

  const [live, setLive] = useState<Live>(null)
  const moving = live?.kind === 'move' ? { id: live.id, x: live.x, y: live.y } : undefined

  const layout = useMemo(
    () => layoutGraph(map, { draft: editingId ? { id: editingId, text: draft } : undefined, moving }),
    // `moving` is rebuilt every render, so depend on its parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, editingId, draft, moving?.id, moving?.x, moving?.y],
  )
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // While an idea is dragged the box around everything changes constantly; "fit" should use the resting layout.
  const restingBounds = useMemo(() => layoutGraph(map).bounds, [map])
  const boundsRef = useRef(restingBounds)
  boundsRef.current = restingBounds

  const viewport = useViewport(boundsRef)
  const { viewRef, setView, toWorld, reveal } = viewport

  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ key: string; time: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const placed = selectedId ? layoutRef.current.byId[selectedId] : undefined
    if (placed) reveal(placed)
  }, [selectedId, reveal])

  /** True when this tap is the second of a double tap on the same thing. */
  const isDoubleTap = (key: string, x: number, y: number): boolean => {
    const now = performance.now()
    const last = lastTap.current
    const double = !!last && last.key === key && now - last.time < DOUBLE_CLICK_MS && Math.hypot(x - last.x, y - last.y) < 8
    lastTap.current = double ? null : { key, time: now, x, y }
    return double
  }

  const nodeUnder = (x: number, y: number, except: string): string | null => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    return id && id !== except ? id : null
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement
    if (target.closest('.zoom-controls') || target.tagName === 'INPUT') return
    if (e.button !== 0 && e.button !== 1) return
    const view = viewRef.current
    const startPan = (background: boolean): void => {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, background }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (e.button === 1) return startPan(false)

    const handle = target.closest<HTMLElement>('[data-link-handle]')
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    if (handle && nodeEl) {
      gesture.current = { kind: 'link', from: nodeEl.dataset.nodeId as string, sx: e.clientX, sy: e.clientY, active: false }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    if (nodeEl) {
      const id = nodeEl.dataset.nodeId as string
      selectNode(id)
      if (isDoubleTap(`node:${id}`, e.clientX, e.clientY)) {
        gesture.current = { kind: 'action', run: () => startEdit(id) }
        return
      }
      const idea = map.nodes[id]
      const at = toWorld(e.clientX, e.clientY)
      gesture.current = {
        kind: 'move',
        id,
        sx: e.clientX,
        sy: e.clientY,
        offX: at.x - idea.x,
        offY: at.y - idea.y,
        active: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    const linkEl = target.closest<HTMLElement>('[data-link-id]')
    if (linkEl) {
      const id = linkEl.dataset.linkId as string
      selectLink(id)
      if (isDoubleTap(`link:${id}`, e.clientX, e.clientY)) gesture.current = { kind: 'action', run: () => startEditLink(id) }
      return
    }

    startPan(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const g = gesture.current
    if (!g || g.kind === 'action') return
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
    const at = toWorld(e.clientX, e.clientY)
    if (g.kind === 'move') {
      setLive({ kind: 'move', id: g.id, x: snap(at.x - g.offX), y: snap(at.y - g.offY) })
    } else {
      setLive({ kind: 'link', from: g.from, x: at.x, y: at.y, target: nodeUnder(e.clientX, e.clientY, g.from) })
    }
  }

  const finishGesture = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean): void => {
    const g = gesture.current
    gesture.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const result = live
    setLive(null)
    if (!g || cancelled) return

    if (g.kind === 'action') {
      g.run()
      return
    }
    if (g.kind === 'pan' && !g.moved && g.background) {
      selectNode(null)
      const at = toWorld(e.clientX, e.clientY)
      if (isDoubleTap('background', e.clientX, e.clientY)) addIdeaAt(snap(at.x), snap(at.y))
    } else if (g.kind === 'move' && g.active && result?.kind === 'move') {
      moveIdeaTo(g.id, result.x, result.y)
    } else if (g.kind === 'link') {
      if (!g.active) {
        // A plain click on the handle adds a connected idea, like Tab.
        selectNode(g.from)
        addChildToSelected()
      } else if (result?.kind === 'link') {
        if (result.target) connectIdeas(g.from, result.target)
        else addConnectedIdeaAt(g.from, snap(result.x), snap(result.y))
      }
    }
  }

  const linkPreview = (() => {
    if (live?.kind !== 'link') return null
    const from = layout.byId[live.from]
    const to = live.target ? layout.byId[live.target] : null
    return {
      x1: from.x + from.w / 2,
      y1: from.y + from.h / 2,
      x2: to ? to.x + to.w / 2 : live.x,
      y2: to ? to.y + to.h / 2 : live.y,
    }
  })()

  const isFlowchart = map.variant === 'flowchart'

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
        layout.nodes.length <= 3 &&
        !editingId && (
          <div className="hint">
            <span>
              <Kbd keys={['Tab']} /> Add connected idea
            </span>
            <span>
              <Kbd keys={['Enter']} /> Add idea below
            </span>
            <span>Double-click to add anywhere</span>
            {isFlowchart && (
              <span>
                <Kbd keys={['S']} /> Change shape
              </span>
            )}
            <span>
              <Kbd keys={[MOD, 'K']} /> Commands
            </span>
          </div>
        )
      }
    >
      <div className={`graph ${map.variant}`}>
        <EdgeLayer layout={layout} activeId={selectedLinkId} clickable preview={linkPreview} />

        {layout.edges.map((edge) => {
          if (!edge.label) return null
          const editing = edge.id === editingLinkId
          const selected = edge.id === selectedLinkId
          // Empty labels stay invisible until the link is selected, so they never clutter the canvas.
          if (!editing && !edge.label.text && !selected) return null
          return (
            <div
              key={edge.id}
              className={['link-label', selected && 'selected', !edge.label.text && 'empty'].filter(Boolean).join(' ')}
              data-link-id={edge.id}
              style={{ transform: `translate(${edge.label.x}px, ${edge.label.y}px) translate(-50%, -50%)` }}
            >
              {editing ? (
                <InlineInput
                  initial={edge.label.text}
                  className="link-input"
                  placeholder="Label"
                  label="Link label"
                  style={{ width: `${Math.max(7, draft.length + 2)}ch` }}
                />
              ) : (
                edge.label.text || 'Add label'
              )}
            </div>
          )
        })}

        {layout.nodes.map((placed) => {
          const node = map.nodes[placed.id]
          const shape = placed.shape ?? 'process'
          const isSelected = placed.id === selectedId
          const isEditing = placed.id === editingId
          const className = [
            'node',
            `shape-${shape}`,
            isSelected && 'selected',
            live?.kind === 'move' && live.id === placed.id && 'moving',
            live?.kind === 'link' && live.target === placed.id && 'link-target',
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
              {shape === 'decision' && (
                <svg className="shape-bg" viewBox={`0 0 ${placed.w} ${placed.h}`} width={placed.w} height={placed.h} aria-hidden="true">
                  <polygon
                    points={`${placed.w / 2},1 ${placed.w - 1},${placed.h / 2} ${placed.w / 2},${placed.h - 1} 1,${placed.h / 2}`}
                  />
                </svg>
              )}
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
              {isSelected && !isEditing && !live && (
                <span className="add-child side-right" data-link-handle title="Drag to connect, click to add (Tab)">
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
