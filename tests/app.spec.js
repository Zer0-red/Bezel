// The desktop app in Electron (from dist/, so `npm test` builds first). Devices are <webview>s
// with the page script from src/sync.js injected. Each run gets its own settings folder.
// To test a packaged build instead: BEZEL_APP=release/linux-unpacked/bezel npx playwright test --project=app
import { test, expect, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PHONE, TABLET, LAPTOP, whereIs, userScrollTo, shows } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGED = process.env.BEZEL_APP; // a built app's executable, if set
let app;
let win;
let settings;

// The devices' pages in the tab in front; other tabs' pages stay loaded behind them.
const SHOWN = 'webview:not(.is-background)';
const BEHIND = 'webview.is-background';

/** Runs page code in every device, in desk order. */
const inViews = (code, selector = SHOWN) =>
  win.evaluate(([code, selector]) => Promise.all([...document.querySelectorAll(selector)].map((v) => v.executeJavaScript(code))), [code, selector]);
const inView = (index, code) => win.evaluate(([i, code, selector]) => document.querySelectorAll(selector)[i].executeJavaScript(code), [index, code, SHOWN]);
const deviceBoxes = () => win.$$eval('.rig__frame', (els) => els.map((el) => JSON.stringify(el.getBoundingClientRect())));

// Mouse input goes straight to the device's page, as real, trusted events at the page's own
// coordinates. (Sending it to Bezel's window and letting Chromium route it into the scaled,
// emulated device views is unreliable on a bare virtual display: clicks drift or get lost.)
const deviceId = (index) => win.evaluate(([i, selector]) => document.querySelectorAll(selector)[i].getWebContentsId(), [index, SHOWN]);
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

/** Starts Bezel with this run's settings folder. */
async function launch() {
  app = await electron.launch({
    executablePath: PACKAGED || electronPath,
    args: PACKAGED ? ['--no-sandbox'] : ['--no-sandbox', ROOT],
    // A fresh settings folder: Linux keeps them in $XDG_CONFIG_HOME, Windows in %APPDATA%.
    env: { ...process.env, XDG_CONFIG_HOME: settings, APPDATA: settings, NO_PROXY: '*' },
  });
  win = await app.firstWindow();
  await expect(win.locator('#app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
}

test.beforeAll(async () => {
  settings = mkdtempSync(join(tmpdir(), 'bezel-test-'));
  await launch();
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
  test.skip(!!PACKAGED, 'a packaged app checks GitHub for updates instead');
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

test('the devices hold still at every window height', async () => {
  // A row of devices right at its smallest used to flicker: too wide, so the desk got a sideways
  // scrollbar, which took height, so the devices shrank and fitted, so the scrollbar went, and again.
  const setSize = (size) => app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), size);
  const original = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentSize());
  const flickering = [];
  try {
    for (let height = 850; height <= 950; height += 5) {
      await setSize([1280, height]);
      await win.waitForTimeout(150);
      // The desk's size over ten frames in a row.
      const sizes = await win.evaluate(
        () =>
          new Promise((resolve) => {
            const seen = new Set();
            const tick = () => {
              seen.add(document.querySelector('#stage').clientHeight);
              if (seen.size > 1 || (tick.n = (tick.n ?? 0) + 1) >= 10) resolve(seen.size);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      if (sizes > 1) flickering.push(height);
    }
  } finally {
    await setSize(original);
  }
  expect(flickering).toEqual([]);
});

test('a second tab shows another page on the same devices; switching back finds the first as it was', async () => {
  const boxes = await deviceBoxes();
  await inView(LAPTOP, userScrollTo('#pricing h2'));
  await expect.poll(async () => (await inViews('scrollY')).every((y) => y > 0)).toBe(true);
  await win.waitForTimeout(300);
  await inViews("window.left = 'here'");
  const scrolled = await inViews('scrollY');

  // A new tab starts empty, with the address bar ready for the other address (the admin, say).
  await win.click('#new-tab-btn');
  await expect(win.locator('#address-input')).toBeFocused();
  await expect(win.locator('.tab')).toHaveCount(2);
  await win.fill('#address-input', '127.0.0.1:4174/index.html?tab=2');
  await win.press('#address-input', 'Enter');
  await expect.poll(() => inViews('location.search + document.readyState')).toEqual(Array(3).fill('?tab=2complete'));
  await expect(win.locator('webview')).toHaveCount(6); // the first tab's pages wait behind, hidden
  expect(await win.$$eval(BEHIND, (els) => els.map((el) => getComputedStyle(el).visibility))).toEqual(Array(3).fill('hidden'));
  expect(await deviceBoxes()).toEqual(boxes); // the devices didn't move
  // The new tab's pages are emulated like the first's.
  expect(await inView(PHONE, '[innerWidth, devicePixelRatio, navigator.maxTouchPoints]')).toEqual([402, 3, 5]);

  // Synced scrolling stays within the tab in front: the pages behind don't move.
  await expect.poll(() => inViews('typeof window.__bezelScrollTo')).toEqual(Array(3).fill('function'));
  await wheelIn(LAPTOP, 900);
  await expect.poll(async () => (await inViews('scrollY')).every((y) => y > 0)).toBe(true);
  expect(await inViews('scrollY', BEHIND)).toEqual(scrolled);

  // Alt+T, pressed while working in a device, goes back: the same pages, not reloaded, still scrolled
  // where they were. The keyboard moves to the same device in that tab, never to a hidden page.
  await inViews("window.keys = ''; addEventListener('keydown', (e) => (window.keys += e.key)); 0", 'webview');
  await sendInput(LAPTOP, [
    { type: 'mouseMove', x: 200, y: 300 },
    { type: 'mouseDown', x: 200, y: 300, button: 'left', clickCount: 1 },
    { type: 'mouseUp', x: 200, y: 300, button: 'left', clickCount: 1 },
  ]);
  await expect.poll(() => win.evaluate(() => document.activeElement?.tagName)).toBe('WEBVIEW');
  await sendInput(LAPTOP, [{ type: 'keyDown', keyCode: 'T', modifiers: ['alt'] }]);
  await expect(win.locator('#address-input')).toHaveValue('127.0.0.1:4174');
  await expect(win.locator('.tab').first()).toHaveClass(/is-active/);
  expect(await inViews('[location.search, window.left]')).toEqual(Array(3).fill(['', 'here']));
  expect(await inViews('scrollY')).toEqual(scrolled);
  expect(await deviceBoxes()).toEqual(boxes);
  await win.waitForTimeout(100);
  await win.keyboard.press('j');
  const typed = async () => ({ shown: await inViews('window.keys'), behind: await inViews('window.keys', BEHIND) });
  await expect.poll(typed).toEqual({ shown: ['', '', 'j'], behind: ['', '', ''] });

  // Turning the phone turns it in every tab.
  await win.click('#rotate-btn');
  await expect.poll(() => inViews('innerWidth', BEHIND).then((w) => w[PHONE])).toBe(874);
  await win.click('#rotate-btn');
  await expect.poll(() => inViews('innerWidth', BEHIND).then((w) => w[PHONE])).toBe(402);

  // Closing a tab closes its pages.
  await win.click('.tab:nth-child(2) .tab__close');
  await expect(win.locator('.tab')).toHaveCount(1);
  await expect(win.locator('webview')).toHaveCount(3);
  expect(await inViews('window.left')).toEqual(Array(3).fill('here'));
});

test('a login survives closing Bezel, and an update installer forcing it closed', async () => {
  // Like a dev server's login: an HttpOnly session cookie with no expiry, a lasting cookie and a token in localStorage.
  const signIn = (n) => `fetch('/login?session=${n}').then(() => { document.cookie = 'remember=${n}; max-age=86400; path=/'; localStorage.token = '${n}'; return 0; })`;
  const signedIn = "fetch('/whoami').then((r) => r.text()).then((cookies) => cookies + ' token=' + localStorage.token)";
  const userData = await app.evaluate(({ app }) => app.getPath('userData'));

  await inView(LAPTOP, signIn('one'));
  expect(await inViews(signedIn)).toEqual(Array(3).fill('remember=one; session=one token=one'));
  await app.close();
  await launch();
  await openSite();
  expect(await inViews(signedIn)).toEqual(Array(3).fill('remember=one; session=one token=one'));

  // Signed in again a moment ago, then forced closed: it never gets to quit.
  await inView(LAPTOP, signIn('two'));
  await expect.poll(() => readFileSync(join(userData, 'session-cookies.json'), 'utf8')).toContain('"value":"two"');
  const exited = new Promise((resolve) => app.process().once('exit', resolve));
  app.process().kill('SIGKILL');
  await exited;
  await launch();
  await openSite();
  expect(await inViews(signedIn)).toEqual(Array(3).fill('remember=two; session=two token=two'));

  // Signed out (Bezel keeps its settings between tests).
  await app.evaluate(({ session }) => session.fromPartition('persist:bezel').clearStorageData());
});
