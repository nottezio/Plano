import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isEmailInput, teammates, transferCopy, transferCopyId, transferTarget } from './transfer';

describe('transferCopy', () => {
  it("makes the recipient's own active copy and drops the sender's state", () => {
    const original = {
      id: 'p1', ownerId: 'sender', memberIds: ['sender'], name: 'X', notes: 'alergi',
      status: 'archived', archive: { reason: 'pindah' }, temporary: true, deletedAt: 5,
      transferTo: 'rekan', transferToName: 'R', transferFrom: { uid: 'sender', name: 'S' },
      createdAt: 1, updatedAt: 2,
    };
    const copy = transferCopy(original, 'rekan', transferCopyId('p1', 'rekan'));
    expect(copy).toEqual({
      id: 'p1_rekan', ownerId: 'rekan', memberIds: ['rekan'], name: 'X', notes: 'alergi',
      status: 'active', deletedAt: null,
    });
  });
});

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

  it('lets only the addressed account read, copy and archive the original', () => {
    expect(rules).toContain('data.transferTo == request.auth.token.email.lower()');
    // The recipient reads the notes to copy them, and leaves the sender's
    // original archived as "pindah" without ever owning it.
    expect(rules).toContain('isMember(pid) || isPendingRecipient(pid)');
    expect(rules).toContain("request.resource.data.archive.reason == 'pindah'");
    expect(rules).not.toContain('request.resource.data.ownerId == request.auth.uid\n             && request.resource.data.memberIds == [request.auth.uid]\n             && request.resource.data.status');
  });
});
