import { describe, expect, it } from 'vitest';

import { splitChat } from './chat';
import { buildFloorList, countLabel, patientLine, splitFloorList } from './build';
import { effective, newRosterPatient } from './floor';
import { dischargeFlag, latestOf, latestPatients, listBody, manualPatient, nicknameOf, onFloorNumber, otherDepartmentUtama, readReport, readReports } from './report';

/*
  The floor's WhatsApp group, re-typed with invented patients and residents
  (shapes taken from the real export: openings, DPJP lines, headings, TS
  blocks, closings). No real name, RM or date of birth.
*/
const EXPORT = `[10/11/26, 6:30:00 AM] Jul 26 - dr. Contoh Satu: Tabe dokter mohon izin mengirimkan List Pasien PJT Lantai 4, Minggu, 11 Oktober 2026, 04.00 WITA
🟡JUMLAH PASIEN : 2
[10/11/26, 6:34:20 AM] Jul 26 - dr. Muh Contoh Dua: Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lt 4 Kamar 417 Bed 4 atas nama:

Ny. Contoh Pertama /1234567/12-07-1969/57 tahun

DPJP Utama: Dr. dr. Khalid Saleh, Sp.PD-KKV
DPJP Pulmo : Dr. dr. Lain Paru, Sp.P(K)

S:
- Sesak tidak ada.

O:
Compos mentis

Mohon izin kami assesst dengan
- Congestive Heart Failure NYHA III
- Hyponatremia (121->123)

Mohon izin kami terapi dengan
- Furosemide 40mg/12jam/oral

Selesai :
- Bolus Dextrose 40% 1 kolf (05-10-2026)

Plan
- Monitoring tanda vital
- Mohon arahan DPJP untuk rencana pulang
- Usul H-1 hari ini (11-10-2026)

TS Pulmo
A/
- Efusi pleura dextra
P/
- Monitoring mini wsd

Selanjutnya mohon arahan dokter. Terima kasih dok.
[10/11/26, 6:59:00 AM] dr. Contoh Tiga: Assalamualaikum prof, Tabe prof, mohon izin melaporkan follow up pasien perpindahan dari IGD Red Zone bed 4 ke PJT Lt. 4 Kamar 408 atas nama:

Tn.Contoh Kedua / 13-03-1968 / 58 tahun / RM 01733961

DPJP: Prof. Dr. dr. Muzakkir Amir, SpJP(K)

S:
- Nyeri dada tidak ada.

Mohon izin pasien kami assess dengan :
- Acute Coronary Syndrome

Mohon izin pasien kami terapi dengan :
- Aspilet 80 mg/24 jam/oral

Plan :
- Rencana pulang hari ini (11/10/2026)

Tabe dokter, selanjutnya mohon arahannya dokter. Terima kasih dokter
[10/11/26, 7:09:00 AM] You: Chief : Kepala
Junior : Muda

Assalamualaikum dok. Tabe dok, mohon izin melaporkan follow up pasien di PJT Lt 4 Kamar 421 Bed 3 atas nama:

Ny. Contoh Ketiga / 31-12-1957 / 68 tahun / RM 824614

DJPJP Utama : dr. Zaenab Djafar, MKes, SpPD, SpJP, Subsp.PRKV(K)
DPJP Aritmia : Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)

Diagnosis
- Symptomatic Bradycardia ec TAVB post PPM (H-1)

Jam Verifikasi :  09.53 WITA

Tabe mohon arahan selanjutnya, Dokter. Terima kasih, Dokter.

S/
Pasien mengeluh pusing.

Mohon izin kami assess dengan :
- Symptomatic Bradycardia ec TAVB post PPM Implantation (H-1)

Mohon izin kami terapi dengan:
- KSR 600mg/8jam/oral

Plan :
- EKG/hari

Selanjutnya mohon arahan dokter. terima kasih dokter.
[10/11/26, 9:09:00 AM] Jul 23 - dr. Contoh Empat: Assalamualaikum Dokter. Mohon izin melaporkan follow up perpindahan pasien KJS TS BTKV dari HCU bed 1 ke PJT Lantai 4 Kamar 415 Bed 1 atas nama:

Tn. H. Contoh Keempat/08-02-1963/63 tahun/RM 01720061

DPJP Kardio: dr. Aussie Fitriani Ghaznawie, Sp.JP, Subsp.Eko(K)
DPJP BTKV (Utama): Dr. dr. Bedah Contoh, M.Kes., Sp.BTKV., Subsp.JD(K)

Diagnosis:
- POD-15 Mitral valve replacement

Mohon izin kami terapi dengan
- Warfarin 2mg/24jam/oral

Plan
- Monitoring INR

Tabe terima kasih dokter
[10/12/26, 6:35:00 AM] Jul 26 - dr. Muh Contoh Dua: Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lt 4 Kamar 417 Bed 4 atas nama:

Ny. Contoh Pertama /1234567/12-07-1969/57 tahun

DPJP Utama: Dr. dr. Khalid Saleh, Sp.PD-KKV

Mohon izin kami assesst dengan
- Congestive Heart Failure NYHA III
- Hyponatremia (121->123->130)

Mohon izin kami terapi dengan
- Furosemide 40mg/12jam/oral

Plan
- Rawat jalan hari ini (Senin, 12-10-2026)

Selanjutnya mohon arahan dokter. Terima kasih dok.
`;

describe('splitChat', () => {
  it('reads iOS export stamps and senders', () => {
    const messages = splitChat(EXPORT);
    expect(messages).toHaveLength(6);
    expect(messages[1]).toMatchObject({ sentAt: '2026-10-11T06:34', sender: 'Jul 26 - dr. Muh Contoh Dua' });
    expect(messages[4]!.sentAt).toBe('2026-10-11T09:09');
  });

  it('reads Android, copied and markdown exports', () => {
    expect(splitChat('11/10/26, 18:05 - dr. A: halo\n12/10/26, 07:00 - dr. B: lagi')[0]).toMatchObject({
      sentAt: '2026-11-10T18:05',
      sender: 'dr. A',
    });
    expect(splitChat('[06:27, 9/10/2026] dr. A: halo')[0]!.sentAt).toBe('2026-10-09T06:27');
    const md = splitChat('## 9 October 2026\n\n[6.27] **dr. A:** halo\n[7.05] **dr. B:** lagi');
    expect(md.map((m) => [m.sentAt, m.sender])).toEqual([
      ['2026-10-09T06:27', 'dr. A'],
      ['2026-10-09T07:05', 'dr. B'],
    ]);
  });

  it('splits header-less pastes at each report opening, keeping a Chief header with its report', () => {
    const bare = [
      'Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lt 4 Kamar 401 atas nama:',
      'Tn. A / RM 1111111',
      'Tabe iye dokter',
      'Chief : Kepala',
      'Junior : Muda',
      '',
      'Assalamualaikum dok, mohon izin melaporkan follow up pasien di PJT Lt 4 Kamar 402 atas nama:',
      'Tn. B / RM 2222222',
    ].join('\n');
    const parts = splitChat(bare);
    expect(parts).toHaveLength(2);
    expect(parts[1]!.text.startsWith('Chief : Kepala')).toBe(true);
  });
});

describe('readReport', () => {
  const messages = splitChat(EXPORT);

  it('skips the List message itself', () => {
    expect(readReport(messages[0]!)).toBeNull();
  });

  it('reads place, identity, DPJP and the A/P tail with renamed headings', () => {
    const p = readReport(messages[1]!)!;
    expect(p).toMatchObject({ room: '417', bed: '4', floor: '4', rm: '1234567', name: 'Ny. Contoh Pertama', dpjpId: 'ks', btkv: false });
    expect(p.body.split('\n')[0]).toBe('Diagnosis:');
    expect(p.body).toContain('\nTerapi:\n- Furosemide');
    // A bulleted "Mohon arahan" is a plan item, not the sign-off; TS blocks stay.
    expect(p.body).toContain('- Mohon arahan DPJP untuk rencana pulang');
    expect(p.body).toContain('TS Pulmo\nA/\n- Efusi pleura dextra');
    expect(p.body).not.toMatch(/Selanjutnya|Compos mentis|Sesak tidak ada/);
    // Colour is never taken from the SOAP (12.12); the Plan only feeds a suggestion chip.
    expect(p.discharge).toBeNull();
    expect(dischargeFlag(p.body)).toBe('tomorrow');
  });

  it('takes the room after "ke" on a transfer, and a name with no space after Tn.', () => {
    const p = readReport(messages[2]!)!;
    expect(p).toMatchObject({ room: '408', bed: '', rm: '01733961', key: 'rm:1733961', dpjpId: 'mz', discharge: null });
    expect(dischargeFlag(p.body)).toBe('today');
    expect(p.body.split('\n')[0]).toBe('Diagnosis:');
  });

  it('uses the LAST assess heading, reads Chief/Junior and an Aritmia KJS', () => {
    const p = readReport(messages[3]!)!;
    expect(p).toMatchObject({ dpjpId: 'zd', kjsDpjpIds: ['mz'], chief: 'Kepala', junior: 'Muda' });
    expect(p.body).toContain('post PPM Implantation (H-1)');
    expect(p.body).not.toContain('Jam Verifikasi');
    // "(H-1)" in a diagnosis is not a discharge plan.
    expect(dischargeFlag(p.body)).toBeNull();
  });

  it('files a BTKV patient under the cardiology DPJP and marks KJS BTKV', () => {
    const p = readReport(messages[4]!)!;
    expect(p).toMatchObject({ dpjpId: 'afg', btkv: true, room: '415', bed: '1', junior: '', senderNick: 'Contoh' });
  });
});

describe('latestPatients', () => {
  it('keeps the latest report per patient (RM leading zeros ignored)', () => {
    const patients = latestPatients(splitChat(EXPORT));
    expect(patients).toHaveLength(4);
    const first = patients.find((p) => p.rm === '1234567')!;
    expect(first.sentAt).toBe('2026-10-12T06:35');
    expect(first.body).toContain('121->123->130');
  });
});

describe('helpers', () => {
  it('nicknames skip honorifics and common first names', () => {
    expect(nicknameOf('Jul 26 - dr. Nurul Contoh')).toBe('Contoh');
    expect(nicknameOf('dr. Muh Bima Lain S')).toBe('Bima');
    expect(nicknameOf('')).toBe('');
  });

  it('discharge flags read the plan only', () => {
    expect(dischargeFlag('Diagnosis:\n- post PPM (H-1)\nPlan\n- EKG')).toBeNull();
    expect(dischargeFlag('Plan:\n- Rawat jalan besok')).toBe('tomorrow');
    expect(dischargeFlag('Plan:\n- Usul H-1 hari ini\n- Pulang hari ini')).toBe('today');
  });

  it('listBody is empty without an assessment', () => {
    expect(listBody('S:\n- baik\nO:\nCM')).toBe('');
  });
});

describe('buildFloorList', () => {
  // The roster minus the patient who went home (marked Pulang by hand).
  const present = latestPatients(splitChat(EXPORT))
    .filter((p) => p.room !== '408')
    .map((p) => effective(newRosterPatient(p, '', ''), { nicknames: {}, chiefs: '' }, '2026-10-12'));
  const text = buildFloorList(present, { ward: 'PJT Lantai 4', date: '2026-10-12', time: '04.00' });
  const lines = text.split('\n');

  it('opens with the floor, the long date and the time', () => {
    expect(lines[0]).toBe('Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4, Senin, 12 Oktober 2026, 04.00 WITA*');
  });

  it('counts the floor and every DPJP, zero included', () => {
    expect(lines).toContain('🟡JUMLAH PASIEN : 3');
    expect(lines).toContain('🫀KARDIO FU : LT 4 (2)');
    expect(lines).toContain('🤕KJS BTKV: LT 4 (1)');
    expect(lines).toContain('🫀 dr. PT : 0 pasien');
    expect(lines).toContain('🫀 Prof. MZ : 0 pasien + 1 KJS');
    expect(lines).toContain('🫀 dr. AFG : 1 pasien KJS BTKV');
    expect(countLabel(2, { btkv: 1, kjs: 0 })).toBe('2 pasien (1 kardio, 1 KJS BTKV)');
    expect(countLabel(5, { btkv: 0, kjs: 2 })).toBe('5 pasien + 2 KJS');
    expect(countLabel(0, { btkv: 0, kjs: 1 })).toBe('0 pasien + 1 KJS');
    expect(lines).toContain('👶🏻 dr. YP : 0 pasien');
  });

  it('prints each patient bold with residents, then the A/P; KJS patients under the KJS DPJP', () => {
    expect(text).toContain('*🫀 dr. KS : 1 pasien*\n*1. 417 Bed 4/KS/Ny. Contoh Pertama /1234567/12-07-1969/57 tahun - dr. Contoh*\nDiagnosis:');
    expect(text).toContain('*KJS*\n1. 421 Bed 3/ZD/Ny. Contoh Ketiga / 31-12-1957 / 68 tahun / RM 824614 - dr. Muda / dr. Kepala');
  });

  it('patientLine marks KJS BTKV before the residents', () => {
    const p = present.find((x) => x.btkv)!;
    expect(patientLine(p)).toBe('415 Bed 1/AFG/Tn. H. Contoh Keempat/08-02-1963/63 tahun/RM 01720061 (KJS BTKV) - dr. Contoh');
  });
});

describe('readReports (several openings in one message)', () => {
  const opening = (room: string, who: string) =>
    `Assalamualaikum. Tabe Prof, mohon izin melaporkan follow up pasien di PJT Lantai 4 Kamar ${room} atas nama:\n\n${who}\n\nDPJP Utama : Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)\n`;

  it('a summary then the full SOAP of the SAME patient: one patient, the full A/P', () => {
    const text = [
      opening('415 bed 2', 'Tn. Contoh Lima / 06-05-1987 / 39 Tahun / RM 1730002'),
      'Diagnosis :\n- Ringkas\n\nSelanjutnya mohon arahan prof. Terima kasih prof\n',
      opening('415 bed 2', 'Tn. Contoh Lima / 06-05-1987 / 39 Tahun / RM 1730002'),
      'Mohon izin kami assess dengan\n- Lengkap\n\nMohon izin kami terapi dengan\n- Obat\n\nSelanjutnya mohon arahan prof.',
    ].join('\n');
    const patients = latestPatients([{ sentAt: '2026-10-10T10:58', sender: 'dr. A', text, index: 0 }]);
    expect(patients).toHaveLength(1);
    expect(patients[0]!.body).toContain('- Lengkap');
    expect(patients[0]!.full).toContain('- Ringkas');
  });

  it('two DIFFERENT patients in one message: both are read', () => {
    const text = [
      opening('401', 'Tn. Contoh Enam / 01-01-1960 / 66 tahun / RM 1111112'),
      'Mohon izin kami assess dengan\n- A\n\nTerima kasih dok\n',
      opening('402', 'Ny. Contoh Tujuh / 02-02-1970 / 56 tahun / RM 2222223'),
      'Mohon izin kami assess dengan\n- B\n\nTerima kasih dok',
    ].join('\n');
    const patients = latestPatients([{ sentAt: '2026-10-10T10:58', sender: 'dr. A', text, index: 0 }]);
    expect(patients.map((p) => [p.room, p.rm]).sort()).toEqual([
      ['401', '1111112'],
      ['402', '2222223'],
    ]);
  });
});

describe('manualPatient (pediatri, entered by hand)', () => {
  it('builds a report from the three fields; no colour from its Plan', () => {
    const p = manualPatient({
      room: '421', bed: '6', dpjpId: 'yp', identity: 'An. Contoh Anak / 15-05-2008 / 18 tahun / RM 1516148',
      fields: { diagnosis: '- VSD', terapi: '- Furosemide', plan: '- Pulang hari ini' }, sentAt: '2026-10-10T08:00', sender: 'dr. Saya',
    });
    expect(p).toMatchObject({ key: 'rm:1516148', manual: true, dpjpId: 'yp', room: '421', bed: '6', discharge: null });
    expect(p.body).toBe('Diagnosis:\n- VSD\n\nTerapi:\n- Furosemide\n\nPlan:\n- Pulang hari ini');
  });

  it('its text is a ward report: read back like a SOAP from the group (13.12)', () => {
    const p = manualPatient({
      room: '421', bed: '6', dpjpId: 'yp', identity: 'An. Contoh Anak / 15-05-2008 / 18 tahun / RM 1516148',
      fields: { diagnosis: '- VSD', terapi: '- Furosemide', plan: '- Echo' }, sentAt: '2026-10-10T08:00', sender: 'dr. Saya',
    });
    expect(p.full).toContain('Mohon izin kami assess dengan:\n- VSD');
    const read = readReport({ sentAt: p.sentAt, sender: p.sender, text: p.full, index: 0 });
    expect(read).toMatchObject({ key: p.key, room: '421', bed: '6', dpjpId: 'yp', name: p.name });
    expect(read!.body).toBe(p.body);
  });

  it('without an RM the key is room + name, and editing keeps the key', () => {
    const p = manualPatient({ room: '421', bed: '', dpjpId: 'aau', identity: 'Contoh Bayi / 2026', fields: { diagnosis: '- X', terapi: '', plan: '' }, sentAt: '', sender: '' });
    expect(p.key).toBe('manual:421:contoh-bayi');
    expect(p.body).toBe('Diagnosis:\n- X');
    expect(manualPatient({ room: '420', bed: '1', dpjpId: 'aau', identity: 'Contoh Bayi', fields: { diagnosis: '- Y', terapi: '', plan: '' }, sentAt: '', sender: '', key: p.key }).key).toBe(p.key);
  });
});

describe('splitFloorList (coloured view, 12.12)', () => {
  it('cuts at the separators: heading, body and patient count per DPJP; the intro before', () => {
    const patients = latestPatients(splitChat(EXPORT)).map((p) => effective(newRosterPatient(p, '', ''), { nicknames: {}, chiefs: '' }, '2026-10-12'));
    const text = buildFloorList(patients, { ward: 'PJT Lantai 4', date: '2026-10-12', time: '04.00' });
    const { intro, parts } = splitFloorList(text);
    expect(intro.split('\n')[0]).toMatch(/^Tabe dokter/);
    const ks = parts.find((p) => p.heading.includes('dr. KS'))!;
    expect(ks.heading).toBe('🫀 dr. KS : 1 pasien');
    expect(ks.count).toBe(1);
    expect(parts.find((p) => p.heading.includes('dr. PT'))!.count).toBe(0);
    expect(parts.reduce((n, p) => n + p.count, 0)).toBeGreaterThanOrEqual(patients.length);
  });
});

describe('report variants from the Lt 4 (Sept) / Lt 5 (Oct) exports, 12.12', () => {
  const msg = (text: string) => ({ sentAt: '2026-10-12T07:00', sender: 'dr. A', text, index: 0 });
  const report = (opening: string, middle: string) =>
    readReport(
      msg(
        `${opening} atas nama:\n\nTn. Contoh Delapan / 01-01-1960 / 66 tahun / RM 1234500\n\nDPJP Utama : Dr. dr. Khalid Saleh, Sp.PD-KKV\n\nS:\n- baik\n\n${middle}\n\nTabe mohon arahannya dokter. Terima kasih dokter.`,
      ),
    )!;

  it('reads every A/T heading spelling, with or without "dengan" or a colon', () => {
    const variants = [
      ['Mohon izin dok, pasien kami diagnosis dengan:', 'Mohon Izin dok, pasien kami terapi dengan:'],
      ['Mohon izin kami asses pasien dengan:', 'Mohon izin kami terapi pasien dengan:'],
      ['Mohon izin kami assesstment dengan:', 'Mohon izin kami inisial terapi dengan :'],
      ['Mohon Izin Kami Asses:', 'Mohon izin kami Terapi:'],
    ];
    for (const [a, t] of variants) {
      const p = report('Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lantai 4 Kamar 417 Bed 1', `${a}\n- CHF\n\n${t}\n- Furosemide\n\nPlan:\n- Monitoring`);
      expect(p.body).toBe('Diagnosis:\n- CHF\n\nTerapi:\n- Furosemide\n\nPlan:\n- Monitoring');
    }
  });

  it('floor from "Lt .4" or from the room; Super VIP is room 411 on Lt 4; IGD has no floor', () => {
    expect(report('mohon izin melaporkan pasien di Lt .4 Kamar 421 Bed 1', 'Mohon izin kami assess dengan\n- X')).toMatchObject({ floor: '4', room: '421' });
    expect(report('mohon izin melaporkan pasien di PJT Kamar 417 Bed 1', 'Mohon izin kami assess dengan\n- X')).toMatchObject({ floor: '4', room: '417' });
    expect(report('mohon izin melaporkan pasien di Lantai 4 Kamar Super VIP', 'Mohon izin kami assess dengan\n- X')).toMatchObject({ floor: '4', room: '411' });
    expect(report('mohon izin melaporkan perpindahan pasien dari CVCU Bed 9 ke PJT Lt.4 Supervip', 'Mohon izin kami assess dengan\n- X').room).toBe('411');
    const igd = report('mohon izin melaporkan pasien baru di IGD PJT Redzone bed 1', 'Mohon izin kami assess dengan\n- X');
    expect([igd.floor, igd.room, onFloorNumber(igd, '4')]).toEqual(['', '', false]);
  });

  it('utama of another department with our DPJP only as a consultant: no own DPJP, the consultant\'s KJS (13.10)', () => {
    const text = [
      'Mohon izin melaporkan pasien KJS di PJT Lantai 4 Kamar 416 Bed 3 atas nama:',
      'Tn. Contoh Tujuh / 01-01-1960 / 66 tahun / RM 1600007',
      'DPJP Penyakit Dalam (Utama) : dr. Contoh Internis, Sp.PD',
      'DPJP KJS Aritmia : Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)',
    ].join('\n');
    const p = readReport({ sentAt: '2026-10-12T07:00', sender: 'dr. Bima', text, index: 0 });
    expect(p).toMatchObject({ dpjpId: null, kjsDpjpIds: ['mz'] });
  });

  it('a non-cardiology DPJP Utama makes it KJS TS Lain; cardiology or BTKV Utama does not', () => {
    expect(otherDepartmentUtama('DPJP Urologi (Utama) : dr. Contoh Satu, Sp.U\nDPJP Kardio : Dr. dr. Khalid Saleh, Sp.PD-KKV')).toBe(true);
    expect(otherDepartmentUtama('DPJP GH (Utama): dr. Contoh Dua, Sp.PD K GH')).toBe(true);
    expect(otherDepartmentUtama('DPJP Utama : Dr. dr. Khalid Saleh, Sp.PD-KKV')).toBe(false);
    expect(otherDepartmentUtama('DPJP BTKV (Utama) : dr. Contoh Tiga, Sp.BTKV')).toBe(false);
    expect(otherDepartmentUtama('- Rawat jalan mengikuti DPJP Utama')).toBe(false);
  });
});

describe('a sent List Pasien, read back (12.12)', () => {
  const msg = (text: string) => ({ sentAt: '2026-10-12T04:00', sender: 'dr. Luar', text, index: 0 });

  it('shape A: code after the room, residents after " - ", A/T/P under each; a KJS line joins its own line', () => {
    const text = [
      'Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4, Senin, 12 Oktober 2026, 04.00 WITA*',
      '🟡JUMLAH PASIEN : 2',
      '🫀 dr. KS : 1 pasien',
      '',
      '-------------------------------------',
      '*🫀 dr. KS : 1 pasien*',
      '*1. 419 bed 4/KS/Tn. Contoh Satu / 01-07-1960 / 66 tahun / RM 1600001 (KJS BTKV) - dr. Bima / dr. Kepala*',
      'Diagnosis:',
      '- 1. Post MVR H-9',
      '',
      'Mohon izin kami terapi dengan:',
      '- Furosemide',
      '',
      '-------------------------------------',
      '*🫀 Prof. MZ : 1 pasien + 1 KJS*',
      '*1. 415 Bed 2/MZ/Ny. Contoh Dua / 02-02-1970 / 56 tahun / RM 1600002 - dr. Dani / dr. Kepala*',
      'Diagnosis:',
      '- VT',
      '',
      '*KJS*',
      '1. 419 bed 4/KS/Tn. Contoh Satu / 01-07-1960 / 66 tahun / RM 1600001 - dr. Bima / dr. Kepala',
    ].join('\n');
    const patients = readReports(msg(text));
    expect(patients.map((p) => [p.room, p.bed, p.dpjpId, p.name, p.rm, p.junior, p.chief, p.btkv, p.fromList])).toEqual([
      ['419', '4', 'ks', 'Tn. Contoh Satu', '1600001', 'Bima', 'Kepala', true, true],
      ['415', '2', 'mz', 'Ny. Contoh Dua', '1600002', 'Dani', 'Kepala', false, true],
    ]);
    expect(patients[0]!.body).toBe('Diagnosis:\n- 1. Post MVR H-9\n\nTerapi:\n- Furosemide');
    expect(patients[0]!.kjsDpjpIds).toEqual(['mz']);
  });

  it('a KJS line with no own line (utama of another department, "TM/…") is kept, filed as the KJS of that DPJP (13.10)', () => {
    const text = [
      'Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4*',
      '-------------------------------------',
      '*🫀 Prof. MZ : 0 pasien + 1 KJS*',
      '*KJS*',
      '1. 416 Bed 3/TM/Tn. Contoh Enam / 01-01-1960 / 66 tahun / RM 1600006',
    ].join('\n');
    const [p] = readReports(msg(text));
    expect(p).toMatchObject({ room: '416', bed: '3', dpjpId: null, dpjpCode: 'TM', kjsDpjpIds: ['mz'], name: 'Tn. Contoh Enam', fromList: true });
    expect(patientLine(p!)).toBe('416 Bed 3/TM/Tn. Contoh Enam / 01-01-1960 / 66 tahun / RM 1600006');
  });

  it('shape B (code and nickname at the end) and shape C (short list under a DPJP heading)', () => {
    const b = readReports(msg('Tabe dokter izin mengirimkan List Pasien Lt. 5\n__________\n🫀dr. KS : 1 pasien\n1.510 bed 6/Tn. Contoh Tiga/ 29-05-73/ 53 Tahun/ RM 1600003/dr.KS/bima\nMohon izin pasien kami assess dengan :\n* CCS'));
    expect(b.map((p) => [p.room, p.bed, p.dpjpId, p.name, p.junior])).toEqual([['510', '6', 'ks', 'Tn. Contoh Tiga', 'Bima']]);
    const c = readReports(msg('Tabe dokter, izin mengirimkan list pasien pendek\n\n🫀 dr. ZD — 2 pasien\n1. 414 bed 1/ Ny. Contoh Empat/ dr. Bima/dr. Kepala\n2. 410/ Tn. Contoh Lima/ dr. Dani/dr. Kepala (KJS Aritmia)'));
    expect(c.map((p) => [p.room, p.bed, p.dpjpId, p.name, p.junior, p.chief])).toEqual([
      ['414', '1', 'zd', 'Ny. Contoh Empat', 'Bima', 'Kepala'],
      ['410', '', 'zd', 'Tn. Contoh Lima', 'Dani', 'Kepala'],
    ]);
  });

  it('"FU" marks the junior wherever it is written', () => {
    const list = readReports(
      msg(
        'mengirimkan List Pasien\n---------\n🫀 dr. KS : 2 pasien\n1. 420 bed 2/KS/Tn. Contoh Satu / RM 1600001 / FU Bima - dr. Kepala\n2. 420 bed 4/KS/Tn. Contoh Dua / RM 1600002 - dr. Kepala / dr. FU Dani',
      ),
    );
    expect(list.map((p) => [p.identity, p.junior, p.chief])).toEqual([
      ['Tn. Contoh Satu / RM 1600001', 'Bima', 'Kepala'],
      ['Tn. Contoh Dua / RM 1600002', 'Dani', 'Kepala'],
    ]);
  });

  it('a trailing " - KJS BTKV" is a note, not part of the junior\'s name', () => {
    const list = readReports(
      msg(
        'mengirimkan List Pasien\n---------\n*🫀 dr. AHA : 1 pasien (1 BTKV)*\n1. 413/AHA/Tn. Contoh Satu/15-07-1982/44 tahun/RM 1600001/dr. Kepala/FU Bima - KJS BTKV\n2. 420 Bed 6/AHA/Tn. Contoh Dua/RM 1600002/FU Dani - KJS BTKV',
      ),
    );
    expect(list.map((p) => [p.identity, p.junior, p.chief, p.btkv])).toEqual([
      ['Tn. Contoh Satu / 15-07-1982 / 44 tahun / RM 1600001', 'Bima', 'Kepala', true],
      ['Tn. Contoh Dua / RM 1600002', 'Dani', '', true],
    ]);
  });

  it('a real SOAP outranks a list line for the same patient, whichever came later', () => {
    const fromList = { ...readReports(msg('mengirimkan List Pasien\n---------\n🫀 dr. KS : 1 pasien\n1. 419 bed 4/KS/Tn. Contoh Satu / RM 1600001'))[0]!, sentAt: '2026-10-12T09:00' };
    const soap = { ...fromList, fromList: undefined, sentAt: '2026-10-12T07:00', full: 'SOAP lengkap' };
    expect(latestOf([soap, fromList])[0]!.full).toBe('SOAP lengkap');
    expect(latestOf([fromList, soap])[0]!.full).toBe('SOAP lengkap');
  });
});

describe('a sent Lt. 5-6 list of 14-10-2026 (headings in brackets, "1..", no A heading)', () => {
  const msg = (text: string) => ({ sentAt: '2026-10-14T04:00', sender: 'dr. Luar', text, index: 0 });
  const text = [
    'Tabe dokter izin mengirimkan List Pasien Lt. 5 dan Lt. 6  (14 oktober 2026) Pukul :04.00 WITA',
    '_________________________',
    'Dr. AFG (1 pasien)',
    '1. 513 bed 1/Tn. Contoh Satu/01-02-1973/53 tahun/RM 1600101',
    'Mohon izin pasien kami assess dengan',
    '-  Chronic Coronary Syndrome',
    '_____________',
    'Dr.AHA  (1 pasien)',
    '1.509/Tn. Contoh Dua/22-02-1971/55 tahun/RM 1600102',
    '-  Coronary Artery Disease 3 Vessels Disease',
    '',
    'Mohon ijin kami terapi dengan:',
    '-  Aspilet 80 mg/24jam/oral',
    '',
    'Plan',
    '-  Pro CABG',
    '_________________',
    'Prof. MZ ( 1 Pasien)',
    '',
    '1..519 Bed 2/Tn. Contoh Tiga / 07-05-1962 / 64 Tahun / RM 1600103',
    '*Mohon Izin prof, pasien kami assest dengan:*',
    '-  Symptomatic Bradycardia',
  ].join('\n');

  it('files each patient under its own bracketed heading and reads "1..519"', () => {
    expect(readReports(msg(text)).map((p) => [p.room, p.bed, p.dpjpId])).toEqual([
      ['513', '1', 'afg'],
      ['509', '', 'aha'],
      ['519', '2', 'mz'],
    ]);
  });

  it('gives diagnoses written with no heading a Diagnosis section', () => {
    const aha = readReports(msg(text))[1]!;
    expect(aha.body).toBe('Diagnosis:\n-  Coronary Artery Disease 3 Vessels Disease\n\nTerapi:\n-  Aspilet 80 mg/24jam/oral\n\nPlan\n-  Pro CABG');
  });

  it('reads "A/" as the diagnosis heading of a list block', () => {
    const one = readReports(msg(['Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4*', '🫀 dr. ZD : 1 pasien', '1. 421 Bed 4/ZD/Ny. Contoh Empat / 31-12-1957 / RM 1600104', 'A/', '- Symptomatic Bradycardia', 'P/', '- EKG/hari'].join('\n')))[0]!;
    expect(one.body.startsWith('Diagnosis:\n- Symptomatic Bradycardia')).toBe(true);
  });
});

describe('SOAP reader, 2026-10-16 audit of the Lt. 4 and Lt. 5 exports', () => {
  const msg = (text: string) => ({ sentAt: '2026-10-12T14:13', sender: 'dr. Contoh', text, index: 0 });

  it('reads "Bed bed 4" as bed 4', () => {
    const r = readReport(msg(['Assalamualaikum dokter, mohon izin melaporkan konsul kelayakan tindakan dari TS Bedah Saraf di PJT lantai 5 Kamar 510 Bed bed 4 atas nama :', '', 'tn. Contoh Satu/01-07-1955/71 tahun/ RM 01600601', '', 'DPJP Kardio : Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)', '', 'Diagnosis:', '- CCS', '', 'Plan:', '- Echo'].join('\n')))!;
    expect([r.room, r.bed, r.dpjpId]).toEqual(['510', '4', 'pk']);
  });

  it('drops zero-width characters from the identity and name', () => {
    const r = readReport(msg(['Selamat pagi dokter, mohon izin melaporkan pasien PJT Lt 4 Kamar 410 atas nama:', '', '⁠Tn. Contoh Dua/13-06-1972/53 tahun/RM 1600602', '', 'DPJP Utama : Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)', '', 'Diagnosis:', '- HF'].join('\n')))!;
    expect(r.name).toBe('Tn. Contoh Dua');
    expect(r.identity.startsWith('Tn.')).toBe(true);
  });

  it('takes a consultation\'s "Saat ini evaluasi kardiologi …" paragraph as its A when it has no Diagnosis heading', () => {
    const r = readReport(msg([
      'Selamat siang dokter, tabe dokter izin melaporkan pasien konsul byname dari TS Geriatri di PJT Lt 5 Kamar 503, atas nama:',
      '',
      'Tn. Contoh Tiga/ 69 th/ 25-12-1956/ RM 1600603',
      '',
      'Pasien dikonsulkan untuk evaluasi echocardiography',
      '',
      'Echocardiography bedside (05-10-2026)',
      'Mildly Abnormal LV systolic function, EF 42%',
      '',
      'Saat ini evaluasi kardiologi berdasarkan echocardiography bedside, pasien dengan mildly abnormal LV systolic function.',
      '',
      'Tabe mohon arahan ta dokter, terima kasih dokter.',
    ].join('\n')))!;
    expect(r.body).toBe('Saat ini evaluasi kardiologi berdasarkan echocardiography bedside, pasien dengan mildly abnormal LV systolic function.');
  });
});
