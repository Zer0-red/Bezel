// Synced scrolling and clicks: scroll one device and the others follow to the same
// relative position (0 = top, 1 = bottom of the page); click something and it is
// clicked in the others too.
//
// Each device page runs a tiny script (PAGE_SCRIPT below):
//   • in the desktop app Bezel injects it into every device view and hears back
//     through console messages (device views have no Node or preload);
//   • on the web, browsers keep other sites' frames off-limits, so the page has to
//     include public/sync.js itself (one line in the dev site, see the README);
//     it talks to Bezel with postMessage. Keep the two scripts alike.
// Only scrolling and clicks the user does are shared, so a device that is being
// moved by Bezel never echoes it back.
//
// Clicks: a click on a menu, tab, accordion or button is replayed in the other
// devices on the same element, found by its place in the page and checked by its
// tag and text, even where that element is scrolled out of view or hidden. Links to
// another page and form buttons are not replayed: the other devices load the page
// the link opened instead (see followPage in main.js), and a form is sent only once.
//
// The same script passes a trackpad pinch or Ctrl + wheel inside a device up to Bezel,
// which zooms the devices (the page itself doesn't zoom).

export const CONSOLE_PREFIX = '__bezel:scroll:';
export const ZOOM_PREFIX = '__bezel:zoom:';
export const CLICK_PREFIX = '__bezel:click:';

/** Injected into device views by the desktop app. */
export const PAGE_SCRIPT = `(() => {
  if (window.__bezelSync) return;
  window.__bezelSync = true;
  let userAt = 0, applying = false, frame = 0;
  const mark = () => { userAt = Date.now(); };
  for (const type of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown']) {
    addEventListener(type, mark, { passive: true, capture: true });
  }
  const range = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  addEventListener('scroll', () => {
    if (applying || Date.now() - userAt > 1500) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => console.debug('${CONSOLE_PREFIX}' + (scrollY / range()).toFixed(5)));
  }, { passive: true });
  addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1);
    console.debug('${ZOOM_PREFIX}' + [px, e.clientX, e.clientY].map((n) => n.toFixed(2)).join(':'));
  }, { passive: false, capture: true });
  window.__bezelScrollTo = (ratio) => {
    applying = true;
    scrollTo({ top: Math.min(1, Math.max(0, ratio)) * range(), behavior: 'instant' });
    setTimeout(() => { applying = false; }, 100);
  };

  const pageOf = (href) => String(href).split('#')[0];
  const textOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (n.id && document.querySelectorAll('#' + CSS.escape(n.id)).length === 1) {
        parts.unshift('#' + CSS.escape(n.id));
        break;
      }
      let i = 1;
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i += 1;
      parts.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
    }
    return parts.join('>');
  };
  const CLICKABLE = 'button, summary, label, a, [onclick], [aria-expanded], [aria-controls], [aria-haspopup], ' +
    '[role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=radio], [role=option], [role=link]';
  const targetOf = (node) => {
    let el = node;
    while (el && !(el instanceof HTMLElement)) el = el.parentElement; // an icon's SVG → its HTML parent
    return el ? el.closest(CLICKABLE) || el : null;
  };
  const leavesPage = (a) => !!a && ((a.target && a.target !== '_self') || a.hasAttribute('download') || pageOf(a.href) !== pageOf(location.href));
  const sendsForm = (b) => !!b && !!b.form && b.matches('button:not([type]), button[type=submit], input[type=submit], input[type=image]');
  addEventListener('click', (e) => {
    if (!e.isTrusted) return; // a click Bezel replayed here
    const el = targetOf(e.target);
    if (!el || el.closest('input, textarea, select, [contenteditable]:not([contenteditable=false])')) return;
    if (leavesPage(el.closest('a[href]')) || sendsForm(el.closest('button'))) return;
    console.debug('${CLICK_PREFIX}' + JSON.stringify({ page: pageOf(location.href), path: pathOf(el), tag: el.tagName, text: textOf(el) }));
  }, true);
  window.__bezelClick = (d) => {
    if (!d || d.page !== pageOf(location.href)) return false; // this device shows another page
    const same = (n) => n instanceof HTMLElement && n.tagName === d.tag && textOf(n) === d.text;
    let el = null;
    try { el = document.querySelector(d.path); } catch (err) { el = null; }
    if (!same(el)) {
      const found = [...document.getElementsByTagName(d.tag)].filter(same);
      el = found.length === 1 ? found[0] : null; // the layout differs here: only an unmistakable match
    }
    if (!el) return false;
    el.click();
    return true;
  };
})();`;

/** Parses a console message from a device view; returns the scroll ratio or null. */
export function ratioFromConsole(message) {
  if (typeof message !== 'string' || !message.startsWith(CONSOLE_PREFIX)) return null;
  const ratio = Number(message.slice(CONSOLE_PREFIX.length));
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : null;
}

/** Parses a postMessage from a device frame (web version); returns the ratio or null. */
export function ratioFromMessage(data) {
  if (!data || data.bezel !== 'scroll') return null;
  const ratio = Number(data.ratio);
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : null;
}

const zoom = (deltaY, x, y) => {
  const values = [deltaY, x, y].map(Number);
  return values.every(Number.isFinite) ? { deltaY: values[0], x: values[1], y: values[2] } : null;
};

/** Parses a console message from a device view; returns a zoom step ({ deltaY, x, y }) or null. */
export function zoomFromConsole(message) {
  if (typeof message !== 'string' || !message.startsWith(ZOOM_PREFIX)) return null;
  const [deltaY, x, y] = message.slice(ZOOM_PREFIX.length).split(':');
  return zoom(deltaY, x, y);
}

/** Parses a postMessage from a device frame (web version); returns a zoom step or null. */
export function zoomFromMessage(data) {
  if (!data || data.bezel !== 'zoom') return null;
  return zoom(data.deltaY, data.x, data.y);
}

// A click comes from a web page, so only well-formed, bounded values are passed on.
const click = (d) => {
  if (!d || typeof d !== 'object') return null;
  const { page, path, tag, text } = d;
  if (typeof page !== 'string' || !/^https?:\/\//i.test(page) || page.length > 4000) return null;
  if (typeof path !== 'string' || !path || path.length > 2000) return null;
  if (typeof tag !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,40}$/.test(tag)) return null;
  if (typeof text !== 'string' || text.length > 200) return null;
  return { page, path, tag, text };
};

/** Parses a console message from a device view; returns a click ({ page, path, tag, text }) or null. */
export function clickFromConsole(message) {
  if (typeof message !== 'string' || !message.startsWith(CLICK_PREFIX)) return null;
  try {
    return click(JSON.parse(message.slice(CLICK_PREFIX.length)));
  } catch {
    return null;
  }
}

/** Parses a postMessage from a device frame (web version); returns a click or null. */
export function clickFromMessage(data) {
  if (!data || data.bezel !== 'click') return null;
  return click(data);
}

/** Parses the page address a device frame reports (web version); returns it or null. */
export function pageFromMessage(data) {
  if (!data || (data.bezel !== 'hello' && data.bezel !== 'page') || typeof data.url !== 'string') return null;
  return /^https?:\/\//i.test(data.url) && data.url.length <= 4000 ? data.url : null;
}
