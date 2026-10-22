const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

const isDev = process.argv.includes('--dev')
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

const DEV_URL = 'http://127.0.0.1:5173'
const MAX_FILE_BYTES = 20 * 1024 * 1024

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    show: false,
    title: 'Nodara',
    backgroundColor: '#08090a',
    // Frameless look: the app draws its own top bar, the OS keeps its window controls.
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 20 } } : {}),
    ...(isWin
      ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#08090a', symbolColor: '#8a8f98', height: 52 } }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Never let the app window navigate away or open new windows itself.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })

  if (isDev) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function buildMenu() {
  // Deliberately no Undo/Redo roles: Cmd/Ctrl+Z belongs to the map, and a menu
  // accelerator would swallow the key before the page sees it.
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('file:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Nodara map', extensions: ['nodara', 'json'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const stat = await fs.stat(file)
  if (stat.size > MAX_FILE_BYTES) throw new Error('That file is too large to open.')
  return { name: path.basename(file), content: await fs.readFile(file, 'utf8') }
})

ipcMain.handle('file:save', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { defaultName, content, filterName, extensions } = options ?? {}
  const valid =
    typeof defaultName === 'string' &&
    typeof content === 'string' &&
    typeof filterName === 'string' &&
    Array.isArray(extensions) &&
    extensions.every((ext) => typeof ext === 'string')
  if (!valid || content.length > MAX_FILE_BYTES) throw new Error('Invalid save request.')

  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.basename(defaultName),
    filters: [{ name: filterName, extensions }],
  })
  if (result.canceled || !result.filePath) return false
  await fs.writeFile(result.filePath, content, 'utf8')
  return true
})

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
