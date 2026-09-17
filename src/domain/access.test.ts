import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ADMIN_UID, REGISTRY_KEYS, decideAccess, isDue } from './access';

const RULES = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');

describe('decideAccess', () => {
  const user = 'someone';

  it('always lets the admin in, whatever the switch or record says', () => {
    expect(decideAccess({ uid: ADMIN_UID, enforce: null, status: undefined })).toBe('allowed');
    expect(decideAccess({ uid: ADMIN_UID, enforce: true, status: 'revoked' })).toBe('allowed');
  });

  it('lets everyone in while the switch is off', () => {
    expect(decideAccess({ uid: user, enforce: false, status: null })).toBe('allowed');
    expect(decideAccess({ uid: user, enforce: false, status: 'revoked' })).toBe('allowed');
  });

  it('with the switch on, follows the record', () => {
    expect(decideAccess({ uid: user, enforce: true, status: 'approved' })).toBe('allowed');
    expect(decideAccess({ uid: user, enforce: true, status: 'pending' })).toBe('pending');
    expect(decideAccess({ uid: user, enforce: true, status: 'revoked' })).toBe('revoked');
  });

  it('treats a missing record as waiting for approval', () => {
    expect(decideAccess({ uid: user, enforce: true, status: null })).toBe('pending');
  });

  it('never refuses before the answer is known', () => {
    expect(decideAccess({ uid: user, enforce: null, status: 'approved' })).toBe('unknown');
    expect(decideAccess({ uid: user, enforce: true, status: undefined })).toBe('unknown');
  });
});

describe('isDue', () => {
  it('is due the first time, after the interval, and for a corrupt stamp', () => {
    expect(isDue(null, 1000, 500)).toBe(true);
    expect(isDue(0, 1000, 500)).toBe(true);
    expect(isDue(Number.NaN, 1000, 500)).toBe(true);
    expect(isDue(800, 1000, 500)).toBe(false);
  });
});

/**
 * The rules and this file state the same facts twice, because rules cannot
 * import TypeScript. These tests are what keep them from drifting.
 */
describe('firestore.rules agrees with the client', () => {
  it('names the same admin', () => {
    expect(RULES).toContain(`request.auth.uid == '${ADMIN_UID}'`);
    // Exactly one admin UID literal: a second would be a second admin.
    expect(RULES.match(/request\.auth\.uid == '[A-Za-z0-9]{20,}'/g)).toHaveLength(1);
  });

  it('lets users write exactly the registry fields', () => {
    const match = /function registryKeys\(\) \{\s*return \[([^\]]*)\];/.exec(RULES);
    expect(match).not.toBeNull();
    const keys = (match?.[1] ?? '').split(',').map((key) => key.trim().replace(/'/g, ''));
    expect(keys).toEqual([...REGISTRY_KEYS]);
  });

  it('gates every data path, leaving only the bootstrap reads open', () => {
    // `authed()` alone may appear only in the helper definitions, the own-
    // profile rules, the config read and the access self-service rules.
    const bare = RULES.split('\n').filter(
      (line) => /authed\(\)/.test(line) && !/allowed\(\)|function /.test(line),
    );
    expect(bare.length).toBeLessThanOrEqual(6);
  });
});
