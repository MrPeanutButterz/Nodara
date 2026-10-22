import '@fontsource-variable/inter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Lets the stylesheet leave room for the macOS traffic lights and the Windows window buttons.
document.documentElement.dataset.platform = window.nodara?.platform ?? 'web'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
