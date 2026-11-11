// Choosing devices: the device bar (setup menu + chips of the devices in view)
// and the device library (search, brands, popular sizes, custom sizes).

import { CATEGORIES, DEVICES, POPULAR, POPULAR_DEVICES, POPULAR_SOURCE, SETUPS } from './devices.js';

const TABS = [
  { id: 'popular', label: 'Popular sizes' },
  { id: 'Mobile', label: 'Phones', categories: ['Mobile'] },
  { id: 'Tablet', label: 'Tablets', categories: ['Tablet'] },
  { id: 'Laptop', label: 'Laptops', categories: ['Laptop'] },
  { id: 'Monitors', label: 'Monitors', categories: ['Desktop', 'Large screen'] },
  { id: 'custom', label: 'Custom sizes' },
];

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * ctx: { state, h, ICONS, iconButton, allDevices, deviceById, persist, render,
 *        toggleSelected, focusDevice, setMode, scrollToDevice }
 */
export function createPicker(ctx) {
  const { state, h, ICONS, iconButton } = ctx;
  const $ = (sel) => document.querySelector(sel);
  const els = {
    bar: $('#devicebar'),
    menu: $('#setups-menu'),
    library: $('#library'),
    search: $('#library-search'),
    tabs: $('#library-tabs'),
    panel: $('#library-panel'),
    scroller: $('.library__panel'), // the panel's scrolling container
    count: $('#library-count'),
    customForm: $('#custom-form'),
  };
  let tab = 'popular';

  const icon = (name) => {
    const span = h('span', { class: 'icon', 'aria-hidden': 'true' });
    span.innerHTML = ICONS[name];
    return span;
  };

  // ── Setups ─────────────────────────────────────────────────

  const allSetups = () => [...SETUPS, ...state.setups];
  const activeSetup = () => allSetups().find((s) => sameSet(s.devices.filter(ctx.deviceById), state.selected));

  function applySetup(setup) {
    state.selected = setup.devices.filter((id) => ctx.deviceById(id));
    state.mode = 'grid';
    ctx.persist();
    els.menu.hidePopover();
    ctx.render();
  }

  function saveSetup(name) {
    const clean = name.trim().slice(0, 40);
    if (!clean || !state.selected.length) return;
    state.setups.push({ id: `setup-${Date.now().toString(36)}`, name: clean, devices: [...state.selected] });
    ctx.persist();
    renderMenu();
    renderBar();
  }

  function deleteSetup(id) {
    state.setups = state.setups.filter((s) => s.id !== id);
    ctx.persist();
    renderMenu();
    renderBar();
  }

  function summary(setup) {
    return setup.devices
      .map((id) => ctx.deviceById(id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  function renderMenu() {
    const active = activeSetup();
    const row = (setup, own) => {
      const pick = h(
        'button',
        { class: 'menu__item', type: 'button', 'aria-pressed': String(active?.id === setup.id), onclick: () => applySetup(setup) },
        h('span', { class: 'menu__name', text: setup.name }),
        h('span', { class: 'menu__summary', text: summary(setup) }),
      );
      if (!own) return pick;
      return h('div', { class: 'menu__row' }, pick, iconButton('close', `Delete ${setup.name}`, () => deleteSetup(setup.id)));
    };

    const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Name this setup', 'aria-label': 'Setup name' });
    const save = h(
      'form',
      {
        class: 'menu__save',
        onsubmit: (e) => {
          e.preventDefault();
          saveSetup(input.value);
          input.value = '';
        },
      },
      input,
      h('button', { class: 'btn btn--quiet', type: 'submit', disabled: !state.selected.length, text: 'Save current' }),
    );

    els.menu.replaceChildren(
      h('p', { class: 'menu__title', text: 'Setups' }),
      ...SETUPS.map((s) => row(s, false)),
      ...(state.setups.length ? [h('p', { class: 'menu__title', text: 'Your setups' }), ...state.setups.map((s) => row(s, true))] : []),
      save,
    );
  }

  // Place the menu under its button (the popover itself handles open/close and Escape).
  els.menu.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;
    renderMenu();
    const anchor = els.bar.querySelector('.setup-btn')?.getBoundingClientRect();
    if (anchor) {
      els.menu.style.left = `${Math.max(8, anchor.left)}px`;
      els.menu.style.top = `${anchor.bottom + 6}px`;
    }
  });

  // ── Device bar ─────────────────────────────────────────────

  function renderBar() {
    const isGrid = state.mode === 'grid';
    const active = activeSetup();

    const setupBtn = h(
      'button',
      { class: 'setup-btn', type: 'button', popovertarget: 'setups-menu', title: 'Choose a setup' },
      icon('stack'),
      h('span', { text: active ? active.name : 'Your selection' }),
      icon('chevron'),
    );

    const chipFor = (device, extra = false) => {
      const pressed = !isGrid && state.focusId === device.id;
      const chip = h(
        'span',
        { class: `chip${extra ? ' chip--extra' : ''}` },
        h('button', {
          class: 'chip__btn',
          type: 'button',
          'aria-pressed': String(pressed),
          title: `${device.width} × ${device.height}${isGrid ? '' : ''}`,
          text: device.name,
          onclick: () => (isGrid ? ctx.scrollToDevice(device.id) : ctx.focusDevice(device.id)),
        }),
      );
      chip.append(
        extra
          ? iconButton('plus', `Keep ${device.name} in your devices`, () => ctx.toggleSelected(device.id), 'chip__side')
          : iconButton('close', `Remove ${device.name}`, () => ctx.toggleSelected(device.id), 'chip__side'),
      );
      return chip;
    };

    const shown = ctx.allDevices().filter((d) => state.selected.includes(d.id));
    const chips = shown.map((d) => chipFor(d));
    if (!isGrid && !state.selected.includes(state.focusId) && ctx.deviceById(state.focusId)) {
      chips.push(chipFor(ctx.deviceById(state.focusId), true));
    }

    const addBtn = h('button', { class: 'chip__btn chip__btn--add', type: 'button', onclick: () => openLibrary() });
    addBtn.append(icon('plus'), h('span', { text: 'Add device' }));

    els.bar.replaceChildren(
      setupBtn,
      h('div', { class: 'devicebar__chips' }, ...(chips.length ? chips : [h('span', { class: 'devicebar__hint', text: 'No devices in view' })])),
      addBtn,
    );
  }

  // ── Library ────────────────────────────────────────────────

  const isShown = (id) => state.selected.includes(id) || (state.mode === 'focus' && state.focusId === id);

  function toggle(id) {
    const adding = !state.selected.includes(id);
    ctx.toggleSelected(id);
    if (adding && state.mode === 'focus') ctx.focusDevice(id);
    renderPanel();
  }

  function deviceRow(device, { removable = false } = {}) {
    const pressed = isShown(device.id);
    const row = h(
      'button',
      { class: 'lib-row', type: 'button', 'aria-pressed': String(pressed), onclick: () => toggle(device.id) },
      h('span', { class: 'lib-check', 'aria-hidden': 'true' }),
      h('span', { class: 'lib-name', text: device.name }),
      h('span', { class: 'lib-meta', text: `${device.width} × ${device.height}` }),
      h('span', { class: 'lib-year', text: device.year ? String(device.year) : '' }),
    );
    if (!removable) return row;
    return h('div', { class: 'lib-item' }, row, iconButton('close', `Delete ${device.name}`, () => removeCustom(device.id)));
  }

  function popularSection(list) {
    const max = Math.max(...list.sizes.map((s) => s.share));
    const rows = list.sizes.map((size, i) => {
      const id = `size-${size.width}x${size.height}`;
      return h(
        'button',
        { class: 'lib-row lib-row--popular', type: 'button', 'aria-pressed': String(isShown(id)), onclick: () => toggle(id) },
        h('span', { class: 'lib-check', 'aria-hidden': 'true' }),
        h('span', { class: 'lib-rank', text: String(i + 1) }),
        h('span', { class: 'lib-name' }, h('span', { text: `${size.width} × ${size.height}` }), h('span', { class: 'lib-hint', text: size.hint ?? '' })),
        h('span', { class: 'lib-share' }, h('span', { class: 'lib-bar', style: `--share:${(size.share / max) * 100}%` }), h('span', { text: `${size.share}%` })),
      );
    });
    return h(
      'section',
      { class: 'lib-section' },
      h('h3', {}, h('span', { text: list.title }), ' ', h('a', { href: list.url, target: '_blank', rel: 'noopener', class: 'lib-period', text: list.period })),
      ...rows,
    );
  }

  function groupedByBrand(devices) {
    const brands = [...new Set(devices.map((d) => d.brand ?? 'Other'))];
    return brands.map((brand) =>
      h(
        'section',
        { class: 'lib-section' },
        h('h3', { text: brand }),
        ...devices.filter((d) => (d.brand ?? 'Other') === brand).map((d) => deviceRow(d)),
      ),
    );
  }

  function matches(device, query) {
    const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
    const hay = `${device.name} ${device.brand ?? ''} ${device.category} ${device.width}x${device.height} ${device.width}×${device.height} ${device.width} × ${device.height}`.toLowerCase();
    return q.split(' ').every((word) => hay.includes(word.replace('*', 'x')));
  }

  function renderPanel() {
    const scroll = els.scroller.scrollTop;
    const query = els.search.value.trim();
    els.customForm.hidden = !(tab === 'custom' && !query);

    for (const btn of els.tabs.querySelectorAll('button')) {
      btn.setAttribute('aria-selected', String(!query && btn.dataset.tab === tab));
    }

    let content;
    if (query) {
      const found = [...DEVICES, ...POPULAR_DEVICES, ...state.custom].filter((d) => matches(d, query));
      content = found.length
        ? groupedByBrand(found)
        : [h('p', { class: 'lib-empty', text: `Nothing matches “${query}”. Try a name like Pixel or a width like 390.` })];
    } else if (tab === 'popular') {
      content = [
        h('p', { class: 'lib-intro', text: 'The screen sizes people browse with most, worldwide. Add any of them to your view.' }),
        ...POPULAR.map(popularSection),
        h('p', { class: 'lib-source' }, 'Source: ', h('a', { href: POPULAR_SOURCE.url, target: '_blank', rel: 'noopener', text: POPULAR_SOURCE.name }), '. Sizes in CSS pixels.'),
      ];
    } else if (tab === 'custom') {
      content = state.custom.length
        ? [h('section', { class: 'lib-section' }, h('h3', { text: 'Your sizes' }), ...state.custom.map((d) => deviceRow(d, { removable: true })))]
        : [h('p', { class: 'lib-intro', text: 'Add any width and height, for example your own phone or a client’s screen.' })];
    } else {
      const categories = TABS.find((t) => t.id === tab).categories;
      content = groupedByBrand(DEVICES.filter((d) => categories.includes(d.category)));
    }

    els.panel.replaceChildren(...content);
    els.scroller.scrollTop = scroll;
    const n = state.selected.length;
    els.count.textContent = n === 1 ? '1 device in view' : `${n} devices in view`;
  }

  function openLibrary(startTab) {
    if (startTab) tab = startTab;
    els.search.value = '';
    renderPanel();
    els.library.showModal();
    els.search.focus();
  }

  // Tabs
  els.tabs.replaceChildren(
    ...TABS.map((t) =>
      h('button', {
        type: 'button',
        role: 'tab',
        'data-tab': t.id,
        text: t.label,
        onclick: () => {
          tab = t.id;
          els.search.value = '';
          els.scroller.scrollTop = 0;
          renderPanel();
        },
      }),
    ),
  );
  els.search.addEventListener('input', () => {
    els.scroller.scrollTop = 0;
    renderPanel();
  });
  $('#library-close').addEventListener('click', () => els.library.close());
  $('#library-done').addEventListener('click', () => els.library.close());
  els.library.addEventListener('click', (e) => {
    if (e.target === els.library) els.library.close(); // click on the backdrop
  });

  // ── Custom sizes ───────────────────────────────────────────

  els.customForm.querySelector('select[name="category"]').append(...CATEGORIES.map((c) => h('option', { value: c, text: c })));
  els.customForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(els.customForm);
    const width = Math.round(Number(data.get('width')));
    const height = Math.round(Number(data.get('height')));
    const name = String(data.get('name')).trim().slice(0, 40);
    const category = CATEGORIES.includes(data.get('category')) ? data.get('category') : 'Mobile';
    if (!name || !(width >= 200 && width <= 7680) || !(height >= 200 && height <= 7680)) return;

    const id = `custom-${Date.now().toString(36)}`;
    state.custom.push({ id, name, brand: 'Your sizes', category, width, height, custom: true });
    state.selected.push(id);
    ctx.persist();
    els.customForm.reset();
    ctx.render();
    renderPanel();
  });

  function removeCustom(id) {
    state.custom = state.custom.filter((d) => d.id !== id);
    state.selected = state.selected.filter((x) => x !== id);
    delete state.rotated[id];
    if (state.focusId === id) state.focusId = state.selected[0] ?? DEVICES[0].id;
    ctx.persist();
    ctx.render();
    renderPanel();
  }

  return {
    renderBar,
    openLibrary,
    isOpen: () => els.library.open,
  };
}
