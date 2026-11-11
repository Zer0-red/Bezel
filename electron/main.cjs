// Bezel desktop app (Windows), main process.
//
// The window shows the same interface as the web version (dist/). Inside the
// app each device is a <webview>: a real browser view rather than an iframe,
// so sites that refuse to be framed (Google, most production sites) still load,
// and phones/tablets can get a mobile user agent, pixel density and touch.

const { app, BrowserWindow, ipcMain, session, shell, webContents } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.BEZEL_DEV_URL; // e.g. http://localhost:5173 with `npm run app:dev`

// Present a normal Chrome user agent (no "Electron/…" or "bezel/…" tokens) so
// sites treat desktop devices like a regular browser.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|bezel)\/\S+/gi, '');

const isWebUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    title: 'Bezel',
    backgroundColor: '#1c2027',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  const appUrl = () => mainWindow.webContents.getURL().split(/[?#]/)[0];

  // The interface never navigates away from itself; web links open in the default browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.split(/[?#]/)[0] === appUrl()) return;
    event.preventDefault();
    if (isWebUrl(url)) shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Device views (<webview>) ─────────────────────────────────

const SHORTCUT_CODES = new Set(['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyR']);

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'window') {
    // Every device view gets locked-down settings, whatever the page asks for.
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;
      if (params.src && params.src !== 'about:blank' && !isWebUrl(params.src)) event.preventDefault();
    });
  }

  if (contents.getType() === 'webview') {
    // Only web pages inside device views; links that open a new window stay in the same device.
    contents.on('will-navigate', (event, url) => {
      if (!isWebUrl(url)) event.preventDefault();
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) contents.loadURL(url);
      return { action: 'deny' };
    });

    // Keyboard shortcuts keep working after clicking into a device (Alt+0–5, Alt+R, Alt+Shift+R).
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || !input.alt || input.control || input.meta) return;
      if (!SHORTCUT_CODES.has(input.code)) return;
      event.preventDefault();
      contents.hostWebContents?.send('bezel:shortcut', { code: input.code, shift: input.shift });
    });
  }
});

// Mobile emulation for one device view: pixel density, mobile viewport rules,
// screen size and touch input, through the Chrome DevTools Protocol.
ipcMain.handle('bezel:emulate', async (event, id, options = {}) => {
  const contents = webContents.fromId(Number(id));
  if (!contents || contents.getType() !== 'webview' || contents.hostWebContents !== event.sender) return false;

  const dpr = Math.min(4, Math.max(1, Number(options.dpr) || 1));
  const width = Math.min(8000, Math.max(0, Math.round(Number(options.width) || 0)));
  const height = Math.min(8000, Math.max(0, Math.round(Number(options.height) || 0)));
  const mobile = Boolean(options.mobile);
  const touch = Boolean(options.touch);

  try {
    if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
    // The exact viewport, like Chrome DevTools' device mode. Phones need it so
    // `width=device-width` resolves to the phone's width; it is sent again on rotation.
    await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: touch,
      maxTouchPoints: touch ? 5 : 1,
    });
    await contents.debugger.sendCommand('Emulation.setEmitTouchEventsForMouse', {
      enabled: touch,
      configuration: 'mobile',
    });
    return true;
  } catch (error) {
    console.error('Emulation failed:', error);
    return false;
  }
});

// ── Updates (GitHub Releases) ────────────────────────────────

function setUpAutoUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (error) {
    console.error('Updater unavailable:', error);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // also installs when Bezel is simply closed

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('bezel:update', { state: 'ready', version: info.version });
  });
  autoUpdater.on('error', (error) => console.error('Update check failed:', error?.message ?? error));

  ipcMain.on('bezel:install-update', () => autoUpdater.quitAndInstall());

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 4 * 60 * 60 * 1000); // and every 4 hours while open
}

// ── App lifecycle ────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    // Device views (partition "persist:bezel") can never open files from this computer.
    session.fromPartition('persist:bezel').protocol.handle('file', () => new Response('Blocked', { status: 403 }));
    createWindow();
    setUpAutoUpdates();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
