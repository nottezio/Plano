import { describe, expect, it } from 'vitest';

import { splitChat } from './chat';
import { buildFloorList, patientLine } from './build';
import { emptyDay, withEdits } from './floor';
import { dischargeFlag, latestPatients, listBody, nicknameOf, onFloor, readReport } from './report';

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
    expect(p.discharge).toBe('tomorrow');
  });

  it('takes the room after "ke" on a transfer, and a name with no space after Tn.', () => {
    const p = readReport(messages[2]!)!;
    expect(p).toMatchObject({ room: '408', bed: '', rm: '01733961', key: 'rm:1733961', dpjpId: 'mz', discharge: 'today' });
    expect(p.body.split('\n')[0]).toBe('Diagnosis:');
  });

  it('uses the LAST assess heading, reads Chief/Junior and an Aritmia KJS', () => {
    const p = readReport(messages[3]!)!;
    expect(p).toMatchObject({ dpjpId: 'zd', kjsDpjpIds: ['mz'], chief: 'Kepala', junior: 'Muda' });
    expect(p.body).toContain('post PPM Implantation (H-1)');
    expect(p.body).not.toContain('Jam Verifikasi');
    // "(H-1)" in a diagnosis is not a discharge plan.
    expect(p.discharge).toBeNull();
  });

  it('files a BTKV patient under the cardiology DPJP and marks KJS BTKV', () => {
    const p = readReport(messages[4]!)!;
    expect(p).toMatchObject({ dpjpId: 'afg', btkv: true, room: '415', bed: '1', junior: '', senderNick: 'Contoh' });
  });
});

describe('latestPatients / onFloor', () => {
  const messages = splitChat(EXPORT);

  it('keeps the latest report per patient (RM leading zeros ignored)', () => {
    const patients = latestPatients(messages);
    expect(patients).toHaveLength(4);
    const first = patients.find((p) => p.rm === '1234567')!;
    expect(first.sentAt).toBe('2026-10-12T06:35');
    expect(first.body).toContain('121->123->130');
  });

  it('drops who went home on an earlier day, and who has had no report since the day before', () => {
    const { present, gone } = onFloor(latestPatients(messages), '2026-10-12');
    expect(present.map((p) => p.room).sort()).toEqual(['415', '417', '421']);
    expect(gone.map((g) => [g.patient.room, g.reason])).toEqual([['408', 'pulang']]);
    // "Usul H-1 hari ini" written on the 11th is "pulang hari ini" on the 12th.
    const h1 = readReport(messages[1]!)!;
    expect(h1.discharge).toBe('tomorrow');
    expect(onFloor([h1], '2026-10-12').present[0]!.discharge).toBe('today');
    expect(onFloor([h1], '2026-10-11').present[0]!.discharge).toBe('tomorrow');
    const later = onFloor(latestPatients(messages), '2026-10-13');
    expect(later.gone.map((g) => g.reason).sort()).toEqual(['pulang', 'pulang', 'tanpa-laporan', 'tanpa-laporan']);
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
  const present = onFloor(latestPatients(splitChat(EXPORT)), '2026-10-12').present.map((p) =>
    withEdits(p, { nicknames: {} }, emptyDay('2026-10-12')),
  );
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
    expect(lines).toContain('🫀 dr. AFG : 1 pasien (1 BTKV)');
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
