// Device library, popular screen sizes and ready-made setups.
//
// Sizes are CSS-pixel viewports (screen size in CSS pixels, portrait for phones
// and tablets): what media queries see at the device's default display setting.
// `frame` picks the hardware drawn around the screen (see frames.js);
// `ua` and `dpr` drive mobile emulation in the desktop app (see emulation.js).
// `statusBar` is the phone's top safe-area inset in portrait (Apple's values); the page
// starts below it, as in Safari and Chrome (see statusBarHeight in frames.js).
// Laptop and monitor sizes are the whole screen; a browser window on them is a
// little shorter (menu bar, tabs and address bar).

export const CATEGORIES = ['Mobile', 'Tablet', 'Laptop', 'Desktop', 'Large screen'];

export const DEVICES = [
  // ── Apple phones ──
  { id: 'iphone-18-pro-max', name: 'iPhone 18 Pro Max', brand: 'Apple', category: 'Mobile', year: 2026, width: 440, height: 956, frame: 'island', ua: 'ios', dpr: 3, statusBar: 62 },
  { id: 'iphone-18-pro', name: 'iPhone 18 Pro', brand: 'Apple', category: 'Mobile', year: 2026, width: 402, height: 874, frame: 'island', ua: 'ios', dpr: 3, statusBar: 62 },
  { id: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max', brand: 'Apple', category: 'Mobile', year: 2025, width: 440, height: 956, frame: 'island', ua: 'ios', dpr: 3, statusBar: 62 },
  { id: 'iphone-17-pro', name: 'iPhone 17 Pro', brand: 'Apple', category: 'Mobile', year: 2025, width: 402, height: 874, frame: 'island', ua: 'ios', dpr: 3, statusBar: 62 },
  { id: 'iphone-air', name: 'iPhone Air', brand: 'Apple', category: 'Mobile', year: 2025, width: 420, height: 912, frame: 'island', ua: 'ios', dpr: 3, statusBar: 68 },
  { id: 'iphone-17', name: 'iPhone 17', brand: 'Apple', category: 'Mobile', year: 2025, width: 402, height: 874, frame: 'island', ua: 'ios', dpr: 3, statusBar: 62 },
  { id: 'iphone-16e', name: 'iPhone 16e', brand: 'Apple', category: 'Mobile', year: 2025, width: 390, height: 844, frame: 'notch', ua: 'ios', dpr: 3, statusBar: 47 },
  { id: 'iphone-16-plus', name: 'iPhone 16 Plus', brand: 'Apple', category: 'Mobile', year: 2024, width: 430, height: 932, frame: 'island', ua: 'ios', dpr: 3, statusBar: 59 },
  { id: 'iphone-16', name: 'iPhone 16', brand: 'Apple', category: 'Mobile', year: 2024, width: 393, height: 852, frame: 'island', ua: 'ios', dpr: 3, statusBar: 59 },
  { id: 'iphone-15', name: 'iPhone 15', brand: 'Apple', category: 'Mobile', year: 2023, width: 393, height: 852, frame: 'island', ua: 'ios', dpr: 3, statusBar: 59 },
  { id: 'iphone-14', name: 'iPhone 14', brand: 'Apple', category: 'Mobile', year: 2022, width: 390, height: 844, frame: 'notch', ua: 'ios', dpr: 3, statusBar: 47 },
  { id: 'iphone-11', name: 'iPhone 11 / XR', brand: 'Apple', category: 'Mobile', year: 2019, width: 414, height: 896, frame: 'notch', ua: 'ios', dpr: 2, statusBar: 48 },
  { id: 'iphone-se', name: 'iPhone SE', brand: 'Apple', category: 'Mobile', year: 2022, width: 375, height: 667, frame: 'home', ua: 'ios', dpr: 2, statusBar: 20 },

  // ── Google phones ──
  { id: 'pixel-10-pro', name: 'Pixel 10 Pro', brand: 'Google', category: 'Mobile', year: 2025, width: 410, height: 914, frame: 'punch', ua: 'android', dpr: 3.125 },
  { id: 'pixel-10', name: 'Pixel 10', brand: 'Google', category: 'Mobile', year: 2025, width: 412, height: 923, frame: 'punch', ua: 'android', dpr: 2.625 },
  { id: 'pixel-9-pro', name: 'Pixel 9 Pro', brand: 'Google', category: 'Mobile', year: 2024, width: 410, height: 914, frame: 'punch', ua: 'android', dpr: 3.125 },
  { id: 'pixel-9', name: 'Pixel 9', brand: 'Google', category: 'Mobile', year: 2024, width: 412, height: 923, frame: 'punch', ua: 'android', dpr: 2.625 },
  { id: 'pixel-8', name: 'Pixel 8', brand: 'Google', category: 'Mobile', year: 2023, width: 412, height: 915, frame: 'punch', ua: 'android', dpr: 2.625 },

  // ── Samsung phones ──
  { id: 'galaxy-s26-ultra', name: 'Galaxy S26 Ultra', brand: 'Samsung', category: 'Mobile', year: 2026, width: 412, height: 891, frame: 'punch', ua: 'android', dpr: 3.5 },
  { id: 'galaxy-s25-ultra', name: 'Galaxy S25 Ultra', brand: 'Samsung', category: 'Mobile', year: 2025, width: 412, height: 891, frame: 'punch', ua: 'android', dpr: 3.5 },
  { id: 'galaxy-s25', name: 'Galaxy S25', brand: 'Samsung', category: 'Mobile', year: 2025, width: 360, height: 780, frame: 'punch', ua: 'android', dpr: 3 },
  { id: 'galaxy-s24', name: 'Galaxy S24', brand: 'Samsung', category: 'Mobile', year: 2024, width: 360, height: 780, frame: 'punch', ua: 'android', dpr: 3 },
  { id: 'galaxy-a', name: 'Galaxy A55 / A56', brand: 'Samsung', category: 'Mobile', year: 2025, width: 384, height: 832, frame: 'punch', ua: 'android', dpr: 2.8125 },

  // ── Tablets ──
  { id: 'ipad-mini', name: 'iPad mini', brand: 'Apple', category: 'Tablet', year: 2024, width: 744, height: 1133, frame: 'tablet', ua: 'ipad', dpr: 2 },
  { id: 'ipad-10', name: 'iPad / iPad Air 11"', brand: 'Apple', category: 'Tablet', year: 2025, width: 820, height: 1180, frame: 'tablet', ua: 'ipad', dpr: 2 },
  { id: 'ipad-pro-11', name: 'iPad Pro 11"', brand: 'Apple', category: 'Tablet', year: 2024, width: 834, height: 1210, frame: 'tablet', ua: 'ipad', dpr: 2 },
  { id: 'ipad-pro-12', name: 'iPad Air 13" / Pro 12.9"', brand: 'Apple', category: 'Tablet', year: 2025, width: 1024, height: 1366, frame: 'tablet', ua: 'ipad', dpr: 2 },
  { id: 'ipad-pro-13', name: 'iPad Pro 13"', brand: 'Apple', category: 'Tablet', year: 2024, width: 1032, height: 1376, frame: 'tablet', ua: 'ipad', dpr: 2 },

  // ── Laptops ──
  { id: 'macbook-air-13', name: 'MacBook Air 13"', brand: 'Apple', category: 'Laptop', year: 2025, width: 1470, height: 956, frame: 'laptop' },
  { id: 'macbook-pro-14', name: 'MacBook Pro 14"', brand: 'Apple', category: 'Laptop', year: 2025, width: 1512, height: 982, frame: 'laptop' },
  { id: 'macbook-air-15', name: 'MacBook Air 15"', brand: 'Apple', category: 'Laptop', year: 2025, width: 1710, height: 1107, frame: 'laptop' },
  { id: 'macbook-pro-16', name: 'MacBook Pro 16"', brand: 'Apple', category: 'Laptop', year: 2025, width: 1728, height: 1117, frame: 'laptop' },
  { id: 'laptop-15', name: 'Windows laptop 15.6"', brand: 'Windows', category: 'Laptop', width: 1536, height: 864, frame: 'laptop' },
  { id: 'laptop-small', name: 'Small laptop', brand: 'Windows', category: 'Laptop', width: 1366, height: 768, frame: 'laptop' },

  // ── Monitors ──
  { id: 'full-hd', name: 'Full HD monitor', brand: 'Monitors', category: 'Desktop', width: 1920, height: 1080, frame: 'monitor' },
  { id: 'imac-24', name: 'iMac 24"', brand: 'Apple', category: 'Desktop', year: 2024, width: 2240, height: 1260, frame: 'monitor' },
  { id: 'qhd', name: 'QHD monitor', brand: 'Monitors', category: 'Large screen', width: 2560, height: 1440, frame: 'monitor' },
  { id: 'ultrawide', name: 'Ultrawide 34"', brand: 'Monitors', category: 'Large screen', width: 3440, height: 1440, frame: 'monitor' },
  { id: '4k', name: '4K monitor', brand: 'Monitors', category: 'Large screen', width: 3840, height: 2160, frame: 'monitor' },
];

// ── Popular screen sizes (StatCounter Global Stats, worldwide) ──
// Update these lists from the StatCounter pages linked below.

export const POPULAR_SOURCE = { name: 'StatCounter Global Stats', url: 'https://gs.statcounter.com/screen-resolution-stats' };

export const POPULAR = [
  {
    category: 'Mobile',
    title: 'Phones',
    period: 'October 2026',
    url: 'https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide',
    sizes: [
      { width: 414, height: 896, share: 12.67, hint: 'iPhone XR, 11' },
      { width: 360, height: 800, share: 8.57, hint: 'Android phones' },
      { width: 384, height: 832, share: 7.24, hint: 'Galaxy A series' },
      { width: 390, height: 844, share: 5.33, hint: 'iPhone 12–14, 16e' },
      { width: 393, height: 873, share: 4.43 },
      { width: 360, height: 780, share: 3.31, hint: 'Galaxy S series' },
    ],
  },
  {
    category: 'Tablet',
    title: 'Tablets',
    period: 'July 2026',
    url: 'https://gs.statcounter.com/screen-resolution-stats/tablet/worldwide',
    sizes: [
      { width: 768, height: 1024, share: 9.03, hint: 'Older iPads' },
      { width: 800, height: 1280, share: 6.84, hint: 'Android tablets' },
      { width: 1280, height: 800, share: 6.42, hint: 'Android tablets, landscape' },
      { width: 820, height: 1180, share: 5.7, hint: 'iPad 10th gen, iPad Air' },
      { width: 810, height: 1080, share: 5.58, hint: 'iPad 7th–9th gen' },
      { width: 601, height: 1007, share: 4.28 },
    ],
  },
  {
    category: 'Desktop',
    title: 'Laptops & desktops',
    period: 'September 2026',
    url: 'https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide',
    sizes: [
      { width: 1920, height: 1080, share: 28.07, hint: 'Full HD' },
      { width: 1536, height: 864, share: 10, hint: 'Laptops at 125% scaling' },
      { width: 1366, height: 768, share: 7.95, hint: 'Budget laptops' },
      { width: 1280, height: 720, share: 4.71, hint: 'Laptops at 150% scaling' },
      { width: 2560, height: 1440, share: 3.95, hint: 'QHD' },
      { width: 1280, height: 1200, share: 3.64 },
    ],
  },
];

const sizeCategory = (list, width) => {
  if (list.category !== 'Desktop') return list.category;
  if (width >= 2560) return 'Large screen';
  return width >= 1920 ? 'Desktop' : 'Laptop';
};
const sizeLabel = { Mobile: 'Phone', Tablet: 'Tablet', Laptop: 'Laptop', Desktop: 'Desktop', 'Large screen': 'Monitor' };

/** Every popular size as a selectable device (id "size-414x896"). */
export const POPULAR_DEVICES = POPULAR.flatMap((list) =>
  list.sizes.map((size) => {
    const category = sizeCategory(list, size.width);
    return {
      id: `size-${size.width}x${size.height}`,
      name: `${sizeLabel[category]} ${size.width}×${size.height}`,
      brand: 'Popular sizes',
      category,
      width: size.width,
      height: size.height,
      ua: category === 'Mobile' ? 'android' : category === 'Tablet' ? 'ipad' : undefined,
      dpr: category === 'Mobile' ? 3 : category === 'Tablet' ? 2 : undefined,
    };
  }),
);

// ── Ready-made setups ──

export const SETUPS = [
  { id: 'essentials', name: 'Phone, tablet, laptop', devices: ['iphone-17-pro', 'ipad-10', 'macbook-air-13'] },
  { id: 'phone-to-desktop', name: 'Phone to desktop', devices: ['iphone-17-pro', 'ipad-10', 'macbook-air-13', 'full-hd', 'qhd'] },
  { id: 'three-phones', name: 'Three phones', devices: ['iphone-17-pro', 'pixel-9-pro', 'galaxy-s25'] },
  { id: 'phone-sizes', name: 'Phones, small to large', devices: ['iphone-se', 'iphone-17', 'iphone-17-pro-max'] },
  { id: 'popular', name: 'Most popular sizes', devices: ['size-414x896', 'size-768x1024', 'size-1536x864', 'size-1920x1080'] },
  { id: 'apple', name: 'Apple', devices: ['iphone-17-pro', 'ipad-pro-11', 'macbook-air-13', 'macbook-pro-16'] },
  { id: 'macbooks', name: 'MacBooks', devices: ['macbook-air-13', 'macbook-pro-14', 'macbook-air-15', 'macbook-pro-16'] },
  { id: 'tablets', name: 'Tablets', devices: ['ipad-mini', 'ipad-10', 'ipad-pro-13'] },
];

export const DEFAULT_DEVICE_IDS = SETUPS[0].devices;
