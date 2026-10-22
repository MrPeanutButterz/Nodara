import { docToMarkdown, mapTitle, sanitizeDoc } from './model/doc'
import type { AnyMap } from './model/types'
import { deleteMap, getState, importMap, selectActiveDoc, showToast } from './store'

const FILE_FORMAT = 'nodara-map'

const safeName = (title: string): string => title.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'Untitled map'

async function saveText(defaultName: string, content: string, filterName: string, extensions: string[]): Promise<boolean> {
  if (window.nodara) return window.nodara.saveFile({ defaultName, content, filterName, extensions })
  // Plain browser (dev:web): fall back to a download.
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = defaultName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function pickTextFile(): Promise<{ name: string; content: string } | null> {
  if (window.nodara) return window.nodara.openFile()
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.nodara,.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, content: await file.text() } : null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export async function saveMapToFile(): Promise<void> {
  const map = selectActiveDoc(getState())
  if (!map) return
  const content = JSON.stringify({ format: FILE_FORMAT, version: 1, map }, null, 2)
  try {
    if (await saveText(`${safeName(mapTitle(map))}.nodara`, content, 'Nodara map', ['nodara'])) showToast('Map saved')
  } catch {
    showToast("Couldn't save the file. Check that the folder is writable and try again.")
  }
}

export async function exportMarkdown(): Promise<void> {
  const map = selectActiveDoc(getState())
  if (!map) return
  try {
    if (await saveText(`${safeName(mapTitle(map))}.md`, docToMarkdown(map), 'Markdown', ['md'])) {
      showToast('Markdown exported')
    }
  } catch {
    showToast("Couldn't export the file. Check that the folder is writable and try again.")
  }
}

export async function openMapFromFile(): Promise<void> {
  try {
    const file = await pickTextFile()
    if (!file) return
    const parsed: unknown = JSON.parse(file.content)
    const raw = typeof parsed === 'object' && parsed !== null && 'map' in parsed ? (parsed as { map: unknown }).map : parsed
    const map: AnyMap | null = sanitizeDoc(raw)
    if (!map) throw new Error('not a map')
    importMap(map)
    showToast('Map opened')
  } catch {
    showToast("That file isn't a Nodara map. Choose a .nodara file saved from Nodara.")
  }
}

export function confirmDeleteMap(map: AnyMap): void {
  if (window.confirm(`Delete "${mapTitle(map)}"? This can't be undone.`)) deleteMap(map.id)
}
