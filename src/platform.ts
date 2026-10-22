const platform = window.nodara?.platform ?? navigator.platform

export const isMac = /mac|darwin/i.test(platform)

/** The modifier key as it is printed on this keyboard. */
export const MOD = isMac ? '⌘' : 'Ctrl'
export const SHIFT = isMac ? '⇧' : 'Shift'
