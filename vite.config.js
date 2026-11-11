import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any folder or host (e.g. GitHub Pages).
  base: './',
  server: {
    port: 5173,
    open: true,
  },
});
