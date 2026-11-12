// Unit tests (node --test): the messages device pages send Bezel, the page scripts, version bumps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAGE_SCRIPT,
  CONSOLE_PREFIX,
  CLICK_PREFIX,
  ZOOM_PREFIX,
  scrollFromConsole,
  scrollFromMessage,
  clickFromConsole,
  clickFromMessage,
  pageFromMessage,
  zoomFromConsole,
} from '../../src/sync.js';
import { nextVersion } from '../../scripts/bump-version.mjs';

test('the page scripts are valid JavaScript', () => {
  assert.doesNotThrow(() => new Function(PAGE_SCRIPT));
  assert.doesNotThrow(() => new Function(readFileSync(new URL('../../public/sync.js', import.meta.url), 'utf8')));
});

test('scroll reports: ratio and the content at the top', () => {
  const anchors = [{ path: '#about>h2:nth-of-type(1)', tag: 'H2', text: 'About us', f: 0.25 }];
  assert.deepEqual(scrollFromConsole(CONSOLE_PREFIX + JSON.stringify({ ratio: 0.5, anchors })), { ratio: 0.5, anchors });
  assert.deepEqual(scrollFromMessage({ bezel: 'scroll', ratio: 0.5, anchors }), { ratio: 0.5, anchors });
});

test('scroll reports from older pages: a bare ratio', () => {
  assert.deepEqual(scrollFromConsole(`${CONSOLE_PREFIX}0.42`), { ratio: 0.42, anchors: [] });
  assert.deepEqual(scrollFromMessage({ bezel: 'scroll', ratio: 0.42 }), { ratio: 0.42, anchors: [] });
});

test('scroll reports are bounded and cleaned', () => {
  const good = { path: 'main>section:nth-of-type(2)', tag: 'SECTION', text: 'x'.repeat(100), f: 9 };
  const bad = [{ path: '', tag: 'P', f: 0 }, { path: 'p', tag: '<img>', f: 0 }, { path: 'p', tag: 'P', f: 'NaN' }, { path: 'x'.repeat(2000), tag: 'P', f: 0 }, null];
  const result = scrollFromConsole(CONSOLE_PREFIX + JSON.stringify({ ratio: 7, anchors: [...bad, ...Array(10).fill(good)] }));
  assert.equal(result.ratio, 1);
  assert.equal(result.anchors.length, 3); // only the first 8 entries are read; 5 of them are invalid
  assert.equal(result.anchors[0].text.length, 40);
  assert.equal(result.anchors[0].f, 2);
  assert.equal(scrollFromConsole(`${CONSOLE_PREFIX}{oops`), null);
  assert.equal(scrollFromConsole('something else'), null);
  assert.equal(scrollFromMessage({ bezel: 'scroll', ratio: 'far' }), null);
});

test('click reports: only well-formed web pages, tags and paths', () => {
  const click = { page: 'http://localhost:3000/', path: 'body>button:nth-of-type(2)', tag: 'BUTTON', text: 'Menu' };
  assert.deepEqual(clickFromConsole(CLICK_PREFIX + JSON.stringify(click)), click);
  assert.deepEqual(clickFromMessage({ bezel: 'click', ...click }), click);
  assert.equal(clickFromMessage({ bezel: 'click', ...click, page: 'javascript:alert(1)' }), null);
  assert.equal(clickFromMessage({ bezel: 'click', ...click, tag: 'svg onload=x' }), null);
  assert.equal(clickFromMessage({ bezel: 'click', ...click, path: '' }), null);
  assert.equal(clickFromConsole(`${CLICK_PREFIX}not json`), null);
});

test('page reports: only http(s) addresses', () => {
  assert.equal(pageFromMessage({ bezel: 'hello', url: 'http://localhost:3000/about' }), 'http://localhost:3000/about');
  assert.equal(pageFromMessage({ bezel: 'page', url: 'https://example.com/' }), 'https://example.com/');
  assert.equal(pageFromMessage({ bezel: 'page', url: 'file:///etc/passwd' }), null);
  assert.equal(pageFromMessage({ bezel: 'hello' }), null);
});

test('zoom steps from pinches and Ctrl + wheel', () => {
  assert.deepEqual(zoomFromConsole(`${ZOOM_PREFIX}-12.5:100:200`), { deltaY: -12.5, x: 100, y: 200 });
  assert.equal(zoomFromConsole(`${ZOOM_PREFIX}a:b:c`), null);
});

test('version bumps add 0.0.1 and roll over at 9', () => {
  assert.equal(nextVersion('0.2.7'), '0.2.8');
  assert.equal(nextVersion('0.2.9'), '0.3.0');
  assert.equal(nextVersion('0.9.9'), '1.0.0');
  assert.throws(() => nextVersion('1.2'));
});
