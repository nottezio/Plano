import { describe, expect, it } from 'vitest';

import { toPlain, toWhatsApp } from './formatters';
import {
  BOLD,
  normaliseBullets,
  restoreEmphasis,
  ITALIC,
  insertSectionHeader,
  toggleBullet,
  toggleNumbered,
  toggleWrap,
} from './markdownLite';

describe('toggleWrap', () => {
  it('wraps a selection', () => {
    const result = toggleWrap('sesak berat', 0, 5, BOLD);
    expect(result.text).toBe('*sesak* berat');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('sesak');
  });

  it('unwraps when the markers are inside the selection', () => {
    const result = toggleWrap('*sesak* berat', 0, 7, BOLD);
    expect(result.text).toBe('sesak berat');
  });

  it('unwraps when the markers sit just outside the selection', () => {
    const result = toggleWrap('*sesak* berat', 1, 6, BOLD);
    expect(result.text).toBe('sesak berat');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('sesak');
  });

  it('inserts an empty pair and parks the caret inside', () => {
    const result = toggleWrap('S: ', 3, 3, ITALIC);
    expect(result.text).toBe('S: __');
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('round-trips', () => {
    const once = toggleWrap('sesak', 0, 5, BOLD);
    const twice = toggleWrap(once.text, once.selectionStart, once.selectionEnd, BOLD);
    expect(twice.text).toBe('sesak');
  });
});

describe('toggleBullet', () => {
  it('bullets every selected line', () => {
    const text = 'O2 3 lpm\nCek DPL';
    const result = toggleBullet(text, 0, text.length);
    expect(result.text).toBe('- O2 3 lpm\n- Cek DPL');
  });

  it('removes bullets when every line already has one', () => {
    const text = '- O2 3 lpm\n- Cek DPL';
    expect(toggleBullet(text, 0, text.length).text).toBe('O2 3 lpm\nCek DPL');
  });

  it('leaves blank lines alone', () => {
    const text = 'O2 3 lpm\n\nCek DPL';
    expect(toggleBullet(text, 0, text.length).text).toBe('- O2 3 lpm\n\n- Cek DPL');
  });

  it('operates on the caret line when nothing is selected', () => {
    const text = 'S: sesak\nO2 3 lpm';
    const result = toggleBullet(text, 12, 12);
    expect(result.text).toBe('S: sesak\n- O2 3 lpm');
  });

  it('replaces numbering rather than stacking it', () => {
    const text = '1. O2 3 lpm';
    expect(toggleBullet(text, 0, text.length).text).toBe('- O2 3 lpm');
  });
});

describe('toggleNumbered', () => {
  it('numbers a block from 1', () => {
    const text = 'O2 3 lpm\nCek DPL\nKonsul';
    expect(toggleNumbered(text, 0, text.length).text).toBe(
      '1. O2 3 lpm\n2. Cek DPL\n3. Konsul',
    );
  });

  it('removes numbering when every line already has it', () => {
    const text = '1. O2\n2. DPL';
    expect(toggleNumbered(text, 0, text.length).text).toBe('O2\nDPL');
  });

  it('renumbers rather than trusting the existing digits', () => {
    const text = '- O2\n- DPL';
    expect(toggleNumbered(text, 0, text.length).text).toBe('1. O2\n2. DPL');
  });
});

describe('insertSectionHeader', () => {
  it('inserts at the caret when already at a line start', () => {
    const result = insertSectionHeader('S: sesak\n', 9, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: ');
    expect(result.selectionStart).toBe(result.text.length);
  });

  it('breaks the line first when the caret is mid-line', () => {
    const result = insertSectionHeader('S: sesak', 8, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: ');
  });

  it('keeps following text on its own line', () => {
    const result = insertSectionHeader('S: sesak\nA: pneumonia', 9, 'Penunjang');
    expect(result.text).toBe('S: sesak\nPenunjang: \nA: pneumonia');
  });

  it('produces a header the parser actually detects', () => {
    const result = insertSectionHeader('', 0, 'Penunjang');
    expect(result.text).toBe('Penunjang: ');
  });
});

describe('bold is the spelling that gets typed', () => {
  it('wraps in a single asterisk, as WhatsApp writes it', () => {
    expect(toggleWrap('sesak berat', 0, 5, BOLD).text).toBe('*sesak* berat');
  });

  it('round-trips: wrapping then unwrapping restores the text', () => {
    const wrapped = toggleWrap('sesak berat', 0, 5, BOLD);
    expect(toggleWrap(wrapped.text, 1, 6, BOLD).text).toBe('sesak berat');
  });

  it('is the spelling every formatter already accepts', () => {
    // Both spellings have been handled since the WhatsApp-paste work, so
    // storing the typed one costs nothing downstream.
    expect(toWhatsApp('*tebal*')).toBe('*tebal*');
    expect(toPlain('*tebal*')).toBe('tebal');
  });
});

describe('restoreEmphasis', () => {
  it('puts the markers back on headings a plain paste stripped', () => {
    const plain = ['S:', '- nyeri dada tidak ada', '', 'Plan:', '- Monitoring'].join('\n');
    const out = restoreEmphasis(plain);
    expect(out).toContain('*S:*');
    expect(out).toContain('*Plan:*');
    expect(out).toContain('- nyeri dada tidak ada');
  });

  it('italicises the DPJP and referral lines', () => {
    expect(restoreEmphasis('DPJP Utama : dr. A')).toBe('_DPJP Utama : dr. A_');
    expect(restoreEmphasis('Pasien dirujuk dari RSUD X')).toBe('_Pasien dirujuk dari RSUD X_');
  });

  it('emphasises a dated investigation heading', () => {
    expect(restoreEmphasis('EKG PJT Lt. 4 (19-08-2026)')).toBe('*EKG PJT Lt. 4 (19-08-2026)*');
  });

  it('leaves body text alone', () => {
    const body = '- Aspilet 80mg/24jam/oral';
    expect(restoreEmphasis(body)).toBe(body);
  });

  it('is idempotent — a line that already has markers is untouched', () => {
    const once = restoreEmphasis('S:');
    expect(restoreEmphasis(once)).toBe(once);
  });
});

describe('normaliseBullets', () => {
  it('turns the iPhone bullet into a hyphen', () => {
    expect(normaliseBullets('• Aspilet\n• Clopidogrel')).toBe('- Aspilet\n- Clopidogrel');
  });

  it('preserves indentation', () => {
    expect(normaliseBullets('  • Cek DPL')).toBe('  - Cek DPL');
  });

  it('leaves a mid-line bullet alone, which is never list syntax', () => {
    expect(normaliseBullets('nilai • penting')).toBe('nilai • penting');
  });
});

describe('the iPhone asterisk bullet', () => {
  it('converts `* ` at the start of a line', () => {
    const pasted = [
      '*Mohon izin kami terapi dengan:*',
      '* IVFD NaCl 0.9% 500 ml/24 jam/IV',
      '* Furosemide 40 mg/24 jam/IV',
    ].join('\n');

    const out = normaliseBullets(pasted);
    expect(out).toContain('- IVFD NaCl 0.9% 500 ml/24 jam/IV');
    expect(out).toContain('- Furosemide 40 mg/24 jam/IV');
  });

  it('leaves a bold heading alone', () => {
    // The difference is the space: `*Heading*` has none, `* item` does.
    expect(normaliseBullets('*Mohon izin kami terapi dengan:*')).toBe(
      '*Mohon izin kami terapi dengan:*',
    );
    expect(normaliseBullets('*Plan:*')).toBe('*Plan:*');
  });

  it('preserves indentation on a nested asterisk bullet', () => {
    expect(normaliseBullets('  * Cek DPL')).toBe('  - Cek DPL');
  });

  it('leaves a mid-line asterisk alone', () => {
    expect(normaliseBullets('Ceftriaxone 2*1 g')).toBe('Ceftriaxone 2*1 g');
  });
});

/**
 * The emphasis rules, as Avi stated them against the real note format.
 *
 * Each block names the rule it locks down, because the previous version of
 * this function held its own frozen list of heading regexes and drifted from
 * the parser silently — the failure was invisible until a note came out with
 * half its headings plain.
 */
describe('restoreEmphasis — confirmed rules', () => {
  it('bolds the identity line', () => {
    expect(restoreEmphasis('Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190')).toBe(
      '*Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190*',
    );
  });

  it('italicises the DPJP lines', () => {
    expect(restoreEmphasis('DPJP Kardio: dr. Zaenab Djafar, Sp.JP(K)')).toBe(
      '_DPJP Kardio: dr. Zaenab Djafar, Sp.JP(K)_',
    );
  });

  it('italicises every line between the identity and the first clinical heading', () => {
    /*
     * A ZONE, not a vocabulary. The previous version matched sentences —
     * `DPJP …`, `Pasien dikonsulkan untuk …`, `Rencana tindakan : …` — and was
     * always going to be incomplete. `Post Tindakan`, `Pasien rujukan dari`
     * and `Paska tindakan` are all in the corpus and none of them matched.
     *
     * Every seeded template puts the same kind of line here and nothing else:
     * who is looking after this patient, and why they are in.
     */
    const body = [
      'Assalamualaikum dokter.',
      'Mohon izin melaporkan pasien di PJT Lantai 5 Kamar 517 Bed 3 atas nama:',
      '',
      'Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190',
      '',
      'DPJP Utama dan Tindakan : dr. ZD',
      'Post Tindakan : PCI (Senin, 10-08-2026)',
      'Pasien rujukan dari RS Wahidin',
      'Paska tindakan CABG hari ke-3',
      'Rencana tindakan : PCI (Senin, 10-08-2026)',
      '',
      'S:',
      '- Sesak berkurang',
    ].join('\n');

    const out = restoreEmphasis(body).split('\n');
    // Above the identity line stays plain — the greeting and the reporting
    // sentence are not context about the episode.
    expect(out[0]).toBe('Assalamualaikum dokter.');
    expect(out[1]).toBe(
      'Mohon izin melaporkan pasien di PJT Lantai 5 Kamar 517 Bed 3 atas nama:',
    );
    expect(out[3]).toBe('*Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190*');
    for (const index of [5, 6, 7, 8, 9]) {
      expect(out[index]).toMatch(/^_.+_$/);
    }
    expect(out[11]).toBe('*S:*');
    expect(out[12]).toBe('- Sesak berkurang');
  });

  it('italicises the stock physical-exam sentence, which sits inside O', () => {
    // Below the clinical boundary, so the zone rule cannot reach it.
    expect(restoreEmphasis('*O:*\nPemeriksaan fisis dalam batas normal')).toBe(
      '*O:*\n_Pemeriksaan fisis dalam batas normal_',
    );
  });

  it('leaves the note alone when there is no clinical heading to bound the zone', () => {
    // An unbounded zone would italicise everything below the identity line.
    const body = 'Tn. Basra / 56 tahun / RM 1068190\nCatatan bebas tanpa judul apapun';
    expect(restoreEmphasis(body).split('\n')[1]).toBe('Catatan bebas tanpa judul apapun');
  });

  it('bolds the header only, leaving content on the same line plain', () => {
    // `*S: Sesak berkurang*` would bold the complaint along with the label,
    // which is a different claim about the note.
    expect(restoreEmphasis('S: Sesak berkurang')).toBe('*S:* Sesak berkurang');
  });

  it('bolds every heading the alias table names, not just S/O/A/P', () => {
    for (const [input, expected] of [
      ['Asesmen:', '*Asesmen:*'],
      ['Terapi:', '*Terapi:*'],
      ['Plan:', '*Plan:*'],
      ['Penunjang:', '*Penunjang:*'],
      ['O :', '*O :*'],
      ['Mohon izin kami assess dengan:', '*Mohon izin kami assess dengan:*'],
    ] as const) {
      expect(restoreEmphasis(input)).toBe(expected);
    }
  });

  it('leaves labels that are not headings of OUR note plain', () => {
    // All four parse as custom sections. They are labels inside the note, not
    // headings of it, and the seeded templates write them without markers.
    for (const line of [
      'Diagnosis Primer :',
      'Diagnosis Sekunder :',
      'Problem :',
      'Faktor resiko koroner:',
    ]) {
      expect(restoreEmphasis(line)).toBe(line);
    }
  });

  it('leaves measurements plain', () => {
    // A note bolding every vital sign is the striping bug the tint layer had.
    for (const line of ['Tekanan Darah : 120/80 mmHg', 'LVSV : 41,8 mL']) {
      expect(restoreEmphasis(line)).toBe(line);
    }
  });

  it('bolds a dated investigation heading, which carries no delimiter', () => {
    expect(restoreEmphasis('Laboratorium PJT (04-08-2026)')).toBe(
      '*Laboratorium PJT (04-08-2026)*',
    );
  });

  it('bolds a bare TS heading whole, and a TS heading with content by its header', () => {
    expect(restoreEmphasis('TS Neurologi')).toBe('*TS Neurologi*');
    expect(restoreEmphasis('TS BTKV: rencana CABG')).toBe('*TS BTKV:* rencana CABG');
  });

  it('stops emphasising once a TS block starts, and stays stopped at the next TS', () => {
    /*
     * A TS writes its own Diagnosis / Terapi / Plan. Emphasising them would
     * make another service's plan look like the one we are sending, in a
     * document whose whole purpose is to state what WE think should happen.
     */
    const body = [
      'Plan:',
      '- Echo',
      'TS Neurologi',
      'Diagnosis:',
      '- Stroke iskemik',
      'Terapi:',
      '- Aspilet',
      'TS BTKV: rencana CABG',
      'Plan:',
      '- Konsul anestesi',
    ].join('\n');

    expect(restoreEmphasis(body)).toBe(
      [
        '*Plan:*',
        '- Echo',
        '*TS Neurologi*',
        'Diagnosis:',
        '- Stroke iskemik',
        'Terapi:',
        '- Aspilet',
        '*TS BTKV:* rencana CABG',
        'Plan:',
        '- Konsul anestesi',
      ].join('\n'),
    );
  });

  it('is idempotent', () => {
    const body = 'Tn. Basra / RM 1068190\nS: Sesak\nTS BTKV: CABG\nPlan:';
    const once = restoreEmphasis(body);
    expect(restoreEmphasis(once)).toBe(once);
  });

  it('follows an alias added in Settings', () => {
    // The whole point of taking the vocabulary from the alias table: a heading
    // the parser learns, this button learns too.
    const aliases = [
      { sectionId: 's' as const, label: 'Subjektif', order: 1, aliases: ['Keluhan Utama'] },
    ];
    expect(restoreEmphasis('Keluhan Utama:', aliases)).toBe('*Keluhan Utama:*');
    expect(restoreEmphasis('Keluhan Utama:')).toBe('Keluhan Utama:');
  });
});
