import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build runs from any CDN sub-path (CrazyGames, Poki, Steam/Electron file://).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
    // Rapier's compat build inlines its WASM as base64 (~4.3 MB raw / 1.7 MB gzip) in its own
    // lazily-loaded chunk; everything else stays well under this.
    chunkSizeWarningLimit: 4500,
  },
  server: {
    host: true,
    port: 5173,
  },
});
