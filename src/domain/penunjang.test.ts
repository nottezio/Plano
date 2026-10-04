import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES as ALIASES } from './defaults';
import { latestPenunjangOnly, penunjangKind } from './penunjang';

const NOTE = [
  'Assalamualaikum dokter, mohon izin melaporkan pasien',
  '',
  '*Tn. Contoh/60 tahun/RM 1234567*',
  '',
  '*S :*',
  '- Sesak berkurang',
  '',
  '*O :*',
  'Tensi : 120/70 mmHg',
  '',
  '*EKG di PJT Lt. 4 (30-9-2026)*',
  'Sinus rhythm, HR 88',
  '',
  '*Laboratorium IGD (29-09-2026)*',
  'WBC : 12.000',
  'HGB : 10.1',
  '',
  '*EKG PJT Lt. 4 (03-10-2026)*',
  'Sinus rhythm, HR 72',
  '',
  '*Foto Thorax (29-09-2026)*',
  'Kardiomegali',
  '',
  '*Laboratorium PJT (02-10-2026)*',
  'WBC : 9.000',
  '',
  '*Echocardiography (01-10-2026)*',
  'EF 35%',
  'Saran :',
  '- Konfrens',
  '',
  '*Mohon izin kami assess dengan*',
  '- ADHF',
  '',
  '*Plan :*',
  '- Rencana Echo (06-10-2026)',
  '- EKG (05-10-2026)',
].join('\n');

describe('penunjangKind', () => {
  it('ignores the place and spelling', () => {
    expect(penunjangKind('EKG di PJT Lt. 4')).toBe('ekg');
    expect(penunjangKind('Laboratorium IGD')).toBe('lab');
    expect(penunjangKind('Lab')).toBe('lab');
    expect(penunjangKind('Echocardiography')).toBe('echo');
    expect(penunjangKind('Echo Hemodinamik')).toBe('echo hemodinamik');
    expect(penunjangKind('Foto Thorax AP')).toBe('thorax');
    expect(penunjangKind('Laporan PTCA di PJT')).toBe('laporan ptca');
  });
});

describe('latestPenunjangOnly', () => {
  const result = latestPenunjangOnly(NOTE, ALIASES);

  it('drops older blocks of the same kind, with their content', () => {
    expect(result.text).not.toContain('(30-9-2026)');
    expect(result.text).not.toContain('HR 88');
    expect(result.text).not.toContain('Laboratorium IGD');
    expect(result.text).not.toContain('WBC : 12.000');
    expect(result.removed.map((block) => block.date)).toEqual(['2026-09-30', '2026-09-29']);
  });

  it('keeps the newest of each kind and kinds that appear once', () => {
    expect(result.text).toContain('*EKG PJT Lt. 4 (03-10-2026)*\nSinus rhythm, HR 72');
    expect(result.text).toContain('*Laboratorium PJT (02-10-2026)*\nWBC : 9.000');
    expect(result.text).toContain('*Foto Thorax (29-09-2026)*\nKardiomegali');
    expect(result.text).toContain('Saran :\n- Konfrens');
  });

  it('never touches anything below the assessment', () => {
    expect(result.text).toContain('- Rencana Echo (06-10-2026)\n- EKG (05-10-2026)');
  });

  it('leaves the rest of the note byte-identical and spaced', () => {
    expect(result.text.startsWith(NOTE.slice(0, NOTE.indexOf('*EKG di')))).toBe(true);
    expect(result.text).not.toMatch(/\n{3,}/);
  });

  it('keeps two blocks on the newest date', () => {
    const body = '*O :*\n*Lab (01-10-2026)*\nA\n\n*Lab (02-10-2026)*\nB\n\n*Lab (02-10-2026)*\nC';
    const out = latestPenunjangOnly(body, ALIASES).text;
    expect(out).toBe('*O :*\n*Lab (02-10-2026)*\nB\n\n*Lab (02-10-2026)*\nC');
  });

  it('ends a block at the next bold heading rather than eating it', () => {
    const body = '*O :*\n*EKG (01-10-2026)*\nX\n\n*TS Paru*\n- milik TS\n\n*EKG (02-10-2026)*\nY';
    const out = latestPenunjangOnly(body, ALIASES).text;
    expect(out).toContain('*TS Paru*\n- milik TS');
    expect(out).not.toContain('\nX\n');
  });

  it('returns the note unchanged when there is nothing older', () => {
    const body = '*O :*\n*EKG (01-10-2026)*\nX';
    expect(latestPenunjangOnly(body, ALIASES)).toEqual({ text: body, removed: [] });
  });

  it('reads two-digit years and slashes', () => {
    const body = '*O :*\n*Lab (01/10/26)*\nA\n\n*Lab (2/10/26)*\nB';
    expect(latestPenunjangOnly(body, ALIASES).text).toBe('*O :*\n*Lab (2/10/26)*\nB');
  });
});
