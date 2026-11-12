import '@fontsource-variable/instrument-sans';
import './styles.css';
import { CATEGORIES, DEFAULT_DEVICE_IDS, DEVICES, POPULAR_DEVICES } from './devices.js';
import { createPicker } from './picker.js';
import { canRotate, geometry } from './frames.js';
import { loadState, saveState } from './storage.js';
import { normalizeUrl } from './url.js';
import { emulationFor } from './emulation.js';

// In the Windows app (electron/preload.cjs) devices are real browser views
// instead of iframes, so every site loads and phones get mobile emulation.
const bridge = window.bezel?.isApp ? window.bezel : null;
if (bridge) document.documentElement.dataset.app = 'desktop';

// Version from package.json (vite.config.js), top left next to the name.
document.querySelector('#app-version').textContent = `v${__APP_VERSION__}`;

// ── State ────────────────────────────────────────────────────

const CAPTION_SPACE = 68; // room under each device for its caption
const MAX_RECENT = 8;

const defaults = {
  url: '',
  recent: [],
  selected: [...DEFAULT_DEVICE_IDS],
  mode: 'grid', // 'grid' = all devices, 'focus' = one device
  focusId: DEFAULT_DEVICE_IDS[0],
  zoom: 'fit',
  rotated: {},
  custom: [],
  setups: [], // the user's saved setups
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

// A ?url= link wins over the saved address.
const linkedUrl = normalizeUrl(new URLSearchParams(location.search).get('url'));
if (linkedUrl) state.url = linkedUrl;

const persist = () => saveState(state);

// ── Elements ─────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $('#address-form'),
  input: $('#address-input'),
  recent: $('#recent-urls'),
  reload: $('#reload-btn'),
  rotate: $('#rotate-btn'),
  modeButtons: document.querySelectorAll('.segmented button'),
  zoom: $('#zoom-select'),
  devicebar: $('#devicebar'),
  stage: $('#stage'),
  rack: $('#rack'),
  empty: $('#stage-empty'),
  update: $('#update-toast'),
  updateText: $('#update-text'),
  updateRestart: $('#update-restart'),
  updateLater: $('#update-later'),
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

/** id → { root, frame, device, body, screen, view, url, name, dims, scale, rotateBtn, focusBtn, geomKey } */
const rigs = new Map();

function createRig(device) {
  const screen = h('div', { class: 'device__screen' });
  const body = h('div', { class: 'device__body' }, screen);
  const deviceEl = h('div', { class: 'device' }, body);
  const frame = h('div', { class: 'rig__frame' }, deviceEl);

  const name = h('button', {
    class: 'rig__name',
    type: 'button',
    text: device.name,
    title: `View ${device.name} on its own`,
    onclick: () => focusDevice(device.id),
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
    h('div', { class: 'rig__label' }, status, name, h('span', { class: 'rig__meta' }, dims, scale)),
    h('div', { class: 'rig__actions' }, rotateBtn, focusBtn),
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
function createView(rig, device) {
  if (!bridge) {
    const frame = h('iframe', { title: `${device.name} preview`, allow: 'fullscreen; clipboard-write' });
    frame.addEventListener('load', () => rig.root.classList.remove('is-loading'));
    return frame;
  }

  // Emulation is switched on while the view shows a blank page, so the site's
  // very first load already sees the phone's pixel density, viewport rules and touch.
  const emulation = emulationFor(device);
  const view = h('webview', {
    title: `${device.name} preview`,
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

  // Phones: the status bar sits above the page, as in Safari and Chrome.
  screen.style.setProperty('--sb', `${g.statusBar}px`);
  screen.querySelector('.statusbar')?.remove();
  if (g.statusBar) screen.prepend(statusBarElement(deviceData, g));

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
  if (state.zoom === 'fit' && state.mode === 'grid' && shown.length) {
    let factor = 1;
    for (let i = 0; i < 3; i += 1) {
      const rowWidth =
        shown.reduce((sum, d) => sum + Math.max(d.g.outerW * d.s * factor, CAPTION_MIN_WIDTH), 0) + gap * (shown.length - 1);
      if (rowWidth <= availW) break;
      factor = Math.max(MIN_ROW_SHRINK, factor * (availW / rowWidth));
    }
    for (const d of shown) d.s *= factor;
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

function renderToolbar() {
  els.input.value = state.url ? displayUrl(state.url) : '';
  els.recent.replaceChildren(...state.recent.map((url) => h('option', { value: displayUrl(url) })));
  els.modeButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.mode)));
  els.zoom.value = String(state.zoom);
  els.reload.disabled = !state.url;
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
  openUrl(els.input.value);
});
els.input.addEventListener('input', () => els.input.setCustomValidity(''));
els.reload.addEventListener('click', reloadAll);
els.rotate.addEventListener('click', rotate);
els.modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
els.zoom.addEventListener('change', () => {
  state.zoom = els.zoom.value === 'fit' ? 'fit' : Number(els.zoom.value);
  persist();
  layout();
});

// Scroll the row of devices sideways with a normal mouse wheel.
els.stage.addEventListener(
  'wheel',
  (e) => {
    if (state.mode !== 'grid' || e.ctrlKey) return;
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
  if (picker.isOpen()) return;

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
  if (picker.isOpen()) return false;
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
  return false;
}

// ── Desktop app only ─────────────────────────────────────────

if (bridge) {
  // In the app, shortcuts also work while a device has focus.
  bridge.onShortcut(({ code, shift }) => runShortcut(code, shift));

  // The brand link would reload the app's file; it stays put instead.
  document.querySelector('.brand')?.addEventListener('click', (e) => e.preventDefault());

  // A downloaded update: offer a restart (it also installs when Bezel is closed).
  bridge.onUpdate(({ state: updateState, version }) => {
    if (updateState !== 'ready') return;
    els.updateText.textContent = `Bezel ${version} is ready.`;
    els.update.hidden = false;
  });
  els.updateRestart.addEventListener('click', () => bridge.installUpdate());
  els.updateLater.addEventListener('click', () => (els.update.hidden = true));
}

let frameRequest = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(frameRequest);
  frameRequest = requestAnimationFrame(layout);
}).observe(els.stage);

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

render();
if (!state.url) els.input.focus();
