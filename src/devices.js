// Built-in device presets. Sizes are CSS-pixel viewports, in portrait for phones/tablets.

export const CATEGORIES = ['Mobile', 'Tablet', 'Laptop', 'Desktop', 'Large screen'];

export const DEVICES = [
  { id: 'iphone-se', name: 'iPhone SE', category: 'Mobile', width: 375, height: 667 },
  { id: 'iphone-15', name: 'iPhone 15', category: 'Mobile', width: 393, height: 852 },
  { id: 'galaxy-s24', name: 'Galaxy S24', category: 'Mobile', width: 360, height: 780 },
  { id: 'pixel-8', name: 'Pixel 8', category: 'Mobile', width: 412, height: 915 },
  { id: 'ipad-10', name: 'iPad (10th gen)', category: 'Tablet', width: 820, height: 1180 },
  { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', category: 'Tablet', width: 1024, height: 1366 },
  { id: 'laptop-small', name: 'Small laptop', category: 'Laptop', width: 1366, height: 768 },
  { id: 'macbook-air-13', name: 'MacBook Air 13"', category: 'Laptop', width: 1440, height: 900 },
  { id: 'full-hd', name: 'Full HD', category: 'Desktop', width: 1920, height: 1080 },
  { id: 'qhd', name: 'QHD', category: 'Large screen', width: 2560, height: 1440 },
  { id: '4k', name: '4K', category: 'Large screen', width: 3840, height: 2160 },
];

// One device per category is shown by default.
export const DEFAULT_DEVICE_IDS = ['iphone-15', 'ipad-10', 'macbook-air-13', 'full-hd', 'qhd'];
