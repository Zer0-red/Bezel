// Unit tests (node --test): saved tabs and tab names (src/tabs.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TABS, restoreTabs, tabLabel } from '../../src/tabs.js';

test('a state saved before tabs becomes one tab with its address', () => {
  const { tabs, activeTab } = restoreTabs({ url: 'http://localhost:3000/' });
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].url, 'http://localhost:3000/');
  assert.equal(activeTab, tabs[0].id);
  assert.match(tabs[0].id, /^[\w-]{1,40}$/);
});

test('a first start has one empty tab', () => {
  const { tabs, activeTab } = restoreTabs({});
  assert.deepEqual(tabs.map((t) => t.url), ['']);
  assert.equal(activeTab, tabs[0].id);
});

test('saved tabs come back in order, with the one that was in front', () => {
  const saved = [
    { id: 'site', url: 'http://localhost:3000/' },
    { id: 'admin', url: 'http://localhost:3000/admin' },
  ];
  assert.deepEqual(restoreTabs({ tabs: saved, activeTab: 'admin', url: 'http://localhost:3000/admin' }), { tabs: saved, activeTab: 'admin' });
});

test('broken or unsafe saved tabs are dropped, and a missing front tab falls back to the first', () => {
  const { tabs, activeTab } = restoreTabs({
    tabs: [
      { id: 'a', url: 'javascript:alert(1)' },
      { id: 'b', url: 'http://localhost:3000/' },
      { id: 'b', url: 'http://localhost:4000/' }, // same id twice
      { id: '<img>', url: '' },
      { url: 'http://localhost:5000/' },
      null,
      { id: 'c', url: '' },
      { id: 'd', url: 'localhost:3000' }, // not a normalised address
    ],
    activeTab: 'gone',
  });
  assert.deepEqual(tabs, [
    { id: 'b', url: 'http://localhost:3000/' },
    { id: 'c', url: '' },
  ]);
  assert.equal(activeTab, 'b');
});

test(`at most ${MAX_TABS} tabs come back`, () => {
  const saved = Array.from({ length: MAX_TABS + 3 }, (_, i) => ({ id: `t${i}`, url: '' }));
  assert.equal(restoreTabs({ tabs: saved }).tabs.length, MAX_TABS);
});

test('tab names: short addresses, both ends kept when long', () => {
  assert.equal(tabLabel(''), 'New tab');
  assert.equal(tabLabel('http://localhost:3000/'), 'localhost:3000');
  assert.equal(tabLabel('http://localhost:3000/admin'), 'localhost:3000/admin');
  assert.equal(tabLabel('https://www.example.com/wp-admin/?page=x#top'), 'example.com/wp-admin');
  const long = tabLabel('https://shop.example-company.com/admin/orders/pending');
  assert.ok(long.length <= 30, long);
  assert.ok(long.startsWith('shop.example-c'), long);
  assert.ok(long.endsWith('orders/pending'), long);
});
