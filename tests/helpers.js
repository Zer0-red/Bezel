// Shared by the web and app tests.

/** The built web version (vite preview). The fixture pages load its sync.js from here. */
export const BEZEL = 'http://127.0.0.1:4173';
/** The fixture site the devices open: another origin, as a real dev server would be. */
export const SITE = 'http://127.0.0.1:4174';

/** Default devices, in desk order. */
export const PHONE = 0;
export const TABLET = 1;
export const LAPTOP = 2;

/**
 * Page code: which section is at the top of the screen, whether the page is scrolled to its end,
 * and whether the section with this id is in view.
 */
export const whereIs = (id) => `(() => {
  let top = 'hero';
  for (const s of document.querySelectorAll('main > section')) if (s.id && s.getBoundingClientRect().top <= 2) top = s.id;
  const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();
  return {
    top,
    atEnd: scrollY >= document.documentElement.scrollHeight - innerHeight - 2,
    inView: r.bottom > 0 && r.top < innerHeight,
    y: Math.round(scrollY),
  };
})()`;

/** Page code: scroll as the user would (the sync scripts only pass on scrolling that follows user input). */
export const userScrollTo = (selector) =>
  `(() => { dispatchEvent(new WheelEvent('wheel')); document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start' }); return true; })()`;

/** A device that follows shows the same section at the top, or, if its page is shorter, is at its end with that section in view. */
export const shows = (where, id) => where.top === id || (where.atEnd && where.inView);
