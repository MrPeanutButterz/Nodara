import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Bounds } from '../model/layout'
import { FIT_EVENT } from '../store'

export interface View {
  x: number
  y: number
  k: number
}

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2.5

export const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/**
 * Panning and zooming shared by every kind of map. `boundsRef` points at the box around everything
 * on the canvas, so "fit" always sees the latest layout. With `startRef`, a new map opens centred on
 * that box at normal size instead of fitted to everything.
 */
export function useViewport(boundsRef: { current: Bounds }, startRef?: { current: Bounds | undefined }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const bounds = boundsRef.current
    const pad = 96
    const k = clamp(Math.min((width - pad * 2) / bounds.w, (height - pad * 2) / bounds.h), MIN_ZOOM, 1)
    setView({
      k,
      x: width / 2 - (bounds.x + bounds.w / 2) * k,
      y: height / 2 - (bounds.y + bounds.h / 2) * k,
    })
  }, [boundsRef])

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const v = viewRef.current
    const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM)
    const ratio = k / v.k
    setView({ k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio })
  }, [])

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      zoomAt(factor, width / 2, height / 2)
    },
    [zoomAt],
  )

  /** A point on screen, as a position on the canvas. */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - (rect?.left ?? 0) - v.x) / v.k, y: (clientY - (rect?.top ?? 0) - v.y) / v.k }
  }, [])

  /** Pans just far enough to bring a box on the canvas back into view. */
  const reveal = useCallback((box: Bounds) => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const v = viewRef.current
    const left = box.x * v.k + v.x
    const top = box.y * v.k + v.y
    const right = left + box.w * v.k
    const bottom = top + box.h * v.k
    const margin = 72
    let dx = 0
    let dy = 0
    if (left < margin) dx = margin - left
    else if (right > width - margin) dx = width - margin - right
    if (top < margin) dy = margin - top
    else if (bottom > height - margin) dy = height - margin - bottom
    if (dx || dy) setView({ ...v, x: v.x + dx, y: v.y + dy })
  }, [])

  const centerOn = useCallback((box: Bounds) => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setView({ k: 1, x: width / 2 - (box.x + box.w / 2), y: height / 2 - (box.y + box.h / 2) })
  }, [])

  useLayoutEffect(() => {
    const start = startRef?.current
    if (start) centerOn(start)
    else fit()
  }, [fit, centerOn, startRef])

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

  return { containerRef, view, viewRef, setView, fit, zoomAt, zoomFromCenter, toWorld, reveal }
}

export type Viewport = ReturnType<typeof useViewport>
