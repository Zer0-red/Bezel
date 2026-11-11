// Turns what the user types into a loadable address.
//   "3000"            → http://localhost:3000/
//   "localhost:5173"  → http://localhost:5173/
//   "192.168.1.20:80" → http://192.168.1.20/
//   "example.com"     → https://example.com/
// Only http and https are allowed, so a crafted ?url= link can't run script in Bezel.

const LOCAL_HOST =
  /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/:]+\.(local|localhost)(:|\/|$))/i;

export function normalizeUrl(input) {
  let value = String(input ?? '').trim();
  if (!value) return '';

  if (/^\d{2,5}$/.test(value)) value = `localhost:${value}`;
  if (/^:\d{2,5}/.test(value)) value = `localhost${value}`;

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    value = (LOCAL_HOST.test(value) ? 'http://' : 'https://') + value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}
