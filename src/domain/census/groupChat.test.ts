import { describe, expect, it } from 'vitest';

import type { ClinicalDate } from '@/domain/types';
import { chatSource, digestChat, greetingPlace, placeOfLocation, previousDigest, readDigest, splitMessages } from './groupChat';
import { buildCensus, entriesFor, parseLists } from './maker';

/*
  The shapes of dr. KS's group export (13-14 Nov 2026), names and RMs
  invented: an IGD admission at night, its transfer to CVCU, a follow-up the
  next morning; a ward patient reported on both days; a konsul answered in one
  sentence; chatter with no patient.
*/
const report = (greeting: string, identity: string, body: string): string =>
  `${greeting}\n\n${identity}\n\nDPJP Utama : Dr. dr. Khalid Saleh, Sp.PD-KKV\n\nS:\n- Keluhan nyeri dada tidak ada\n\n${body}`;

const IGD_NEW = report(
  'Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan pasien baru di IGD PJT Redzone bed 1 atas nama:',
  'Tn. Contoh Satu/ 27-05-1968/ 58 tahun/ RM 1700001',
  'Mohon izin kami assess dengan :\n- NSTEMI\n- Hypertensive Heart Disease\n\nMohon izin kami terapi dengan:\n- Aspilet 80 mg/24 jam/oral',
);
const IGD_MOVE = report(
  'Assalamualaikum dokter, tabe dok mohon ijin melaporkan perpindahan pasien dari IGD PJT Rezone bed 1 ke CVCU Bed 12 pasien atas nama:',
  'Tn. Contoh Satu/ 27-05-1968/ 58 tahun/ RM 1700001',
  'Mohon izin kami assess dengan :\n- NSTEMI\n- Hypertensive Heart Disease\n- Hipokalemia (3.1)\n\nPlan:\n- Echo',
);
const WARD_DAY1 = report(
  'Assalamualaikum dokter, tabe dokter izin melaporkan follow up pasien di PJT Lantai 4 Kamar 408 atas nama :',
  'Ny. Contoh Dua /17-06-1978/48 tahun/RM 1700002',
  'Mohon izin kami assess dengan:\n- Chronic Coronary Syndrome\n\nPlan:\n- Rawat jalan hari ini',
);
const KONSUL = report(
  'Assalamuaikum dokter. Mohon izin melaporkan konsul baru dari TS Neurologi (Dr. dr. Contoh, Sp.N(K)) di Palem Atas Kamar 202 Bed 1 atas nama:',
  'Ny. Contoh Tiga/ 17-08-1990/ 36 Tahun/ RM 1700003',
  'Saat ini evaluasi Kardiologi berdasarkan anamnesis, pemeriksaan fisik, EKG, pasien termasuk kategori Low Risk (Lee Revised Cardiac Risk Index) untuk tindakan DSA\n\nTS Neuro\nA/\n1. CEREBRAL INFARCTION',
);

/** iPhone, English locale: "[11/13/26, 3:44:07 AM] Name: …". */
const IOS = [
  '[11/12/26, 7:00:00 AM] dr. Lama: follow up lama atas nama:\nTn. Lama/ RM 1799999\n',
  '‎[11/13/26, 5:20:48 AM] Jan 23 - dr. Satu: ' + KONSUL,
  '[11/13/26, 6:44:05 AM] Jul 26 - dr. Dua: ' + WARD_DAY1,
  '[11/13/26, 6:23:49 AM] Dr. dr. Khalid Saleh: Tabe. Siapa yg jaga di IGD PJT',
  '[11/13/26, 9:48:34 PM] Jul 22 - dr. Tiga: ' + IGD_NEW,
  '[11/14/26, 12:53:49 AM] Jul 24 - dr. Empat: ' + IGD_MOVE,
  '[11/14/26, 6:38:51 AM] Jul 26 - dr. Dua: ' + WARD_DAY1.replace('Rawat jalan hari ini', 'Lanjut terapi'),
].join('\n');

/** Android, Indonesian locale: "14/11/26 00.53 - Name: …". */
const ANDROID = [
  '13/11/26 05.20 - Pesan dan panggilan terenkripsi secara end-to-end.',
  '13/11/26 21.48 - Jul 22 - dr. Tiga: ' + IGD_NEW,
  '14/11/26 00.53 - Jul 24 - dr. Empat: ' + IGD_MOVE,
].join('\n');

const DAY: ClinicalDate = '2026-11-14' as ClinicalDate;

describe('splitMessages', () => {
  it('reads iPhone stamps, month first with a 12-hour clock', () => {
    const messages = splitMessages(IOS);
    expect(messages.map((m) => `${m.date} ${m.time}`)).toEqual([
      '2026-11-12 07:00',
      '2026-11-13 05:20',
      '2026-11-13 06:44',
      '2026-11-13 06:23',
      '2026-11-13 21:48',
      '2026-11-14 00:53',
      '2026-11-14 06:38',
    ]);
    expect(messages[1]!.body.startsWith('Assalamuaikum dokter.')).toBe(true);
  });

  it('reads Android stamps, day first, and drops the system line', () => {
    const messages = splitMessages(ANDROID);
    expect(messages.map((m) => `${m.date} ${m.time}`)).toEqual(['2026-11-13 21:48', '2026-11-14 00:53']);
  });
});

describe('greetingPlace', () => {
  it('takes the side after "ke" for a transfer, and where it came from', () => {
    expect(greetingPlace('melaporkan perpindahan pasien dari IGD PJT Rezone bed 1 ke CVCU Bed 12 pasien atas nama:', 'pindah')).toEqual({
      location: 'CVCU Bed 12',
      from: 'IGD PJT Rezone bed 1',
    });
  });

  it('skips a consultant in brackets and "dari TS …"', () => {
    expect(greetingPlace('konsul baru dari TS Neurologi (Dr. dr. Contoh di RS) di Palem Atas Kamar 202 Bed 1, atas nama:', 'konsul').location).toBe(
      'Palem Atas Kamar 202 Bed 1',
    );
    expect(greetingPlace('pasien baru pengantar dari poli di bangsal PJT Lantai 4 Kamar 420 Bed 4 atas nama:', 'baru').location).toBe(
      'PJT Lantai 4 Kamar 420 Bed 4',
    );
  });
});

describe('placeOfLocation', () => {
  it('files the wards of the other hospitals, then the PJT floors', () => {
    expect(placeOfLocation('PCC Kamar 306')).toBe('RSWS');
    expect(placeOfLocation('HCU Central bed 8')).toBe('RSWS');
    expect(placeOfLocation('Katinting 502 Bed 3')).toBe('RSUH');
    expect(placeOfLocation('IGD PJT LT.5 Kamar 509')).toBe('LT5');
    expect(placeOfLocation('ICU PJT Bed 7')).toBe('CVCU');
    expect(placeOfLocation('IGD Bluezone')).toBe('IGD');
  });
});

describe('digestChat', () => {
  const digest = digestChat({ text: IOS, file: 'chat.zip', censusDate: DAY });

  it('reads yesterday and today only, and finds whose group it is', () => {
    expect(digest.code).toBe('KS');
    expect(digest.older).toBe(1);
    expect(digest.messages).toBe(6);
    expect(digest.reports).toBe(5);
  });

  it('keeps one row per patient: the newest report sets the place and the diagnoses', () => {
    const one = digest.patients.find((p) => p.key === 'rm:1700001')!;
    expect(one.place).toBe('CVCU');
    expect(one.location).toBe('CVCU Bed 12');
    expect(one.diagnoses).toEqual(['- NSTEMI', '- Hypertensive Heart Disease', '- Hipokalemia (3.1)']);
    expect(one.dxChanged).toBe(true);
    expect(one.reports.map((r) => r.kind)).toEqual(['baru', 'pindah']);
    expect(digest.patients).toHaveLength(3);
  });

  it('a going-home line counts only from the newest report', () => {
    expect(digest.patients.find((p) => p.key === 'rm:1700002')!.homeHint).toBeNull();
    const yesterday = digestChat({ text: IOS, file: 'x', censusDate: '2026-11-13' as ClinicalDate });
    expect(yesterday.patients.find((p) => p.key === 'rm:1700002')!.homeHint).toBe('Rawat jalan hari ini');
  });

  it("takes a konsul's evaluation sentence as its diagnosis, and marks it KJS", () => {
    const konsul = digest.patients.find((p) => p.key === 'rm:1700003')!;
    expect(konsul.place).toBe('RSWS');
    expect(konsul.kjs).toBe('KJS Neurologi');
    expect(konsul.diagnoses).toEqual(['- Low Risk (Lee Revised Cardiac Risk Index) untuk tindakan DSA']);
  });

  it('round-trips through the stored text', () => {
    expect(readDigest(JSON.stringify(digest))).toEqual(digest);
    expect(readDigest('Tabe dokter izin mengirimkan List Pasien')).toBeNull();
  });
});

describe('chatSource', () => {
  const digest = digestChat({ text: IOS, file: 'chat.zip', censusDate: DAY });

  it('builds the census, leaving out what the resident skipped', () => {
    const { source } = chatSource({ ...digest, skipped: ['rm:1700003'] });
    const census = buildCensus({ sources: [source], code: 'KS', date: DAY, address: 'dokter' });
    expect(census.entries.map((e) => e.key)).toEqual(['rm:1700001', 'rm:1700002']);
    expect(census.text).toContain('*CVCU/HCU/ICU PJT : 1 pasien*');
    expect(census.text).toContain('1. CVCU Bed 12/ Tn. Contoh Satu/ 27-05-1968/ 58 tahun/ RM 1700001');
    // A chat covers no place: no "0 pasien" headings for wards nobody wrote from.
    expect(census.text).not.toContain('RSWS : 0');
  });

  it('a ward list naming the same patient wins over the chat', () => {
    const { source } = chatSource(digest);
    const [ward] = parseLists(`Tabe dokter izin mengirimkan List Pasien PJT Lantai 4
1. 408/KS/Ny. Contoh Dua /17-06-1978/48 tahun/RM 1700002
Diagnosis:
- CCS dari list`);
    const rows = entriesFor([source, ward!], 'KS');
    expect(rows.find((e) => e.key === 'rm:1700002')!.diagnoses).toEqual(['- CCS dari list']);
  });
});

describe('memory of the previous import', () => {
  const yesterday = digestChat({ text: IOS, file: 'x', censusDate: '2026-11-13' as ClinicalDate });
  const onlyNight = [
    '[11/14/26, 12:53:49 AM] Jul 24 - dr. Empat: ' + IGD_MOVE,
    '[11/15/26, 6:00:00 AM] Jul 24 - dr. Empat: ' + IGD_MOVE,
  ].join('\n');

  it('keeps patients the new window does not report, marked, and what was left out stays out', () => {
    const today = digestChat({
      text: onlyNight,
      file: 'y',
      censusDate: '2026-11-15' as ClinicalDate,
      previous: { ...yesterday, skipped: ['rm:1700003'] },
    });
    expect(today.patients.map((p) => [p.key, !!p.carried])).toEqual([
      ['rm:1700003', true],
      ['rm:1700001', false],
      ['rm:1700002', true],
      ['rm:1799999', true],
    ]);
    expect(today.skipped).toEqual(['rm:1700003']);
  });

  it('finds the newest earlier import among the stored days', () => {
    const days = {
      '2026-11-12': { lists: [{ kind: 'grup-wa', text: JSON.stringify({ ...yesterday, file: 'old' }) }] },
      '2026-11-13': { lists: [{ kind: 'grup-wa', text: JSON.stringify(yesterday) }, { kind: 'auto', text: 'list' }] },
      '2026-11-14': { lists: [{ kind: 'auto', text: 'list' }] },
    };
    expect(previousDigest(days, '2026-11-15')?.file).toBe('x');
    expect(previousDigest(days, '2026-11-12')).toBeNull();
  });
});

describe('chat bubble', () => {
  it('keeps the greeting, the identity line and the diagnosis block as written', () => {
    const digest = digestChat({ text: IOS, file: 'x', censusDate: DAY });
    const bubble = digest.patients.find((p) => p.key === 'rm:1700001')!.reports.at(-1)!.bubble!;
    expect(bubble.identity).toBe('Tn. Contoh Satu/ 27-05-1968/ 58 tahun/ RM 1700001');
    expect(bubble.greeting[0]).toContain('ke CVCU Bed 12');
    expect(bubble.dx).toEqual(['Mohon izin kami assess dengan :', '- NSTEMI', '- Hypertensive Heart Disease', '- Hipokalemia (3.1)']);
    expect(digest.patients.find((p) => p.key === 'rm:1700001')!.reports.at(-1)!.sender).toBe('Jul 24 - dr. Empat');
  });
});
