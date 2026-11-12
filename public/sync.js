/*
 * Bezel synced scrolling helper for the web version.
 * Add it to your site while developing:
 *   <script src="https://zer0-red.github.io/Bezel/sync.js" defer></script>
 * It does nothing unless the page is shown inside Bezel (or another page's frame):
 * it tells the parent page how far you've scrolled, and scrolls when asked to.
 * Only scrolling you do yourself is shared.
 */
(() => {
  if (window.top === window || window.__bezelSync) return;
  window.__bezelSync = true;

  let userAt = 0;
  let applying = false;
  let frame = 0;
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

  addEventListener('message', (event) => {
    if (event.source !== parent || !event.data || event.data.bezel !== 'scrollTo') return;
    const ratio = Math.min(1, Math.max(0, Number(event.data.ratio) || 0));
    applying = true;
    scrollTo({ top: ratio * range(), behavior: 'instant' });
    setTimeout(() => {
      applying = false;
    }, 100);
  });

  parent.postMessage({ bezel: 'hello' }, '*');
})();
