import { describe, expect, it } from 'vitest';

import type { FloorDoc } from './floor';
import {
  collapseNicknames,
  confirmQuestion,
  isUidInvite,
  memberRole,
  myInviteKey,
  parseInviteInput,
  saveErrorMessage,
  transferQuestion,
  transferTargets,
} from './membersView';

describe('Undang anggota by email or username (14 Nov 2026)', () => {
  it('reads an email as an email, lowercased', () => {
    expect(parseInviteInput('  Rina@Gmail.com ')).toEqual({ email: 'rina@gmail.com' });
    expect(parseInviteInput('rina@gmail')).toEqual({ error: 'Format email tidak valid.' });
  });

  it('reads anything else as a username, with or without @', () => {
    expect(parseInviteInput('@Dr.Rina')).toEqual({ handle: 'dr.rina' });
    expect(parseInviteInput('dr_rina')).toEqual({ handle: 'dr_rina' });
    expect(parseInviteInput('@a')).toEqual({ error: 'Minimal 3 karakter.' });
    expect(parseInviteInput('   ')).toEqual({ error: 'Tulis email Google atau username anggota.' });
  });

  it('tells uid keys from email keys', () => {
    expect(isUidInvite('rina@gmail.com')).toBe(false);
    expect(isUidInvite('Xy12abCDuid')).toBe(true);
  });

  it('accepts under the email when invited by email, else under the uid', () => {
    expect(myInviteKey({ inviteEmails: ['rina@gmail.com'] }, 'u1', 'Rina@gmail.com')).toBe('rina@gmail.com');
    expect(myInviteKey({ inviteEmails: ['u1'] }, 'u1', 'rina@gmail.com')).toBe('u1');
    expect(myInviteKey({ inviteEmails: ['u1'] }, 'u1', null)).toBe('u1');
  });
});

const floor = { ownerUid: 'o', roles: { o: 'edit', e: 'edit', v: 'view' } } as unknown as FloorDoc;

describe('Setelan list (26 Oct 2026)', () => {
  it('says why a write failed in words, never the raw error', () => {
    expect(saveErrorMessage({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toBe(
      'Tidak punya izin untuk perubahan ini. Hubungi pemilik list.',
    );
    expect(saveErrorMessage(new Error('boom'))).toBe('Gagal menyimpan. Coba lagi.');
    expect(saveErrorMessage('x')).toBe('Gagal menyimpan. Coba lagi.');
    expect(saveErrorMessage(undefined)).toBe('Gagal menyimpan. Coba lagi.');
  });

  it('the owner is always an editor; others read their stored role, view by default', () => {
    expect(memberRole(floor, 'o')).toBe('edit');
    expect(memberRole(floor, 'e')).toBe('edit');
    expect(memberRole(floor, 'v')).toBe('view');
    expect(memberRole(floor, 'stranger')).toBe('view');
  });

  it('names the person in the question, so the wrong row cannot be confirmed', () => {
    expect(confirmQuestion('remove', 'Dr. Contoh')).toBe('Keluarkan Dr. Contoh dari list?');
    expect(confirmQuestion('leave')).toBe('Keluar dari list ini?');
    expect(confirmQuestion('remove', '')).toBe('Keluarkan anggota ini dari list?');
  });

  it('handing the list over names the new owner and says what the old one keeps (28 Oct 2026)', () => {
    expect(transferQuestion('Dr. Contoh')).toBe('Jadikan Dr. Contoh pemilik list? Anda tetap menjadi editor.');
    expect(transferQuestion('')).toBe('Jadikan anggota ini pemilik list? Anda tetap menjadi editor.');
    // Only members other than the owner; an invited address is not a member yet.
    expect(transferTargets({ ownerUid: 'o', memberIds: ['o', 'e', 'v'] })).toEqual(['e', 'v']);
    expect(transferTargets({ ownerUid: 'o', memberIds: ['o'] })).toEqual([]);
  });

  it('a long sender list folds away; a short one stays open', () => {
    expect([0, 1, 5, 6, 40].map(collapseNicknames)).toEqual([false, false, false, true, true]);
  });
});
