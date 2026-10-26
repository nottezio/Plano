import { describe, expect, it } from 'vitest';

import { daySummary, daySummaryText, moveKind, movesByDay, movements, weekCounts } from './analysis';
import { localStamp, newRosterPatient, type Edition, type RosterPatient } from './floor';
import type { FloorPatient } from './report';

const p = (key: string, over: Partial<FloorPatient> = {}): FloorPatient => ({ key, name: key, room: '417', bed: '1', ...over }) as FloorPatient;
/** An ISO time whose local clock reads `stamp` (the tests run in any zone). */
const iso = (stamp: string): string => new Date(`${stamp}:00`).toISOString();

function rostered(key: string, log: Array<[string, string]>, state: Partial<RosterPatient> = {}): RosterPatient {
  const base = newRosterPatient(p(key), iso('2026-10-10T08:00'), 'Bima');
  return { ...base, log: log.map(([at, what]) => ({ at: iso(at), by: 'Bima', what })), ...state };
}

describe('Analisis (13.12)', () => {
  it('reads the kind of a change from the wording the app logs', () => {
    expect(['Masuk list', 'Masuk lagi (dari Tempel)', 'Dikembalikan ke list', 'Pulang', 'Pindah ke ICU', 'Pindah kamar 417/1 → 420/2', 'H-1 (merah)', 'Rencana pulang 14/10/2026', 'Tag Pre-op'].map(moveKind)).toEqual([
      'masuk', 'masuk', 'masuk', 'pulang', 'pindah', 'kamar', 'rencana', 'rencana', 'lain',
    ]);
  });

  it('a day: who went home, left, moved room or came in; who is green or red now', () => {
    const roster = [
      rostered('a', [['2026-10-12T08:00', 'Masuk list'], ['2026-10-13T10:00', 'Pulang']], { status: 'pulang', leftAt: iso('2026-10-13T10:00') }),
      rostered('b', [['2026-10-13T07:00', 'Masuk list'], ['2026-10-13T09:00', 'Pindah kamar 417/1 → 420/2']]),
      rostered('c', [['2026-10-13T11:00', 'Pindah ke ICU']], { status: 'pindah', pindahKe: 'ICU', leftAt: iso('2026-10-13T11:00') }),
      rostered('d', [['2026-10-12T22:00', 'Pulang']], { status: 'pulang', leftAt: iso('2026-10-12T22:00') }),
    ];
    const active = [p('b', { discharge: 'today' }), p('e', { discharge: 'tomorrow' }), p('f')];
    const moves = movements(roster);
    expect(moves[0]!.what).toBe('Pindah ke ICU');
    const day = daySummary('2026-10-13', roster, active, moves);
    expect(day.pulang.map((x) => x.key)).toEqual(['a']);
    expect(day.pindah.map((x) => x.key)).toEqual(['c']);
    expect(day.kamar.map((m) => m.key)).toEqual(['b']);
    expect(day.masuk.map((m) => m.key)).toEqual(['b']);
    expect(day.pulangHariIni.map((x) => x.key)).toEqual(['b']);
    expect(day.rencanaH1.map((x) => x.key)).toEqual(['e']);
  });

  it('usul H-1 is its own kind, not a plan: marked, cancelled, and accepted (26 Oct 2026)', () => {
    expect(['Usul H-1 (dari saran Plan)', 'Usul H-1 dibatalkan', 'H-1 (usul disetujui)'].map(moveKind)).toEqual(['usul', 'usul', 'rencana']);
  });

  it('a day lists the open usul H-1 apart from the firm H-1, with how long each has waited', () => {
    const roster = [
      rostered('u', [['2026-10-11T09:00', 'Usul H-1 (dari saran Plan)']], { usulH1: '2026-10-11' }),
      rostered('v', [['2026-10-13T09:00', 'Usul H-1 (dari saran Plan)']], { usulH1: '2026-10-13' }),
      rostered('w', [['2026-10-11T09:00', 'Usul H-1 (dari saran Plan)']], { usulH1: '2026-10-11', status: 'pulang', leftAt: iso('2026-10-12T10:00') }),
      rostered('x', []),
    ];
    const active = [p('u', { usul: true }), p('v', { usul: true }), p('e', { discharge: 'tomorrow' })];
    const day = daySummary('2026-10-13', roster, active, movements(roster));
    expect(day.usulH1.map((u) => [u.patient.key, u.days])).toEqual([['u', 2], ['v', 0]]);
    expect(day.rencanaH1.map((x) => x.key)).toEqual(['e']);
  });

  it('a week of counts, with the census of the day\'s last saved list', () => {
    const roster = [rostered('a', [['2026-10-13T08:00', 'Masuk list'], ['2026-10-13T10:00', 'Pulang']]), rostered('b', [['2026-10-11T07:00', 'Masuk list']])];
    const editions = [
      { date: '2026-10-13', patients: [p('x'), p('y')] },
      { date: '2026-10-13', patients: [p('x')] },
      { date: '2026-10-12', patients: [p('x'), p('y'), p('z')] },
    ] as unknown as Edition[];
    const week = weekCounts('2026-10-13', movements(roster), editions, 3);
    expect(week).toEqual([
      { date: '2026-10-11', masuk: 1, pulang: 0, pindah: 0, kamar: 0, census: null },
      { date: '2026-10-12', masuk: 0, pulang: 0, pindah: 0, kamar: 0, census: 3 },
      { date: '2026-10-13', masuk: 1, pulang: 1, pindah: 0, kamar: 0, census: 2 },
    ]);
    expect(localStamp(new Date(iso('2026-10-13T10:00')))).toBe('2026-10-13T10:00');
  });

  it('the day as a WhatsApp message: DPJP added, no clock times (2026-10-14)', () => {
    const roster = [
      rostered('a', [['2026-10-13T10:13', 'Pulang']], { status: 'pulang', leftAt: iso('2026-10-13T10:13'), report: p('a', { name: 'Tn. Satu', room: '413', bed: '2', dpjpId: 'aha' }) }),
      rostered('c', [['2026-10-13T13:28', 'Pindah ke CVCU'], ['2026-10-13T13:30', 'Dikembalikan ke list']], {
        status: 'pindah',
        pindahKe: 'CVCU',
        leftAt: iso('2026-10-13T13:28'),
        report: p('c', { name: 'Ny. Dua', room: '421', bed: '1', dpjpId: 'zd' }),
      }),
      rostered('n', [['2026-10-13T14:23', 'Masuk list']], { report: p('n', { name: 'Tn. Tiga', room: '413', bed: '1', dpjpCode: 'TM' }) }),
    ];
    const active = [
      p('g', { name: 'Tn. Empat', room: '420', bed: '4', dpjpId: null, kjsDpjpIds: ['mz'], discharge: 'today' }),
    ];
    const text = daySummaryText(daySummary('2026-10-13', roster, active, movements(roster)), 'PJT Lantai 4');
    expect(text).toBe(
      [
        '*Ringkasan PJT Lantai 4 — 13/10/2026*',
        '',
        '*Rencana pulang hari ini (masih di lantai) (1)*',
        '420/4 MZ/Tn. Empat',
        '*Rencana H-1 (pulang besok) (0)*',
        '-',
        '*Usul H-1 (menunggu konfirmasi DPJP) (0)*',
        '-',
        '',
        '*Sudah pulang (1)*',
        '413/2 AHA/Tn. Satu',
        '*Pindah ruangan (1)*',
        '421/1 ZD/Ny. Dua - ke CVCU',
        '*Pindah kamar (di lantai ini) (0)*',
        '-',
        '',
        '*Masuk list (2)*',
        '413/1 TM/Tn. Tiga - baru',
        '421/1 ZD/Ny. Dua - dikembalikan ke list',
      ].join('\n'),
    );
    expect(text).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('the WhatsApp message names the usul H-1 and its wait', () => {
    const roster = [rostered('u', [], { usulH1: '2026-10-11', report: p('u', { name: 'Tn. Lima', room: '417', bed: '2', dpjpId: 'zd' }) })];
    const active = [p('u', { name: 'Tn. Lima', room: '417', bed: '2', dpjpId: 'zd', usul: true })];
    const text = daySummaryText(daySummary('2026-10-13', roster, active, []), 'PJT Lantai 4');
    expect(text).toContain('*Usul H-1 (menunggu konfirmasi DPJP) (1)*\n417/2 ZD/Tn. Lima - usul sejak 2 hari');
    expect(daySummaryText(daySummary('2026-10-13', [rostered('v', [], { usulH1: '2026-10-13' })], [p('v', { name: 'Tn. Enam', kjsDpjpIds: [], usul: true })], []), 'W')).toContain('usul hari ini');
  });

  it('groups the history by day, newest day first, each day newest first (2026-10-16)', () => {
    const roster = [
      rostered('a', [['2026-10-12T08:00', 'Masuk list'], ['2026-10-13T10:00', 'Pulang']]),
      rostered('b', [['2026-10-13T07:00', 'Masuk list'], ['2026-10-12T21:00', 'H-1 (merah)']]),
    ];
    const days = movesByDay(movements(roster));
    expect(days.map((d) => [d.date, d.moves.map((m) => m.at.slice(11))])).toEqual([
      ['2026-10-13', ['10:00', '07:00']],
      ['2026-10-12', ['21:00', '08:00']],
    ]);
  });
});
