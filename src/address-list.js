// The address bar's list: favorite sites first, then recent ones.
// It opens when the address field is focused, filters as you type and works
// with the arrow keys, Enter, Delete (removes a favorite) and Escape.
// The star in the field adds or removes the site that is open.
// Favorites are kept with the other settings (storage.js), so they are there
// when Bezel opens again.

const MAX_FAVORITES = 50;

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

/** ctx: { state, h, persist, displayUrl, openUrl, pageTitle } */
export function createAddressList(ctx) {
  const { state, h } = ctx;
  const input = document.querySelector('#address-input');
  const list = document.querySelector('#address-list');
  const star = document.querySelector('#favorite-btn');
  let options = []; // [{ el, url, favorite }]
  let active = -1;
  let filtering = false; // the user has typed since the list opened

  const isFavorite = (url) => state.favorites.some((f) => f.url === url);
  const isOpen = () => !list.hidden;

  const svg = (markup, cls) => {
    const span = h('span', { class: cls, 'aria-hidden': 'true' });
    span.innerHTML = markup;
    return span;
  };

  // ── Favorites ──────────────────────────────────────────────

  function toggleFavorite(url) {
    if (!url) return;
    if (isFavorite(url)) {
      state.favorites = state.favorites.filter((f) => f.url !== url);
    } else if (state.favorites.length < MAX_FAVORITES) {
      const title = ctx.pageTitle(url);
      state.favorites = [...state.favorites, title ? { url, title } : { url }];
    }
    ctx.persist();
    renderStar();
    if (isOpen()) open(); // re-render; closes if nothing is left
  }

  function renderStar() {
    const url = state.url;
    const on = Boolean(url) && isFavorite(url);
    star.disabled = !url;
    star.setAttribute('aria-pressed', String(on));
    const label = !url
      ? 'Open a site to add it to your favorites'
      : on
        ? `Remove ${ctx.displayUrl(url)} from favorites`
        : `Add ${ctx.displayUrl(url)} to favorites`;
    star.setAttribute('aria-label', label);
    star.title = label;
  }

  // ── The list ───────────────────────────────────────────────

  function entries() {
    const query = filtering ? input.value.trim().toLowerCase() : '';
    const matches = (url, title = '') =>
      !query || url.toLowerCase().includes(query) || ctx.displayUrl(url).toLowerCase().includes(query) || title.toLowerCase().includes(query);
    return {
      query,
      favorites: state.favorites.filter((f) => matches(f.url, f.title)),
      recent: state.recent.filter((url) => !isFavorite(url) && matches(url)),
    };
  }

  function optionFor(url, { favorite, title }) {
    const index = options.length;
    const action = h('button', {
      class: 'address__action',
      type: 'button',
      tabindex: '-1',
      'aria-label': favorite ? `Remove ${ctx.displayUrl(url)} from favorites` : `Add ${ctx.displayUrl(url)} to favorites`,
      title: favorite ? 'Remove from favorites' : 'Add to favorites',
    });
    action.innerHTML = favorite ? CLOSE : STAR;
    action.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(url);
    });

    const el = h(
      'div',
      { class: `address__option${favorite ? ' is-favorite' : ''}`, role: 'option', id: `address-option-${index}`, 'aria-selected': 'false' },
      svg(favorite ? STAR : CLOCK, 'address__kind'),
      h('span', { class: 'address__url', text: ctx.displayUrl(url) }),
      h('span', { class: 'address__title', text: title ?? '' }),
      action,
    );
    el.addEventListener('click', () => choose(url));
    el.addEventListener('pointermove', () => setActive(index, { scroll: false }));
    options.push({ el, url, favorite });
    return el;
  }

  function group(label, children) {
    const id = `address-group-${label.toLowerCase()}`;
    return h('div', { class: 'address__group', role: 'group', 'aria-labelledby': id }, h('p', { class: 'address__group-label', id, text: label }), ...children);
  }

  /** Builds the list; returns whether it has anything to show. */
  function render() {
    const { query, favorites, recent } = entries();
    options = [];
    const groups = [];
    if (favorites.length) {
      groups.push(group('Favorites', favorites.map((f) => optionFor(f.url, { favorite: true, title: f.title }))));
    } else if (!query && recent.length) {
      groups.push(group('Favorites', [h('p', { class: 'address__hint', text: 'Click the star in the address bar to keep a site here.' })]));
    }
    if (recent.length) groups.push(group('Recent', recent.map((url) => optionFor(url, { favorite: false }))));
    list.replaceChildren(...groups);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    return options.length > 0;
  }

  function setActive(index, { scroll = true } = {}) {
    if (!options.length) return;
    active = (index + options.length) % options.length;
    options.forEach((o, i) => {
      o.el.classList.toggle('is-active', i === active);
      o.el.setAttribute('aria-selected', String(i === active));
    });
    input.setAttribute('aria-activedescendant', options[active].el.id);
    if (scroll) options[active].el.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    const any = render();
    list.hidden = !any;
    input.setAttribute('aria-expanded', String(any));
  }

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function choose(url) {
    close();
    ctx.openUrl(url);
    input.blur(); // back to the devices, so the shortcuts work again
  }

  // ── Events ─────────────────────────────────────────────────

  input.addEventListener('focus', () => {
    filtering = false;
    open();
  });
  input.addEventListener('click', () => {
    if (!isOpen()) open();
  });
  input.addEventListener('input', () => {
    filtering = true;
    open();
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) open();
      if (isOpen()) setActive(active === -1 && e.key === 'ArrowUp' ? -1 : active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && isOpen() && active >= 0) {
      e.preventDefault();
      choose(options[active].url);
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
    } else if (e.key === 'Delete' && isOpen() && active >= 0 && options[active].favorite) {
      e.preventDefault();
      const keep = active;
      toggleFavorite(options[active].url);
      if (options.length) setActive(Math.min(keep, options.length - 1));
    } else if (e.key === 'Tab') {
      close();
    }
  });
  // Clicking in the list keeps the focus in the field, so it doesn't close first.
  list.addEventListener('mousedown', (e) => e.preventDefault());
  star.addEventListener('click', () => toggleFavorite(state.url));

  return { renderStar, close };
}
