/*
 * Bezel synced scrolling helper for the web version.
 * Add it to your site while developing:
 *   <script src="https://zer0-red.github.io/Bezel/sync.js" defer></script>
 * It does nothing unless the page is shown inside Bezel (or another page's frame):
 * it tells the parent page how far you've scrolled, and scrolls when asked to.
 * Only scrolling you do yourself is shared.
 * Once Bezel answers, a trackpad pinch or Ctrl + wheel on the page zooms Bezel's devices
 * instead of the page.
 */
(() => {
  if (window.top === window || window.__bezelSync) return;
  window.__bezelSync = true;

  let userAt = 0;
  let applying = false;
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
      if (applying || Date.now() - userAt > 1500) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => parent.postMessage({ bezel: 'scroll', ratio: scrollY / range() }, '*'));
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

  addEventListener('message', (event) => {
    if (event.source !== parent || !event.data) return;
    if (event.data.bezel === 'ready') {
      inBezel = true;
      return;
    }
    if (event.data.bezel !== 'scrollTo') return;
    const ratio = Math.min(1, Math.max(0, Number(event.data.ratio) || 0));
    applying = true;
    scrollTo({ top: ratio * range(), behavior: 'instant' });
    setTimeout(() => {
      applying = false;
    }, 100);
  });

  parent.postMessage({ bezel: 'hello' }, '*');
})();
