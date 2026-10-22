const { contextBridge, ipcRenderer } = require('electron')

// The only door between the page and the system: two file dialogs and the platform name.
contextBridge.exposeInMainWorld('nodara', {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
})
