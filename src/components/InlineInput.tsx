import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { cancelEdit, commitEdit, setDraft } from '../store'

interface InlineInputProps {
  initial: string
  className: string
  placeholder: string
  label: string
  style?: CSSProperties
  /** Tab saves the text, then calls this. Without it Tab does nothing. */
  onTab?: () => void
}

/** The text box shared by ideas and link labels. Enter saves, Escape cancels, clicking away saves. */
export function InlineInput({ initial, className, placeholder, label, style, onTab }: InlineInputProps) {
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
      className={className}
      style={style}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      maxLength={500}
      aria-label={label}
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
        } else if (e.key === 'Tab') {
          e.preventDefault()
          if (onTab && !e.shiftKey && value.trim()) {
            finish(true)
            onTab()
          }
        }
      }}
      onBlur={() => {
        if (!finished.current) commitEdit(value)
      }}
    />
  )
}
