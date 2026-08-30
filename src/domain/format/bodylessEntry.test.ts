import { describe, expect, it } from 'vitest';

import { composeCopy, resolveRange } from './composeCopy';
import { DEFAULT_SECTION_ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

/**
 * Empty Salin on a day with a visible note, 2026-08-31.
 *
 * `writeShiftNotes` materialises an entry document with `date`, `hariRawat`
 * and `shiftNotes` but NO `body` field — adding a jaga note to a day that has
 * no SOAP does exactly that. The symptom was a copy sheet reporting "(kosong)"
 * for a day whose note was visible behind it, and a rail that disagreed with
 * the copy sheet about which days had notes at all.
 *
 * Three separate faults lined up, and each is pinned below.
 */
describe('entry documents with no body field', () => {
  const options = {
    format: 'whatsapp' as const,
    sections: 'all' as const,
    includeIdentity: false,
    includeDateHeader: false,
    aliases: DEFAULT_SECTION_ALIASES,
    patient: makePatient({ name: 'Tn. A', mrn: '1' }),
    bullet: 'hyphen' as const,
  };

  it('composeCopy does not throw on a day with an empty body', () => {
    // It called `body.trim()`, which threw on `undefined` and surfaced as a
    // blank preview rather than as an error anyone could see.
    expect(() => composeCopy([{ date: '2026-08-31', body: '' }], options)).not.toThrow();
  });

  it('resolveRange cannot tell a body-less day from a real one', () => {
    // Which is precisely why a body-less entry must never reach it: it
    // matches on date alone, so it returned the empty day as the day to copy
    // while the note lived on the day beside it.
    const pool = [
      { date: '2026-08-31', body: '' },
      { date: '2026-08-30', body: '*S:*\nada isi' },
    ];
    expect(resolveRange({ range: 'today' }, pool, '2026-08-31')).toEqual([
      { date: '2026-08-31', body: '' },
    ]);
  });

  it('a real note still copies normally', () => {
    const out = composeCopy([{ date: '2026-08-31', body: '*S:*\nada isi' }], options);
    expect(out).toContain('ada isi');
  });
});
