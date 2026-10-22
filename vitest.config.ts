import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Separate from vite.config.ts on purpose: the app config carries the PWA
 * plugin, which has no business running during a unit test.
 *
 * `TZ=UTC` for the process is deliberate — the clinical-date tests must fail
 * if any helper leaks the host timezone into its result. A machine already
 * set to Asia/Jakarta would hide exactly that class of bug.
 *
 * Set here, not as `TZ=UTC vitest` in package.json: npm runs scripts through
 * cmd on Windows, which reads `TZ=UTC` as a command name. Workers inherit it.
 * `src/testTimezone.test.ts` fails if it ever stops applying.
 */
process.env.TZ = 'UTC';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'dot',
  },
});
