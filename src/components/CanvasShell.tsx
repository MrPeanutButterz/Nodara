import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { MOD } from '../platform'
import { FitIcon, MinusIcon, PlusIcon } from './icons'
import type { Viewport } from './useViewport'

const GRID = 24

export interface CanvasHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void
}

interface CanvasShellProps {
  viewport: Viewport
  handlers: CanvasHandlers
  /** Drawn on the canvas itself: moves and scales with the view. */
  children: ReactNode
  /** Drawn on top of the canvas and fixed to the screen. */
  overlay?: ReactNode
}

/** The dotted, pannable surface and the zoom buttons that every kind of map sits on. */
export function CanvasShell({ viewport, handlers, children, overlay }: CanvasShellProps) {
  const { containerRef, view, zoomFromCenter, fit } = viewport
  return (
    <div
      ref={containerRef}
      className="canvas"
      style={{
        backgroundSize: `${GRID * view.k}px ${GRID * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      {...handlers}
    >
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {children}
      </div>

      {overlay}

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
