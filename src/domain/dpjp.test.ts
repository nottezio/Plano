import { describe, expect, it } from 'vitest';

import { DPJPS, detectDpjps, dpjpById, primaryDpjp } from './dpjp';

const REAL_NOTE = [
  "Selamat pagi prof. Tabe prof, melaporkan follow up pasien di *PJT Lantai 5 Kamar 517 Bed 3* atas nama:",
  '',
  '*Ny. Bubi Dg Pajja/ 01-02-1960/ 66 tahun / RM 1478911*',
  '',
  '_DPJP Utama : Prof. dr. Peter Kabo, PhD, Sp.FK, Sp.JP(K)_',
  '_DPJP Tindakan : Dr. dr. Abdul Hakim Alkatiri, Sp.JP (K)_',
  '_DPJP Interna GH : dr. Sitti Rabiul Zatalia Ramadhan, Sp.PD, K-GH_',
  '',
  'S :',
  '- nyeri dada tidak ada',
].join('\n');

describe('the registry', () => {
  it('has unique ids and initials', () => {
    expect(new Set(DPJPS.map((d) => d.id)).size).toBe(DPJPS.length);
    expect(new Set(DPJPS.map((d) => d.initials)).size).toBe(DPJPS.length);
  });

  it('shares no matching token between two consultants', () => {
    // The invariant that keeps a card from being labelled with the wrong name.
    const tokens = DPJPS.flatMap((d) => d.match);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('excludes tokens that two consultants share', () => {
    const tokens = DPJPS.flatMap((d) => d.match);
    // `Tandean` is both Pendrik and Frizt Alfred; `Muzakkir` is both the
    // professor and Akhtar Fajar.
    expect(tokens).not.toContain('tandean');
    expect(tokens).not.toContain('muzakkir');
  });
});

describe('detectDpjps', () => {
  const found = detectDpjps(REAL_NOTE);

  it('reads every DPJP line, with its role', () => {
    expect(found).toEqual([
      { id: 'pk', role: 'Utama' },
      { id: 'aha', role: 'Tindakan' },
    ]);
  });

  it('ignores a consultant who is not in the registry', () => {
    // The Interna GH line names someone not on the list; nothing is invented.
    expect(found.some((entry) => entry.role === 'Interna GH')).toBe(false);
  });

  it('survives the ways titles are actually written', () => {
    for (const line of [
      '_DPJP Utama dan Tindakan : Dr. dr. Akhtar Fajar M, SpJP, Subsp. IKKV(K), KI(K)_',
      '*DPJP: Dr. dr. Akhtar Fajar Muzakkir, Sp.JP(K)*',
      'DPJP Utama : dr Akhtar Fajar',
    ]) {
      expect(detectDpjps(line)[0]?.id).toBe('afm');
    }
  });

  it('does not confuse the two Muzakkirs', () => {
    expect(detectDpjps('DPJP: Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)')[0]?.id).toBe('mz');
    expect(detectDpjps('DPJP: Dr. dr. Akhtar Fajar Muzakkir, SpJP')[0]?.id).toBe('afm');
  });

  it('does not confuse the two Tandeans', () => {
    expect(detectDpjps('DPJP: dr. Pendrik Tandean, Sp.PD-KKV')[0]?.id).toBe('pt');
    expect(detectDpjps('DPJP: dr. Frizt Alfred Tandean, Sp.JP(K)')[0]?.id).toBe('fat');
  });

  it('reports nothing rather than guessing on a bare surname it shares', () => {
    expect(detectDpjps('DPJP: dr. Tandean, Sp.JP')).toEqual([]);
  });

  it('only looks at DPJP lines', () => {
    // Alkatiri named in a procedure report must not become the patient's DPJP.
    const note = '*Laporan PCI*\nOperator: Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)';
    expect(detectDpjps(note)).toEqual([]);
  });

  it('never lists the same consultant twice', () => {
    const note = '_DPJP Utama : Peter Kabo_\n_DPJP Tindakan : Peter Kabo_';
    expect(detectDpjps(note)).toHaveLength(1);
  });

  it('returns nothing for a note with no DPJP line', () => {
    expect(detectDpjps('S :\n- nyeri dada tidak ada')).toEqual([]);
  });
});

describe('primaryDpjp', () => {
  it('prefers the Utama line over the others', () => {
    expect(primaryDpjp(REAL_NOTE)?.initials).toBe('PK');
  });

  it('falls back to the first DPJP found when none says Utama', () => {
    expect(primaryDpjp('_DPJP Tindakan : Dr. dr. Az Hafid Nashar_')?.initials).toBe('AHN');
  });

  it('is null when nobody is named', () => {
    expect(primaryDpjp('S :\n- nyeri dada')).toBeNull();
  });
});

describe('dpjpById', () => {
  it('resolves a known id', () => {
    expect(dpjpById('ahn')?.name).toContain('Az Hafid Nashar');
  });

  it('is undefined for an unknown id', () => {
    expect(dpjpById('nope')).toBeUndefined();
  });
});
