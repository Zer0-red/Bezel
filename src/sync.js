// Synced scrolling: scroll one device and the others follow to the same
// relative position (0 = top, 1 = bottom of the page).
//
// Each device page runs a tiny script (PAGE_SCRIPT below):
//   • in the Windows app Bezel injects it into every device view and hears back
//     through console messages (device views have no Node or preload);
//   • on the web, browsers keep other sites' frames off-limits, so the page has to
//     include public/sync.js itself (one line in the dev site, see the README);
//     it talks to Bezel with postMessage.
// Only scrolling the user does with wheel, touch, keys or the scrollbar is shared,
// so a device that is being moved by Bezel never echoes it back.
//
// The same script passes a trackpad pinch or Ctrl + wheel inside a device up to Bezel,
// which zooms the devices (the page itself doesn't zoom).

export const CONSOLE_PREFIX = '__bezel:scroll:';
export const ZOOM_PREFIX = '__bezel:zoom:';

/** Injected into device views by the Windows app. */
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
