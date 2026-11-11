// Adds 0.0.1 to the version in package.json and package-lock.json.
// Each digit rolls over at 9: 0.1.9 → 0.2.0, 0.9.9 → 1.0.0.
// Usage: npm run version:bump

import { readFileSync, writeFileSync } from 'node:fs';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

export function nextVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Unexpected version "${version}" (expected x.y.z)`);
  let [major, minor, patch] = match.slice(1).map(Number);
  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }
  return `${major}.${minor}.${patch}`;
}

const pkg = read('package.json');
const next = nextVersion(pkg.version);
pkg.version = next;
write('package.json', pkg);

try {
  const lock = read('package-lock.json');
  lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  write('package-lock.json', lock);
} catch {
  /* no lockfile */
}

console.log(`Bezel version: ${next}`);
