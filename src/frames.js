// Geometry for the hardware drawn around each screen.
// Everything is in real (unscaled) CSS pixels, proportional to the screen size,
// so a frame looks right at any zoom level.

const r = Math.round;

export function frameKind(device) {
  if (device.frame) return device.frame;
  if (device.category === 'Mobile') return 'punch';
  if (device.category === 'Tablet') return 'tablet';
  if (device.category === 'Laptop') return 'laptop';
  return 'monitor';
}

// Laptops only make sense in landscape.
export const canRotate = (device) => frameKind(device) !== 'laptop';

/**
 * Returns the layout of a device frame:
 * - outerW/outerH: full size including buttons, base or stand
 * - body: the device body, relative to the frame
 * - screen: the viewport, relative to the body
 * - parts: extra hardware (buttons, camera, island, stand…), relative to the frame
 */
export function geometry(device, rotated = false) {
  const kind = frameKind(device);
  let w = device.width;
  let h = device.height;
  if (rotated && canRotate(device)) [w, h] = [h, w];

  const min = Math.min(w, h);
  const max = Math.max(w, h);
  const landscape = w > h;
  const parts = [];

  let pad;
  let outerRadius;
  let innerRadius;
  let screenRadius;
  let rim;
  let offX = 0;
  let offY = 0;
  let extraW = 0;
  let extraH = 0;

  if (kind === 'island' || kind === 'punch' || kind === 'notch' || kind === 'home') {
    // ── Phones ──────────────────────────────────────────────
    const b = r(min * 0.04);
    const thick = kind === 'home' ? r(min * 0.27) : b;
    pad = landscape ? { t: b, r: thick, b, l: thick } : { t: thick, r: b, b: thick, l: b };
    const radius = r(min * (kind === 'home' ? 0.15 : 0.14));
    rim = Math.max(2, r(b * 0.25));
    outerRadius = `${radius}px`;
    innerRadius = `${radius - rim}px`;
    screenRadius = kind === 'home' ? `${r(min * 0.01)}px` : `${Math.max(0, radius - b)}px`;

    const t = Math.max(3, r(min * 0.009)); // side-button thickness
    offX = t;
    offY = t;
    extraW = t * 2;
    extraH = t * 2;
    const bw = w + pad.l + pad.r;
    const bh = h + pad.t + pad.b;

    // Side buttons. Landscape is the portrait phone turned counter-clockwise.
    if (!landscape) {
      parts.push({ cls: 'btn', x: offX + bw - 1, y: offY + bh * 0.24, w: t + 1, h: bh * 0.12 });
      parts.push({ cls: 'btn', x: 0, y: offY + bh * 0.2, w: t + 1, h: bh * 0.07 });
      parts.push({ cls: 'btn', x: 0, y: offY + bh * 0.3, w: t + 1, h: bh * 0.07 });
    } else {
      parts.push({ cls: 'btn', x: offX + bw * 0.24, y: 0, w: bw * 0.12, h: t + 1 });
      parts.push({ cls: 'btn', x: offX + bw * 0.2, y: offY + bh - 1, w: bw * 0.07, h: t + 1 });
      parts.push({ cls: 'btn', x: offX + bw * 0.3, y: offY + bh - 1, w: bw * 0.07, h: t + 1 });
    }

    if (kind === 'notch') {
      // Notch phones (iPhone X to 14, 16e): a cut-out hanging from the top edge of the screen.
      const nw = r(min * 0.4);
      const nh = r(min * 0.078);
      if (!landscape) {
        parts.push({ cls: 'cutout', x: offX + pad.l + (w - nw) / 2, y: offY + pad.t, w: nw, h: nh });
      } else {
        parts.push({ cls: 'cutout', x: offX + pad.l, y: offY + pad.t + (h - nw) / 2, w: nh, h: nw });
      }
    } else if (kind === 'island' || kind === 'punch') {
      const iw = kind === 'island' ? r(min * 0.3) : r(min * 0.032);
      const ih = kind === 'island' ? r(min * 0.088) : iw;
      const gap = r(min * 0.028);
      const cls = kind === 'island' ? 'island' : 'punch';
      if (!landscape) {
        parts.push({ cls, x: offX + pad.l + (w - iw) / 2, y: offY + pad.t + gap, w: iw, h: ih });
      } else {
        parts.push({ cls, x: offX + pad.l + gap, y: offY + pad.t + (h - iw) / 2, w: ih, h: iw });
      }
    } else {
      // Home-button phone: speaker above the screen, round button below it.
      const d = r(thick * 0.55);
      const sw = r(min * 0.16);
      const sh = Math.max(4, r(min * 0.012));
      if (!landscape) {
        parts.push({ cls: 'home', x: offX + (bw - d) / 2, y: offY + pad.t + h + (thick - d) / 2, w: d, h: d });
        parts.push({ cls: 'speaker', x: offX + (bw - sw) / 2, y: offY + (thick - sh) / 2, w: sw, h: sh });
      } else {
        parts.push({ cls: 'home', x: offX + pad.l + w + (thick - d) / 2, y: offY + (bh - d) / 2, w: d, h: d });
        parts.push({ cls: 'speaker', x: offX + (thick - sh) / 2, y: offY + (bh - sw) / 2, w: sh, h: sw });
      }
    }
  } else if (kind === 'tablet') {
    // ── Tablets ─────────────────────────────────────────────
    const b = r(min * 0.045);
    pad = { t: b, r: b, b, l: b };
    const radius = r(min * 0.055);
    rim = Math.max(2, r(b * 0.12));
    outerRadius = `${radius}px`;
    innerRadius = `${radius - rim}px`;
    screenRadius = `${Math.max(r(min * 0.012), radius - b)}px`;
    const bw = w + b * 2;
    const bh = h + b * 2;
    const d = Math.max(4, r(b * 0.2));
    if (!landscape) parts.push({ cls: 'camera', x: (bw - d) / 2, y: (b - d) / 2, w: d, h: d });
    else parts.push({ cls: 'camera', x: (b - d) / 2, y: (bh - d) / 2, w: d, h: d });
  } else if (kind === 'laptop') {
    // ── Laptops: lid + keyboard base ────────────────────────
    const side = r(w * 0.012);
    const top = r(w * 0.022);
    const bottom = r(w * 0.026);
    pad = { t: top, r: side, b: bottom, l: side };
    rim = Math.max(2, r(side * 0.2));
    const rt = r(w * 0.012);
    const rb = r(w * 0.004);
    outerRadius = `${rt}px ${rt}px ${rb}px ${rb}px`;
    innerRadius = `${rt - rim}px ${rt - rim}px ${Math.max(0, rb - rim)}px ${Math.max(0, rb - rim)}px`;
    screenRadius = '0px';
    const bw = w + side * 2;
    const bh = h + top + bottom;
    const baseW = r(bw * 1.14);
    const baseH = r(w * 0.024);
    offX = r((baseW - bw) / 2);
    extraW = baseW - bw;
    extraH = baseH;
    const d = Math.max(4, r(top * 0.16));
    parts.push({ cls: 'camera', x: offX + (bw - d) / 2, y: (top - d) / 2, w: d, h: d });
    parts.push({ cls: 'base', x: 0, y: bh, w: baseW, h: baseH });
    const nw = r(bw * 0.13);
    parts.push({ cls: 'notch', x: (baseW - nw) / 2, y: bh, w: nw, h: r(baseH * 0.42) });
  } else {
    // ── Monitors: thin bezel, chin, stand ───────────────────
    const b = Math.max(8, r(max * 0.006));
    const chin = r(b * 2.2);
    pad = { t: b, r: b, b: chin, l: b };
    const radius = Math.max(4, r(max * 0.004));
    rim = Math.max(1, r(b * 0.15));
    outerRadius = `${radius}px`;
    innerRadius = `${Math.max(0, radius - rim)}px`;
    screenRadius = '0px';
    const bw = w + b * 2;
    const bh = h + b + chin;
    const neckW = r(max * 0.065);
    const neckH = r(max * 0.09);
    const footW = r(max * 0.27);
    const footH = r(max * 0.014);
    extraH = neckH + footH;
    parts.push({ cls: 'neck', x: (bw - neckW) / 2, y: bh - r(chin * 0.5), w: neckW, h: neckH + r(chin * 0.5) });
    parts.push({ cls: 'foot', x: (bw - footW) / 2, y: bh + neckH, w: footW, h: footH });
  }

  const bw = w + pad.l + pad.r;
  const bh = h + pad.t + pad.b;

  return {
    kind,
    w,
    h,
    landscape,
    outerW: bw + extraW,
    outerH: bh + extraH,
    body: { x: offX, y: offY, w: bw, h: bh, radius: outerRadius, innerRadius, rim },
    screen: { x: pad.l, y: pad.t, w, h, radius: screenRadius },
    parts,
    statusBar: statusBarHeight(device, landscape),
    // Width of the camera cut-out across the status bar (time and icons sit either side).
    cutout: kind === 'island' ? r(min * 0.3) : kind === 'notch' ? r(min * 0.4) : 0,
  };
}

const PHONE_FRAMES = ['island', 'notch', 'punch', 'home'];

/**
 * Height of the phone's status bar, above the page (0 for tablets, laptops, monitors).
 * iPhones use Apple's top safe-area inset (devices.js `statusBar`); Safari hides the status
 * bar in landscape. Android phones with a camera cut-out use AOSP's default portrait
 * status bar (48dp) and 28dp in landscape.
 */
export function statusBarHeight(device, landscape) {
  const kind = frameKind(device);
  if (!PHONE_FRAMES.includes(kind)) return 0;
  const ios = device.ua === 'ios';
  if (landscape) return ios ? 0 : 28;
  if (device.statusBar) return device.statusBar;
  if (kind === 'home') return 20;
  if (kind === 'notch') return 47;
  return 48;
}
