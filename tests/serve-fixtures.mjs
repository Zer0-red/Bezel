// Serves tests/fixtures on 127.0.0.1 (default port 4174): the site Bezel's tests open in its devices.
// Usage: node tests/serve-fixtures.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./fixtures/', import.meta.url));
const port = Number(process.argv[2] || 4174);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  // A login like a dev server's: an HttpOnly session cookie, no expiry (/login?session=…),
  // and the cookies the browser sends back, sorted (/whoami).
  if (path === '/login' || path === '/whoami') {
    const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };
    if (path === '/login') headers['set-cookie'] = `session=${encodeURIComponent(url.searchParams.get('session') ?? '')}; Path=/; HttpOnly; SameSite=Lax`;
    res.writeHead(200, headers).end(path === '/login' ? 'ok' : (req.headers.cookie ?? '').split('; ').filter(Boolean).sort().join('; '));
    return;
  }
  const file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Fixture site on http://127.0.0.1:${port}`));
