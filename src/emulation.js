// Mobile emulation settings for the desktop app. The web version ignores these:
// a page can't change the user agent or touch input of an iframe.

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
// iPadOS Safari presents itself as a Mac by default; sites spot an iPad by its touch support.
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';

function androidUa() {
  const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? '140';
  return `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Mobile Safari/537.36`;
}

const MAC = IPAD; // Safari on macOS

/** Emulation for a device. Every device hides its scrollbar, as the page would look on a phone or a Mac. */
export function emulationFor(device) {
  // Apple laptops and iMacs: Retina density, overlay scrollbars and Safari, but no touch.
  if (device.brand === 'Apple' && (device.category === 'Laptop' || device.category === 'Desktop')) {
    return { userAgent: MAC, mobile: false, touch: false, hideScrollbars: true, dpr: 2 };
  }
  const kind = device.ua ?? (device.category === 'Mobile' ? 'android' : device.category === 'Tablet' ? 'ipad' : null);
  // Windows laptops and monitors: this computer's own browser and pixel density (dpr 0 keeps it), no scrollbar.
  if (!kind) return { userAgent: null, mobile: false, touch: false, hideScrollbars: true, dpr: 0 };
  const userAgent = kind === 'ios' ? IOS : kind === 'ipad' ? IPAD : androidUa();
  return {
    userAgent,
    mobile: kind !== 'ipad', // iPad Safari renders desktop-style pages; phones apply mobile viewport rules
    touch: true,
    hideScrollbars: true, // phones and tablets use overlay scrollbars that take no space
    dpr: device.dpr ?? (kind === 'ipad' ? 2 : 3),
  };
}
