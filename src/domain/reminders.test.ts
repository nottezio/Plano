import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REMINDER_KINDS,
  activeReminders,
  newReminderId,
  reminderMode,
  toggleReminderDone,
} from './reminders';

const today = '2026-09-30';

describe('daily reminders', () => {
  it('a today-only reminder expires by itself; a standing one does not', () => {
    const patient = {
      reminders: { ekg: { mode: 'hari-ini' as const, date: '2026-09-29' }, uo: { mode: 'harian' as const } },
    };
    expect(reminderMode(patient, 'ekg', today)).toBeNull();
    expect(reminderMode(patient, 'ekg', '2026-09-29')).toBe('hari-ini');
    expect(reminderMode(patient, 'uo', today)).toBe('harian');
  });

  it('reads the old EKG fields until a reminder is set, and "off" wins over them', () => {
    expect(reminderMode({ ekgHarian: true }, 'ekg', today)).toBe('harian');
    expect(reminderMode({ ekgFor: today }, 'ekg', today)).toBe('hari-ini');
    expect(reminderMode({ ekgHarian: true, reminders: { ekg: { mode: 'off' } } }, 'ekg', today)).toBeNull();
  });

  it('ticks belong to one day and never carry over', () => {
    const ticked = toggleReminderDone(undefined, 'uo', today);
    expect(ticked).toEqual({ date: today, ids: ['uo'] });
    const patient = { reminders: { uo: { mode: 'harian' as const } }, reminderDone: ticked };
    expect(activeReminders(patient, DEFAULT_REMINDER_KINDS, today)[0]?.done).toBe(true);
    expect(activeReminders(patient, DEFAULT_REMINDER_KINDS, '2026-10-01')[0]?.done).toBe(false);
    expect(toggleReminderDone(ticked, 'uo', today).ids).toEqual([]);
    expect(toggleReminderDone(ticked, 'ekg', '2026-10-01')).toEqual({ date: '2026-10-01', ids: ['ekg'] });
  });

  it('makes unique ids for new kinds', () => {
    expect(newReminderId('Cek GDS', DEFAULT_REMINDER_KINDS)).toBe('cek-gds');
    expect(newReminderId('EKG', DEFAULT_REMINDER_KINDS)).toBe('ekg-2');
  });
});

describe('procedure reminders (ICU post-op, dr. Nuralim Mallapasi)', () => {
  it('appears on H-1 for MNM patients, on any DPJP line', async () => {
    const { activeReminders, DEFAULT_REMINDER_KINDS: kinds } = await import('./reminders');
    const patient = { operationFor: '2026-10-03', dpjpId: 'zd', dpjpIds: ['zd', 'mnm'] };
    expect(activeReminders(patient, kinds, '2026-10-02').map((r) => r.label)).toEqual(['Konsul ICU post-op']);
    expect(activeReminders(patient, kinds, '2026-10-03')).toEqual([]);
    expect(activeReminders(patient, kinds, '2026-10-01')).toEqual([]);
  });

  it('not for other consultants, and ticks like any reminder', async () => {
    const { activeReminders, DEFAULT_REMINDER_KINDS: kinds } = await import('./reminders');
    expect(activeReminders({ operationFor: '2026-10-03', dpjpId: 'zd' }, kinds, '2026-10-02')).toEqual([]);
    const done = activeReminders(
      { operationFor: '2026-10-03', dpjpIds: ['mnm'], reminderDone: { date: '2026-10-02', ids: ['icu-postop'] } },
      kinds,
      '2026-10-02',
    );
    expect(done[0]?.done).toBe(true);
  });
});

describe('MNM is not confused with dr. Zulfadly Nuralim', () => {
  it('attributes only the Mallapasi spelling', async () => {
    const { detectDpjps } = await import('./dpjp');
    expect(detectDpjps('_DPJP BTKV : dr. Muhammad Nuralim Mallapasi, Sp.BTKV_').map((d) => d.id)).toContain('mnm');
    expect(detectDpjps('_DPJP BTKV (Utama) : dr. Muhammad Zulfadly Nuralim, Sp.BTKV_').map((d) => d.id)).not.toContain('mnm');
  });
});
