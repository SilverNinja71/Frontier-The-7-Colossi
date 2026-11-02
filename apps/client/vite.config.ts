import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const PRIVATE_DIR = fileURLToPath(new URL('./private-assets', import.meta.url));

/**
 * Serves personal-use models from the git-ignored ./private-assets folder on the dev server
 * only. `vite build` and `vite preview` never include or serve them.
 */
function privateAssets(): Plugin {
  return {
    name: 'frontier-private-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/private-assets', (req, res) => {
        const name = decodeURIComponent((req.url ?? '/').split('?')[0]!.replace(/^\/+/, ''));
        res.setHeader('Cache-Control', 'no-store');
        if (name === 'manifest.json') {
          const models = existsSync(PRIVATE_DIR) ? readdirSync(PRIVATE_DIR).filter((f) => f.endsWith('.glb')) : [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ models }));
          return;
        }
        const file = path.join(PRIVATE_DIR, path.basename(name));
        if (!file.endsWith('.glb') || !existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', String(statSync(file).size));
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Relative asset URLs so the build runs from any CDN sub-path (CrazyGames, Poki, Steam/Electron file://).
  base: './',
  plugins: [react(), tailwindcss(), privateAssets()],
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
