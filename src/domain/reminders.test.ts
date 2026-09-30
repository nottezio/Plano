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
