// The web version in Chrome: devices are iframes, and the fixture site includes public/sync.js.
import { test, expect } from '@playwright/test';
import { BEZEL, SITE, PHONE, TABLET, LAPTOP, whereIs, userScrollTo, shows } from './helpers.js';

const frames = async (page) => Promise.all((await page.$$('.rig iframe')).map((h) => h.contentFrame()));
const inFrames = async (page, code) => Promise.all((await frames(page)).map((f) => f.evaluate(code)));

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  await page.goto(`${BEZEL}/?url=${encodeURIComponent(SITE)}`);
  await expect(page.locator('#app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(page.locator('.rig iframe')).toHaveCount(3);
  // Every device has loaded the site and its sync helper has said hello.
  await expect.poll(async () => (await inFrames(page, () => document.title)).join()).toBe('Fixture site,Fixture site,Fixture site');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sync-btn').title)).toMatch(/are synced across devices/);
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

test('the update button knows this is the latest version', async ({ page }) => {
  await expect(page.locator('#update-btn')).toHaveAttribute('data-light', 'ok');
});

test('scrolling with the wheel moves the other devices', async ({ page }) => {
  const laptop = (await page.$$('.rig iframe'))[LAPTOP];
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
