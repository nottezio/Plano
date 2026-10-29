import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { transferTarget } from './transfer';

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
  });
});
