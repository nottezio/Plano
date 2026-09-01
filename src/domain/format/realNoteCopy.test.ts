import { describe, expect, it } from 'vitest';

import { composeCopy } from './composeCopy';
import { sectionsForGroups } from './copyGroups';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

/**
 * A real bangsal note, from the export Avicenna supplied on 2026-09-02.
 *
 * Every fixture before this was written by me from a description, and three
 * separate bugs in "Salin bagian" survived all of them because the shapes they
 * depended on only occur in a real note: an identity line that parses as a
 * wrapped header, DPJP lines that parse as `label : value`, and four vitals in
 * a row that each parse as their own section.
 */
const REAL_NOTE = [
  'Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lt. 4 kamar 414 bed 2* atas nama :',
  '',
  '*Ny. Siati /01-06-1965/61 th/RM 881487*',
  '',
  '_DPJP Kardio (Utama): dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP, Subsp.PRKV(K)_',
  '_DPJP Orthopedi: Dr. dr. Karya Triko Biakto, MARS, Sp.O.T.Subsp.O.T.B(K)_',
  '_DPJP Paru: Dr. dr. Irawaty Djaharuddin, Sp.P(K), MHPE_',
  '',
  '*S :*',
  '- Sesak nafas ada, berdebar tidak ada, nyeri dada tidak ada. nyeri pada kepala bagian belakang dan panggul belakang. Batuk lendir ada. BAB terakhir 5 hari yang lalu dan BAK kesan normal',
  '',
  '*O :*',
  'Compos mentis',
  'Tensi : 100/70 mmHg',
  'Nadi : 65x/menit, reguler',
  'Nafas : 24 x /menit',
  'Suhu : 36.7 C',
  'SpO2 : 99% on NC 4lpm',
  '',
  'Anemis tidak ada, ikterus tidak ada',
  'JVP R+2 cmH20',
  'BJ I/II murni reguler, murmur tidak ada ',
  'BP Vesikuler, ronkhi ada, wheezing tidak ada',
  'Edema ekstremitas tidak ada, akral teraba hangat.',
  '',
  '*EKG di PJT Lt. 4 (31-8-2026)*',
  'Sinus rhythm, HR 65 BPM, reguler, normoaxis, P wave 0.12 sec, PR interval 0.20 sec, QRS duration 0.08 sec, no significant ST-T changes.',
].join('\n');

const OPTIONS = {
  format: 'whatsapp' as const,
  includeIdentity: false,
  includeDateHeader: false,
  aliases: ALIASES,
  patient: makePatient({ name: 'Ny. Siati', mrn: '881487' }),
  bullet: 'hyphen' as const,
};

function copyGroup(group: 's' | 'o' | 'a' | 'terapi' | 'plan'): string {
  return composeCopy([{ date: '2026-09-01', body: REAL_NOTE }], {
    ...OPTIONS,
    sections: sectionsForGroups(REAL_NOTE, ALIASES, [group]),
  });
}

describe('Salin bagian, against a real note', () => {
  it('puts the heading on its own line', () => {
    expect(copyGroup('s')).toContain('*S :*\n- Sesak nafas ada');
  });

  it('keeps a vital sign on ONE line', () => {
    // `Tensi : 100/70 mmHg` is a field: the label and value share a line on
    // purpose. Giving it the heading treatment split every vital in two.
    const out = copyGroup('o');
    expect(out).toContain('Tensi : 100/70 mmHg');
    expect(out).not.toContain('Tensi :\n');
  });

  it('keeps consecutive vitals consecutive', () => {
    // The parser makes each its own section, but they are adjacent lines in
    // the note. A blank line between each turned four lines into eight.
    expect(copyGroup('o')).toContain(
      'Tensi : 100/70 mmHg\nNadi : 65x/menit, reguler\nNafas : 24 x /menit',
    );
  });

  it('includes the TTV in O + Penunjang', () => {
    const out = copyGroup('o');
    expect(out).toContain('Compos mentis');
    expect(out).toContain('SpO2 : 99% on NC 4lpm');
    expect(out).toContain('*EKG di PJT Lt. 4 (31-8-2026)*');
  });

  it('leaves the opening out of a section subset', () => {
    // The identity line parses as a wrapped header and the DPJP lines as
    // `label : value`; unrecognised, they fell through to the O group, so
    // copying O pasted the patient name and three consultants above the
    // vitals.
    const out = copyGroup('o');
    expect(out).not.toContain('Ny. Siati /01-06-1965');
    expect(out).not.toContain('DPJP Kardio');
    expect(out).not.toContain('Assalamualaikum');
  });

  it('copies only the group asked for', () => {
    expect(copyGroup('s')).not.toContain('Compos mentis');
    expect(copyGroup('o')).not.toContain('Sesak nafas ada');
  });
});
