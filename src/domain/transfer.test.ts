import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isEmailInput, teammates, transferTarget } from './transfer';

describe('isEmailInput', () => {
  it('tells an email from a username', () => {
    expect(isEmailInput('rina@gmail.com')).toBe(true);
    expect(isEmailInput(' @dr.rina ')).toBe(false);
    expect(isEmailInput('dr.rina')).toBe(false);
  });
});

describe('teammates', () => {
  it('lists everyone I share a list with once, without me, by name', () => {
    const floors = [
      { memberIds: ['me', 'b', 'a'], names: { me: 'Saya', a: 'Rina', b: 'Bima' } },
      { memberIds: ['me', 'a', 'c'], names: { me: 'Saya', a: 'Rina (lt 4)', c: '' } },
    ];
    expect(teammates(floors, 'me')).toEqual([
      { uid: 'b', name: 'Bima' },
      { uid: 'a', name: 'Rina' },
    ]);
  });
});

describe('transferTarget', () => {
  it('lowercases and trims, as the rules compare it', () => {
    expect(transferTarget('  Rekan.Dokter@Gmail.com ', 'me@gmail.com')).toEqual({
      email: 'rekan.dokter@gmail.com',
    });
  });

  it('refuses empty, malformed and own addresses', () => {
    expect(transferTarget('', null)).toHaveProperty('error');
    expect(transferTarget('rekan@', null)).toHaveProperty('error');
    expect(transferTarget('Me@Gmail.com', 'me@gmail.com')).toHaveProperty('error');
  });
});

describe('firestore.rules agrees with the transfer flow', () => {
  const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');

  it('lets only the addressed account read and take over the patient', () => {
    expect(rules).toContain('data.transferTo == request.auth.token.email.lower()');
    expect(rules).toContain('request.resource.data.memberIds == [request.auth.uid]');
    // Accepted patients land active; the client's acceptTransfer writes these keys.
    expect(rules).toContain("request.resource.data.status == 'active'");
    expect(rules).toMatch(/'status', 'archive', 'deletedAt', 'temporary'/);
  });
});
