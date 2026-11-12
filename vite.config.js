import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Relative asset paths so the build works from any folder or host
  // (GitHub Pages, and the desktop app loading dist/ from disk).
  base: './',
  define: {
    // Shown next to the name, top left (see npm run version:bump).
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    {
      // dist/version.json: an open web version checks it and offers a reload when a newer Bezel is out.
      name: 'bezel-version-file',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ version })}\n` });
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
});
