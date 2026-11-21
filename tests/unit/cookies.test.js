// Unit tests (node --test): bringing back saved session cookies in the app (electron/cookies.cjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { cookieDetails } = createRequire(import.meta.url)('../../electron/cookies.cjs');

test('a host-only session cookie comes back for the same host only, still without an expiry', () => {
  const cookie = { name: 'session', value: 'abc', domain: 'localhost', hostOnly: true, path: '/', secure: false, httpOnly: true, session: true, sameSite: 'lax' };
  assert.deepEqual(cookieDetails(cookie), { url: 'http://localhost/', name: 'session', value: 'abc', path: '/', secure: false, httpOnly: true, sameSite: 'lax' });
});

test('a cookie for a domain and its subdomains keeps its domain; a secure one gets an https address', () => {
  const cookie = { name: 'sid', value: '1', domain: '.example.test', hostOnly: false, path: '/app', secure: true, httpOnly: false, sameSite: 'no_restriction' };
  assert.deepEqual(cookieDetails(cookie), { url: 'https://example.test/app', name: 'sid', value: '1', domain: '.example.test', path: '/app', secure: true, httpOnly: false, sameSite: 'no_restriction' });
});

test('IP addresses work, and a missing path or same-site policy gets the defaults', () => {
  assert.equal(cookieDetails({ name: 'a', value: 'b', domain: '127.0.0.1', hostOnly: true }).url, 'http://127.0.0.1/');
  assert.equal(cookieDetails({ name: 'a', value: 'b', domain: '[::1]', hostOnly: true }).url, 'http://[::1]/');
  assert.equal(cookieDetails({ name: 'a', value: 'b', domain: 'localhost', path: 'x', sameSite: 'bogus' }).sameSite, 'unspecified');
  assert.equal(cookieDetails({ name: 'a', value: 'b', domain: 'localhost', path: 'x' }).path, '/');
});

test('anything that is not a well-formed cookie is left out', () => {
  for (const bad of [
    null,
    'session=abc',
    { name: 'a', value: 'b' },
    { name: 'a', value: 'b', domain: '' },
    { name: 'a', value: 'b', domain: 'evil.test/path' },
    { name: 'a', value: 'b', domain: 'user@evil.test' },
    { name: 'a', value: 'b', domain: 'evil.test:8080' },
    { name: 'a', value: 7, domain: 'localhost' },
    { name: 'a', value: 'x'.repeat(5000), domain: 'localhost' },
  ]) {
    assert.equal(cookieDetails(bad), null, JSON.stringify(bad));
  }
});
