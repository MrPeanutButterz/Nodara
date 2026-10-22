import type { ReactNode } from 'react'
import type { MapKind } from '../model/types'

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const SidebarIcon = () => (
  <Icon>
    <rect x="2" y="3" width="12" height="10" rx="2.5" />
    <path d="M6.3 3v10" />
  </Icon>
)

export const PlusIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
)

export const MinusIcon = () => (
  <Icon>
    <path d="M3.5 8h9" />
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M5.5 3.5 2.5 6.5l3 3" />
    <path d="M2.5 6.5h6a3.5 3.5 0 0 1 0 7H6" />
  </Icon>
)

export const RedoIcon = () => (
  <Icon>
    <path d="m10.5 3.5 3 3-3 3" />
    <path d="M13.5 6.5h-6a3.5 3.5 0 0 0 0 7H10" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.2" />
    <path d="m10.2 10.2 3.3 3.3" />
  </Icon>
)

export const FitIcon = () => (
  <Icon>
    <path d="M2.5 6V4A1.5 1.5 0 0 1 4 2.5h2M10 2.5h2A1.5 1.5 0 0 1 13.5 4v2M13.5 10v2a1.5 1.5 0 0 1-1.5 1.5h-2M6 13.5H4A1.5 1.5 0 0 1 2.5 12v-2" />
  </Icon>
)

export const TrashIcon = () => (
  <Icon>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />
  </Icon>
)

export const ChevronIcon = () => (
  <Icon size={14}>
    <path d="m6 4 4 4-4 4" />
  </Icon>
)

export const MapIcon = () => (
  <Icon>
    <circle cx="4" cy="8" r="1.6" />
    <circle cx="12" cy="4" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="m5.5 7.4 5-2.8M5.5 8.6l5 2.8" />
  </Icon>
)

export const ChevronDownIcon = () => (
  <Icon size={14}>
    <path d="m4 6 4 4 4-4" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
)

export const ConceptIcon = () => (
  <Icon>
    <circle cx="4.5" cy="4.5" r="2" />
    <circle cx="11.5" cy="11.5" r="2" />
    <path d="m6 6 4 4" />
    <path d="M10 4.5h3.5M2.5 11.5H6" />
  </Icon>
)

export const FlowchartIcon = () => (
  <Icon>
    <rect x="5.2" y="1.8" width="5.6" height="3.4" rx="1.2" />
    <path d="M8 5.2v2" />
    <path d="M8 7.2 11.2 10 8 12.8 4.8 10z" />
  </Icon>
)

export const TimelineIcon = () => (
  <Icon>
    <path d="M1.8 8h12.4" />
    <path d="M4.5 8V4M8.5 8v4M12 8V5" />
    <circle cx="4.5" cy="3.2" r="0.9" />
    <circle cx="8.5" cy="12.8" r="0.9" />
  </Icon>
)

/** The icon that goes with a kind of map. */
export function KindIcon({ kind }: { kind: MapKind }) {
  switch (kind) {
    case 'concept':
      return <ConceptIcon />
    case 'flowchart':
      return <FlowchartIcon />
    case 'timeline':
      return <TimelineIcon />
    default:
      return <MapIcon />
  }
}
