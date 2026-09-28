import { describe, expect, it } from 'vitest';

import { locateQuote, parseSoapReview, soapReviewSystem } from './soapReview';

const NOTE = '*A:*\n- ADHF ec CAD\n- Hipokalemia (2.9)\n*P:*\n- Furosemid 40 mg iv tiap 12 jam\n- Furosemid 20 mg po';

describe('locateQuote', () => {
  it('finds a quote regardless of case and spacing', () => {
    expect(locateQuote(NOTE, 'furosemid  40 MG iv')?.at).toBe(NOTE.indexOf('Furosemid 40'));
  });

  it('strips the quotation marks a model likes to add', () => {
    expect(locateQuote(NOTE, '“Hipokalemia (2.9)”')?.text).toBe('Hipokalemia (2.9)');
  });

  it('returns null for text that is not in the note', () => {
    expect(locateQuote(NOTE, 'Spironolakton 25 mg')).toBeNull();
  });
});

describe('parseSoapReview', () => {
  it('keeps grounded findings, points at them, and orders them by urgency', () => {
    const result = parseSoapReview(
      {
        temuan: [
          { kategori: 'cek', pesan: 'Furosemid tertulis dua kali dengan dosis berbeda.', kutipan: 'Furosemid 20 mg po' },
          { kategori: 'isi', pesan: 'Hipokalemia belum ada rencananya di P.', kutipan: 'Hipokalemia (2.9)' },
        ],
      },
      NOTE,
    );
    expect(result.dropped).toBe(0);
    expect(result.findings.map((f) => f.level)).toEqual(['isi', 'cek']);
    expect(NOTE.slice(result.findings[0]!.at).startsWith('Hipokalemia')).toBe(true);
  });

  it('DROPS a finding whose quote is not in the note, and counts it', () => {
    const result = parseSoapReview(
      { temuan: [{ kategori: 'cek', pesan: 'Spironolakton belum dihentikan.', kutipan: 'Spironolakton 25 mg' }] },
      NOTE,
    );
    expect(result).toEqual({ findings: [], dropped: 1 });
  });

  it('survives malformed output without inventing anything', () => {
    expect(parseSoapReview(null, NOTE)).toEqual({ findings: [], dropped: 0 });
    expect(parseSoapReview({ temuan: 'x' }, NOTE)).toEqual({ findings: [], dropped: 0 });
    expect(parseSoapReview({ temuan: [{ kategori: 'aneh', pesan: '', kutipan: 'ADHF' }] }, NOTE).dropped).toBe(1);
  });

  it('treats an unknown category as a check, and drops duplicates', () => {
    const result = parseSoapReview(
      {
        temuan: [
          { kategori: 'aneh', pesan: 'Sama.', kutipan: 'ADHF ec CAD' },
          { kategori: 'cek', pesan: 'sama.', kutipan: 'ADHF ec CAD' },
        ],
      },
      NOTE,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.level).toBe('cek');
  });
});

describe('soapReviewSystem', () => {
  it('lists the rule findings so the AI does not repeat them, and keeps the hard rules', () => {
    const system = soapReviewSystem({
      today: '2026-09-29',
      previousDate: '2026-09-28',
      ruleFindings: [{ message: 'TTV belum diisi: Nadi.' }],
    });
    expect(system).toContain('- TTV belum diisi: Nadi.');
    expect(system).toContain('JANGAN memberi saran klinis');
    expect(system).toContain('H-2 berarti HARI KE-2');
    expect(system).toContain('Tanggal catatan hari ini: 2026-09-29.');
  });
});
