// Keeps the device views' logins when Bezel closes, restarts or updates.
//
// Chromium forgets session cookies (no expiry date, how most dev servers set a login) when
// the app closes, and writes the other cookies to disk only every 30 seconds or so, so an
// update installer that forces Bezel closed could lose a fresh login too. Like Chrome's
// "Continue where you left off", Bezel saves the session cookies to a file in its settings
// folder and sets them again at the next start, and writes the cookie store and the sites'
// storage to disk a moment after every cookie change and before quitting or installing.
//
// No `require('electron')` here: the unit tests load this file in plain Node.

const fs = require('node:fs');

const SAVE_DELAY = 1000; // ms after a cookie change
const MAX_COOKIES = 5000;
const SAME_SITE = new Set(['unspecified', 'no_restriction', 'lax', 'strict']);

/** What is kept of a session cookie (from `cookies.get()`). */
const keep = ({ name, value, domain, hostOnly, path, secure, httpOnly, sameSite }) => ({ name, value, domain, hostOnly, path, secure, httpOnly, sameSite });

/**
 * The `cookies.set()` details that bring a saved cookie back as it was, still a session
 * cookie (no expiry). Null for anything that isn't a well-formed cookie.
 */
function cookieDetails(cookie) {
  if (!cookie || typeof cookie !== 'object') return null;
  const { name, value, domain, path } = cookie;
  if (typeof name !== 'string' || typeof value !== 'string' || typeof domain !== 'string') return null;
  if (name.length + value.length > 4096) return null; // browsers' own limit per cookie
  const host = domain.replace(/^\./, '');
  const cookiePath = typeof path === 'string' && path.startsWith('/') ? path : '/';
  const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookiePath}`;
  try {
    if (!host || new URL(url).hostname.replace(/^\[|\]$/g, '') !== host.replace(/^\[|\]$/g, '').toLowerCase()) return null;
  } catch {
    return null;
  }
  return {
    url,
    name,
    value,
    // A host-only cookie (set without a domain) must not become one for every subdomain.
    ...(cookie.hostOnly === false && { domain }),
    path: cookiePath,
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: SAME_SITE.has(cookie.sameSite) ? cookie.sameSite : 'unspecified',
  };
}

/**
 * Starts keeping the cookies of `ses` (an Electron session), saving session cookies to `file`.
 * Returns `restore()`, to call once before any page loads, and `flush()`, which writes
 * everything now (before quitting or installing an update).
 */
function keepCookies(ses, file, log = console.error) {
  let timer = null;
  let queue = Promise.resolve();

  async function save() {
    clearTimeout(timer);
    timer = null;
    ses.flushStorageData(); // the sites' localStorage
    await ses.cookies.flushStore(); // cookies with an expiry date
    const cookies = (await ses.cookies.get({})).filter((c) => c.session).map(keep);
    const tmp = `${file}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify({ cookies }), { mode: 0o600 });
    await fs.promises.rename(tmp, file);
  }

  /** Saves now, after any save already under way. */
  const flush = () => (queue = queue.then(save).catch((error) => log('Saving cookies failed:', error)));

  ses.cookies.on('changed', () => {
    timer ??= setTimeout(flush, SAVE_DELAY);
  });

  async function restore() {
    let saved;
    try {
      saved = JSON.parse(await fs.promises.readFile(file, 'utf8'))?.cookies;
    } catch {
      return 0; // nothing saved yet
    }
    if (!Array.isArray(saved)) return 0;
    let restored = 0;
    for (const cookie of saved.slice(0, MAX_COOKIES)) {
      const details = cookieDetails(cookie);
      if (!details) continue;
      try {
        await ses.cookies.set(details);
        restored++;
      } catch {
        // A cookie Chromium no longer accepts is left out.
      }
    }
    return restored;
  }

  return { restore, flush };
}

module.exports = { cookieDetails, keepCookies };
