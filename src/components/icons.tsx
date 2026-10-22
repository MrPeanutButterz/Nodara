import type { ReactNode } from 'react'

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
