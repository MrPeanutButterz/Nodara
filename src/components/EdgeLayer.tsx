import type { CSSProperties } from 'react'
import type { Layout } from '../model/layout'

interface EdgeLayerProps {
  layout: Layout
  /** Edge ids drawn in the accent colour: the selected idea's branch or the selected link. */
  activeId: string | null
  /** Links can be clicked, so they get a wider invisible target to hit. */
  clickable?: boolean
  /** A line being dragged out of an idea to make a new link. */
  preview?: { x1: number; y1: number; x2: number; y2: number } | null
}

/** All lines of a map. Every kind of map hands over finished path data, so this knows nothing about layouts. */
export function EdgeLayer({ layout, activeId, clickable = false, preview = null }: EdgeLayerProps) {
  return (
    <svg className="edges" width="1" height="1" aria-hidden="true">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="context-stroke" />
        </marker>
      </defs>
      {layout.edges.map((edge) => {
        // The CSS `d` property lets lines glide to their new shape when the layout changes.
        const style = { d: `path("${edge.d}")` } as unknown as CSSProperties
        const className = ['edge', edge.id === activeId && 'active', edge.id === '__axis' && 'axis'].filter(Boolean).join(' ')
        return (
          <g key={edge.id}>
            <path
              d={edge.d}
              style={style}
              className={className}
              markerEnd={edge.directed ? 'url(#arrow)' : undefined}
            />
            {clickable && <path d={edge.d} style={style} className="edge-hit" data-link-id={edge.id} />}
          </g>
        )
      })}
      {preview && <line className="edge preview" x1={preview.x1} y1={preview.y1} x2={preview.x2} y2={preview.y2} />}
    </svg>
  )
}
