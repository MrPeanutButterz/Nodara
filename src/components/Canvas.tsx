import { selectActiveDoc, useStore } from '../store'
import { GraphCanvas } from './GraphCanvas'
import { TreeCanvas } from './TreeCanvas'

export function Canvas() {
  const doc = useStore(selectActiveDoc)
  if (!doc) return null
  // Keyed by map id: opening another map starts with a fresh view that fits it.
  return doc.kind === 'tree' ? <TreeCanvas key={doc.id} map={doc} /> : <GraphCanvas key={doc.id} map={doc} />
}
