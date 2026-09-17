import { describe, expect, it } from 'vitest';

import { firstSyncState, followRemoteState, pickRoster, toStorable } from './sync';

describe('pickRoster', () => {
  const imported = (at: string) => ({ importedAt: at });
  const march = imported('2026-09-01T10:00:00.000Z');
  const later = imported('2026-09-15T08:00:00.000Z');

  it('uploads when the account has none', () => {
    expect(pickRoster('jarkom', march, null)).toBe('upload');
  });

  it('downloads when this device has none', () => {
    expect(pickRoster('jarkom', null, march)).toBe('download');
  });

  it('falls back to the later import when nothing else differs', () => {
    expect(pickRoster('jarkom', later, march)).toBe('upload');
    expect(pickRoster('jarkom', march, later)).toBe('download');
  });

  it('moves nothing for the same version or when neither side has one', () => {
    expect(pickRoster('jarkom', march, { ...march })).toBe('same');
    expect(pickRoster('jarkom', null, null)).toBe('same');
  });

  it('keeps the later SCHEDULE even when the older one was imported later', () => {
    const september = { importedAt: '2026-09-01T00:00:00.000Z', shifts: [{ date: '2026-09-30' }] };
    const augustImportedLate = {
      importedAt: '2026-09-20T00:00:00.000Z',
      shifts: [{ date: '2026-08-31' }],
    };
    expect(pickRoster('roster', september, augustImportedLate)).toBe('upload');
  });
});

describe('firstSyncState', () => {
  it('uploads everything when the account is empty, and keeps it all locally', () => {
    const local = {
      sender: { name: 'Avi', place: 'PJT' },
      confirmed: { '2026-09-18:malam': ['igdA'] },
      names: { AV: 'Avicenna' },
    };
    const { merged, uploads } = firstSyncState(local, null);
    expect(merged.confirmed).toEqual(local.confirmed);
    expect(merged.names).toEqual(local.names);
    expect(uploads).toEqual([
      { field: 'sender', key: null, value: local.sender },
      { field: 'names', key: 'AV', value: 'Avicenna' },
      { field: 'confirmed', key: '2026-09-18:malam', value: ['igdA'] },
    ]);
  });

  it('lets the account win on a shared key, and uploads only local-only keys', () => {
    const local = { confirmed: { a: ['igdA'], b: ['cvcu'] } };
    const remote = { confirmed: { a: ['igdA', 'igdB'] } };
    const { merged, uploads } = firstSyncState(local, remote);
    expect(merged.confirmed).toEqual({ a: ['igdA', 'igdB'], b: ['cvcu'] });
    expect(uploads).toEqual([{ field: 'confirmed', key: 'b', value: ['cvcu'] }]);
  });

  it("keeps the account's sender over this device's", () => {
    const { merged, uploads } = firstSyncState(
      { sender: { name: 'lama', place: '' } },
      { sender: { name: 'baru', place: 'PJT' } },
    );
    expect(merged.sender).toEqual({ name: 'baru', place: 'PJT' });
    expect(uploads).toEqual([]);
  });

  it('ignores a malformed field rather than failing', () => {
    const { merged } = firstSyncState({ names: ['not', 'a', 'map'] as never }, null);
    expect(merged.names).toEqual({});
  });
});

describe('followRemoteState', () => {
  it('replaces each map, so a deletion on another device arrives', () => {
    const next = followRemoteState(
      { names: { AV: 'Avicenna', XY: 'Salah' } },
      { names: { AV: 'Avicenna' } },
    );
    expect(next.names).toEqual({ AV: 'Avicenna' });
  });

  it('leaves a field the account does not have yet', () => {
    const next = followRemoteState({ religion: { AV: true } }, { names: {} });
    expect(next.religion).toEqual({ AV: true });
  });
});

describe('toStorable', () => {
  it('drops undefined fields, which Firestore rejects', () => {
    expect(toStorable({ name: 'A', initials: undefined })).toEqual({ name: 'A' });
    expect('initials' in toStorable({ name: 'A', initials: undefined })).toBe(false);
  });
});
