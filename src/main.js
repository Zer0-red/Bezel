import '@fontsource-variable/instrument-sans';
import './styles.css';
import { CATEGORIES, DEFAULT_DEVICE_IDS, DEVICES } from './devices.js';
import { canRotate, geometry } from './frames.js';
import { loadState, saveState } from './storage.js';
import { normalizeUrl } from './url.js';

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
  lastByCategory: {},
};

const state = { ...defaults, ...loadState() };

// Built-in and custom devices, grouped in category order.
const allDevices = () =>
  [...DEVICES, ...state.custom].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
const deviceById = (id) => allDevices().find((d) => d.id === id);

// Drop anything stale from an older saved state.
state.selected = state.selected.filter((id) => deviceById(id));
if (!deviceById(state.focusId)) state.focusId = state.selected[0] ?? DEVICES[0].id;
if (!['grid', 'focus'].includes(state.mode)) state.mode = 'grid';

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
  dialog: $('#custom-dialog'),
  customForm: $('#custom-form'),
  customCancel: $('#custom-cancel'),
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
};

function iconButton(icon, label, onClick, extraClass = '') {
  const btn = h('button', { class: `icon-btn icon-btn--small ${extraClass}`, type: 'button', 'aria-label': label, title: label, onclick: onClick });
  btn.innerHTML = ICONS[icon];
  return btn;
}

// ── Device rigs (frame + caption) ────────────────────────────

/** id → { root, frame, device, body, screen, iframe, name, dims, scale, rotateBtn, focusBtn, geomKey } */
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
  const rig = { root, frame, device: deviceEl, body, screen, iframe: null, name, dims, scale, rotateBtn, focusBtn, geomKey: '' };
  setRigUrl(rig, device, state.url);
  return rig;
}

function setRigUrl(rig, device, url, { force = false } = {}) {
  if (!url) {
    rig.iframe?.remove();
    rig.iframe = null;
    rig.root.classList.remove('is-loading');
    if (!rig.screen.querySelector('.screen-empty')) {
      rig.screen.append(
        h('div', { class: 'screen-empty' }, h('p', { text: 'Type your dev server’s address above, like localhost:3000, and press Open.' })),
      );
    }
    return;
  }

  rig.screen.querySelector('.screen-empty')?.remove();
  if (!rig.iframe) {
    rig.iframe = h('iframe', { title: `${device.name} preview`, allow: 'fullscreen; clipboard-write' });
    rig.iframe.addEventListener('load', () => rig.root.classList.remove('is-loading'));
    rig.screen.append(rig.iframe);
  } else if (rig.iframe.getAttribute('src') === url && !force) {
    return;
  }
  rig.root.classList.add('is-loading');
  rig.iframe.src = url; // setting src again reloads, even with the same address
}

function renderParts(rig, g) {
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

  // Insert new rigs in device order without moving existing ones (moving an iframe reloads it).
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

function layout() {
  const cs = getComputedStyle(els.stage);
  const availW = els.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = els.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - CAPTION_SPACE;

  for (const [id, rig] of rigs) {
    if (rig.root.hidden) continue;
    const device = deviceById(id);
    const rotated = !!state.rotated[id];
    const g = geometry(device, rotated);

    const key = `${g.kind}:${g.w}x${g.h}`;
    if (key !== rig.geomKey) {
      renderParts(rig, g);
      rig.geomKey = key;
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
    s = Math.max(0.05, s);

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

function renderDeviceBar() {
  const isGrid = state.mode === 'grid';
  const groups = CATEGORIES.map((category) => {
    const devices = allDevices().filter((d) => d.category === category);
    if (!devices.length) return null;
    const chips = devices.map((device) => {
      const pressed = isGrid ? state.selected.includes(device.id) : state.focusId === device.id;
      const chip = h(
        'span',
        { class: `chip${device.custom ? ' chip--custom' : ''}` },
        h('button', {
          class: 'chip__btn',
          type: 'button',
          'aria-pressed': String(pressed),
          title: `${device.width} × ${device.height}`,
          text: device.name,
          onclick: () => (isGrid ? toggleSelected(device.id) : focusDevice(device.id)),
        }),
      );
      if (device.custom) {
        chip.append(iconButton('close', `Remove ${device.name}`, () => removeCustom(device.id), 'chip__remove'));
      }
      return chip;
    });
    return h('div', { class: 'devicebar__group', role: 'group', 'aria-label': category }, h('span', { class: 'devicebar__cat', text: category }), ...chips);
  }).filter(Boolean);

  const addBtn = h('button', { class: 'chip__btn chip__btn--add', type: 'button', onclick: openCustomDialog });
  addBtn.innerHTML = `${ICONS.plus}<span>Custom size</span>`;

  els.devicebar.replaceChildren(
    h('span', { class: 'devicebar__hint', text: isGrid ? 'Show' : 'View on' }),
    ...groups,
    h('span', { class: 'chip' }, addBtn),
  );
}

function render() {
  renderToolbar();
  renderDeviceBar();
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

function openCustomDialog() {
  els.customForm.reset();
  els.dialog.showModal();
}

function addCustom(form) {
  const data = new FormData(form);
  const width = Math.round(Number(data.get('width')));
  const height = Math.round(Number(data.get('height')));
  const name = String(data.get('name')).trim();
  const category = CATEGORIES.includes(data.get('category')) ? data.get('category') : 'Mobile';
  if (!name || !(width >= 200 && width <= 7680) || !(height >= 200 && height <= 7680)) return;

  const id = `custom-${Date.now().toString(36)}`;
  state.custom.push({ id, name, category, width, height, custom: true });
  if (state.mode === 'grid') state.selected.push(id);
  else state.focusId = id;
  persist();
  render();
}

function removeCustom(id) {
  state.custom = state.custom.filter((d) => d.id !== id);
  state.selected = state.selected.filter((x) => x !== id);
  delete state.rotated[id];
  if (state.focusId === id) state.focusId = state.selected[0] ?? DEVICES[0].id;
  persist();
  render();
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

els.customForm.querySelector('select[name="category"]').append(...CATEGORIES.map((c) => h('option', { value: c, text: c })));
els.customCancel.addEventListener('click', () => els.dialog.close('cancel'));
els.customForm.addEventListener('submit', (e) => {
  if (e.submitter?.value === 'add') addCustom(els.customForm);
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
  if (els.dialog.open) return;

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

  const digit = /^Digit([0-5])$/.exec(e.code);
  if (digit) {
    e.preventDefault();
    const n = Number(digit[1]);
    if (n === 0) setMode('grid');
    else focusCategory(CATEGORIES[n - 1]);
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    if (e.shiftKey) reloadAll();
    else rotate();
  }
});

let frameRequest = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(frameRequest);
  frameRequest = requestAnimationFrame(layout);
}).observe(els.stage);

render();
if (!state.url) els.input.focus();
