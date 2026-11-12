// The device menu: click a device's name under it, point at a category
// (Phones, Tablets…), then a series (iPhone, Pixel, MacBook…), and pick a device
// to put in its place.

const SECTIONS = [
  { label: 'Phones', categories: ['Mobile'] },
  { label: 'Tablets', categories: ['Tablet'] },
  { label: 'Laptops', categories: ['Laptop'] },
  { label: 'Desktops', categories: ['Desktop', 'Large screen'] },
];

// The name people use for each brand's line of devices.
const SERIES = {
  Mobile: { Apple: 'iPhone', Google: 'Pixel', Samsung: 'Galaxy' },
  Tablet: { Apple: 'iPad' },
  Laptop: { Apple: 'MacBook', Windows: 'Windows laptops' },
  Desktop: { Apple: 'iMac' },
};

const seriesOf = (device) => (device.custom ? 'Your sizes' : (SERIES[device.category]?.[device.brand] ?? device.brand ?? 'Other'));

const HOVER_DELAY = 140; // ms before a pointed-at item opens its submenu, so the pointer can cross other items on the way
const MARGIN = 8; // keep panels this far from the window's edges
const GAP = 4; // between a panel and its submenu

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 7 5 5-5 5"/></svg>';

/** ctx: { state, h, allDevices, deviceById, replaceDevice } */
export function createSwapMenu(ctx) {
  const { state, h } = ctx;
  const root = document.querySelector('#swap-menu');
  let anchor = null;
  let currentId = null;
  let panels = []; // open panels by level: sections, series, devices
  let openers = []; // openers[level]: the item in panel `level` whose submenu is open
  let hoverTimer = 0;
  let direction = 1; // submenus open to the right (1) or, near the window's right edge, to the left (-1)

  const svg = (markup, cls) => {
    const span = h('span', { class: cls, 'aria-hidden': 'true' });
    span.innerHTML = markup;
    return span;
  };

  function sections() {
    const devices = ctx.allDevices();
    return SECTIONS.map((section) => {
      const groups = [];
      for (const device of devices.filter((d) => section.categories.includes(d.category))) {
        const label = seriesOf(device);
        let group = groups.find((g) => g.label === label);
        if (!group) groups.push((group = { label, devices: [] }));
        group.devices.push(device);
      }
      return { ...section, groups };
    }).filter((section) => section.groups.length);
  }

  // A device already in view can't be picked again (it would appear twice).
  const isTaken = (id) => id !== currentId && state.selected.includes(currentId) && state.selected.includes(id);

  // ── Panels ─────────────────────────────────────────────────

  function makePanel(level, label, children) {
    const panel = h('div', { class: 'cascade__panel', role: 'menu', 'aria-label': label, 'data-level': String(level) }, ...children);
    panel.addEventListener('pointerenter', () => clearTimeout(hoverTimer)); // the pointer made it into the submenu
    return panel;
  }

  function branchItem(level, label, { current, meta, build }) {
    const item = h(
      'button',
      { class: 'cascade__item', type: 'button', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-current': current ? 'true' : null },
      h('span', { class: 'cascade__mark', 'aria-hidden': 'true' }),
      h('span', { class: 'cascade__label', text: label }),
      meta ? h('span', { class: 'cascade__meta', text: meta }) : '',
      svg(ARROW, 'cascade__arrow'),
    );
    item.addEventListener('pointerenter', () => schedule(() => openSub(level, item, build)));
    item.addEventListener('click', () => {
      clearTimeout(hoverTimer);
      focusFirst(openSub(level, item, build));
    });
    item.openSub = () => openSub(level, item, build);
    return item;
  }

  function deviceItem(level, device) {
    const current = device.id === currentId;
    const taken = isTaken(device.id);
    const popular = device.brand === 'Popular sizes';
    const label = popular ? `${device.width} × ${device.height}` : device.name;
    const meta = taken ? 'Added' : popular ? `${device.share}%` : `${device.width} × ${device.height}`;
    const title = taken ? `${device.name} is already in your devices` : popular ? [device.hint, `${device.share}% of browsing`].filter(Boolean).join(', ') : null;
    const item = h(
      'button',
      { class: 'cascade__item', type: 'button', role: 'menuitemradio', 'aria-checked': String(current), 'aria-disabled': taken ? 'true' : null, title },
      svg(CHECK, 'cascade__mark'),
      h('span', { class: 'cascade__label', text: label }),
      h('span', { class: 'cascade__meta', text: meta }),
    );
    item.addEventListener('pointerenter', () => schedule(() => closeFrom(level + 1)));
    item.addEventListener('click', () => {
      if (taken) return;
      const from = currentId;
      close();
      if (!current) ctx.replaceDevice(from, device.id);
    });
    return item;
  }

  function sectionsPanel() {
    const currentDevice = ctx.deviceById(currentId);
    const items = sections().map((section) =>
      branchItem(0, section.label, {
        current: section.categories.includes(currentDevice?.category),
        build: () => seriesPanel(section),
      }),
    );
    return makePanel(0, 'Device type', [h('p', { class: 'cascade__title', text: `Replace ${currentDevice?.name ?? 'device'} with` }), ...items]);
  }

  function seriesPanel(section) {
    const currentDevice = ctx.deviceById(currentId);
    const items = section.groups.map((group) =>
      branchItem(1, group.label, {
        current: group.devices.some((d) => d.id === currentDevice?.id),
        meta: String(group.devices.length),
        build: () => devicesPanel(group),
      }),
    );
    return makePanel(1, section.label, items);
  }

  function devicesPanel(group) {
    const items = group.devices.map((device) => deviceItem(2, device));
    const intro = group.label === 'Popular sizes' ? [h('p', { class: 'cascade__title', text: 'Share of browsing worldwide' })] : [];
    return makePanel(2, group.label, [...intro, ...items]);
  }

  // ── Opening and closing submenus ───────────────────────────

  function schedule(fn) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(fn, HOVER_DELAY);
  }

  function closeFrom(level) {
    while (panels.length > level) panels.pop().remove();
    panels[level - 1]?.querySelectorAll('[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
  }

  function openSub(level, item, build) {
    if (item.getAttribute('aria-expanded') === 'true' && panels[level + 1]) return panels[level + 1];
    closeFrom(level + 1);
    item.setAttribute('aria-expanded', 'true');
    openers[level] = item;
    const panel = build();
    root.append(panel);
    panels[level + 1] = panel;
    placeSubmenu(panel, item, panels[level]);
    return panel;
  }

  // ── Placement ──────────────────────────────────────────────

  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

  function placeFirst(panel) {
    const a = anchor.getBoundingClientRect();
    panel.style.maxHeight = `${innerHeight - 2 * MARGIN}px`;
    const w = panel.offsetWidth;
    const hgt = panel.offsetHeight;
    // Captions sit low on the desk, so the menu usually opens upwards.
    const roomBelow = innerHeight - a.bottom - MARGIN;
    const up = hgt + 6 > roomBelow && a.top - MARGIN > roomBelow;
    const top = up ? a.top - 6 - hgt : a.bottom + 6;
    const left = clamp(a.left - 10, MARGIN, innerWidth - w - MARGIN);
    panel.style.left = `${left}px`;
    panel.style.top = `${clamp(top, MARGIN, innerHeight - hgt - MARGIN)}px`;
    direction = left + w / 2 > innerWidth / 2 && left + w + 2 * 220 > innerWidth ? -1 : 1;
  }

  function placeSubmenu(panel, item, parent) {
    panel.style.maxHeight = `${innerHeight - 2 * MARGIN}px`;
    const p = parent.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const w = panel.offsetWidth;
    const hgt = panel.offsetHeight;
    const right = p.right + GAP;
    const left = p.left - GAP - w;
    if (direction > 0 && right + w > innerWidth - MARGIN) direction = -1;
    else if (direction < 0 && left < MARGIN) direction = 1;
    const x = direction > 0 ? right : left;
    const padTop = parseFloat(getComputedStyle(panel).paddingTop) || 0;
    panel.style.left = `${clamp(x, MARGIN, innerWidth - w - MARGIN)}px`;
    panel.style.top = `${clamp(r.top - padTop, MARGIN, innerHeight - hgt - MARGIN)}px`;
  }

  // ── Keyboard ───────────────────────────────────────────────

  const itemsOf = (panel) => [...panel.querySelectorAll('.cascade__item')];

  function focusFirst(panel) {
    const items = itemsOf(panel);
    (items.find((el) => el.dataset.current === 'true' || el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
  }

  root.addEventListener('keydown', (e) => {
    const item = e.target.closest?.('.cascade__item');
    const panel = e.target.closest?.('.cascade__panel');
    if (!item || !panel) return;
    const level = Number(panel.dataset.level);
    const items = itemsOf(panel);
    const index = items.indexOf(item);
    const move = (to) => items[(to + items.length) % items.length]?.focus();

    if (e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowUp') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(items.length - 1);
    else if (e.key === 'ArrowRight' && item.openSub) focusFirst(item.openSub());
    else if (e.key === 'ArrowLeft' && level > 0) {
      const opener = openers[level - 1];
      closeFrom(level);
      opener?.focus();
    } else return;
    e.preventDefault();
  });

  // ── Open / close ───────────────────────────────────────────

  function open(anchorEl, deviceId) {
    if (!ctx.deviceById(deviceId)) return;
    close();
    anchor = anchorEl;
    currentId = deviceId;
    root.showPopover();
    const first = sectionsPanel();
    root.append(first);
    panels = [first];
    placeFirst(first);
    anchor.setAttribute('aria-expanded', 'true');
    focusFirst(first);
  }

  function close() {
    if (root.matches(':popover-open')) root.hidePopover();
  }

  // beforetoggle runs synchronously (toggle is queued), so reopening for another device right away is safe.
  root.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'closed') return;
    clearTimeout(hoverTimer);
    const hadFocus = root.contains(document.activeElement);
    root.replaceChildren();
    panels = [];
    openers = [];
    if (anchor) {
      anchor.setAttribute('aria-expanded', 'false');
      if (hadFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
    }
    anchor = null;
  });

  // Clicking into a device (an iframe or the app's browser view) doesn't reach this page; the window loses focus instead.
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);

  const isOpen = () => root.matches(':popover-open');

  return {
    open,
    close,
    isOpen,
    isOpenFor: (el) => isOpen() && anchor === el,
  };
}
