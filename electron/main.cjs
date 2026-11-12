// Bezel desktop app (Windows and Linux), main process.
//
// The window shows the same interface as the web version (dist/). Inside the
// app each device is a <webview>: a real browser view rather than an iframe,
// so sites that refuse to be framed (Google, most production sites) still load,
// and phones/tablets can get a mobile user agent, pixel density and touch.

const { app, BrowserWindow, ClipboardItem, clipboard, ipcMain, session, shell, webContents } = require('electron');
const fs = require('node:fs');
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
    // Windows takes the icon from the .exe; Linux needs it on the window.
    ...(process.platform === 'linux' && { icon: path.join(__dirname, '..', 'build', 'icons', '256x256.png') }),
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

const SHORTCUT_CODES = new Set(['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyR', 'KeyS', 'KeyC']);

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

    // Keyboard shortcuts keep working after clicking into a device (Alt+0–5, Alt+R, Alt+Shift+R, Alt+S).
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

  const size = (value) => Math.min(8000, Math.max(0, Math.round(Number(value) || 0)));
  // 0 keeps this computer's own pixel density (Windows laptops and monitors).
  const dpr = Number(options.dpr) === 0 ? 0 : Math.min(4, Math.max(1, Number(options.dpr) || 1));
  const width = size(options.width); // the page's viewport (below a phone's status bar)
  const height = size(options.height);
  const screenWidth = size(options.screenWidth) || width; // the whole screen
  const screenHeight = size(options.screenHeight) || height;
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
      screenWidth,
      screenHeight,
    });
    // No scrollbar on any device (phones, tablets and Macs use overlay scrollbars that take no space).
    await contents.debugger.sendCommand('Emulation.setScrollbarsHidden', { hidden: Boolean(options.hideScrollbars) });
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: touch,
      maxTouchPoints: touch ? 5 : 1,
    });
    // The mouse stays a mouse. Turning it into touches makes Chrome draw its pointer as a faint
    // grey circle that disappears on dark sites. Pages still see a touch screen (above).
    await contents.debugger.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: false });
    return true;
  } catch (error) {
    console.error('Emulation failed:', error);
    return false;
  }
});

// ── Screenshot of the devices ────────────────────────────────

// The interface sends the devices' area in CSS pixels; the window's own
// picture (device views included) is cut to it and put on the clipboard.
ipcMain.handle('bezel:capture', async (event, rect) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false };
  const zoom = mainWindow.webContents.getZoomFactor(); // CSS pixels to window pixels
  const [maxWidth, maxHeight] = mainWindow.getContentSize();
  const value = (key) => Math.round(Number(rect?.[key]) * zoom);
  const x = Math.max(0, value('x'));
  const y = Math.max(0, value('y'));
  const width = Math.min(maxWidth - x, value('width'));
  const height = Math.min(maxHeight - y, value('height'));
  if (!(width > 0 && height > 0)) return { ok: false };
  try {
    const image = await mainWindow.webContents.capturePage({ x, y, width, height });
    if (image.isEmpty()) return { ok: false };
    // Electron 45's clipboard is asynchronous and takes W3C-style ClipboardItems.
    const png = new Blob([image.toPNG()], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return { ok: true, ...image.getSize() };
  } catch (error) {
    console.error('Screenshot failed:', error);
    return { ok: false };
  }
});

// ── Updates (GitHub Releases) ────────────────────────────────

/** "deb" (or "rpm"…) when Bezel was installed from a Linux package; null for an AppImage and on Windows. */
function linuxPackageType() {
  if (process.platform !== 'linux') return null;
  try {
    // electron-builder writes this file into Linux packages; electron-updater reads it too.
    return fs.readFileSync(path.join(process.resourcesPath, 'package-type'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function setUpAutoUpdates() {
  // The lasting state (up to date, downloading, ready) is kept, so a page that loads later can ask for it.
  let status = { state: 'idle' };
  const send = (data) => {
    // Lasting states, kept for the button's light (green: up to date, orange: a new version).
    if (['current', 'downloading', 'ready'].includes(data.state)) {
      status = data.state === status.state ? { ...status, ...data, quiet: true } : { ...data, quiet: true };
    }
    mainWindow?.webContents.send('bezel:update', data);
  };
  ipcMain.handle('bezel:update-status', () => status);

  // Running from source (npm run app): there is nothing to update.
  if (!app.isPackaged) {
    ipcMain.handle('bezel:check-updates', () => send({ state: 'dev' }));
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (error) {
    console.error('Updater unavailable:', error);
    ipcMain.handle('bezel:check-updates', () => send({ state: 'error' }));
    return;
  }

  autoUpdater.autoDownload = true; // new versions download in the background
  // and install when Bezel is closed (the Windows installer, or the AppImage replacing itself).
  // A Linux .deb installs with dpkg, which asks for the password: that only happens when the
  // user clicks Install, never as a surprise on quit.
  autoUpdater.autoInstallOnAppQuit = linuxPackageType() == null;

  let manual = false; // a check the user asked for reports every step, not only news
  let installing = false; // the user clicked Install
  let downloaded = null;

  autoUpdater.on('checking-for-update', () => manual && send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (progress) => send({ state: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-not-available', () => {
    // Every check reports "up to date" (it turns the light green); only a requested one says so out loud.
    send({ state: 'current', version: app.getVersion(), quiet: !manual });
    manual = false;
  });
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = info.version;
    send({ state: 'ready', version: info.version });
    manual = false;
  });
  autoUpdater.on('error', (error) => {
    console.error('Update failed:', error?.message ?? error);
    if (installing) {
      // E.g. the password prompt for a .deb was cancelled. The update stays downloaded, ready to try again.
      installing = false;
      send({ state: 'install-error', version: downloaded });
      return;
    }
    // A failed background download must not leave the button saying "Downloading".
    const wasDownloading = status.state === 'downloading';
    if (wasDownloading) status = { state: 'idle' };
    if (manual) send({ state: 'error' });
    else if (wasDownloading) send({ state: 'idle' });
    manual = false;
  });

  ipcMain.on('bezel:install-update', () => {
    if (!downloaded) return;
    installing = true;
    autoUpdater.quitAndInstall(); // then Bezel restarts on the new version
  });
  ipcMain.handle('bezel:check-updates', async () => {
    if (downloaded) return send({ state: 'ready', version: downloaded });
    manual = true;
    await autoUpdater.checkForUpdates().catch(() => {});
  });

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
