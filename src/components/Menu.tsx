import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { CheckIcon } from './icons'

export interface MenuItem {
  id: string
  label: string
  description?: string
  icon?: ReactNode
  checked?: boolean
  onSelect: () => void
}

interface MenuProps {
  /** What the button shows. */
  trigger: ReactNode
  buttonClassName: string
  /** Names the menu for screen readers and the tooltip. */
  label: string
  items: MenuItem[]
  /** Opens in the page, pushing what is below it down, as compact rows. */
  inline?: boolean
}

/** A button that opens a short list of choices. Arrow keys move, Enter picks, Escape closes. */
export function Menu({ trigger, buttonClassName, label, items, inline = false }: MenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const move = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const entries = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = entries.indexOf(document.activeElement as HTMLElement)
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length
    entries[next]?.focus()
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        className={buttonClassName}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div className={inline ? 'menu inline' : 'menu'} role="menu" aria-label={label} ref={listRef} onKeyDown={move}>
          {items.map((item) => (
            <button
              key={item.id}
              className="menu-item"
              role="menuitem"
              title={inline ? item.description : undefined}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon && <span className="menu-icon">{item.icon}</span>}
              <span className="menu-text">
                <span className="menu-label">{item.label}</span>
                {!inline && item.description && <span className="menu-desc">{item.description}</span>}
              </span>
              {item.checked && (
                <span className="menu-check">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
