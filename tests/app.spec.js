// The desktop app in Electron (from dist/, so `npm test` builds first). Devices are <webview>s
// with the page script from src/sync.js injected. Each run gets its own settings folder.
import { test, expect, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PHONE, TABLET, LAPTOP, whereIs, userScrollTo, shows } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let app;
let win;
let settings;

/** Runs page code in every device, in desk order. */
const inViews = (code) =>
  win.evaluate((code) => Promise.all([...document.querySelectorAll('webview')].map((v) => v.executeJavaScript(code))), code);
const inView = (index, code) => win.evaluate(([i, code]) => document.querySelectorAll('webview')[i].executeJavaScript(code), [index, code]);

// Mouse input goes straight to the device's page, as real, trusted events at the page's own
// coordinates. (Sending it to Bezel's window and letting Chromium route it into the scaled,
// emulated device views is unreliable on a bare virtual display: clicks drift or get lost.)
const deviceId = (index) => win.evaluate((i) => document.querySelectorAll('webview')[i].getWebContentsId(), index);
const sendInput = async (index, events) =>
  app.evaluate(({ webContents }, [id, events]) => events.forEach((e) => webContents.fromId(id).sendInputEvent(e)), [await deviceId(index), events]);

/** Clicks an element inside a device with the mouse. */
async function clickIn(index, selector) {
  const { x, y } = await inView(
    index,
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  await sendInput(index, [
    { type: 'mouseMove', x, y },
    { type: 'mouseDown', x, y, button: 'left', clickCount: 1 },
    { type: 'mouseUp', x, y, button: 'left', clickCount: 1 },
  ]);
}

/** Turns the mouse wheel over a device (down by `pixels`). */
const wheelIn = (index, pixels) => sendInput(index, [{ type: 'mouseWheel', x: 200, y: 300, deltaX: 0, deltaY: -pixels, canScroll: true }]);

async function openSite() {
  await win.fill('#address-input', SITE.replace('http://', ''));
  await win.press('#address-input', 'Enter');
  await expect.poll(async () => (await inViews('document.readyState + document.title')).join()).toBe(Array(3).fill('completeFixture site').join());
  // Bezel injects its page script once each page is ready; wait for it, then start at the top (not synced: not the user).
  await expect.poll(() => inViews('typeof window.__bezelScrollTo + typeof window.__bezelClick')).toEqual(Array(3).fill('functionfunction'));
  await inViews('scrollTo(0, 0); 0');
  // Within 1.5 s of the user's last input a device passes its scrolling on, so a previous test's
  // scrolling could still echo this reset: let it settle.
  await win.waitForTimeout(1600);
}

// One app for all tests (each starts from a fresh page); after a failure Playwright starts a new one and carries on.

test.beforeAll(async () => {
  settings = mkdtempSync(join(tmpdir(), 'bezel-test-'));
  app = await electron.launch({
    executablePath: electronPath,
    args: ['--no-sandbox', ROOT],
    // A fresh settings folder: Linux keeps them in $XDG_CONFIG_HOME, Windows in %APPDATA%.
    env: { ...process.env, XDG_CONFIG_HOME: settings, APPDATA: settings, NO_PROXY: '*' },
  });
  win = await app.firstWindow();
  await expect(win.locator('#app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(win.locator('#sync-btn')).toHaveAttribute('aria-pressed', 'true');
});

test.afterAll(async () => {
  await app?.close();
  rmSync(settings, { recursive: true, force: true });
});

test.beforeEach(async () => {
  if ((await win.getAttribute('#sync-btn', 'aria-pressed')) !== 'true') await win.click('#sync-btn');
  await openSite();
});

test('the window has no Node, and device views cannot open local files', async () => {
  expect(await win.evaluate(() => typeof require)).toBe('undefined');
  await inView(PHONE, "location.href = 'file:///etc/hostname'; 0").catch(() => {});
  await win.waitForTimeout(800);
  expect(await inView(PHONE, 'location.protocol')).toBe('http:');
});

test('the window fits on the screen', async () => {
  const { bounds, area } = await app.evaluate(({ BrowserWindow, screen }) => ({
    bounds: BrowserWindow.getAllWindows()[0].getBounds(),
    area: screen.getPrimaryDisplay().workAreaSize,
  }));
  expect(bounds.width).toBeLessThanOrEqual(area.width);
  expect(bounds.height).toBeLessThanOrEqual(area.height);
});

test('phones and tablets are emulated: size, pixel density, touch, no hover', async () => {
  const media = await inViews(
    "({ w: innerWidth, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, hoverNone: matchMedia('(hover: none)').matches, coarse: matchMedia('(pointer: coarse)').matches })",
  );
  expect(media[PHONE]).toMatchObject({ w: 402, dpr: 3, touch: 5, hoverNone: true, coarse: true });
  expect(media[TABLET]).toMatchObject({ w: 820, dpr: 2, touch: 5, hoverNone: true, coarse: true });
  expect(media[LAPTOP]).toMatchObject({ w: 1470, touch: 0, hoverNone: false, coarse: false });
});

test('scrolling with the wheel moves the other devices', async () => {
  await wheelIn(LAPTOP, 900);
  await expect.poll(async () => (await inViews('scrollY')).every((y) => y > 0)).toBe(true);
});

for (const [source, name] of [
  [LAPTOP, 'laptop'],
  [PHONE, 'phone'],
]) {
  test(`scrolling the ${name} shows the same section on the others`, async () => {
    for (const id of ['features', 'about', 'pricing']) {
      await inView(source, userScrollTo(`#${id} h2`));
      // What the scrolled device shows at its top (near the end of a short page, that can be an earlier section).
      const shown = (await inView(source, whereIs(id))).top;
      await expect
        .poll(async () => {
          const where = await inViews(whereIs(shown));
          return where.every((w) => shows(w, shown)) ? 'same section' : JSON.stringify(where);
        })
        .toBe('same section');
    }
  });
}

test('a click on a menu far down the page opens it in every device, even off-screen', async () => {
  await inView(LAPTOP, "document.querySelector('.toggle').scrollIntoView({ block: 'center' }); 0"); // not the user: not synced
  await win.waitForTimeout(300);
  await clickIn(LAPTOP, '.toggle svg');
  await expect.poll(() => inViews("!document.getElementById('menu').hidden")).toEqual([true, true, true]);
  const ys = await inViews('scrollY');
  expect(ys[PHONE]).toBe(0);
  expect(ys[TABLET]).toBe(0);
});

test('a form is sent only from the device you clicked', async () => {
  await inView(LAPTOP, "document.getElementById('form').scrollIntoView({ block: 'center' }); 0");
  await win.waitForTimeout(300);
  await clickIn(LAPTOP, '#form button');
  await expect.poll(() => inView(LAPTOP, "document.getElementById('sent').textContent")).toBe('sent 1');
  await win.waitForTimeout(500);
  expect(await inViews("document.getElementById('sent').textContent")).toEqual(['sent 0', 'sent 0', 'sent 1']);
});

test('a link takes every device to the page, and the address bar shows it', async () => {
  await clickIn(LAPTOP, '#about-link');
  await expect.poll(() => inViews('location.pathname')).toEqual(['/about.html', '/about.html', '/about.html']);
  await expect(win.locator('#address-input')).toHaveValue('127.0.0.1:4174/about.html');
  await expect.poll(() => inViews('document.readyState')).toEqual(['complete', 'complete', 'complete']);

  await clickIn(PHONE, '#home-link'); // from another device
  await expect.poll(() => inViews('location.pathname')).toEqual(['/index.html', '/index.html', '/index.html']);
});

test('a single-page-app route change is followed', async () => {
  await clickIn(TABLET, '#route');
  await expect.poll(() => inView(TABLET, "document.getElementById('title').textContent"), { message: 'the tablet got the click' }).toBe('Routed');
  await expect.poll(() => inViews('location.pathname + location.search')).toEqual(Array(3).fill('/index.html?view=2'));
  await expect(win.locator('#address-input')).toHaveValue('127.0.0.1:4174/index.html?view=2');
});

test('a screenshot of the devices goes to the clipboard', async () => {
  await win.click('#shot-btn');
  await expect(win.locator('#toast')).toContainText('Copied');
  const size = await app.evaluate(async ({ clipboard, nativeImage }) => {
    const [item] = await clipboard.read();
    const png = await item.getType('image/png');
    return nativeImage.createFromBuffer(Buffer.from(await png.arrayBuffer())).getSize();
  });
  expect(size.width).toBeGreaterThan(600);
  expect(size.height).toBeGreaterThan(300);
});

test('running from source, the update button says updates come with the installed app', async () => {
  await win.click('#update-btn');
  await expect(win.locator('#update-label')).toHaveText('Updates work in the installed app');
});

test('with sync off, nothing follows', async () => {
  await win.click('#sync-btn');
  await expect(win.locator('#sync-btn')).toHaveAttribute('aria-pressed', 'false');
  await inView(LAPTOP, "document.querySelector('.toggle').scrollIntoView({ block: 'center' }); 0");
  await win.waitForTimeout(300);
  await clickIn(LAPTOP, '.toggle');
  await inView(LAPTOP, userScrollTo('#about h2'));
  await clickIn(LAPTOP, '#about-link');
  await expect.poll(() => inView(LAPTOP, 'location.pathname')).toBe('/about.html');
  await win.waitForTimeout(1000);
  expect(await inViews('location.pathname')).toEqual(['/', '/', '/about.html']);
});
