// Built-in device presets. Sizes are CSS-pixel viewports, in portrait for phones and tablets.
// `frame` picks the hardware drawn around the screen (see frames.js).

export const CATEGORIES = ['Mobile', 'Tablet', 'Laptop', 'Desktop', 'Large screen'];

export const DEVICES = [
  { id: 'iphone-se', name: 'iPhone SE', category: 'Mobile', width: 375, height: 667, frame: 'home' },
  { id: 'iphone-15', name: 'iPhone 15', category: 'Mobile', width: 393, height: 852, frame: 'island' },
  { id: 'galaxy-s24', name: 'Galaxy S24', category: 'Mobile', width: 360, height: 780, frame: 'punch' },
  { id: 'pixel-8', name: 'Pixel 8', category: 'Mobile', width: 412, height: 915, frame: 'punch' },
  { id: 'ipad-10', name: 'iPad (10th gen)', category: 'Tablet', width: 820, height: 1180, frame: 'tablet' },
  { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', category: 'Tablet', width: 1024, height: 1366, frame: 'tablet' },
  { id: 'laptop-small', name: 'Small laptop', category: 'Laptop', width: 1366, height: 768, frame: 'laptop' },
  { id: 'macbook-air-13', name: 'MacBook Air 13"', category: 'Laptop', width: 1440, height: 900, frame: 'laptop' },
  { id: 'full-hd', name: 'Full HD', category: 'Desktop', width: 1920, height: 1080, frame: 'monitor' },
  { id: 'qhd', name: 'QHD', category: 'Large screen', width: 2560, height: 1440, frame: 'monitor' },
  { id: '4k', name: '4K', category: 'Large screen', width: 3840, height: 2160, frame: 'monitor' },
];

// One device per category is shown by default.
export const DEFAULT_DEVICE_IDS = ['iphone-15', 'ipad-10', 'macbook-air-13', 'full-hd', 'qhd'];
