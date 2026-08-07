/// <reference lib="webworker" />
/**
 * Plano service worker (SPEC 17).
 *
 * Two things this file must get right, both of them data-safety concerns
 * rather than performance concerns:
 *
 *  1. Cache names derive from CACHE_NAME (SPEC 16). Every deploy gets a fresh
 *     namespace and the `activate` handler deletes every *older* visite-*
 *     cache. Without this, a stale precached shell can outlive a schema change
 *     and render old code against new data.
 *
 *  2. skipWaiting is NEVER automatic. The page decides. Reloading under the
 *     user mid-sentence at a bedside is a data-loss event, so the new worker
 *     waits until the app confirms the editor is clean and posts SKIP_WAITING.
 */
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { setCacheNameDetails } from 'workbox-core';

import { APP_VERSION, CACHE_PREFIX } from './version.js';

declare let self: ServiceWorkerGlobalScope & {
  /** Injected at build time by vite-plugin-pwa (injectManifest strategy). */
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Must run before any cache is opened, including the precache.
setCacheNameDetails({
  prefix: CACHE_PREFIX.replace(/-$/, ''),
  suffix: APP_VERSION,
  precache: 'shell',
  runtime: 'runtime',
});

// __WB_MANIFEST is injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * SPA navigation fallback.
 *
 * Required for offline deep links (/p/:id/:date) and, on GitHub Pages,
 * required for them to work *at all* after the first load — Pages has no
 * server-side rewrite, so the 404.html copy handles the cold case and this
 * handles every warm one.
 */
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${self.registration.scope}index.html`), {
    denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
  }),
);

/** Fonts and icons: immutable, safe to serve from cache indefinitely. */
registerRoute(
  ({ request }) => request.destination === 'font' || request.destination === 'image',
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}assets-${APP_VERSION}`,
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

self.addEventListener('install', () => {
  // Deliberately no skipWaiting() here. See the file header.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter(
        (key) => key.startsWith(CACHE_PREFIX) && !key.includes(APP_VERSION),
      );
      await Promise.all(stale.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  // The page posts this only after confirming no editor is dirty (SPEC 17).
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: APP_VERSION });
  }
});
