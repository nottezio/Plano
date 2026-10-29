import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { USERNAME_PATTERN, parseUsername } from './username';

describe('parseUsername', () => {
  it('drops the @ and lowercases', () => {
    expect(parseUsername('  @Dr.Rina_4 ')).toEqual({ handle: 'dr.rina_4' });
  });

  it('refuses short, long, spaced and badly bounded handles', () => {
    for (const raw of ['', 'ab', 'a'.repeat(21), 'dr rina', '.rina', 'rina_', 'rína']) {
      expect(parseUsername(raw)).toHaveProperty('error');
    }
  });
});

describe('firestore.rules agrees with the username pattern', () => {
  it('uses the same pattern and never allows listing', () => {
    const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
    expect(rules).toContain(`handle.matches('${USERNAME_PATTERN}')`);
    expect(rules).toMatch(/match \/usernames\/\{handle\}[\s\S]*?allow list: if false;/);
  });
});
