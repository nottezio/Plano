import { describe, expect, it } from 'vitest';

import {
  buildCensus,
  detectSource,
  dpjpCounts,
  dpjpFullName,
  entriesFor,
  knownCodes,
  parseLists,
  parseSource,
  patientCount,
  sectionDpjp,
  segmentCodes,
  splitLists,
  unassigned,
  type ParsedSource,
} from './maker';

/*
  Anonymised copies of the five list shapes the wards send (names, RMs and
  dates invented; structure, spacing, emoji and typos kept as received).
*/

const LT4 = `Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4, Kamis, 8 Oktober 2026, 06.00 WITA*
🟡JUMLAH PASIEN :
🫀 Prof. MZ : 3 pasien
🫀 dr. ZD : 1 pasien

-------------------------------------
*🫀 Prof.  MZ : 3 Pasien*
1. 417 Bed 3/MZ/Ny.Contoh Satu / 18-11-1989/ 1700001
Diagnosis:
- Frequent PVC post ablation H-1
- Atrial Fibrilation Normoventricular Response

Mohon izin kami terapi dengan:
- Warfarin 2mg/24jam/oral

Plan:
- Cek INR/3 hari

2. Supervip/MZ/Contoh Dua/21-01-1967/ RM 100002
Diagnosis:
- Paroxysmal Atrial Fibrillation Post Successful Ablation (H1)

3..409/MZ/Ny, Contoh Tiga / 14-12-1979 / 46 tahun / RM 1700003
Diagnosis:
- Symptomatic Bradycardia ec Sinus Pause post PPM H-0
-------------------------------------
*🫀 dr. ZD :  1 Pasien*
1. 421 Bed 3/ZD/Contoh Empat/13-03-1993/ 33 tahun / RM 01700004- KJS BTKV
Diagnosis:
- Symmetrical Hypertrophy Cardiomyopathy
-------------------------------------
*🫀 dr. Prof PK :  1 pasien*
1. 410/ZD/Tn. Contoh Lima / 04-11-1963 / 63 tahun / RM 1700005
Diagnosis:
​​- Chronic Coronary Syndrome CS Type III
—----------------------------------------------------------
*👶🏻 dr. YP :  0 pasien*

Tabe terima kasih dokter`;

const ICU = `Tabe dokter mohon izin mengirimkan
LIST PASIEN CVCU/HCU/ICU PJT:
Kamis, 08 Oktober 2026, Pukul 06.00 WITA

1. CVCU Bed 1
Pasien dr. TM

2. CVCU Bed 2
KosongNy. Contoh Enam / 10-05-1945 / 81 tahun / RM 1700006/ dr ZD
Diagnosa :
* Symptomatic Bradycardia et causa TAVB
Plan
* Monitoring tanda vital

3. CVCU Bed 11
Tn Contoh Tujuh/15-10-1972/53 th/RM 01700007/ Prof MZ
Diagnosis:
•⁠  ⁠NSTEMI High Risk
•⁠  ⁠Hypertensive Heart Disease
Plan:
•⁠  ⁠Monitoring Tanda vital dan hemodinamik

4. CVCU Bed 9
Tn. Contoh Delapan / 17-07-1950 / 76 tahun / RM 1700008
Diagnosa :
- NSTEMI High Risk

ICU: 1 Pasien

1. ICU Bed 2/ Tn. Contoh Sembilan/47 tahun/09-05-1979/RM 1700009/ Prof PK
Diagnosis:
•⁠  ⁠POH-0 MICS CABG 3 Graft

Tabe terima kasih dokter`;

const RSWS = `*Pasien Baru*
1. ZD / IGD Rhesus RSWS Bed 1 / Tn. Contoh Sepuluh/ 17-01-1946/ 80 Tahun/ RM 1700010

*Pasien Pulang*
1. MZ / BC Bed 9 / Contoh Sebelas / 02-05-1969 / 57 thn / 1700011 (EP)

*Pasien Meninggal*
-
============================

*Assalamualaikum, dokter. Tabe dokter, izin mengirimkan List Pasien dan List Pemantauan RSWS Rabu 08-10-2026 Jam 07.00 WITA*

============================
*dr. ZD :  1 Pasien*
🔵 1. ZD / IGD Rhesus RSWS Bed 1 / Tn. Contoh Sepuluh/ 17-01-1946/ 80 Tahun/ RM 1700010
Diagnosis:
- Acute Lung Oedema
============================
*Prof. MZ : 1 Pasien*
1. MZ / Lontara 5 K1B1 / Tn. Contoh Duabelas / 06-07-2005 / 21 thn / 1700012 (EP)
Diagnosis:
- Atrial Flutter post Ablasi H-3
============================
*dr. PT : 1 Pasien*
🔵🔴 1. PT / HCU Bed 18 / Tn. Contoh Tigabelas / 17-06-1955 / 72 tahun / RM 00700013 (Resa)
Diagnosis:
HHD
============================

dr. AHN : 0 Pasien / dr. AFM : 0 Paisen

Tabe terima kasih dokter.`;

const LT56 = `Tabe dokter izin mengirimkan List Pasien Lt. 5 dan Lt. 6  (8 oktober 2026) Pukul : 05.00

🫀dr. ZD : 1 pasien
____________________________________________________
🫀Dr. ZD ( 1 pasien)
1.518 bed 1/Tn. Contoh Empatbelas/21-06-2001/ 25 tahun/ RM   700014/dr.ZD-dr.AAU/resa
Mohon izin kami assess dengan
- ASD Secundum Bidirectional Shunt
- WPW Syndrome Type B

Mohon izin kami terapi dengan
- Warfarin 2mg/24jam/oral

TS GH
Assesment
- Chronic Kidney Disease G5D
___________________________________________________
🫀Prof. MZ (1 Pasien)
1.515 bed 2/Tn. Contoh Limabelas / 04-01-1947 / 79 tahun / RM 700015/prof.MZ
Mohon izin kami assess dengan:
* Congestive Heart Failure NYHA III

_________________________________________________
👶🏻 dr. YP : 0  Pasien
1.517 bed 4/ny.contoh/dr.YP
Diagnosis : stenosis pulmonal
2.510 bed 3/contoh enambelas/1700016/dr.YP
Diagnosa ; Atrial Septal Defect Secundum
____________________________________________
List Pasien Lt. 6  1 pasien

Prof.MZ : 1 Pasien
1.617 bed 1/nn. Contoh Tujuhbelas/20-10-2011/14 tahun/01700017/prof.MZ/tika
Mohon izin kami assess dengan
- Post Supraventricular Tachycardia (documented)`;

const RSUH = `*Pasien Baru*
1. ARB / IGD RSUH Bed 3 / Tn. Contoh Delapanbelas/ 28-08-1974 / 52 Tahun/ RM 200018

*Pasien Pulang*
1. AAU/ Sandeq 306/ Ny. Contoh Pulang/ 03-03-1953/ 73 Tahun/ RM 275019
============================

*Assalamualaikum, dokter. Tabe dokter, izin mengirimkan List Pasien dan List Pemantauan RSUH Rabu, 08-10-2026 Jam 07.00 WITA*
============================
*dr. ARB (1 pasien)*
1. ARB / IGD RSUH Bed 3 / Tn. Contoh Delapanbelas/ 28-08-1974 / 52 Tahun/ RM 200018
Diagnosa:
- NSTEMI High Risk
============================
*dr. AAU (Pediatri 1 pasien)*
1. AAU/PICU RSUH/ Contoh Anak/ 29-6-2026/ 1 bulan/ RM 271620 (Tika)
Diagnosis:
* Patent ductus arteriosus
============================
*dr. TI (1 Pasien)*
1. KJS Neuro/ TI/ Sandeq 311/Tn. Contoh Duapuluh / 193621 / 81 tahun / 01-01-1945*
Diagnosis:
* Hypertensive Heart Disease

Tabe terima kasih dokter.`;

function parseAll(...texts: string[]): ParsedSource[] {
  const first = texts.map((text) => parseSource(text));
  const known = knownCodes(first);
  return texts.map((text) => parseSource(text, known));
}

describe('detectSource', () => {
  it('tells the five lists apart by their own header', () => {
    expect(detectSource(LT4)).toMatchObject({ kind: 'pjt-ward', floor: 'LT4' });
    expect(detectSource(ICU)).toMatchObject({ kind: 'pjt-icu' });
    expect(detectSource(RSWS)).toMatchObject({ kind: 'rsws' });
    expect(detectSource(LT56)).toMatchObject({ kind: 'pjt-ward', floor: 'LT5', label: 'PJT Lt. 5 dan 6' });
    expect(detectSource(RSUH)).toMatchObject({ kind: 'rsuh' });
  });
});

describe('segmentCodes', () => {
  const known = new Set(['MZ', 'ZD', 'AAU', 'PT']);
  it('reads every spelling of a code', () => {
    expect(segmentCodes('MZ', known)).toEqual(['MZ']);
    expect(segmentCodes(' prof.MZ', known)).toEqual(['MZ']);
    expect(segmentCodes(' dr ZD', known)).toEqual(['ZD']);
    expect(segmentCodes('ZD (UTAMA) ', known)).toEqual(['ZD']);
    expect(segmentCodes('dr.ZD-dr.AAU', known)).toEqual(['ZD', 'AAU']);
  });
  it('does not take a resident name or a ward for a code', () => {
    expect(segmentCodes('tika', known)).toBeNull();
    expect(segmentCodes('Resaa', known)).toBeNull();
    expect(segmentCodes('PCC', known)).toBeNull();
    expect(segmentCodes('pt', known)).toBeNull();
  });
});

describe('PJT Lantai 4 list', () => {
  const [lt4] = parseAll(LT4);

  it('moves the code to the front and keeps the rest as written', () => {
    const mz = entriesFor([lt4!], 'MZ');
    expect(mz.map((entry) => entry.place)).toEqual(['LT4', 'LT4', 'LT4']);
    const text = buildCensus({ sources: [lt4!], code: 'MZ', date: '2026-10-08', address: 'dokter', style: 'front' }).text;
    expect(text).toContain('1. MZ/417 Bed 3/Ny.Contoh Satu / 18-11-1989/ 1700001\nDiagnosis:\n- Frequent PVC post ablation H-1\n- Atrial Fibrilation Normoventricular Response\n\n2.');
    expect(text).toContain('2. MZ/Supervip/Contoh Dua/21-01-1967/ RM 100002');
    expect(text).toContain('3. MZ/409/Ny, Contoh Tiga');
  });

  it('stops the diagnosis at the therapy and plan', () => {
    const [first] = entriesFor([lt4!], 'MZ');
    expect(first!.diagnoses).toHaveLength(2);
  });

  it("files a patient by the code on the line, not by the section it was pasted into", () => {
    // Prof PK's section carries one of dr. ZD's patients.
    expect(entriesFor([lt4!], 'PK')).toHaveLength(0);
    expect(entriesFor([lt4!], 'ZD').map((entry) => entry.key)).toEqual(['rm:1700004', 'rm:1700005']);
  });

  it('removes invisible characters before the bullet', () => {
    const five = entriesFor([lt4!], 'ZD')[1]!;
    expect(five.diagnoses).toEqual(['- Chronic Coronary Syndrome CS Type III']);
  });
});

describe('CVCU/HCU/ICU list', () => {
  const [icu] = parseAll(ICU);

  it('takes the bed from its own line and the code from the end', () => {
    const front = buildCensus({ sources: [icu!], code: 'MZ', date: '2026-10-08', address: 'dokter', style: 'front' }).text;
    expect(front).toContain('*CVCU/HCU/ICU PJT : 1 pasien*\n1. MZ/CVCU Bed 11/Tn Contoh Tujuh/15-10-1972/53 th/RM 01700007\nDiagnosis:\n- NSTEMI High Risk\n- Hypertensive Heart Disease\n');
    const asis = buildCensus({ sources: [icu!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(asis).toContain('1. CVCU Bed 11/ Tn Contoh Tujuh/15-10-1972/53 th/RM 01700007/ Prof MZ\n');
  });

  it('reads "KosongNy." as the patient and skips beds with nobody listed', () => {
    const zd = entriesFor([icu!], 'ZD');
    expect(zd).toHaveLength(1);
    expect(zd[0]!.rest).toBe('Ny. Contoh Enam / 10-05-1945 / 81 tahun / RM 1700006');
    expect(zd[0]!.diagnoses).toEqual(['- Symptomatic Bradycardia et causa TAVB']);
  });

  it('reads the ICU line with the bed inline', () => {
    const pk = entriesFor([icu!], 'PK');
    expect(pk).toHaveLength(1);
    expect(pk[0]!.location).toBe('ICU Bed 2');
  });

  it('reports a patient with no DPJP instead of dropping them', () => {
    expect(unassigned([icu!]).map((entry) => entry.key)).toEqual(['rm:1700008']);
  });
});

describe('RSWS list', () => {
  const [rsws] = parseAll(RSWS);

  it('prints the line as written, drops the marker emoji and nickname, keeps (EP)', () => {
    const text = buildCensus({ sources: [rsws!], code: 'PT', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('1. PT / HCU Bed 18 / Tn. Contoh Tigabelas / 17-06-1955 / 72 tahun / RM 00700013\nDiagnosis:\nHHD');
    const mz = buildCensus({ sources: [rsws!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(mz).toContain('1. MZ / Lontara 5 K1B1 / Tn. Contoh Duabelas / 06-07-2005 / 21 thn / 1700012 (EP)');
  });

  it('leaves out Pasien Pulang and counts Pasien Baru once, with its diagnosis', () => {
    expect(entriesFor([rsws!], 'MZ')).toHaveLength(1);
    const zd = entriesFor([rsws!], 'ZD');
    expect(zd).toHaveLength(1);
    expect(zd[0]!.diagnoses).toEqual(['- Acute Lung Oedema']);
  });
});

describe('PJT Lantai 5 dan 6 list', () => {
  const [lt56] = parseAll(LT56);

  it('reads "Mohon izin kami assess dengan" as the diagnosis and stops at TS blocks', () => {
    const zd = entriesFor([lt56!], 'ZD');
    expect(zd[0]!.diagnoses).toEqual(['- ASD Secundum Bidirectional Shunt', '- WPW Syndrome Type B']);
  });

  it('lists a joint patient under both DPJPs, with the census DPJP in front', () => {
    const aau = buildCensus({ sources: [lt56!], code: 'AAU', date: '2026-10-08', address: 'dokter', style: 'front' }).text;
    expect(aau).toContain('1. AAU/518 bed 1/Tn. Contoh Empatbelas/21-06-2001/ 25 tahun/ RM   700014\n');
  });

  it("drops the resident's name after a trailing code", () => {
    const mz = buildCensus({ sources: [lt56!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(mz).toContain('*PJT Lt. 6 : 1 pasien*\n1. 617 bed 1/nn. Contoh Tujuhbelas/20-10-2011/14 tahun/01700017/prof.MZ\n');
    expect(mz).not.toContain('tika');
    expect(mz).toContain('*PJT Lt. 5 : 1 pasien*');
  });

  it('reads a diagnosis written on the heading line, after ":" or ";"', () => {
    const yp = entriesFor([lt56!], 'YP');
    expect(yp.map((entry) => entry.diagnoses)).toEqual([['stenosis pulmonal'], ['Atrial Septal Defect Secundum']]);
  });
});

describe('RSUH list', () => {
  const [rsuh] = parseAll(RSUH);

  it('reads a code that is only in a section header (dr. TI)', () => {
    const ti = entriesFor([rsuh!], 'TI');
    expect(ti).toHaveLength(1);
    expect(ti[0]!.rest).toBe('KJS Neuro/ TI/ Sandeq 311/Tn. Contoh Duapuluh / 193621 / 81 tahun / 01-01-1945');
  });

  it('leaves out the discharged patient', () => {
    expect(entriesFor([rsuh!], 'AAU').map((entry) => entry.key)).toEqual(['rm:271620']);
  });
});

describe('the whole census', () => {
  it('has the shape the residents send: every covered place, zeros included', () => {
    const sources = parseAll(LT4, ICU, RSWS, LT56, RSUH);
    const text = buildCensus({ sources, code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    const lines = text.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'Assalamualaikum. Tabe Dokter, mohon izin melaporkan sensus pasien',
      `_*${dpjpFullName('MZ')}*_`,
      'Di RSWS, RSUH, CVCU/HCU/ICU PJT, PJT Lt. 4, PJT Lt. 5 dan PJT Lt. 6 (Kamis, 08/10/2026)',
      '',
      '*Total Pasien : 7 pasien*',
    ]);
    expect(lines.filter((line) => /^\*.* : \d+ pasien\*$/.test(line) && !line.startsWith('*Total'))).toEqual([
      '*RSWS : 1 pasien*',
      '*RSUH : 0 pasien*',
      '*CVCU/HCU/ICU PJT : 1 pasien*',
      '*PJT Lt. 4 : 3 pasien*',
      '*PJT Lt. 5 : 1 pasien*',
      '*PJT Lt. 6 : 1 pasien*',
    ]);
    expect(lines.at(-1)).toBe('Tabe terima kasih dokter.');
  });

  it('separates patients with a blank line', () => {
    const text = buildCensus({ sources: parseAll(LT4), code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('- Atrial Fibrilation Normoventricular Response\n\n2. Supervip/MZ/Contoh Dua');
  });

  it('reports only the places a pasted list covers', () => {
    // No RSWS or RSUH list pasted: saying "RSWS : 0" would be a claim nobody checked.
    const text = buildCensus({ sources: parseAll(LT4), code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('Di PJT Lt. 4 (Kamis, 08/10/2026)');
    expect(text).not.toContain('RSWS');
  });

  it('still writes a census for a DPJP with nobody listed', () => {
    const text = buildCensus({ sources: parseAll(LT4, ICU), code: 'AFM', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('*Total Pasien : 0 pasien*');
    expect(text).toContain('*CVCU/HCU/ICU PJT : 0 pasien*\n\n*PJT Lt. 4 : 0 pasien*');
  });

  it('addresses a Prof when asked', () => {
    const sources = parseAll(LT4);
    const text = buildCensus({ sources, code: 'MZ', date: '2026-10-08', address: 'prof' }).text;
    expect(text.startsWith('Assalamualaikum. Tabe Prof,')).toBe(true);
    expect(text.endsWith('Tabe terima kasih Prof.')).toBe(true);
  });

  it('counts every DPJP once per patient across lists', () => {
    const counts = dpjpCounts(parseAll(LT4, ICU, RSWS, LT56, RSUH));
    expect(counts.find((row) => row.code === 'ZD')?.count).toBe(5);
    expect(counts.find((row) => row.code === 'MZ')?.count).toBe(7);
  });
});

describe('a diagnosis block that holds the therapy', () => {
  const LIST = `Tabe dokter mohon izin mengirimkan *List Pasien PJT Lantai 4*
*🫀 dr. AHN : 1 Pasien*
1. 407/AHN/Ny. Contoh / 16-04-1959 / 67 Tahun / RM 1700030
Diagnosis:
- IVFD NaCl 500 cc/24 jam/IV
- Clopidogrel 75 mg/24 jam/oral
- Furosemide 40 mg/24 jam/oral (bila sesak)

Plan :
- Monitoring tanda vital`;

  it('prints "-" and flags it instead of passing drugs off as diagnoses', () => {
    const [entry] = entriesFor(parseAll(LIST), 'AHN');
    expect(entry!.diagnoses).toEqual([]);
    expect(entry!.dxWasTherapy).toBe(true);
  });

  it('leaves a real diagnosis that mentions a dose alone', () => {
    const [lt4] = parseAll(LT4);
    expect(entriesFor([lt4!], 'MZ').every((entry) => !entry.dxWasTherapy)).toBe(true);
  });
});

describe('IGD PJT list', () => {
  // Shape as sent (zones, bolded lines, a Sisrute block); names invented.
  const IGD = `Tabe dokter izin mengirimkan List Pasien IGD PJT Kamis, 08-10-2026, pukul 16.00 WITA

Total Pasien: 3 Pasien
Pasien Baru: 2 Pasien
Sisrute: 2 Pasien

🔴 Red Zone: 2 Pasien

1. *IGD Red Zone Bed 3 / Ny. Contoh Satu / RM 800001 / dr. ARB*
_Sementara diterima

2. *IGD Red Zone bed 4 /*\u200eTn.Contoh Dua / 01700002 / 58 tahun / RM 01700002/Prof. MZ* 
Diagnosis
- Congestive Heart Failure NYHA III
- Hipokalemia (3.4)
\u200e
\u200e*Plan:*
- Monitoring tanda vital dan hemodinamik

🟡 Yellow Zone: 1 pasien

1. *YZ Bed 8 / *Tn. Contoh Tiga / 07-01-1962 / 64 tahun / RM 1700003 / dr. ARB*
Diagnosis
- Chronic Coronary Syndrome Clinical Presentation Type III
Plan:
- Pantau tanda vital

🟢 Green Zone: 0 pasien

🚑 Sisrute: 2 pasien

1. RSUD Contoh / Ny. Rujukan / 65 tahun/ STEMI inferior onset 24 jam / Sudah Acc

2. RS Contoh Lain / Tn. Rujukan Dua / Chest Pain / Belum Acc dari Sisrute Central

Tabe terima kasih, Dokter.`;

  const [igd] = parseAll(IGD);

  it('is its own place, every zone together', () => {
    expect(igd!.kind).toBe('pjt-igd');
    const text = buildCensus({ sources: [igd!], code: 'ARB', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain(
      '*IGD PJT : 2 pasien*\n1. IGD Red Zone Bed 3 / Ny. Contoh Satu / RM 800001 / dr. ARB\nDiagnosis:\n-\n\n2. YZ Bed 8 / Tn. Contoh Tiga / 07-01-1962 / 64 tahun / RM 1700003 / dr. ARB\nDiagnosis:\n- Chronic Coronary Syndrome Clinical Presentation Type III',
    );
  });

  it('reads the DPJP at the end of a bolded line and stops the diagnosis at Plan', () => {
    const [mz] = entriesFor([igd!], 'MZ');
    expect(mz!.asWritten).toBe('IGD Red Zone bed 4 /Tn.Contoh Dua / 01700002 / 58 tahun / RM 01700002/Prof. MZ');
    expect(mz!.diagnoses).toEqual(['- Congestive Heart Failure NYHA III', '- Hipokalemia (3.4)']);
  });

  it('leaves the Sisrute referrals out: they are requests, not patients', () => {
    expect(igd!.entries).toHaveLength(3);
    expect(unassigned([igd!])).toEqual([]);
  });
});

describe('AI mode output', () => {
  it('keeps well-formed patients and drops malformed ones', async () => {
    const { readAiCensus, formatCensus } = await import('./maker');
    const groups = readAiCensus({
      patients: [
        { place: 'LT4', identity: 'MZ/417 Bed 3/Ny. Contoh / RM 1700001', diagnoses: ['• CHF'] },
        { place: 'Mars', identity: 'x', diagnoses: [] },
        { place: 'RSWS', identity: '', diagnoses: [] },
        'junk',
      ],
    });
    expect(groups).toEqual([{ place: 'LT4', patients: [{ identity: 'MZ/417 Bed 3/Ny. Contoh / RM 1700001', diagnoses: ['- CHF'] }] }]);
    const text = formatCensus({ code: 'MZ', date: '2026-10-08', address: 'dokter', groups });
    expect(text).toContain('*PJT Lt. 4 : 1 pasien*\n1. MZ/417 Bed 3/Ny. Contoh / RM 1700001\nDiagnosis:\n- CHF');
    expect(readAiCensus(null)).toEqual([]);
  });
});

/*
  2026-10-09: shapes from Avi's lists of 9 October (anonymised). A RSUH entry
  numbered without a dot and marked KJS; an assessment block split into
  "Diagnosis Utama" / "Diagnosis Sekunder"; a CVCU patient with no DPJP code
  (the one the AI put into ARB's census).
*/
const RSUH_KJS = `*Assalamualaikum, dokter. Tabe dokter, izin mengirimkan List Pasien dan List Pemantauan RSUH Jumat, 09-10-2026 Jam 05.00 WITA*

*Pasien Baru*
1. ARB / 603 Lepa B Bed 3 / Tn. Contoh Uro/ 01-02-1962 / 63 Tahun/ RM 1930011
============================
*dr. ARB (2 pasien)*
1. ARB / Katinting 502 Bed 3 / Tn. Contoh Dua/ 01-03-1974 / 52 Tahun/ RM 2000586
Diagnosis:
- NSTEMI High Risk

2 KJS Uro / ARB / 603 Lepa B Bed 3 / Tn. Contoh Uro/ 01-02-1962 / 63 Tahun/ RM 1930011
Diagnosis :
- Chronic Coronary Syndrome Type 3
- Hypertensive Heart Disease
`;

const LT5_SUBHEADINGS = `Tabe dokter izin mengirimkan List Pasien Lt. 5 dan Lt. 6  (9 oktober 2026)
🫀Dr. AHN (1  Pasien)
1.519 bed 1/Tn Contoh/ 01-04-1980 / 45 Tahun / RM 1700592/dr.AHN
Mohon izin kami assess dengan:
Diagnosis Utama : 
- Ischemic Heart Disease 

Diagnosis Sekunder:
- Coronary Artery Disease 3 Vessel Disease
- Heart failure reduced ejection fraction  

Mohon izin kami terapi dengan:
- Aspilet 80mg/24jam/oral
`;

const CVCU_NO_CODE = `Tabe dokter mohon izin mengirimkan
LIST PASIEN CVCU/HCU/ICU PJT:
Jumat, 09 Oktober 2026, Pukul 05.15 WITA

12. CVCU Bed 12
(BTKV) Contoh Btkv / 01-01-1959 / 67 tahun / RM 1700019/ ARB
Diagnosis
- NSTEMI High Risk

18. CVCU Super VIP
Ny. dr. Contoh Vip/ 01 Januari 1950/76 tahun/ RM 2500006
Diagnosa:
- Acute Pulmonary Oedema (perbaikan)
`;

describe('2026-10-09 list shapes', () => {
  it('reads a numbered line without a dot, and keeps the full entry over the "Pasien Baru" one', async () => {
    const { entriesFor: forCode } = await import('./maker');
    const source = parseSource(RSUH_KJS);
    const arb = forCode([source], 'ARB');
    expect(arb).toHaveLength(2);
    const uro = arb.find((entry) => entry.key === 'rm:1930011');
    expect(uro?.asWritten).toBe('KJS Uro / ARB / 603 Lepa B Bed 3 / Tn. Contoh Uro/ 01-02-1962 / 63 Tahun/ RM 1930011');
    expect(uro?.diagnoses).toEqual(['- Chronic Coronary Syndrome Type 3', '- Hypertensive Heart Disease']);
  });

  it('does not read a bare room number as a patient number', () => {
    // Since 2026-10-14 an unnumbered patient line is read (lists do send
    // them); what must not happen is "512" becoming patient 51 in "2 bed 2".
    const source = parseSource('List Pasien PJT Lantai 4\n512 bed 2/Tn. Contoh/RM 1700002/dr.ARB\n');
    expect(source.entries.map((entry) => [entry.place, entry.asWritten])).toEqual([['LT5', '512 bed 2/Tn. Contoh/RM 1700002/dr.ARB']]);
  });

  it('reads "Diagnosis Utama" and "Diagnosis Sekunder" as one block', () => {
    const [entry] = parseSource(LT5_SUBHEADINGS).entries;
    expect(entry?.diagnoses).toEqual([
      '- Ischemic Heart Disease',
      '- Coronary Artery Disease 3 Vessel Disease',
      '- Heart failure reduced ejection fraction',
    ]);
  });

  it('leaves a CVCU patient without a DPJP code unassigned', () => {
    const source = parseSource(CVCU_NO_CODE);
    expect(entriesFor([source], 'ARB').map((entry) => entry.key)).toEqual(['rm:1700019']);
    expect(unassigned([source]).map((entry) => entry.key)).toEqual(['rm:2500006']);
  });
});

describe('KJS', () => {
  it('reads the four ways the lists mark it', async () => {
    const { kjsOf } = await import('./maker');
    expect(kjsOf('KJS Uro / ARB / 603 Lepa B Bed 3 / Tn. X')).toBe('KJS Uro');
    expect(kjsOf('ZD (KJS) / Lontara 1 Kamar 8 / Tn. X')).toBe('KJS');
    expect(kjsOf('421 Bed 3/ZD/Contoh/RM 01700052- KJS BTKV')).toBe('KJS BTKV');
    expect(kjsOf('CVCU Bed 12 (BTKV) Contoh / RM 1700019/ ARB')).toBe('KJS BTKV');
    expect(kjsOf('ZD (UTAMA) / ICU IC Kamar 2 / Ny. X')).toBeNull();
    expect(kjsOf('MZ/417 Bed 3/Ny. X')).toBeNull();
  });

  it('marks the census line unless it already says KJS', () => {
    const census = buildCensus({
      sources: [parseSource(CVCU_NO_CODE), parseSource(RSUH_KJS)],
      code: 'ARB',
      date: '2026-10-09',
      address: 'dokter',
    }).text;
    expect(census).toContain('(BTKV) Contoh Btkv / 01-01-1959 / 67 tahun / RM 1700019/ ARB (KJS BTKV)');
    expect(census).toContain('1. KJS Uro / ARB / 603 Lepa B');
    expect(census).not.toContain('RM 1930011 (KJS');
  });
});

describe('AI checked against the rules', () => {
  it('asks the AI to confirm the rules, and to put patients without a code in `uncertain`, not exclude them', async () => {
    const { sensusAiPrompt } = await import('./maker');
    const sources = [parseSource(CVCU_NO_CODE)];
    const prompt = sensusAiPrompt({
      code: 'ARB',
      texts: [CVCU_NO_CODE],
      candidates: entriesFor(sources, 'ARB'),
      noCode: unassigned(sources),
    });
    expect(prompt).toContain('[CVCU] RM 1700019');
    expect(prompt).toMatch(/`uncertain`[\s\S]*RM 2500006/);
    expect(prompt).not.toContain('JANGAN dimasukkan');
  });

  it('reads RM and source line, and shows what only one side found, with why', async () => {
    const { readAiPatients, checkAiCensus } = await import('./maker');
    const sources = [parseSource(CVCU_NO_CODE), parseSource(RSUH_KJS)];
    const rules = entriesFor(sources, 'ARB');
    const ai = readAiPatients({
      patients: [
        // The one the AI invented an owner for:
        { place: 'CVCU', rm: '2500006', source_line: 'Ny. dr. Contoh Vip/ 01 Januari 1950/76 tahun/ RM 2500006', dpjp_from: 'judul_bagian', identity: 'CVCU Super VIP / Ny. dr. Contoh Vip', diagnoses: ['- APO'] },
        // Matched, but with no diagnosis:
        { place: 'CVCU', rm: '01700019', source_line: '(BTKV) Contoh Btkv / RM 1700019/ ARB', dpjp_from: 'baris', kjs: 'KJS BTKV', identity: 'CVCU Bed 12/ (BTKV) Contoh Btkv', diagnoses: [] },
        { place: 'RSUH', rm: '2000586', source_line: 'ARB / Katinting 502 Bed 3 / Tn. Contoh Dua', dpjp_from: 'baris', identity: 'ARB / Katinting 502 Bed 3 / Tn. Contoh Dua', diagnoses: ['- NSTEMI High Risk'] },
        // Not in any pasted list:
        { place: 'LT4', rm: '9999999', source_line: '', dpjp_from: 'baris', identity: '401/ARB/Tn. Hantu', diagnoses: [] },
      ],
    });
    expect(ai[1]?.rm).toBe('1700019');

    const check = checkAiCensus({ ai, rules, sources, texts: [CVCU_NO_CODE, RSUH_KJS] });
    expect(check.matched).toBe(2);
    expect(check.onlyAi.map((item) => [item.patient.rm, item.inLists, item.rules])).toEqual([
      ['2500006', true, 'Aturan: tidak ada kode DPJP di barisnya'],
      ['9999999', false, 'RM/baris ini tidak ada di list yang ditempel'],
    ]);
    expect(check.onlyRules.map((entry) => entry.key)).toEqual(['rm:1930011']);
    expect(check.dxMissing.map(({ entry }) => entry.key)).toEqual(['rm:1700019']);
  });
});

describe('"Perlu dicek" (cross-check)', () => {
  it('reads the AI\'s unsure patients with their reasons', async () => {
    const { readAiUncertain, readAiPatients } = await import('./maker');
    const raw = {
      patients: [],
      uncertain: [
        { place: 'CVCU', rm: '2500006', source_line: 'Ny. dr. Contoh Vip/ RM 2500006', identity: 'CVCU Super VIP / Ny. dr. Contoh Vip', diagnoses: ['- APO'], reason: 'tidak ada kode DPJP; bed setelah pasien ARB' },
        { place: 'Mars', identity: 'x', diagnoses: [], reason: 'junk' },
      ],
    };
    expect(readAiPatients(raw)).toEqual([]);
    const unsure = readAiUncertain(raw);
    expect(unsure).toHaveLength(1);
    expect(unsure[0]).toMatchObject({ rm: '2500006', reason: 'tidak ada kode DPJP; bed setelah pasien ARB' });
  });

  it('puts an included patient into the rules census only when chosen', () => {
    const sources = [parseSource(CVCU_NO_CODE)];
    const [unowned] = unassigned(sources);
    const without = buildCensus({ sources, code: 'ARB', date: '2026-10-09', address: 'dokter' });
    const withIt = buildCensus({ sources, code: 'ARB', date: '2026-10-09', address: 'dokter', extra: unowned ? [unowned] : [] });
    expect(without.text).not.toContain('Contoh Vip');
    expect(withIt.text).toContain('Contoh Vip');
    expect(withIt.text).toContain('*Total Pasien : 2 pasien*');
  });

  it('does not report a patient the user included by hand as an AI disagreement', async () => {
    const { checkAiCensus, entryAsAiPatient } = await import('./maker');
    const sources = [parseSource(CVCU_NO_CODE)];
    const [unowned] = unassigned(sources);
    const rules = buildCensus({ sources, code: 'ARB', date: '2026-10-09', address: 'dokter', extra: [unowned!] }).entries;
    const ai = rules.map((entry) => entryAsAiPatient(entry, 'ARB', 'asis', entry === unowned ? 'manual' : 'baris'));
    const check = checkAiCensus({ ai, rules, sources, texts: [CVCU_NO_CODE] });
    expect(check.onlyAi).toEqual([]);
    expect(check.onlyRules).toEqual([]);
  });
});

/*
  The CVCU/HCU/ICU list as sent on 12-10-2026: bed lines NOT numbered, the
  patient on the next line with the DPJP at the end. Names invented.
*/
const ICU_UNNUMBERED = [
  'Tabe dokter mohon izin mengirimkan',
  'LIST PASIEN CVCU/HCU/ICU PJT:',
  'Senin, 12 Oktober 2026, Pukul 05.00 WITA',
  '',
  'Pasien CVCU/HCU Cardio: 4 Pasien',
  'Total Pasien CVCU/HCU/ICU: 5 Pasien',
  '',
  'CVCU Bed 1',
  'Ny. Satu / 31-12-1967 / 58 tahun / RM 8100001 / dr. ARB',
  'Diagnosis:',
  '- STEMI Inferior',
  '- Hypertensive Heart Disease',
  'Plan:',
  '- Monitoring tanda vital',
  '',
  'CVCU Bed 2',
  'Kosong',
  '',
  'CVCU Bed 3',
  'pasien dr. NP',
  '',
  ' CVCU Bed 4',
  'Tn. Dua/76 tahun/01-07-1950/RM 8100002/Prof MZ',
  'Diagnosis :',
  '•⁠  ⁠NSTEMI High Risk',
  'Plan :',
  '- Cek APTT/hari',
  'CVCU Super VIP',
  'Ny. Tiga/ 05 September 1950/76 tahun/ RM 8100003/ AHA->AHN',
  'Diagnosa:',
  '- Acute Pulmonary Oedema (perbaikan)',
  '',
  ' HCU Bed 1',
  'Pediatri',
  '',
  '1. ICU 5',
  'Tn. Empat / 05-07-1963 / 63 tahun / RM 8100004/ dr. AHA',
  'Diagnosis : ',
  '- Severe Aortic Stenosis',
  '',
  'ICU Bed 7',
  '(BTKV) Lima / 5-09-1959 / 67 tahun / RM 8100005/ ARB',
  'Diagnosis',
  '- CAD 3VD pro CABG',
].join('\n');

describe('CVCU list with unnumbered bed lines (2026-10-12)', () => {
  const src = parseSource(ICU_UNNUMBERED);
  const rms = src.entries.map((entry) => entry.key);

  it('reads every occupied bed, numbered or not', () => {
    // Before: only "1. ICU 5" was read; the rest became its plan.
    expect(rms).toEqual(['rm:8100001', 'rm:8100002', 'rm:8100003', 'rm:8100004', 'rm:8100005']);
  });

  it('skips empty and other-doctor beds', () => {
    expect(src.entries.some((entry) => /kosong|pasien dr|pediatri/i.test(entry.asWritten))).toBe(false);
  });

  it('keeps each patient to their own diagnoses', () => {
    expect(src.entries[0]?.diagnoses).toEqual(['- STEMI Inferior', '- Hypertensive Heart Disease']);
    expect(src.entries[1]?.diagnoses).toHaveLength(1);
    expect(src.entries[1]?.asWritten).toBe('CVCU Bed 4/ Tn. Dua/76 tahun/01-07-1950/RM 8100002/Prof MZ');
  });

  it('reads the DPJP at the end of the line, and a handover as its target', () => {
    expect(src.entries.map((entry) => entry.dpjps.join('+'))).toEqual(['ARB', 'MZ', 'AHN', 'AHA', 'ARB']);
    expect(src.entries[4]?.kjs).toBe('KJS BTKV');
  });
});

describe('segmentCodes handover', () => {
  const known = new Set(['AHA', 'AHN', 'MZ']);
  it('takes the DPJP after the arrow', () => {
    expect(segmentCodes('AHA->AHN', known)).toEqual(['AHN']);
    expect(segmentCodes('AHA → AHN', known)).toEqual(['AHN']);
  });
  it('ignores arrows that are not between two codes', () => {
    expect(segmentCodes('5.9 -> 5.6', known)).toBeNull();
    expect(segmentCodes('AHA -> Pulang', known)).toBeNull();
  });
});

describe('IGD and CVCU list shapes (12.12, Avi: DPJP often not read)', () => {
  const igd = [
    'Tabe dokter izin mengirimkan List Pasien IGD PJT *Selasa, 13-10-2026, pukul 07.00 WITA*',
    '',
    ' Red Zone: 2 Pasien',
    '',
    '1. IGD Red Zone Bed 1/ Tn. Contoh Satu/ 25-08-1970/56 Tahun/RM 1700001 /DPJP Prof PK',
    'Diagnosis:',
    '- NSTEMI',
    '',
    '2. IGD Red Zone Bed 6/Tn. Contoh Dua/05-12-1965/60 tahun/RM 1700002/DPJP prof PK',
    'Diagnosis:',
    '- Cardiogenic shock',
  ].join('\n');
  const cvcu = [
    'Tabe dokter mohon izin mengirimkan',
    'LIST PASIEN CVCU/HCU/ICU PJT:',
    'Selasa, 13 Oktober 2026, Pukul 07.00 WITA',
    '',
    '*3. CVCU Bed 3*',
    'Tn. Contoh Tiga/ 49 tahun / 31-12-1976/ RM 1700003/ *DPJP Prof MZ* (Arago- Malik) ( *Pemantauan* )',
    'Diagnosis :',
    '- STEMI',
    '',
    '13. CVCU Bed 13',
    'Tn. Contoh Empat/ 09-06-1969/ 57 Tahun / RM 1700004 dr. AHN (Firah -Malik)',
    'Diagnosis',
    '- CCS',
    '',
    '15. CVCU Bed 15 (Ara - dr. Malik)',
    'Tn.Contoh Lima / 56 tahun / 20-05-1970/ RM 1700005 Prof MZ (Ara - dr. Malik)',
    '*Diagnosa*',
    '- NSTEMI',
    '',
    '3. HCU Bed 3',
    '*Nn. Contoh Enam / 12-06-2007 / 19 tahun / RM 1700006/dr. KS (KJS BTKV)* (Haliim - Malik)',
    'Diagnosis',
    '- POD-3 AVR',
  ].join('\n');

  it('reads "DPJP Prof PK", a code after the RM with a space, and codes followed by several brackets', () => {
    const sources = [parseSource(igd), parseSource(cvcu)];
    const known = knownCodes(sources);
    const all = [parseSource(igd, known), parseSource(cvcu, known)].flatMap((s) => s.entries);
    expect(all.map((e) => e.dpjps.join('+'))).toEqual(['PK', 'PK', 'MZ', 'AHN', 'MZ', 'KS']);
  });

  it('drops the resident pair, keeps the KJS note', () => {
    const entries = parseSource(cvcu).entries;
    expect(entries.map((e) => e.asWritten)).toEqual([
      'CVCU Bed 3/ Tn. Contoh Tiga/ 49 tahun / 31-12-1976/ RM 1700003/ DPJP Prof MZ',
      'CVCU Bed 13/ Tn. Contoh Empat/ 09-06-1969/ 57 Tahun / RM 1700004/ dr. AHN',
      'CVCU Bed 15/ Tn.Contoh Lima / 56 tahun / 20-05-1970/ RM 1700005/ Prof MZ',
      'HCU Bed 3/ Nn. Contoh Enam / 12-06-2007 / 19 tahun / RM 1700006/dr. KS (KJS BTKV)',
    ]);
  });
});

/*
  2026-10-14 (Avi: "the sensus maker can't detect this format"). Three shapes
  of the 14-10 lists, invented names and RMs:
  - the morning lists pasted into ONE box, hospital lists with their
    "Pasien Baru / Pulang" block above the greeting;
  - the IGD list with no numbers on its patient lines;
  - a two-letter resident tag "(Ai)" after the RSWS line.
*/
const IGD_BARE = `Tabe dokter izin mengirimkan List Pasien IGD PJT *Rabu, 14-10-2026, pukul 06.00 WITA*

Total Pasien: 2 Pasien

🔴 Red Zone: 2 Pasien

IGD Redzone Bed 1 Ny. Contoh Igd / 15-08-1957 / 69 tahun / RM 1700101 / dr MAA -> dr AHA
_Sementara diterima_
Diagnosis:
- NSTEMI Very High Risk
- Acute Lung Edema
Plan:
- Rawat CVCU

IGD Redzone bed 3/ Ny Contoh Dua/RM 1700102 / Prof IM
Diagnosis:
- Hypertensive Urgency
Plan
- Pindah perawatan HCU

🟡 Yellow zone : 1 pasien

Bed 10/ Pasien Pulmo

🚑 Sisrute: 1 pasien
1. RS Contoh/Ny Rujukan/NSTEACS/sudah acc

Tabe terima kasih, Dokter.`;

const RSWS_14 = `*Pasien Baru*
1. IM / Lontara 4 Belakang, Kamar 4 Bed 3 / Ny. Contoh Baru / 31-12-1950 / 75 tahun / 1700201

*Pasien Pulang / Lepas Rawat*
1. AHA/ PCC 304/ Ny. Contoh Pulang / 19-04-1984/ 42 tahun/ 1700202 /  Pulang

*Pasien Pindah*
-

============================

*Assalamualaikum, dokter. Tabe dokter, izin mengirimkan List Pasien dan List Pemantauan RSWS Rabu, 14-10-2026 Jam 05.00 WITA*

Total Jumlah Pasien : 3

============================
*dr. KS : 1 Pasien*
1. PCC Lt4 Kamar 402 / Ny Contoh Tiga / 28-09-1982 / 44thn / 1700203 (Ai)
Diagnosis:
VES Lown Grade 2

============================
*dr.  PT : 1 Pasien*
🔵 1. PT / IC Lt.1 K4B1 / Tn. Contoh Empat / 21-01-1981 / 45 Tahun / 01700204 (Ai)
Diagnosis:
- Congestive Heart Failure (HFrEF)

============================
*Prof. IM : 1 Pasien*
1 IM / Lontara 4 Belakang, Kamar 4 Bed 3 / Ny. Contoh Baru / 31-12-1950 / 75 tahun / 1700201 (Iska)
Diagnosis:
- Moderate Aortic Stenosis

============================

dr. AHN : 0 Pasien / dr. AFM : 0 Paisen

Tabe terima kasih dokter.`;

const LT6_BARE = `Tabe dokter izin mengirimkan List Pasien Lt. 5 dan Lt. 6  (14 oktober 2026) Pukul :04.00 WITA
______________________________
 dr. YP : 1  Pasien
511 bed 3/ny.Contoh Lima/7-3-1990/
Compos Mentis
TD : 102/71 mmhg
______________________________
List Pasien Lt. 6  0  pasien`;

describe('lists of 14-10-2026', () => {
  it('reads IGD patient lines that carry no number, and not the empty bed or the referral', () => {
    const [igd] = parseAll(IGD_BARE);
    expect(igd!.entries.map((entry) => entry.key)).toEqual(['rm:1700101', 'rm:1700102']);
    expect(entriesFor([igd!], 'AHA')[0]).toMatchObject({ place: 'IGD', diagnoses: ['- NSTEMI Very High Risk', '- Acute Lung Edema'] });
    expect(entriesFor([igd!], 'IM')).toHaveLength(1);
  });

  it('reads an unnumbered ward patient line, and ends it at a vitals line', () => {
    const [ward] = parseAll(LT6_BARE);
    const yp = entriesFor([ward!], 'YP');
    expect(yp.map((entry) => [entry.place, entry.asWritten])).toEqual([['LT5', '511 bed 3/ny.Contoh Lima/7-3-1990']]);
    expect(yp[0]!.diagnoses).toEqual([]);
  });

  it('drops a two-letter resident tag and counts a "Pasien Baru" patient once', () => {
    const [rsws] = parseAll(RSWS_14);
    expect(entriesFor([rsws!], 'KS').map((entry) => entry.asWritten)).toEqual([
      'PCC Lt4 Kamar 402 / Ny Contoh Tiga / 28-09-1982 / 44thn / 1700203',
    ]);
    expect(entriesFor([rsws!], 'PT')[0]!.asWritten).toBe('PT / IC Lt.1 K4B1 / Tn. Contoh Empat / 21-01-1981 / 45 Tahun / 01700204');
    expect(entriesFor([rsws!], 'AHA')).toHaveLength(0); // pulang
    expect(rsws!.entries).toHaveLength(4);
    expect(patientCount(rsws!)).toBe(3);
  });

  describe('several lists pasted into one box', () => {
    const joined = [IGD_BARE, RSWS_14, LT6_BARE].join('\n\n');

    it('cuts at each list, keeping a hospital list\'s "Pasien Baru" block with it', () => {
      const parts = splitLists(joined);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^Tabe dokter izin mengirimkan List Pasien IGD/);
      expect(parts[0]).toMatch(/Tabe terima kasih, Dokter\.\s*$/);
      expect(parts[1]).toMatch(/^\*Pasien Baru\*/);
      expect(parts[2]).toMatch(/^Tabe dokter izin mengirimkan List Pasien Lt\. 5/);
      // The Lt. 6 section is part of the Lt. 5 and 6 list, not a list of its own.
      expect(parts[2]).toContain('List Pasien Lt. 6  0  pasien');
    });

    it('files each patient under its own list', () => {
      const sources = parseLists(joined);
      expect(sources.map((source) => [source.kind, patientCount(source)])).toEqual([
        ['pjt-igd', 2],
        ['rsws', 3],
        ['pjt-ward', 1],
      ]);
      expect(entriesFor(sources, 'IM').map((entry) => entry.place)).toEqual(['IGD', 'RSWS']);
      const text = buildCensus({ sources, code: 'IM', date: '2026-10-14', address: 'prof' }).text;
      expect(text).toContain('*RSWS : 1 pasien*');
      expect(text).toContain('*IGD PJT : 1 pasien*');
    });

    it('cuts without a closing line by walking back to the "Pasien Baru" heading', () => {
      const noClosing = [IGD_BARE.replace(/\nTabe terima kasih, Dokter\.$/, '\n- Konsul TS lain'), RSWS_14].join('\n\n');
      const parts = splitLists(noClosing);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/- Konsul TS lain\s*$/);
      expect(parts[1]).toMatch(/^\*Pasien Baru\*/);
    });

    it('cuts at a hand separator or a WhatsApp message stamp', () => {
      expect(splitLists([IGD_BARE, '///////////', RSWS_14].join('\n'))[1]).toMatch(/^\*Pasien Baru\*/);
      const stamped = [`[14/10/26 06.10] Kirana: ${IGD_BARE}`, `[14/10/26 05.12] Bima: ${RSWS_14}`].join('\n');
      expect(splitLists(stamped)[1]).toMatch(/^\[14\/10\/26 05\.12\] Bima: \*Pasien Baru\*/);
    });

    it('keeps one list whole, so its line numbers do not move', () => {
      expect(splitLists(RSWS_14)).toEqual([RSWS_14]);
    });

    it('treats a box whose kind was chosen by hand as one list', () => {
      expect(parseLists(joined, undefined, 'rsws')).toHaveLength(1);
    });
  });
});

/*
  2026-10-14, Avi: "Diagnosis and plan doesn't get parsed" and "Prof. IM 1
  Pasien … gets recognized as Prof MZ patient" (Lt. 5-6 list). Invented names.
*/
const LT56_14 = `Tabe dokter izin mengirimkan List Pasien Lt. 5 dan Lt. 6  (14 oktober 2026) Pukul :04.00 WITA
______________________________
dr. KS   : 1  pasien
1.510 bed 6/Tn. Contoh Satu/ 29-05-73/ 53 Tahun/ RM 1600201/dr.KS/tindakan dr. AHA
-  Mohon izin pasien kami assess dengan :
-  Chronic Coronary Syndrome CS Type I
-  Coronary Artery Disease 2 Vessel Disease

-  Mohon izin pasien kami terapi dengan :
-  Aspilet 80 mg/24 jam/oral
_________________
Prof. MZ ( 1 Pasien)

2..516 Bed 1/Ny. Contoh Dua/17-01-1993/33 tahun/ RM 01600202
*Mohon Izin prof, pasien kami assest dengan:*
-  PVC Bigemini Suggestive RVOT Origin

*Mohon Izin prof, pasien kami terapi dengan:*
-  IVFD NaCL 0.9% 500cc/24 jam/IV
_____________________

Prof. IM 1 Pasien
1. 501/Contoh Tiga / 17-07-1956 / 70 tahun / RM 1600203

Pasien dikonsul untuk evaluasi kelayakan operasi
_____________________
Prof. PK 1 Pasien
1. 506/ Tn. Contoh Empat/07 November 1954/71 tahun/RM 1600204/LUMMI

Mohon izin kami assesst dengan
-  Generalized Weakness`;

const CVCU_HEADLESS = `Tabe dokter mohon izin mengirimkan
LIST PASIEN CVCU/HCU/ICU PJT:
1. CVCU Bed 1 (Bima - dr. Dani)
Tn. Contoh Lima /03-04-1976/50 tahun/RM 1600205/Prof. PK
- STEMI Inferior onset 6 hour KILLIP I
- Heart failure reduced ejection fraction
Plan :
- Cek APTT/Hari

2. CVCU Bed 2
Tn. Contoh Enam / 05-10-1966/ RM 1600206 / Prof PK
_Sementara diterima_
- Monitoring tanda vital`;

describe('Lt. 5-6 list of 14-10-2026', () => {
  const [ward] = parseAll(LT56_14);

  it('reads a heading with the count right after the code ("Prof. IM 1 Pasien")', () => {
    expect(sectionDpjp('Prof. IM 1 Pasien')).toBe('IM');
    expect(sectionDpjp('Prof. PK 3 Pasien')).toBe('PK');
    expect(entriesFor([ward!], 'IM').map((entry) => entry.key)).toEqual(['rm:1600203']);
    expect(entriesFor([ward!], 'MZ').map((entry) => entry.key)).toEqual(['rm:1600202']);
    expect(entriesFor([ward!], 'PK').map((entry) => entry.key)).toEqual(['rm:1600204']);
  });

  it('reads a bulleted assess heading and stops at the bulleted terapi heading', () => {
    expect(entriesFor([ward!], 'KS')[0]!.diagnoses).toEqual(['- Chronic Coronary Syndrome CS Type I', '- Coronary Artery Disease 2 Vessel Disease']);
  });

  it('reads "Mohon Izin prof, pasien kami assest dengan:"', () => {
    expect(entriesFor([ward!], 'MZ')[0]!.diagnoses).toEqual(['- PVC Bigemini Suggestive RVOT Origin']);
    expect(entriesFor([ward!], 'PK')[0]!.diagnoses).toEqual(['- Generalized Weakness']);
  });

  it('leaves a patient with only a consult note without a diagnosis', () => {
    expect(entriesFor([ward!], 'IM')[0]!.diagnoses).toEqual([]);
  });

  it('takes bullets right under the patient as the diagnosis, but not after other text', () => {
    const [icu] = parseAll(CVCU_HEADLESS);
    const pk = entriesFor([icu!], 'PK');
    expect(pk[0]!.diagnoses).toEqual(['- STEMI Inferior onset 6 hour KILLIP I', '- Heart failure reduced ejection fraction']);
    expect(pk[1]!.diagnoses).toEqual([]);
  });

  it('reads "A/" as the heading only when it comes first', () => {
    const [lt4] = parseAll(`List Pasien PJT Lantai 4
🫀 dr. ZD : 1 pasien
1. 421 Bed 4/ZD/Ny. Contoh Tujuh / 31-12-1957 / RM 1600207
A/
- Symptomatic Bradycardia
P/
- EKG/hari`);
    expect(entriesFor([lt4!], 'ZD')[0]!.diagnoses).toEqual(['- Symptomatic Bradycardia']);
  });
});
