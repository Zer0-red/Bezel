import '@fontsource-variable/instrument-sans';
import './styles.css';
import { CATEGORIES, DEFAULT_DEVICE_IDS, DEVICES, POPULAR_DEVICES } from './devices.js';
import { createPicker } from './picker.js';
import { createSwapMenu } from './swap-menu.js';
import { createAddressList } from './address-list.js';
import { canCaptureTab, captureTab, download } from './screenshot.js';
import { canRotate, geometry } from './frames.js';
import { loadState, saveState } from './storage.js';
import { normalizeUrl } from './url.js';
import { emulationFor } from './emulation.js';
import { PAGE_SCRIPT, ratioFromConsole, ratioFromMessage, zoomFromConsole, zoomFromMessage } from './sync.js';

// In the desktop app (electron/preload.cjs) devices are real browser views
// instead of iframes, so every site loads and phones get mobile emulation.
const bridge = window.bezel?.isApp ? window.bezel : null;
if (bridge) document.documentElement.dataset.app = 'desktop';

// Version from package.json (vite.config.js), top left next to the name.
document.querySelector('#app-version').textContent = `v${__APP_VERSION__}`;

// ── State ────────────────────────────────────────────────────

const CAPTION_SPACE = 72; // room under each device for its caption (two centred lines)
const MAX_RECENT = 8;

// Zoom: a fixed scale between these, or Fit times a factor of at least FIT_ZOOM_MIN.
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const FIT_ZOOM_MIN = 0.2;

const defaults = {
  url: '',
  recent: [],
  selected: [...DEFAULT_DEVICE_IDS],
  mode: 'grid', // 'grid' = all devices, 'focus' = one device
  focusId: DEFAULT_DEVICE_IDS[0],
  zoom: 'fit', // 'fit' or a scale (1 = 100%)
  fitZoom: 1, // pinch or Ctrl + wheel on top of Fit: 1.3 = 30% bigger than fitted
  rotated: {},
  custom: [],
  setups: [], // the user's saved setups
  syncScroll: true, // scroll one device, the others follow
  favorites: [], // [{ url, title? }] starred in the address bar
  theme: 'dark', // or 'light'
  lastByCategory: {},
};

const state = { ...defaults, ...loadState() };

// Library devices, popular sizes and custom sizes, grouped in category order.
const allDevices = () =>
  [...DEVICES, ...POPULAR_DEVICES, ...state.custom].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
const deviceById = (id) => allDevices().find((d) => d.id === id);

// Drop anything stale from an older saved state.
state.selected = state.selected.filter((id) => deviceById(id));
if (!deviceById(state.focusId)) state.focusId = state.selected[0] ?? DEVICES[0].id;
if (!['grid', 'focus'].includes(state.mode)) state.mode = 'grid';
if (!Array.isArray(state.setups)) state.setups = [];
if (!Array.isArray(state.custom)) state.custom = [];
if (!Array.isArray(state.recent)) state.recent = [];
state.favorites = (Array.isArray(state.favorites) ? state.favorites : [])
  .filter((f) => typeof f?.url === 'string' && normalizeUrl(f.url) === f.url)
  .map((f) => (typeof f.title === 'string' && f.title ? { url: f.url, title: f.title.slice(0, 120) } : { url: f.url }));
if (!['dark', 'light'].includes(state.theme)) state.theme = 'dark';
if (state.zoom !== 'fit' && !(Number.isFinite(state.zoom) && state.zoom >= ZOOM_MIN && state.zoom <= ZOOM_MAX)) state.zoom = 'fit';
if (!(Number.isFinite(state.fitZoom) && state.fitZoom >= FIT_ZOOM_MIN && state.fitZoom <= 20)) state.fitZoom = 1;

// A ?url= link wins over the saved address.
const linkedUrl = normalizeUrl(new URLSearchParams(location.search).get('url'));
if (linkedUrl) state.url = linkedUrl;

const persist = () => saveState(state);

// ── Elements ─────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $('#address-form'),
  input: $('#address-input'),
  reload: $('#reload-btn'),
  rotate: $('#rotate-btn'),
  sync: $('#sync-btn'),
  shot: $('#shot-btn'),
  toast: $('#toast'),
  modeButtons: document.querySelectorAll('.segmented button'),
  zoom: $('#zoom-select'),
  devicebar: $('#devicebar'),
  stage: $('#stage'),
  rack: $('#rack'),
  empty: $('#stage-empty'),
  version: $('#app-version'),
  theme: $('#theme-btn'),
  updateBtn: $('#update-btn'),
  updateIcon: $('.update-btn__icon'),
  updateLabel: $('#update-label'),
  updateStatus: $('#update-status'),
};

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children);
  return el;
}

const ICONS = {
  rotate:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="14" height="11" rx="2"/><path d="M10 4h4a6 6 0 0 1 6 6v1"/><path d="m17.5 8.5 2.5 2.5 2.5-2.5"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  grid:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  stack:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="6" height="11" rx="1.5"/><rect x="10.5" y="5" width="11" height="9" rx="1.5"/><path d="M13 18h6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
};

function iconButton(icon, label, onClick, extraClass = '') {
  const btn = h('button', { class: `icon-btn icon-btn--small ${extraClass}`, type: 'button', 'aria-label': label, title: label, onclick: onClick });
  btn.innerHTML = ICONS[icon];
  return btn;
}

// ── Device rigs (frame + caption) ────────────────────────────

// Status bar shown above the page on phones (decorative, like a real phone at 9:41).
const STATUS_ICONS =
  '<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
  '<svg viewBox="0 0 16 12"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.3-1.3C13.4 1.5 10.8.5 8 .5S2.6 1.5.7 3.4L2 4.7c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.4l1.3-1.3C11.5 4.8 9.8 4.1 8 4.1s-3.5.7-4.7 1.9l1.3 1.3c.9-.9 2.1-1.4 3.4-1.4zM8 9.5c.5 0 .9.2 1.2.5L8 11.5 6.8 10c.3-.3.7-.5 1.2-.5z"/></svg>' +
  '<svg viewBox="0 0 27 12"><rect class="outline" x=".5" y=".5" width="23" height="11" rx="3.2"/><rect x="2" y="2" width="20" height="8" rx="1.8"/><path class="cap" d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4z"/></svg>';

function statusBarElement(device, g) {
  const ios = device.ua === 'ios';
  const bar = h('div', { class: `statusbar ${ios ? 'statusbar--ios' : 'statusbar--android'}`, 'aria-hidden': 'true' });
  bar.style.setProperty('--cut', `${g.cutout}px`);
  bar.innerHTML = `<span class="statusbar__time">9:41</span><span></span><span class="statusbar__icons">${STATUS_ICONS}</span>`;
  return bar;
}

// A MacBook's menu bar beside the camera housing: Safari's menus on the left, wifi, battery and the clock on the right.
const MENU_ICONS =
  '<svg viewBox="0 0 16 12"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.3-1.3C13.4 1.5 10.8.5 8 .5S2.6 1.5.7 3.4L2 4.7c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.4l1.3-1.3C11.5 4.8 9.8 4.1 8 4.1s-3.5.7-4.7 1.9l1.3 1.3c.9-.9 2.1-1.4 3.4-1.4zM8 9.5c.5 0 .9.2 1.2.5L8 11.5 6.8 10c.3-.3.7-.5 1.2-.5z"/></svg>' +
  '<svg viewBox="0 0 27 12"><rect class="outline" x=".5" y=".5" width="23" height="11" rx="3.2"/><rect x="2" y="2" width="16" height="8" rx="1.8"/><path class="cap" d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4z"/></svg>';

function menuBarElement(g) {
  const bar = h('div', { class: 'statusbar statusbar--mac', 'aria-hidden': 'true' });
  bar.style.setProperty('--cut', `${g.cutout}px`);
  const menus = ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Window', 'Help'].map((m) => `<span>${m}</span>`).join('');
  bar.innerHTML =
    `<span class="statusbar__menus"><b>Safari</b>${menus}</span><span></span>` +
    `<span class="statusbar__icons">${MENU_ICONS}<span class="statusbar__time">Thu 9:41</span></span>`;
  return bar;
}

/** id → { root, frame, device, body, screen, view, url, name, dims, scale, rotateBtn, focusBtn, geomKey } */
const rigs = new Map();

function createRig(device) {
  const screen = h('div', { class: 'device__screen' });
  const body = h('div', { class: 'device__body' }, screen);
  const deviceEl = h('div', { class: 'device' }, body);
  const frame = h('div', { class: 'rig__frame' }, deviceEl);

  // The name opens the device menu, to put another device in this one's place.
  const name = h(
    'button',
    { class: 'rig__name', type: 'button', title: 'Switch to another device', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    h('span', { class: 'rig__name-text', text: device.name }),
  );
  const chevron = h('span', { class: 'rig__name-chevron', 'aria-hidden': 'true' });
  chevron.innerHTML = ICONS.chevron;
  name.append(chevron);
  // A click outside closes the menu before this button's click arrives, so remember whether it was open.
  let menuWasOpen = false;
  name.addEventListener('pointerdown', () => (menuWasOpen = swapMenu.isOpenFor(name)));
  name.addEventListener('click', () => {
    const wasOpen = menuWasOpen || swapMenu.isOpenFor(name);
    menuWasOpen = false;
    if (wasOpen) swapMenu.close();
    else swapMenu.open(name, device.id);
  });
  const dims = h('span', { class: 'rig__dims' });
  const scale = h('span', { class: 'rig__scale' });
  const status = h('span', { class: 'rig__status', 'aria-hidden': 'true' });
  const rotateBtn = iconButton('rotate', `Rotate ${device.name}`, () => toggleRotation(device.id));
  const focusBtn = iconButton('expand', `View ${device.name} on its own`, () =>
    state.mode === 'focus' ? setMode('grid') : focusDevice(device.id),
  );

  const caption = h(
    'figcaption',
    { class: 'rig__caption' },
    h('div', { class: 'rig__title' }, status, name),
    h('div', { class: 'rig__info' }, h('span', { class: 'rig__meta' }, dims, scale), h('div', { class: 'rig__actions' }, rotateBtn, focusBtn)),
  );

  const root = h('figure', { class: 'rig', 'data-id': device.id }, frame, caption);
  const rig = { root, frame, device: deviceEl, body, screen, view: null, url: '', name, dims, scale, rotateBtn, focusBtn, geomKey: '' };
  setRigUrl(rig, device, state.url);
  return rig;
}

function setScreenMessage(rig, text) {
  rig.screen.querySelector('.screen-empty')?.remove();
  if (text) rig.screen.append(h('div', { class: 'screen-empty' }, h('p', { text })));
}

/** The web page inside a device: an iframe on the web, a real browser view in the app. */
// Width of this computer's classic scrollbars (0 where scrollbars overlay, as on Macs).
const SCROLLBAR_WIDTH = (() => {
  const probe = h('div', { style: 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll' });
  document.body.append(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
})();
document.documentElement.style.setProperty('--scrollbar-w', `${SCROLLBAR_WIDTH}px`);

function createView(rig, device) {
  if (!bridge) {
    const frame = h('iframe', { title: `${device.name} preview`, allow: 'fullscreen; clipboard-write' });
    frame.addEventListener('load', () => rig.root.classList.remove('is-loading'));
    // Devices show no scrollbar. On the web, a desktop scrollbar inside the frame can't be
    // removed, so the frame is made one scrollbar wider and the scrollbar is clipped off:
    // the page lays out at the device's exact width.
    if (SCROLLBAR_WIDTH && emulationFor(device)?.hideScrollbars) rig.screen.classList.add('hide-scrollbar');
    return frame;
  }

  // Emulation is switched on while the view shows a blank page, so the site's
  // very first load already sees the phone's pixel density, viewport rules and touch.
  const emulation = emulationFor(device);
  const view = h('webview', {
    'aria-label': `${device.name} preview`, // not title: on a webview it shows as a tooltip over the site
    partition: 'persist:bezel', // devices share cookies, so a login works in all of them
    useragent: emulation?.userAgent,
    src: 'about:blank',
  });
  rig.emulation = emulation;
  let ready = false;
  view.addEventListener('dom-ready', async () => {
    if (ready) return;
    ready = true;
    rig.viewReady = true;
    await applyEmulation(rig, device);
    if (rig.url) view.loadURL(rig.url).catch(() => {});
  });
  view.addEventListener('dom-ready', () => {
    if (rig.url && view.getURL() !== 'about:blank') view.executeJavaScript(PAGE_SCRIPT).catch(() => {});
  });
  view.addEventListener('console-message', (e) => {
    const ratio = ratioFromConsole(e.message);
    if (ratio !== null) {
      syncScroll(rig, ratio);
      return;
    }
    const zoom = zoomFromConsole(e.message); // a pinch or Ctrl + wheel inside the device
    if (zoom) {
      const at = viewPoint(rig, zoom.x, zoom.y);
      zoomAt(zoom.deltaY, at.x, at.y);
    }
  });
  view.addEventListener('did-start-loading', () => setScreenMessage(rig, ''));
  view.addEventListener('did-stop-loading', () => rig.root.classList.remove('is-loading'));
  view.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3: replaced by a newer load
    let host = rig.url;
    try {
      host = new URL(e.validatedURL || rig.url).host;
    } catch {
      /* keep the address as typed */
    }
    setScreenMessage(rig, `Couldn’t open ${host}. Check that the server is running and the address is right.`);
  });
  return view;
}

/** Desktop app: phone/tablet emulation at the device's current (possibly rotated) size. */
async function applyEmulation(rig, device) {
  if (!bridge || !rig.emulation || !rig.viewReady) return;
  const g = geometry(device, !!state.rotated[device.id]);
  // The page gets the screen minus the status bar; screen.width/height stay the full screen.
  await bridge.emulate(rig.view.getWebContentsId(), {
    ...rig.emulation,
    width: g.w,
    height: g.h - g.statusBar,
    screenWidth: g.w,
    screenHeight: g.h,
  });
}

function setRigUrl(rig, device, url, { force = false } = {}) {
  if (!url) {
    rig.view?.remove();
    rig.view = null;
    rig.viewReady = false;
    rig.url = '';
    rig.root.classList.remove('is-loading');
    setScreenMessage(rig, 'Type your dev server’s address above, like localhost:3000, and press Open.');
    return;
  }

  if (!rig.view) {
    setScreenMessage(rig, '');
    rig.view = createView(rig, device);
    rig.screen.append(rig.view);
  } else if (rig.url === url && !force) {
    return;
  }
  rig.url = url;
  rig.root.classList.add('is-loading');

  if (!bridge) {
    rig.view.src = url; // setting src again reloads, even with the same address
  } else if (rig.viewReady) {
    rig.view.loadURL(url).catch(() => {});
  } // otherwise the view loads rig.url as soon as it is ready (see createView)
}

function renderParts(rig, g, deviceData) {
  const { device, body, screen } = rig;
  device.dataset.kind = g.kind;
  // Laptops: which design (MacBook Air, MacBook Pro, Windows laptop…) and the colour of its metal.
  if (g.model) device.dataset.model = g.model;
  else delete device.dataset.model;
  if (g.finish) device.dataset.finish = g.finish;
  else delete device.dataset.finish;
  device.classList.toggle('is-landscape', g.landscape);
  device.style.width = `${g.outerW}px`;
  device.style.height = `${g.outerH}px`;

  Object.assign(body.style, {
    left: `${g.body.x}px`,
    top: `${g.body.y}px`,
    width: `${g.body.w}px`,
    height: `${g.body.h}px`,
    borderRadius: g.body.radius,
  });
  body.style.setProperty('--rim', `${g.body.rim}px`);
  body.style.setProperty('--inner-radius', g.body.innerRadius);

  Object.assign(screen.style, {
    left: `${g.screen.x}px`,
    top: `${g.screen.y}px`,
    width: `${g.screen.w}px`,
    height: `${g.screen.h}px`,
    borderRadius: g.screen.radius,
  });
  screen.style.setProperty('--min', `${Math.min(g.w, g.h)}px`);

  // Phones: the status bar sits above the page, as in Safari and Chrome. MacBooks: the menu bar.
  screen.style.setProperty('--sb', `${g.statusBar}px`);
  screen.querySelector('.statusbar')?.remove();
  if (g.statusBar) screen.prepend(g.kind === 'laptop' ? menuBarElement(g) : statusBarElement(deviceData, g));

  device.querySelectorAll('.part').forEach((p) => p.remove());
  for (const part of g.parts) {
    device.append(
      h('span', {
        class: `part part--${part.cls}`,
        style: `left:${part.x}px;top:${part.y}px;width:${part.w}px;height:${part.h}px`,
      }),
    );
  }
}

// ── Sync DOM with state ──────────────────────────────────────

function syncRigs() {
  const order = allDevices().map((d) => d.id);
  const wanted = new Set(state.selected);
  if (state.mode === 'focus') wanted.add(state.focusId);

  for (const [id, rig] of rigs) {
    if (!wanted.has(id) || !deviceById(id)) {
      rig.root.remove();
      rigs.delete(id);
    }
  }

  // Insert new rigs in device order without moving existing ones (moving a frame or view reloads it).
  order.forEach((id, index) => {
    if (!wanted.has(id) || rigs.has(id)) return;
    const rig = createRig(deviceById(id));
    const next = order.slice(index + 1).find((nextId) => rigs.has(nextId));
    els.rack.insertBefore(rig.root, next ? rigs.get(next).root : null);
    rigs.set(id, rig);
  });

  for (const [id, rig] of rigs) {
    rig.root.hidden = state.mode === 'focus' && id !== state.focusId;
    const isFocus = state.mode === 'focus';
    rig.focusBtn.innerHTML = isFocus ? ICONS.grid : ICONS.expand;
    const label = isFocus ? 'Back to all devices' : `View ${deviceById(id).name} on its own`;
    rig.focusBtn.setAttribute('aria-label', label);
    rig.focusBtn.title = label;
  }

  els.empty.hidden = !(state.mode === 'grid' && state.selected.length === 0);
  document.body.dataset.mode = state.mode;
  layout();
}

// In the all-devices view, "Fit" may shrink the row to fit the window's width,
// but not below this share of each device's height-fitted size (then it scrolls).
const MIN_ROW_SHRINK = 0.55;
const CAPTION_MIN_WIDTH = 220; // .rig__caption min-width in styles.css
let fitScaleMax = 1; // the largest device scale Fit gives before state.fitZoom (set by layout)

function layout() {
  const cs = getComputedStyle(els.stage);
  const availW = els.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = els.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - CAPTION_SPACE;
  const gap = parseFloat(getComputedStyle(els.rack).columnGap) || 0;

  // First pass: geometry and each device's own scale.
  const shown = [];
  for (const [id, rig] of rigs) {
    if (rig.root.hidden) continue;
    const device = deviceById(id);
    const rotated = !!state.rotated[id];
    const g = geometry(device, rotated);

    const key = `${g.kind}:${g.w}x${g.h}`;
    if (key !== rig.geomKey) {
      const resized = rig.geomKey !== '';
      renderParts(rig, g, device);
      rig.geomKey = key;
      if (resized) applyEmulation(rig, device); // rotated: tell the emulated phone its new size
    }

    let s;
    if (state.zoom === 'fit' && state.mode === 'focus') {
      // One device: fill the stage.
      s = Math.min(1, availH / g.outerH, availW / g.outerW);
    } else if (state.zoom === 'fit') {
      // All devices: size each by its taller orientation, so turning a phone
      // keeps its scale instead of making it jump in size.
      const tallest = rotated ? Math.max(g.outerH, geometry(device, false).outerH) : g.outerH;
      s = Math.min(1, availH / tallest);
    } else {
      s = Number(state.zoom);
    }
    shown.push({ rig, device, g, rotated, s });
  }

  // Second pass (all devices, Fit): shrink the whole row together so it fits the width.
  // Captions keep a minimum width, so only the devices wider than that shrink; solve for them.
  if (state.zoom === 'fit' && state.mode === 'grid' && shown.length) {
    const target = availW - 1; // a pixel of slack for sub-pixel rounding
    let factor = 1;
    for (let i = 0; i < 4; i += 1) {
      const widths = shown.map((d) => d.g.outerW * d.s * factor);
      const rowWidth = widths.reduce((sum, w) => sum + Math.max(w, CAPTION_MIN_WIDTH), 0) + gap * (shown.length - 1);
      if (rowWidth <= target) break;
      const scalable = widths.filter((w) => w > CAPTION_MIN_WIDTH).reduce((sum, w) => sum + w, 0);
      if (!scalable) break;
      factor = Math.max(MIN_ROW_SHRINK, factor * ((target - (rowWidth - scalable)) / scalable));
      if (factor === MIN_ROW_SHRINK) break;
    }
    for (const d of shown) d.s *= factor;
  }

  // Zoomed in or out from Fit (pinch or Ctrl + wheel): every device grows or shrinks by the same factor.
  if (state.zoom === 'fit' && shown.length) {
    fitScaleMax = Math.max(...shown.map((d) => d.s));
    for (const d of shown) d.s *= state.fitZoom;
  }

  for (const { rig, device, g, rotated, s: scale } of shown) {
    const s = Math.max(0.05, scale);
    rig.frame.style.width = `${g.outerW * s}px`;
    rig.frame.style.height = `${g.outerH * s}px`;
    rig.device.style.transform = `scale(${s})`;
    rig.root.style.setProperty('--frame-w', `${g.outerW * s}px`);

    rig.dims.textContent = `${g.w} × ${g.h}`;
    rig.scale.textContent = `${Math.round(s * 100)}%`;
    rig.rotateBtn.hidden = !canRotate(device);
    rig.rotateBtn.setAttribute('aria-pressed', String(rotated));
  }
}

// ── Zoom: pinch on a trackpad, or Ctrl + mouse wheel ─────────
// Browsers send a trackpad pinch as a wheel event with ctrlKey set, so both arrive the same way:
// on the desk directly, from device views through the page script (app) or sync.js (web).

const ZOOM_PRESETS = ['0.25', '0.5', '0.75', '1'];
const zoomGesture = { factor: 1, x: 0, y: 0, frame: 0, idle: 0 };

/** A wheel's deltaY in pixels (lines and pages converted), for one step of zoom. */
const wheelPixels = (e) => e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1);

/** Zoom by one wheel event at a point in this window. A mouse-wheel notch zooms about 11%; a pinch follows the fingers. */
function zoomAt(deltaY, x, y) {
  const step = Math.max(-12, Math.min(12, deltaY));
  zoomGesture.factor *= Math.exp(-step / 100);
  zoomGesture.x = x;
  zoomGesture.y = y;
  els.stage.classList.add('is-zooming'); // no transform transition while the fingers move
  if (!zoomGesture.frame) zoomGesture.frame = requestAnimationFrame(applyZoom);
}

/** The device nearest a point, and where the point sits on it (0–1 across and down, can overshoot). */
function anchorAt(x, y) {
  let best = null;
  for (const rig of rigs.values()) {
    if (rig.root.hidden) continue;
    const r = rig.frame.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { rig, distance, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height };
  }
  return best;
}

function applyZoom() {
  const { factor, x, y } = zoomGesture;
  zoomGesture.frame = 0;
  zoomGesture.factor = 1;
  const anchor = anchorAt(x, y);
  if (state.zoom === 'fit') {
    state.fitZoom = Math.min(ZOOM_MAX / fitScaleMax, Math.max(FIT_ZOOM_MIN, state.fitZoom * factor));
  } else {
    state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.zoom * factor));
  }
  layout();
  renderZoom();
  // Keep the same spot of the same device under the pointer.
  if (anchor) {
    const r = anchor.rig.frame.getBoundingClientRect();
    els.stage.scrollLeft += r.left + anchor.fx * r.width - x;
    els.stage.scrollTop += r.top + anchor.fy * r.height - y;
  }
  clearTimeout(zoomGesture.idle);
  zoomGesture.idle = setTimeout(() => {
    els.stage.classList.remove('is-zooming');
    // Back to plain Fit when the gesture ends within 2% of it.
    if (state.zoom === 'fit' && state.fitZoom !== 1 && Math.abs(state.fitZoom - 1) < 0.02) {
      state.fitZoom = 1;
      layout();
      renderZoom();
    }
    persist();
  }, 250);
}

/** A point in a device view (its own CSS pixels) as a point in this window. */
function viewPoint(rig, x, y) {
  const r = rig.view.getBoundingClientRect();
  const k = rig.view.offsetWidth ? r.width / rig.view.offsetWidth : 1;
  return { x: r.left + x * k, y: r.top + y * k };
}

/** The zoom menu shows Fit, a preset, or what a pinch made of it ("Fit +30%", "63%"). */
function renderZoom() {
  const custom = els.zoom.querySelector('option[value="custom"]');
  let value;
  if (state.zoom === 'fit') {
    value = state.fitZoom === 1 ? 'fit' : 'custom';
    const pct = Math.round((state.fitZoom - 1) * 100);
    custom.textContent = `Fit ${pct < 0 ? '−' : '+'}${Math.abs(pct)}%`;
  } else {
    value = ZOOM_PRESETS.includes(String(state.zoom)) ? String(state.zoom) : 'custom';
    custom.textContent = `${Math.round(state.zoom * 100)}%`;
  }
  els.zoom.value = value;
}

// ── Synced scrolling ─────────────────────────────────────────

/** A device was scrolled by the user: move the other visible devices to the same point. */
function syncScroll(sourceRig, ratio) {
  if (!state.syncScroll || state.mode !== 'grid') return;
  for (const rig of rigs.values()) {
    if (rig === sourceRig || rig.root.hidden || !rig.view || !rig.url) continue;
    if (bridge) {
      if (rig.viewReady) rig.view.executeJavaScript(`window.__bezelScrollTo && window.__bezelScrollTo(${ratio})`).catch(() => {});
    } else {
      rig.view.contentWindow?.postMessage({ bezel: 'scrollTo', ratio }, '*');
    }
  }
}

// Web version: pages that include public/sync.js report their scrolling here.
if (!bridge) {
  window.addEventListener('message', (e) => {
    const rig = [...rigs.values()].find((r) => r.view && r.view.contentWindow === e.source);
    if (!rig) return;
    if (e.data?.bezel === 'hello') {
      rig.syncHelper = true;
      e.source.postMessage({ bezel: 'ready' }, '*'); // the helper may now pass on pinches and Ctrl + wheel
      renderToolbar();
      return;
    }
    const ratio = ratioFromMessage(e.data);
    if (ratio !== null) {
      syncScroll(rig, ratio);
      return;
    }
    const zoom = zoomFromMessage(e.data);
    if (zoom) {
      const at = viewPoint(rig, zoom.x, zoom.y);
      zoomAt(zoom.deltaY, at.x, at.y);
    }
  });
}

function toggleSync() {
  state.syncScroll = !state.syncScroll;
  persist();
  renderToolbar();
}

function renderToolbar() {
  els.input.value = state.url ? displayUrl(state.url) : '';
  addressList.renderStar();
  els.modeButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.mode)));
  renderZoom();
  els.reload.disabled = !state.url;
  els.sync.setAttribute('aria-pressed', String(state.syncScroll));
  const helperSeen = bridge || [...rigs.values()].some((r) => r.syncHelper);
  els.sync.title = state.syncScroll
    ? helperSeen
      ? 'Scrolling is synced across devices (Alt+S to turn off)'
      : 'Scrolling is synced once your site includes the Bezel sync helper; see the README (Alt+S to turn off)'
    : 'Sync scrolling across devices (Alt+S)';
}

/** All-devices view: bring a device into view and highlight it briefly. */
function scrollToDevice(id) {
  const rig = rigs.get(id);
  if (!rig) return;
  rig.root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  rig.root.classList.remove('is-flash');
  void rig.root.offsetWidth; // restart the highlight
  rig.root.classList.add('is-flash');
}

function render() {
  renderToolbar();
  picker.renderBar();
  syncRigs();
}

// ── Actions ──────────────────────────────────────────────────

function displayUrl(url) {
  return url.replace(/^http:\/\/(?=(localhost|127\.|\[::1\]))/i, '').replace(/\/$/, '');
}

function openUrl(raw) {
  const url = normalizeUrl(raw);
  if (url === null) {
    els.input.setCustomValidity('That isn’t a web address. Try localhost:3000 or https://example.com.');
    els.input.reportValidity();
    return;
  }
  els.input.setCustomValidity('');
  state.url = url;
  if (url) state.recent = [url, ...state.recent.filter((u) => u !== url)].slice(0, MAX_RECENT);
  persist();

  const params = new URLSearchParams(location.search);
  if (url) params.set('url', url);
  else params.delete('url');
  const query = params.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);

  for (const [id, rig] of rigs) setRigUrl(rig, deviceById(id), url);
  renderToolbar();
}

function reloadAll() {
  if (!state.url) return;
  els.reload.classList.remove('is-turning');
  void els.reload.offsetWidth; // restart the turn
  els.reload.classList.add('is-turning');
  for (const [id, rig] of rigs) setRigUrl(rig, deviceById(id), state.url, { force: true });
}

function setMode(mode) {
  if (mode === 'focus' && !deviceById(state.focusId)) state.focusId = state.selected[0] ?? DEVICES[0].id;
  state.mode = mode;
  persist();
  render();
}

function focusDevice(id) {
  const device = deviceById(id);
  if (!device) return;
  state.focusId = id;
  state.lastByCategory[device.category] = id;
  setMode('focus');
}

function focusCategory(category) {
  const remembered = state.lastByCategory[category];
  const pick =
    (remembered && deviceById(remembered)?.category === category && remembered) ||
    state.selected.find((id) => deviceById(id)?.category === category) ||
    allDevices().find((d) => d.category === category)?.id;
  if (pick) focusDevice(pick);
}

/** The device menu under a device: put another device in its place. */
function replaceDevice(oldId, newId) {
  const next = deviceById(newId);
  if (!next || oldId === newId) return;
  if (state.selected.includes(oldId)) {
    state.selected = state.selected.includes(newId)
      ? state.selected.filter((id) => id !== oldId)
      : state.selected.map((id) => (id === oldId ? newId : id));
  }
  // A phone turned sideways stays sideways when swapped for another phone or tablet.
  if (canRotate(next) && canRotate(deviceById(oldId) ?? next)) state.rotated[newId] = !!state.rotated[oldId];
  if (state.focusId === oldId) state.focusId = newId;
  if (state.mode === 'focus') state.lastByCategory[next.category] = newId;
  persist();
  render();
  if (state.mode === 'grid') scrollToDevice(newId);
}

function toggleSelected(id) {
  state.selected = state.selected.includes(id) ? state.selected.filter((x) => x !== id) : [...state.selected, id];
  persist();
  render();
}

function toggleRotation(id) {
  if (!canRotate(deviceById(id))) return;
  state.rotated[id] = !state.rotated[id];
  persist();
  layout();
}

function rotate() {
  if (state.mode === 'focus') return toggleRotation(state.focusId);
  // In the all-devices view, turn the handhelds together. Monitors turn one at a time from their caption.
  const handheld = ['Mobile', 'Tablet'];
  const rotatable = state.selected.filter((id) => handheld.includes(deviceById(id).category) && canRotate(deviceById(id)));
  if (!rotatable.length) return;
  const allRotated = rotatable.every((id) => state.rotated[id]);
  rotatable.forEach((id) => (state.rotated[id] = !allRotated));
  persist();
  layout();
}

// ── Events ───────────────────────────────────────────────────

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  addressList.close();
  openUrl(els.input.value);
});
els.input.addEventListener('input', () => els.input.setCustomValidity(''));
els.reload.addEventListener('click', reloadAll);
els.rotate.addEventListener('click', rotate);
els.sync.addEventListener('click', toggleSync);
els.shot.addEventListener('click', takeScreenshot);
els.theme.addEventListener('click', toggleTheme);
els.modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
els.zoom.addEventListener('change', () => {
  if (els.zoom.value === 'custom') return;
  state.zoom = els.zoom.value === 'fit' ? 'fit' : Number(els.zoom.value);
  state.fitZoom = 1;
  persist();
  layout();
  renderZoom();
});

// The device menu is placed next to a caption; it closes when the desk scrolls.
els.stage.addEventListener('scroll', () => swapMenu.close(), { passive: true });

// Pinch on the trackpad or Ctrl + wheel zooms the devices (instead of the whole page);
// a normal mouse wheel scrolls the row of devices sideways.
els.stage.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomAt(wheelPixels(e), e.clientX, e.clientY);
      return;
    }
    if (state.mode !== 'grid') return;
    const canScrollX = els.stage.scrollWidth > els.stage.clientWidth;
    const canScrollY = els.stage.scrollHeight > els.stage.clientHeight;
    if (canScrollX && !canScrollY && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      els.stage.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false },
);

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (picker.isOpen() || swapMenu.isOpen()) return;

  if (e.key === '/' && !typing && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    els.input.focus();
    els.input.select();
    return;
  }
  if (e.key === 'Escape' && !typing && state.mode === 'focus') {
    setMode('grid');
    return;
  }
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  if (runShortcut(e.code, e.shiftKey)) e.preventDefault();
});

/** Alt shortcuts. Returns true when the key was one of Bezel's. */
function runShortcut(code, shift) {
  if (picker.isOpen() || swapMenu.isOpen()) return false;
  const digit = /^Digit([0-5])$/.exec(code);
  if (digit) {
    const n = Number(digit[1]);
    if (n === 0) setMode('grid');
    else focusCategory(CATEGORIES[n - 1]);
    return true;
  }
  if (code === 'KeyR') {
    if (shift) reloadAll();
    else rotate();
    return true;
  }
  if (code === 'KeyS') {
    toggleSync();
    return true;
  }
  if (code === 'KeyC') {
    takeScreenshot();
    return true;
  }
  return false;
}

// ── Screenshot of the devices ────────────────────────────────

const TOAST_ICONS = {
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
};
let toastTimer = 0;

/** A short confirmation at the bottom of the window. */
function notify(text, icon = 'check') {
  clearTimeout(toastTimer);
  els.toast.querySelector('.toast__icon').innerHTML = TOAST_ICONS[icon];
  els.toast.dataset.icon = icon;
  els.toast.querySelector('.toast__text').textContent = text;
  els.toast.classList.add('is-shown');
  toastTimer = setTimeout(() => hideToast(), icon === 'check' ? 2200 : 4500);
}

function hideToast({ instant = false } = {}) {
  clearTimeout(toastTimer);
  if (instant) els.toast.style.transition = 'none';
  els.toast.classList.remove('is-shown');
  if (instant) {
    void els.toast.offsetWidth; // apply the change before the transition comes back
    els.toast.style.transition = '';
  }
}

/** The devices with their captions and a margin of desk, in viewport CSS pixels; only what's visible. */
function captureArea() {
  const shown = [...rigs.values()].filter((r) => !r.root.hidden);
  if (!shown.length) return null;
  const stage = els.stage.getBoundingClientRect();
  const boxes = shown.map((r) => r.root.getBoundingClientRect());
  const margin = 28;
  const left = Math.max(stage.left, Math.min(...boxes.map((b) => b.left)) - margin);
  const top = Math.max(stage.top, Math.min(...boxes.map((b) => b.top)) - margin);
  const right = Math.min(stage.left + els.stage.clientWidth, Math.max(...boxes.map((b) => b.right)) + margin);
  const bottom = Math.min(stage.top + els.stage.clientHeight, Math.max(...boxes.map((b) => b.bottom)) + margin);
  if (right <= left || bottom <= top) return null;
  return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
}

let capturing = false;

async function takeScreenshot() {
  if (capturing) return;
  if (!captureArea()) return notify('Add a device to take a screenshot.', 'info');
  if (!bridge && !canCaptureTab()) return notify('Screenshots work in Chrome and Edge, or in the desktop app.', 'info');
  capturing = true;
  els.shot.setAttribute('aria-busy', 'true');
  hideToast({ instant: true }); // never in the picture
  try {
    if (bridge) {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await bridge.capture(captureArea());
      if (result?.ok) notify('Copied to clipboard');
      else notify('Couldn’t take the screenshot. Try again.', 'info');
      return;
    }
    // Web: the browser asks to share this tab, then one frame is cut to the devices.
    const blob = await captureTab(els.stage, captureArea);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      notify('Copied to clipboard');
    } catch {
      download(blob, `bezel-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`);
      notify('The browser blocked the clipboard, so the screenshot was downloaded.', 'info');
    }
  } catch (error) {
    if (error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') {
      console.error('Screenshot failed:', error);
      notify('Couldn’t take the screenshot. Share this tab when the browser asks.', 'info');
    } // otherwise the person chose not to share the tab
  } finally {
    capturing = false;
    els.shot.removeAttribute('aria-busy');
  }
}

// ── Theme ────────────────────────────────────────────────────

/** Dark (the default) or light. index.html applies the saved theme before the first paint too. */
function applyTheme() {
  const light = state.theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', light ? 'light' : 'dark');
  const label = light ? 'Switch to dark theme' : 'Switch to light theme';
  els.theme.setAttribute('aria-label', label);
  els.theme.title = label;
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  persist();
  applyTheme();
}

// ── Updates (button at the end of the toolbar) ───────────────

const UPDATE_ICONS = {
  update: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.75"/><path d="M12 16.25V8M8.25 11.5 12 7.75l3.75 3.75"/></svg>', // the "update" arrow browsers use
  spinner: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-8-8"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

let updateTimer = 0;
let updateLight = ''; // the light on the button: 'ok' (green, up to date) or 'new' (orange, a new version is out)

/**
 * States from electron/main.cjs (idle, checking, current, downloading, ready, error, dev), plus reload on the web.
 * `quiet`: a check nobody asked for; "up to date" then only turns the light green.
 */
function showUpdate({ state: updateState, version, percent, quiet = false } = {}) {
  clearTimeout(updateTimer);
  const btn = els.updateBtn;
  if (version) btn.dataset.version = version;
  const v = btn.dataset.version ?? '';
  if (['downloading', 'ready', 'install-error', 'reload'].includes(updateState)) updateLight = 'new';
  else if (updateState === 'current') updateLight = 'ok';
  if (quiet && updateState === 'current') updateState = 'idle';
  const idleTitle =
    updateLight === 'ok' ? `Bezel ${__APP_VERSION__} is up to date. Click to check again.` : updateLight === 'new' ? `A new version of Bezel is out` : 'Check for updates';
  const views = {
    idle: { icon: 'update', label: '', title: idleTitle },
    checking: { icon: 'spinner', label: '', title: 'Checking for updates…', status: 'Checking for updates…' },
    current: { icon: 'check', label: 'Up to date', title: `Bezel ${__APP_VERSION__} is the latest version.`, status: 'Bezel is up to date.', reset: 4000 },
    downloading: { icon: 'update', label: `Downloading ${v} (${percent ?? 0}%)`, title: `Bezel ${v} is downloading. You can keep working.` },
    ready: { icon: 'update', label: `Install ${v}`, title: `Restart Bezel to install version ${v}`, status: `Bezel ${v} is ready to install.` },
    reload: { icon: 'update', label: `Reload for ${v}`, title: `Bezel ${v} is out. Reload the page to use it.`, status: `Bezel ${v} is out.` },
    error: { icon: 'update', label: 'Couldn’t check', title: 'Couldn’t check for updates. Check your connection and try again.', status: 'Couldn’t check for updates.', reset: 6000 },
    'install-error': { icon: 'update', label: 'Couldn’t install', title: `Bezel couldn’t install version ${v}. Click to try again.`, status: 'Couldn’t install the update.', reset: 6000, next: 'ready' },
    dev: { icon: 'update', label: 'Updates work in the installed app', title: 'Updates work in the installed app.', reset: 5000 },
  };
  const key = views[updateState] ? updateState : 'idle';
  const view = views[key];
  btn.dataset.state = key;
  els.updateIcon.innerHTML = UPDATE_ICONS[view.icon];
  els.updateLabel.textContent = view.label;
  btn.setAttribute('aria-label', view.label || view.title);
  btn.title = view.title;
  if (view.status) els.updateStatus.textContent = view.status;
  if (view.reset) updateTimer = setTimeout(() => showUpdate({ state: view.next ?? 'idle' }), view.reset);
  btn.dataset.light = updateLight;
  btn.hidden = false;
}

els.updateBtn.addEventListener('click', () => {
  const current = els.updateBtn.dataset.state;
  if (current === 'ready' || current === 'install-error') bridge?.installUpdate();
  else if (current === 'reload') location.reload();
  else if (['checking', 'downloading'].includes(current)) return;
  else if (bridge) bridge.checkForUpdates();
  else checkDeployed({ manual: true });
});

// Web version: GitHub Pages serves a version.json next to the page (vite.config.js).
// The light goes green when this is the latest Bezel; a tab left open offers a reload when a newer one is out.
const newerVersion = (a, b) => {
  const [pa, pb] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};
let lastWebCheck = 0;

async function checkDeployed({ manual = false } = {}) {
  lastWebCheck = Date.now();
  if (manual) showUpdate({ state: 'checking' });
  try {
    const res = await fetch(`./version.json?t=${lastWebCheck}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`version.json: ${res.status}`);
    const { version } = await res.json();
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('version.json: no version');
    if (newerVersion(version, __APP_VERSION__)) showUpdate({ state: 'reload', version });
    else showUpdate({ state: 'current', quiet: !manual });
  } catch {
    // Offline, or the development server (it has no version.json).
    if (manual) showUpdate({ state: 'error' });
  }
}

if (!bridge) {
  setTimeout(checkDeployed, 1500);
  setInterval(checkDeployed, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastWebCheck > 10 * 60 * 1000) checkDeployed();
  });
}

// ── Desktop app only ─────────────────────────────────────────

if (bridge) {
  // In the app, shortcuts also work while a device has focus.
  bridge.onShortcut(({ code, shift }) => runShortcut(code, shift));

  // The brand link would reload the app's file; it stays put instead.
  document.querySelector('.brand')?.addEventListener('click', (e) => e.preventDefault());

  // Updates: the app checks by itself; the button in the toolbar (or the version number) checks on demand.
  bridge.onUpdate(showUpdate);
  bridge
    .updateStatus?.()
    .then((status) => status && showUpdate(status)) // an update may have downloaded before this page loaded
    .catch(() => {});

  els.version.disabled = false;
  els.version.title = 'Check for updates';
  els.version.addEventListener('click', () => bridge.checkForUpdates());
}

let frameRequest = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(frameRequest);
  frameRequest = requestAnimationFrame(layout);
}).observe(els.stage);

const swapMenu = createSwapMenu({ state, h, allDevices, deviceById, replaceDevice });

// The page title of an open site (desktop app only; the web version can't read another site's title).
const pageTitle = (url) => {
  if (!bridge) return '';
  const rig = [...rigs.values()].find((r) => r.viewReady && r.url === url);
  const title = rig?.view?.getTitle?.()?.trim() ?? '';
  return title && title !== url && !url.includes(title) ? title : '';
};
const addressList = createAddressList({ state, h, persist, displayUrl, openUrl, pageTitle });

const picker = createPicker({
  state,
  h,
  ICONS,
  iconButton,
  allDevices,
  deviceById,
  persist,
  render,
  toggleSelected,
  focusDevice,
  setMode,
  scrollToDevice,
});

applyTheme();
showUpdate({ state: 'idle' });
render();
if (!state.url) els.input.focus();
