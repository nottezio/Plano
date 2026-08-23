/**
 * SPEC 16 — VERSIONING PROTOCOL.
 *
 * This file is the ONLY place in the repository where a version string may
 * exist. Every consumer (app UI, service worker, vite config, manifest)
 * imports from here. Never copy the literal anywhere else.
 *
 * Format: YYYY-MM-DD.N  (N increments for same-day builds)
 * Bump this in the SAME edit as any shipping change (JS, CSS, cache-relevant
 * asset) — never as a follow-up commit.
 *
 * Verify with: npm run check:version
 */
export const APP_VERSION = '2026-08-23.1';

/** Service-worker cache namespace. All caches derive from this prefix. */
export const CACHE_NAME = `visite-${APP_VERSION}`;

/** Prefix used by the activate handler to identify *our* caches for pruning. */
/**
 * Deliberately still `visite-`, not `plano-`.
 *
 * The service worker's activate handler deletes stale caches by matching this
 * prefix. Renaming it would orphan every cache already installed on a device —
 * nothing would ever match them again, so they would sit there forever. The
 * prefix is invisible to users; the leak would not be.
 */
export const CACHE_PREFIX = 'visite-';
