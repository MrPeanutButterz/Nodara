import { sanitizeDoc } from './model/doc'
import type { AnyMap, Workspace } from './model/types'

const KEY = 'nodara.workspace.v1'

export function loadWorkspace(): Workspace {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { maps?: unknown }).maps)) {
      const stored = parsed as { maps: unknown[]; activeMapId?: unknown }
      const maps = stored.maps.map(sanitizeDoc).filter((map): map is AnyMap => map !== null)
      const active = maps.find((map) => map.id === stored.activeMapId) ?? maps[0]
      return { maps, activeMapId: active?.id ?? null }
    }
  } catch {
    // Unreadable storage: start fresh rather than crash on launch.
  }
  return { maps: [], activeMapId: null }
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace))
  } catch {
    // Storage full or blocked. The map stays in memory; saving to a file still works.
  }
}
