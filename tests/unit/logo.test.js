// Unit tests (node --test): the logo files are one drawing, and the PNGs are rendered from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const viewBox = (path) => read(path).toString().match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
const drawing = (path) => read(path).toString().replace(/^<svg[^>]*>(<!--.*?-->)?/, '');

// The glass B's outline in the artwork's coordinates (getBBox in Chromium, after its translate(49 20)).
const LETTER = { left: 82.7, top: 36.5, right: 673.8, bottom: 728 };
// Points of the drawing: inside the B, and the middle of its two holes (see-through).
const SOLID = [[159, 400], [569, 520], [300, 100]];
const HOLES = [[395, 265], [405, 520]];

// A minimal PNG reader for what rsvg-convert writes: 8-bit RGBA, not interlaced.
function decodePng(buf) {
  assert.equal(buf.toString('latin1', 1, 4), 'PNG');
  let pos = 8;
  let width, height;
  const data = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      assert.deepEqual([chunk[8], chunk[9], chunk[12]], [8, 6, 0], 'expected 8-bit RGBA, not interlaced');
    } else if (type === 'IDAT') data.push(chunk);
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  return { width, height, alpha: (x, y) => px[(y * width + x) * 4 + 3] };
}

// The opacity of the PNG at a point of the drawing, given the SVG it was rendered from.
const alphaAt = (png, [vx, vy, vw, vh], [x, y]) =>
  png.alpha(Math.floor(((x - vx) / vw) * png.width), Math.floor(((y - vy) / vh) * png.height));

test('the top bar, the browser tab and the app icon draw the same logo', () => {
  const mark = drawing('src/assets/logo-mark.svg');
  assert.match(mark, /<path id="letter"/);
  assert.equal(drawing('src/assets/favicon.svg'), mark);
  assert.equal(drawing('build/icon.svg'), mark);
});

test('the top bar mark is a tight 21 × 24 box around the B', () => {
  const [x, y, w, h] = viewBox('src/assets/logo-mark.svg');
  assert.ok(Math.abs(w / h - 21 / 24) < 0.002);
  assert.match(read('index.html').toString(), /class="brand__mark"[^>]*width="21" height="24"/);
  assert.ok(x <= LETTER.left && x + w >= LETTER.right && y <= LETTER.top && y + h >= LETTER.bottom);
  assert.ok(w - (LETTER.right - LETTER.left) < 20 && h - (LETTER.bottom - LETTER.top) < 1);
});

for (const path of ['src/assets/favicon.svg', 'build/icon.svg']) {
  test(`${path} is square with the B in the middle`, () => {
    const [x, y, w, h] = viewBox(path);
    assert.equal(w, h);
    assert.ok(Math.abs(x + w / 2 - (LETTER.left + LETTER.right) / 2) < 1);
    assert.ok(Math.abs(y + h / 2 - (LETTER.top + LETTER.bottom) / 2) < 1);
    assert.ok(x < LETTER.left && x + w > LETTER.right && y < LETTER.top && y + h > LETTER.bottom);
  });
}

const RENDERS = [
  ['build/icon.png', 'build/icon.svg', 1024, 1024],
  ...[16, 24, 32, 48, 64, 128, 256, 512].map((s) => [`build/icons/${s}x${s}.png`, 'build/icon.svg', s, s]),
  ['docs/logo.png', 'src/assets/logo-mark.svg', 315, 360],
];

for (const [png, svg, width, height] of RENDERS) {
  test(`${png} is rendered from ${svg}`, () => {
    const image = decodePng(read(png));
    assert.deepEqual([image.width, image.height], [width, height]);
    const box = viewBox(svg);
    // At 16 and 24 px a hole is only two or three pixels wide, so its middle is partly covered.
    const hole = width < 32 ? 128 : 16;
    for (const point of SOLID) assert.ok(alphaAt(image, box, point) > 240, `solid at ${point}`);
    for (const point of HOLES) assert.ok(alphaAt(image, box, point) < hole, `see-through at ${point}`);
    assert.equal(image.alpha(0, 0), 0);
    assert.equal(image.alpha(width - 1, height - 1), 0);
  });
}
