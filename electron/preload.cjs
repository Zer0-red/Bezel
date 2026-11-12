// The only bridge between the Bezel interface and the desktop app.
// The web version has no window.bezel and works exactly as before.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bezel', {
  isApp: true,
  /** Mobile emulation for a device view: { mobile, touch, dpr, width, height }. */
  emulate: (webContentsId, options) => ipcRenderer.invoke('bezel:emulate', webContentsId, options),
  /** Shortcuts pressed while a device view has focus. */
  onShortcut: (callback) => ipcRenderer.on('bezel:shortcut', (_event, data) => callback(data)),
  /** A downloaded update is ready: { state: 'ready', version }. */
  onUpdate: (callback) => ipcRenderer.on('bezel:update', (_event, data) => callback(data)),
  installUpdate: () => ipcRenderer.send('bezel:install-update'),
  checkForUpdates: () => ipcRenderer.invoke('bezel:check-updates'),
});
