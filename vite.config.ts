import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';

// SPEC 16 — the build reads the version from the one file that owns it.
// Never inline a literal here.
import { APP_VERSION } from './src/version.js';

/**
 * GitHub Pages has no SPA rewrite. Serving a copy of index.html as 404.html is
 * the supported workaround: Pages returns it (with a 404 status) for any
 * unknown path, the bundle boots, and React Router reads the real location.
 * The status code is cosmetic here — this app is not indexed (noindex) and has
 * no crawler contract.
 */
function emitSpaFallback() {
  return {
    name: 'visite-spa-fallback',
    apply: 'build' as const,
    closeBundle() {
      const source = path.resolve(__dirname, 'dist/index.html');
      if (existsSync(source)) {
        copyFileSync(source, path.resolve(__dirname, 'dist/404.html'));
      }
    },
  };
}

// "/" for a custom domain or <user>.github.io root repo;
// "/visite/" for https://<user>.github.io/visite/
const base = process.env['VITE_BASE'] ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // injectManifest, not generateSW: we own the activate handler that prunes
      // stale caches by CACHE_NAME (SPEC 16) and the skipWaiting gate that must
      // never fire while the editor is dirty (SPEC 17).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null, // registration happens in src/pwa.ts, explicitly
      manifest: {
        id: base,
        name: 'Plano',
        short_name: 'Plano',
        description: 'Catatan visite pasien — offline-first.',
        lang: 'id',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Bust the precache manifest whenever the app version changes.
        additionalManifestEntries: [{ url: base, revision: APP_VERSION }],
        dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
    emitSpaFallback(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2020',
    sourcemap: false, // SPEC 18: production builds must not ship note text paths
    rollupOptions: {
      output: {
        /**
         * Split the SDK out of the app chunk.
         *
         * Firebase is ~700 kB and changes on our schedule roughly never; app
         * code changes every phase. Keeping them in one chunk would force a
         * full re-download of the SDK on every deploy — over hospital wifi,
         * for a user who may be mid-round. Separate chunks let the browser and
         * the precache keep the stable half.
         */
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase';
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
