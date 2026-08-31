import { describe, expect, it } from 'vitest';

import { composeShiftNote } from './composeShiftNote';
import { makePatient } from '../testFactories';
import type { ShiftNote } from '../types';

const PATIENT = makePatient({
  name: 'Tn. Muh. Djasmani Djafar',
  mrn: '134048',
  age: 53,
  ward: 'PJT Lt. 4',
  room: '402',
});

const NOTE: ShiftNote = {
  id: 'jaga-1',
  time: '23.42',
  body: '*S:*\n- Nyeri dada tengah sejak 30 menit lalu.\n\n*O:*\nSuhu : 36.8 °C',
  clearedAt: null,
  createdAt: null as never,
};

const BASE = { format: 'whatsapp' as const, bullet: 'hyphen' as const, includeIdentity: true };

describe('composeShiftNote', () => {
  it('names it as a jaga note and carries the time', () => {
    // A bare paragraph of findings reads as a second morning note, and the
    // clock time is the load-bearing fact about a shift complaint.
    expect(composeShiftNote(NOTE, PATIENT, BASE)).toContain('*SOAP Jaga 23.42*');
  });

  it('carries an identity line so the reader knows whose chart it is', () => {
    const out = composeShiftNote(NOTE, PATIENT, BASE);
    expect(out).toContain('Tn. Muh. Djasmani Djafar');
    expect(out).toContain('RM 134048');
    expect(out).toContain('PJT Lt. 4 Kamar 402');
  });

  it('omits identity when asked', () => {
    const out = composeShiftNote(NOTE, PATIENT, { ...BASE, includeIdentity: false });
    expect(out).not.toContain('RM 134048');
    expect(out).toContain('*SOAP Jaga 23.42*');
  });

  it('guarantees ASCII for SIMGOS', () => {
    // Same `?` problem as any other text; no reason to solve it twice.
    const out = composeShiftNote(NOTE, PATIENT, { ...BASE, format: 'plain' });
    expect(out).not.toMatch(/[^\x00-\x7F]/);
    expect(out).toContain('Nyeri dada tengah');
  });

  it('keeps WhatsApp emphasis intact', () => {
    const out = composeShiftNote(NOTE, PATIENT, BASE);
    expect(out).toContain('*S:*');
  });

  it('stands alone — it never pulls in the day\u2019s SOAP', () => {
    const out = composeShiftNote(NOTE, PATIENT, BASE);
    expect(out).not.toContain('Mohon izin kami');
  });

  it('does not leave a blank heading for an empty note', () => {
    const empty = { ...NOTE, body: '   ' };
    expect(composeShiftNote(empty, PATIENT, BASE).trimEnd().endsWith('*SOAP Jaga 23.42*')).toBe(
      true,
    );
  });
});
