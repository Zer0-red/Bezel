// Tabs: another site, or another part of the same one (like its admin), on the same devices.
// main.js keeps a page per tab in every device; these are the parts that need no page.

import { normalizeUrl } from './url.js';

export const MAX_TABS = 8; // every tab keeps a live page in every device, so not too many

export const newTabId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const validUrl = (url) => typeof url === 'string' && (url === '' || normalizeUrl(url) === url);

/**
 * The saved tabs, cleaned up: `{ tabs: [{ id, url }], activeTab }`, never empty.
 * A state saved before there were tabs has only `url`, which becomes the one tab.
 */
export function restoreTabs({ tabs, activeTab, url } = {}) {
  const seen = new Set();
  const kept = (Array.isArray(tabs) ? tabs : [])
    .filter((t) => typeof t?.id === 'string' && /^[\w-]{1,40}$/.test(t.id) && validUrl(t.url) && !seen.has(t.id) && seen.add(t.id))
    .map((t) => ({ id: t.id, url: t.url }))
    .slice(0, MAX_TABS);
  if (!kept.length) kept.push({ id: newTabId(), url: validUrl(url) ? url : '' });
  return { tabs: kept, activeTab: kept.some((t) => t.id === activeTab) ? activeTab : kept[0].id };
}

/** A tab's name: the address without http(s)://, www. or the query, shortened in the middle so both ends show. */
export function tabLabel(url) {
  if (!url) return 'New tab';
  const text = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  return text.length > 30 ? `${text.slice(0, 14)}…${text.slice(-15)}` : text;
}
