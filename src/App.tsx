import { Canvas } from './components/Canvas'
import { CommandPalette } from './components/CommandPalette'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { useGlobalShortcuts } from './shortcuts'
import { useStore } from './store'

export default function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const paletteOpen = useStore((s) => s.paletteOpen)
  const toast = useStore((s) => s.toast)
  useGlobalShortcuts()

  return (
    <div className="app" data-sidebar={sidebarOpen ? 'open' : 'closed'}>
      {sidebarOpen && <Sidebar />}
      <main className="main">
        <Topbar />
        <Canvas />
      </main>
      {paletteOpen && <CommandPalette />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
