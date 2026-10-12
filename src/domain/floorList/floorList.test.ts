import { describe, expect, it } from 'vitest';

import { splitChat } from './chat';
import { buildFloorList, countLabel, patientLine, splitFloorList } from './build';
import { effective, newRosterPatient } from './floor';
import { dischargeFlag, latestPatients, listBody, manualPatient, nicknameOf, onFloorNumber, otherDepartmentUtama, readReport } from './report';

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

  it('a non-cardiology DPJP Utama makes it KJS TS Lain; cardiology or BTKV Utama does not', () => {
    expect(otherDepartmentUtama('DPJP Urologi (Utama) : dr. Contoh Satu, Sp.U\nDPJP Kardio : Dr. dr. Khalid Saleh, Sp.PD-KKV')).toBe(true);
    expect(otherDepartmentUtama('DPJP GH (Utama): dr. Contoh Dua, Sp.PD K GH')).toBe(true);
    expect(otherDepartmentUtama('DPJP Utama : Dr. dr. Khalid Saleh, Sp.PD-KKV')).toBe(false);
    expect(otherDepartmentUtama('DPJP BTKV (Utama) : dr. Contoh Tiga, Sp.BTKV')).toBe(false);
    expect(otherDepartmentUtama('- Rawat jalan mengikuti DPJP Utama')).toBe(false);
  });
});
