import { describe, expect, it } from 'vitest';

import {
  buildCensus,
  detectSource,
  dpjpCounts,
  dpjpFullName,
  entriesFor,
  knownCodes,
  parseSource,
  segmentCodes,
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
    const text = buildCensus({ sources: [lt4!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('1. MZ/417 Bed 3/Ny.Contoh Satu / 18-11-1989/ 1700001\nDiagnosis:\n- Frequent PVC post ablation H-1\n- Atrial Fibrilation Normoventricular Response\n2.');
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
    const text = buildCensus({ sources: [icu!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(text).toContain('*CVCU/HCU/ICU PJT, 1 pasien*\n1. MZ/CVCU Bed 11/Tn Contoh Tujuh/15-10-1972/53 th/RM 01700007\nDiagnosis:\n- NSTEMI High Risk\n- Hypertensive Heart Disease\n');
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
    const aau = buildCensus({ sources: [lt56!], code: 'AAU', date: '2026-10-08', address: 'dokter' }).text;
    expect(aau).toContain('1. AAU/518 bed 1/Tn. Contoh Empatbelas/21-06-2001/ 25 tahun/ RM   700014\n');
  });

  it("drops the resident's name after a trailing code", () => {
    const mz = buildCensus({ sources: [lt56!], code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    expect(mz).toContain('*PJT Lt.6, 1 pasien*\n1. MZ/617 bed 1/nn. Contoh Tujuhbelas/20-10-2011/14 tahun/01700017\n');
    expect(mz).not.toContain('tika');
    expect(mz).toContain('*PJT Lt.5, 1 pasien*');
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
  it('matches the shape of the census sent', () => {
    const sources = parseAll(LT4, ICU, RSWS, LT56, RSUH);
    const text = buildCensus({ sources, code: 'MZ', date: '2026-10-08', address: 'dokter' }).text;
    const lines = text.split('\n');
    expect(lines.slice(0, 6)).toEqual([
      'Assalamualaikum. Tabe Dokter, mohon izin melaporkan Sensus pasien:',
      `_*${dpjpFullName('MZ')}*_`,
      'Di RSWS, PJT Lt. 4 dan 5 dan 6 (Kamis, 08-10-2026)',
      '*TOTAL: 7 Pasien*',
      '*RSWS: 1 Pasien*',
      '*PJT: 6 Pasien*',
    ]);
    const groups = lines.filter((line) => /^\*.*pasien\*$/.test(line));
    expect(groups).toEqual([
      '*RSWS 1 pasien*',
      '*CVCU/HCU/ICU PJT, 1 pasien*',
      '*PJT Lt.4, 3 pasien*',
      '*PJT Lt.5, 1 pasien*',
      '*PJT Lt.6, 1 pasien*',
    ]);
    expect(lines.at(-1)).toBe('Tabe terima kasih dokter');
  });

  it('addresses a Prof when asked', () => {
    const sources = parseAll(LT4);
    const text = buildCensus({ sources, code: 'MZ', date: '2026-10-08', address: 'prof' }).text;
    expect(text.startsWith('Assalamualaikum. Tabe Prof,')).toBe(true);
    expect(text.endsWith('Tabe terima kasih Prof')).toBe(true);
  });

  it('counts every DPJP once per patient across lists', () => {
    const counts = dpjpCounts(parseAll(LT4, ICU, RSWS, LT56, RSUH));
    expect(counts.find((row) => row.code === 'ZD')?.count).toBe(5);
    expect(counts.find((row) => row.code === 'MZ')?.count).toBe(7);
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
    expect(text).toContain('*PJT Lt.4, 1 pasien*\n1. MZ/417 Bed 3/Ny. Contoh / RM 1700001\nDiagnosis:\n- CHF');
    expect(readAiCensus(null)).toEqual([]);
  });
});
