// The only bridge between the Bezel interface and the desktop app.
// The web version has no window.bezel and works exactly as before.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bezel', {
  isApp: true,
  /** Mobile emulation for a device view: { mobile, touch, dpr, width, height }. */
  emulate: (webContentsId, options) => ipcRenderer.invoke('bezel:emulate', webContentsId, options),
  /** Shortcuts pressed while a device view has focus. */
  onShortcut: (callback) => ipcRenderer.on('bezel:shortcut', (_event, data) => callback(data)),
  /** Update progress: { state: 'checking' | 'current' | 'downloading' | 'ready' | 'error' | 'dev', version?, percent? }. */
  onUpdate: (callback) => ipcRenderer.on('bezel:update', (_event, data) => callback(data)),
  /** The lasting update state, for a page that loads after it changed. */
  updateStatus: () => ipcRenderer.invoke('bezel:update-status'),
  installUpdate: () => ipcRenderer.send('bezel:install-update'),
  checkForUpdates: () => ipcRenderer.invoke('bezel:check-updates'),
  /** Copies this area of the window (CSS pixels: { x, y, width, height }) to the clipboard as an image. */
  capture: (rect) => ipcRenderer.invoke('bezel:capture', rect),
});
