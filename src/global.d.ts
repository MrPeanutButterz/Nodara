interface SaveFileOptions {
  defaultName: string
  content: string
  filterName: string
  extensions: string[]
}

/** Exposed by electron/preload.cjs. Missing when the app runs in a plain browser (npm run dev:web). */
interface NodaraBridge {
  platform: string
  openFile(): Promise<{ name: string; content: string } | null>
  saveFile(options: SaveFileOptions): Promise<boolean>
}

interface Window {
  nodara?: NodaraBridge
}

declare module '@fontsource-variable/inter'
