import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The packaged app loads dist/index.html from disk, so lock down what the page
// may load. Injected at build time only: the dev server needs inline scripts
// for hot reload.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'nodara-csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${csp}" />`),
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'esnext' },
})
