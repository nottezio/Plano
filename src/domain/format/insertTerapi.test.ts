import { describe, expect, it } from 'vitest';

import { insertIntoTerapi } from './insertTerapi';

const NOTE = [
  '*S:*',
  '- Sesak berkurang',
  '',
  '*Mohon izin kami terapi dengan*',
  '- Furosemide 40mg/8jam/iv',
  '- Atorvastatin 20mg/24jam/oral',
  '',
  'Selesai :',
  '- Norepinephrine (stop)',
  '',
  '*Plan*',
  '- Monitoring tanda vital',
  '',
  '*TS Pulmo*',
  'T/',
  '- Oksigen via NK 3 lpm',
].join('\n');

describe('insertIntoTerapi', () => {
  it('adds the line at the end of our running list, above "Selesai"', () => {
    const out = insertIntoTerapi(NOTE, '- Heparin 18 U/kgBB/jam');
    expect(out).toContain('- Atorvastatin 20mg/24jam/oral\n- Heparin 18 U/kgBB/jam\n\nSelesai :');
    expect(out?.indexOf('Heparin')).toBeLessThan(out?.indexOf('TS Pulmo') ?? 0);
  });

  it('adds it at the end of the Terapi section when there is no "Selesai"', () => {
    const note = NOTE.replace('Selesai :\n- Norepinephrine (stop)\n\n', '');
    expect(insertIntoTerapi(note, '- Heparin 18 U/kgBB/jam')).toContain(
      '- Atorvastatin 20mg/24jam/oral\n- Heparin 18 U/kgBB/jam\n\n*Plan*',
    );
  });

  it('refuses when the note has no Terapi section', () => {
    expect(insertIntoTerapi('*S:*\n- sesak', '- Heparin')).toBeNull();
  });
});
