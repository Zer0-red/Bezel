/*
 * Bezel sync helper for the web version.
 * Add it to your site while developing:
 *   <script src="https://zer0-red.github.io/Bezel/sync.js" defer></script>
 * It does nothing unless the page is shown inside Bezel (or another page's frame):
 * it tells the parent page what is at the top of the screen as you scroll, which page
 * is open and what you clicked, and scrolls or clicks when asked to. Only what you do
 * yourself is shared.
 * Once Bezel answers, a trackpad pinch or Ctrl + wheel on the page zooms Bezel's devices
 * instead of the page, and clicks are replayed in the other devices.
 */
(() => {
  if (window.top === window || window.__bezelSync) return;
  window.__bezelSync = true;

  let userAt = 0;
  let applied = null; // where Bezel just moved this page: { top, until }
  let frame = 0;
  let inBezel = false; // set when Bezel answers our hello
  const mark = () => {
    userAt = Date.now();
  };
  for (const type of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown']) {
    addEventListener(type, mark, { passive: true, capture: true });
  }
  const range = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

  addEventListener(
    'scroll',
    () => {
      // Bezel just moved this page here (its scroll event can come late on a busy machine): not passed on.
      if (applied && Date.now() < applied.until && Math.abs(scrollY - applied.top) < 2) return;
      if (Date.now() - userAt > 1500) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The content at the top of the screen, so the other devices show the same part of the
        // page (a percentage alone drifts wherever columns stack on small screens).
        const ratio = Math.round((scrollY / range()) * 1e5) / 1e5;
        parent.postMessage({ bezel: 'scroll', ratio, anchors: scrollY > 0 ? anchorsAt() : [] }, '*');
      });
    },
    { passive: true },
  );

  addEventListener(
    'wheel',
    (event) => {
      if (!inBezel || !event.ctrlKey) return;
      event.preventDefault();
      const px = event.deltaY * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 800 : 1);
      parent.postMessage({ bezel: 'zoom', deltaY: px, x: event.clientX, y: event.clientY }, '*');
    },
    { passive: false, capture: true },
  );

  // The page that is open, also when a single-page app changes it without loading.
  let lastUrl = location.href;
  const reportPage = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    parent.postMessage({ bezel: 'page', url: location.href }, '*');
  };
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      reportPage();
      return result;
    };
  }
  addEventListener('popstate', reportPage);
  addEventListener('hashchange', reportPage);

  // Clicks on menus, tabs and buttons are replayed in the other devices on the same element
  // (found by its place in the page, checked by its tag and text), even when it is out of view.
  // Links to another page and form buttons are not: the other devices open the page instead,
  // and a form is sent only once.
  const pageOf = (href) => String(href).split('#')[0];
  const textOf = (el) =>
    (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (n.id && document.querySelectorAll(`#${CSS.escape(n.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(n.id)}`);
        break;
      }
      let i = 1;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i += 1;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${i})`);
    }
    return parts.join('>');
  };
  const find = (path) => {
    try {
      return document.querySelector(path);
    } catch {
      return null;
    }
  };
  const pinned = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const position = getComputedStyle(n).position;
      if (position === 'fixed' || position === 'sticky') return true;
    }
    return false;
  };
  // The element at the top of the screen (under any fixed header) and its block ancestors,
  // each with how far through it the top edge is.
  const anchorsAt = () => {
    const out = [];
    const top = document
      .elementsFromPoint(innerWidth / 2, 1)
      .find((n) => n instanceof HTMLElement && n !== document.body && n !== document.documentElement && !pinned(n));
    for (let n = top; n && n !== document.body && n !== document.documentElement && out.length < 8; n = n.parentElement) {
      if (getComputedStyle(n).display.startsWith('inline')) continue; // lines wrap differently per device
      const r = n.getBoundingClientRect();
      if (r.height < 1) continue;
      out.push({ path: pathOf(n), tag: n.tagName, text: textOf(n).slice(0, 40), f: Math.round((-r.top / r.height) * 1e4) / 1e4 });
    }
    return out;
  };
  const scrollToContent = (d) => {
    let top = Math.min(1, Math.max(0, Number(d.ratio) || 0)) * range();
    for (const a of Array.isArray(d.anchors) ? d.anchors : []) {
      const el = find(a.path);
      if (!el || el.tagName !== a.tag || (a.text && textOf(el).slice(0, 40) !== a.text) || pinned(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1) continue; // hidden on this device
      top = scrollY + r.top + Number(a.f) * r.height;
      break;
    }
    applied = { top: Math.round(Math.min(range(), Math.max(0, top))), until: Date.now() + 1000 };
    scrollTo({ top, behavior: 'instant' });
  };

  const CLICKABLE =
    'button, summary, label, a, [onclick], [aria-expanded], [aria-controls], [aria-haspopup], ' +
    '[role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=radio], [role=option], [role=link]';
  const targetOf = (node) => {
    let el = node;
    while (el && !(el instanceof HTMLElement)) el = el.parentElement; // an icon's SVG → its HTML parent
    return el ? el.closest(CLICKABLE) || el : null;
  };
  const leavesPage = (a) =>
    !!a && ((a.target && a.target !== '_self') || a.hasAttribute('download') || pageOf(a.href) !== pageOf(location.href));
  const sendsForm = (b) =>
    !!b && !!b.form && b.matches('button:not([type]), button[type=submit], input[type=submit], input[type=image]');

  addEventListener(
    'click',
    (event) => {
      if (!inBezel || !event.isTrusted) return; // not in Bezel, or a click Bezel replayed here
      const el = targetOf(event.target);
      if (!el || el.closest('input, textarea, select, [contenteditable]:not([contenteditable=false])')) return;
      if (leavesPage(el.closest('a[href]')) || sendsForm(el.closest('button'))) return;
      parent.postMessage({ bezel: 'click', page: pageOf(location.href), path: pathOf(el), tag: el.tagName, text: textOf(el) }, '*');
    },
    true,
  );

  const replayClick = (d) => {
    if (d.page !== pageOf(location.href)) return; // this device shows another page
    const same = (n) => n instanceof HTMLElement && n.tagName === d.tag && textOf(n) === d.text;
    let el = find(d.path);
    if (!same(el)) {
      const found = [...document.getElementsByTagName(String(d.tag))].filter(same);
      el = found.length === 1 ? found[0] : null; // the layout differs here: only an unmistakable match
    }
    el?.click();
  };

  addEventListener('message', (event) => {
    if (event.source !== parent || !event.data) return;
    if (event.data.bezel === 'ready') {
      inBezel = true;
      return;
    }
    if (event.data.bezel === 'clickAt') {
      if (inBezel) replayClick(event.data);
      return;
    }
    if (event.data.bezel === 'scrollTo') scrollToContent(event.data);
  });

  parent.postMessage({ bezel: 'hello', url: location.href }, '*');
})();
