import { describe, expect, it } from 'vitest';

import type { FloorDoc } from './floor';
import { collapseNicknames, confirmQuestion, memberRole, saveErrorMessage } from './membersView';

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

  it('a long sender list folds away; a short one stays open', () => {
    expect([0, 1, 5, 6, 40].map(collapseNicknames)).toEqual([false, false, false, true, true]);
  });
});
