// The web version in Chrome: devices are iframes, and the fixture site includes public/sync.js.
import { test, expect } from '@playwright/test';
import { BEZEL, SITE, PHONE, TABLET, LAPTOP, whereIs, userScrollTo, shows, BETWEEN_PAGES, betweenPages } from './helpers.js';

// The devices' pages in the tab in front (other tabs' pages stay loaded behind them).
const SHOWN = '.rig iframe:not(.is-background)';
const frames = async (page) => Promise.all((await page.$$(SHOWN)).map((h) => h.contentFrame()));
/** Reads page code in every device, in desk order. A device whose page goes meanwhile reads as BETWEEN_PAGES, so polls try again. */
const inFrames = async (page, code) => Promise.all((await frames(page)).map((f) => f.evaluate(code).catch(betweenPages)));
const deviceBoxes = (page) => page.$$eval('.rig__frame', (els) => els.map((el) => JSON.stringify(el.getBoundingClientRect())));

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  await page.goto(`${BEZEL}/?url=${encodeURIComponent(SITE)}`);
  await expect(page.locator('#app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator(SHOWN)).toHaveCount(3);
  // Every device has loaded the site and its sync helper has said hello.
  await expect.poll(async () => (await inFrames(page, () => document.title)).join()).toBe('Fixture site,Fixture site,Fixture site');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sync-btn').title)).toMatch(/are synced across devices/);
  // The devices glide to their size on the desk (a transform transition). Playwright waits only for an
  // element to hold still inside its own page, so a click aimed at a device still moving lands beside it.
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.device')].some((d) => d.getAnimations().length))).toBe(false);
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

test('shows the site on a phone, a tablet and a laptop at their sizes', async ({ page }) => {
  const widths = await inFrames(page, () => innerWidth);
  expect(widths[PHONE]).toBeLessThan(500);
  expect(widths[TABLET]).toBeGreaterThan(700);
  expect(widths[TABLET]).toBeLessThan(1100);
  expect(widths[LAPTOP]).toBeGreaterThan(1200);
  await expect(page.locator('#address-input')).toHaveValue('127.0.0.1:4174');
});

test('a device whose page goes while the test reads it reads as between pages, so a poll tries again', async ({ page }) => {
  // Polls read the devices while Bezel loads the page another device went to: that must not fail them.
  const f = await frames(page);
  await f[PHONE].evaluate(() => (window.hold = true));
  const reading = inFrames(page, () => (window.hold ? new Promise(() => (window.hold = 'reading')) : location.search)); // the phone's waits
  await expect.poll(() => f[PHONE].evaluate(() => window.hold)).toBe('reading');
  await f[PHONE].goto(`${SITE}/?moved`);
  expect(await reading).toEqual([BETWEEN_PAGES, '', '']);
});

test('the update button knows this is the latest version', async ({ page }) => {
  await expect(page.locator('#update-btn')).toHaveAttribute('data-light', 'ok');
});

test('the glass B is drawn in the top bar and on the tab', async ({ page }) => {
  const box = await page.locator('.brand__mark').boundingBox();
  expect([box.width, box.height]).toEqual([21, 24]);
  // Draw each file as Chrome renders it (clip path, gradients, blur) and check the B is solid with see-through holes.
  const drawn = await page.evaluate(async () => {
    const draw = async (src) => {
      const [vx, vy, vw, vh] = (await (await fetch(src)).text()).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(vw / 2), height: Math.round(vh / 2) });
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const alpha = ([x, y]) => ctx.getImageData(Math.floor(((x - vx) / vw) * canvas.width), Math.floor(((y - vy) / vh) * canvas.height), 1, 1).data[3];
      return { solid: [[159, 400], [569, 520], [300, 100]].map(alpha), holes: [[395, 265], [405, 520]].map(alpha), corner: alpha([vx, vy]) };
    };
    return [await draw(document.querySelector('.brand__mark').src), await draw(document.querySelector('link[rel="icon"]').href)];
  });
  for (const { solid, holes, corner } of drawn) {
    expect(solid.every((a) => a > 240)).toBe(true);
    expect(holes.every((a) => a < 16)).toBe(true);
    expect(corner).toBe(0);
  }
});

test('scrolling with the wheel moves the other devices', async ({ page }) => {
  const laptop = (await page.$$(SHOWN))[LAPTOP];
  const box = await laptop.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 900);
  await expect.poll(async () => (await inFrames(page, () => scrollY)).every((y) => y > 0)).toBe(true);
});

for (const [source, name] of [
  [LAPTOP, 'laptop'],
  [PHONE, 'phone'],
]) {
  test(`scrolling the ${name} shows the same section on the others`, async ({ page }) => {
    for (const id of ['features', 'about', 'pricing']) {
      const f = await frames(page);
      await f[source].evaluate(userScrollTo(`#${id} h2`));
      // What the scrolled device shows at its top (near the end of a short page, that can be an earlier section).
      const shown = (await f[source].evaluate(whereIs(id))).top;
      await expect
        .poll(async () => {
          const where = await inFrames(page, whereIs(shown));
          return where.every((w) => shows(w, shown)) ? 'same section' : JSON.stringify(where);
        })
        .toBe('same section');
    }
  });
}

test('a click on a menu far down the page opens it in every device, even off-screen', async ({ page }) => {
  const f = await frames(page);
  await f[LAPTOP].click('.toggle svg'); // scrolls only the laptop to it, then clicks the icon
  await expect.poll(() => inFrames(page, () => !document.getElementById('menu').hidden)).toEqual([true, true, true]);
  const ys = await inFrames(page, () => scrollY);
  expect(ys[PHONE]).toBe(0);
  expect(ys[TABLET]).toBe(0);
});

test('a form is sent only from the device you clicked', async ({ page }) => {
  const f = await frames(page);
  await f[LAPTOP].click('#form button');
  await expect.poll(() => f[LAPTOP].textContent('#sent')).toBe('sent 1');
  await page.waitForTimeout(500);
  expect(await inFrames(page, () => document.getElementById('sent').textContent)).toEqual(['sent 0', 'sent 0', 'sent 1']);
});

test('a link takes every device to the page, and the address bar shows it', async ({ page }) => {
  let f = await frames(page);
  await f[LAPTOP].click('#about-link');
  await expect.poll(() => inFrames(page, () => location.pathname)).toEqual(['/about.html', '/about.html', '/about.html']);
  await expect(page.locator('#address-input')).toHaveValue('127.0.0.1:4174/about.html');

  f = await frames(page);
  await f[PHONE].click('#home-link'); // from another device
  await expect.poll(() => inFrames(page, () => location.pathname)).toEqual(['/index.html', '/index.html', '/index.html']);
});

test('a single-page-app route change is followed', async ({ page }) => {
  const f = await frames(page);
  await f[TABLET].click('#route');
  await expect.poll(() => inFrames(page, () => location.pathname + location.search)).toEqual(Array(3).fill('/index.html?view=2'));
  await expect(page.locator('#address-input')).toHaveValue('127.0.0.1:4174/index.html?view=2');
});

test('with sync off, nothing follows', async ({ page }) => {
  await page.click('#sync-btn');
  await expect(page.locator('#sync-btn')).toHaveAttribute('aria-pressed', 'false');
  const f = await frames(page);
  await f[LAPTOP].click('.toggle');
  await f[LAPTOP].evaluate(userScrollTo('#about h2'));
  await f[LAPTOP].click('#about-link');
  await page.waitForTimeout(1500);
  expect(await inFrames(page, () => location.pathname)).toEqual(['/', '/', '/about.html']);
});

test('a second tab shows another page on the same devices; switching back finds the first as it was', async ({ page }) => {
  const boxes = await deviceBoxes(page);
  await (await frames(page))[LAPTOP].evaluate(userScrollTo('#pricing h2'));
  await expect.poll(async () => (await inFrames(page, () => scrollY)).every((y) => y > 0)).toBe(true);
  await page.waitForTimeout(300);
  await inFrames(page, () => (window.left = 'here'));
  const scrolled = await inFrames(page, () => scrollY);

  // A new tab starts empty, with the address bar ready for the other address (the admin, say).
  await page.click('#new-tab-btn');
  await expect(page.locator('#address-input')).toBeFocused();
  await expect(page.locator('#address-input')).toHaveValue('');
  await expect(page.locator('.tab')).toHaveCount(2);
  await expect(page.locator('.screen-empty')).toHaveCount(3);
  await page.fill('#address-input', '127.0.0.1:4174/index.html?tab=2');
  await page.press('#address-input', 'Enter');
  await expect.poll(() => inFrames(page, () => location.search)).toEqual(Array(3).fill('?tab=2'));
  await expect(page.locator('.tab.is-active')).toHaveText('127.0.0.1:4174/index.html');
  await expect(page.locator('.rig iframe')).toHaveCount(6); // the first tab's pages wait behind
  expect(await deviceBoxes(page)).toEqual(boxes); // the devices didn't move

  // Synced scrolling stays within the tab in front: the pages behind don't move.
  await expect.poll(() => inFrames(page, () => document.readyState)).toEqual(Array(3).fill('complete'));
  await page.waitForTimeout(300); // the sync helpers say hello once loaded
  await (await frames(page))[LAPTOP].evaluate(userScrollTo('#about h2'));
  await expect.poll(async () => (await inFrames(page, () => scrollY)).every((y) => y > 0)).toBe(true);
  const behind = async () => Promise.all((await page.$$('.rig iframe.is-background')).map(async (h) => (await h.contentFrame()).evaluate(() => scrollY)));
  expect(await behind()).toEqual(scrolled);

  // Alt+T goes back: the same pages, not reloaded, still scrolled where they were.
  await page.keyboard.press('Alt+t');
  await expect(page.locator('#address-input')).toHaveValue('127.0.0.1:4174');
  await expect(page.locator('.tab').first()).toHaveClass(/is-active/);
  expect(await inFrames(page, () => [location.search, window.left])).toEqual(Array(3).fill(['', 'here']));
  expect(await inFrames(page, () => scrollY)).toEqual(scrolled);
  expect(await deviceBoxes(page)).toEqual(boxes);

  // Tabs are kept for next time.
  await page.reload();
  await expect(page.locator('.tab')).toHaveCount(2);
  await expect(page.locator('.tab.is-active')).toHaveText('127.0.0.1:4174');
  await page.click('.tab:nth-child(2) .tab__btn');
  await expect.poll(() => inFrames(page, () => location.search)).toEqual(Array(3).fill('?tab=2'));

  // Closing the tab in front shows the other one again.
  await page.click('.tab.is-active .tab__close');
  await expect(page.locator('.tab')).toHaveCount(1);
  await expect(page.locator('.tab__close')).toHaveCount(0);
  await expect(page.locator('.rig iframe')).toHaveCount(3);
  await expect(page.locator('#address-input')).toHaveValue('127.0.0.1:4174');
  expect(await inFrames(page, () => location.search)).toEqual(['', '', '']);
});
