import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './chat';
import { readReport, readReports } from './report';

/*
  The CVCU/HCU/ICU List Pasien (19 Oct 2026, Avi: "made by a different person
  each day, so the DPJPs cannot be read"). Same structure as the real message,
  invented patients, RMs and residents.
*/
const CVCU = `Tabe dokter mohon izin mengirimkan
LIST PASIEN CVCU/HCU/ICU PJT:
Senin, 19 Oktober 2026, Pukul 05.30 WITA

Total Pasien CVCU/HCU/ICU: 9 Pasien
* Pasien CVCU/HCU Cardio: 6 Pasien
* Pasien ICU BTKV: 1 Pasien

1. CVCU Bed 1
Tn. Contoh Satu/21-6-1972/54 tahun/RM 900001/dr. PT - dr. AHA (Bima- dr. Kepala)
Diagnosis:
- STEMI Extensive Anterior Wall
Plan:
- Monitoring tanda vital dan hemodinamik

2. CVCU Bed 2
(Contoh Dua RM 900002/ Pasien dr MAA)

3. CVCU Bed 3
Tn. Contoh Tiga/ 07-04-1983/ 43 Tahun/RM 900003 / dr. AFG (Kirana - dr. Ketua)
Diagnosis
- Unstable Angina Pectoris Low Risk

4. CVCU Bed 5
Tn. Contoh Empat/01-11-1972/53 tahun/RM 900004/dr. AFG- dr.AFM ( )
Diagnosis*
- NSTEMI High Risk

5. CVCU Bed 7 (Dani - dr. Ketua)
Tn Contoh Lima / 25-12-1962 / 63 tahun / RM 900005 / dr. AFM  ( Pemantauan ) (Sekar - dr. Kepala)
Diagnosis :
- Cardiogenic Shock

6. CVCU Bed 8
Tn. Contoh Enam/28-05-1975/51 tahun/RM 900006 / dr. AFG - Prof. IM (
Diagnosis
- Recent STEMI

7. CVCU Bed 10
Tn. Contoh Tujuh/07-10-1983/43 tahun/RM 01900007 / dr/ PT
Diagnosis :
- NSTEMI High Risk

8. CVCU Bed 15
Kosong

9. CVCU VIP 1
KOSONG

1. HCU Bed 1
(BTKV) Ny. Contoh Delapan/09-04-1999/ tahun/RM 900008 / dr AFG
Diagnosis :
- POD 4 Aortic Valve Replacement

2. HCU Bed 2
(BTKV) Contoh Sembilan / 5-09-1959 / 67 tahun / RM 900009/ ARB
Diagnosis
- POH-5 CABG

3. HCU Bed 5
Pasien BTKV - dr. NP

ICU : 1 pasien

1. ICU bed 4
Tn. Contoh Sepuluh/ 07-04-1964 /62 tahun/RM 900010 / Prof.PK
Diagnosis :
- Coronary Artery Disease 3 Vessels Disease

Tabe terima kasih dokter`;

const message = (text: string): ChatMessage => ({ sentAt: '2026-10-19T05:30', sender: 'dr. Contoh', text, index: 0 });
const byRm = (rm: string) => readReports(message(CVCU)).find((p) => p.rm.replace(/^0+/, '') === rm);

describe('CVCU/HCU/ICU List Pasien', () => {
  it('reads every occupied bed and skips Kosong and bedless lines', () => {
    const patients = readReports(message(CVCU));
    expect(patients.map((p) => p.rm.replace(/^0+/, '')).sort()).toEqual(
      ['900001', '900002', '900003', '900004', '900005', '900006', '1900007', '900008', '900009', '900010'].sort(),
    );
  });

  it('takes the unit and bed from the numbered place line', () => {
    expect(byRm('900001')).toMatchObject({ room: 'CVCU', bed: '1', floor: '' });
    expect(byRm('900008')).toMatchObject({ room: 'HCU', bed: '1' });
    expect(byRm('900010')).toMatchObject({ room: 'ICU', bed: '4' });
  });

  it.each([
    ['900001', 'pt'], // "dr. PT - dr. AHA": the first is the DPJP
    ['900002', 'maa'], // "(… RM …/ Pasien dr MAA)"
    ['900003', 'afg'],
    ['900004', 'afg'], // "dr. AFG- dr.AFM ( )"
    ['900005', 'afm'], // "( Pemantauan )" is not a resident
    ['900006', 'afg'], // "dr. AFG - Prof. IM (" unclosed
    ['1900007', 'pt'], // "dr/ PT" typo; RM written with a leading zero
    ['900008', 'afg'], // "dr AFG" without a dot
    ['900009', 'arb'], // bare "/ ARB"
    ['900010', 'pk'], // "Prof.PK"
  ])('reads the DPJP of %s as %s', (rm, dpjp) => {
    expect(byRm(rm)?.dpjpId).toBe(dpjp);
  });

  it('reads the residents from the last bracket: junior, then chief', () => {
    expect(byRm('900001')).toMatchObject({ junior: 'Bima', chief: 'Kepala' });
    expect(byRm('900003')).toMatchObject({ junior: 'Kirana', chief: 'Ketua' });
    // The identity line's bracket wins over the place line's.
    expect(byRm('900005')).toMatchObject({ junior: 'Sekar', chief: 'Kepala' });
    expect(byRm('900004')).toMatchObject({ junior: '', chief: '' });
  });

  it('keeps the name, not the RM, as the name of a short bracketed entry', () => {
    expect(byRm('900002')?.name).toBe('Contoh Dua');
  });

  it('marks BTKV patients and keeps their diagnosis', () => {
    expect(byRm('900008')?.btkv).toBe(true);
    expect(byRm('900009')?.btkv).toBe(true);
    expect(byRm('900008')?.body).toMatch(/Aortic Valve Replacement/);
  });

  it('does not run the ICU heading into the patient above', () => {
    expect(byRm('900009')?.full ?? '').not.toMatch(/ICU : 1 pasien/);
  });
});

describe('a SOAP from CVCU names its unit as the room', () => {
  it('reads "CVCU Bed 9" as room CVCU, bed 9, no floor', () => {
    const soap = readReport(
      message(
        'Tabe dokter, mohon izin melaporkan follow up pasien di CVCU Bed 9 atas nama:\nTn. Contoh Satu / 01-01-1960 / 66 tahun / RM 900011\nDPJP Utama : dr. AFG\n*S:*\n- baik',
      ),
    );
    expect(soap).toMatchObject({ room: 'CVCU', bed: '9', floor: '' });
  });

  it('leaves a ward opening that only mentions a unit alone', () => {
    const soap = readReport(
      message(
        'Mohon izin melaporkan perpindahan pasien dari CVCU Bed 9 ke PJT Lantai 4 Kamar 417 Bed 1 atas nama:\nTn. Contoh Satu / 01-01-1960 / 66 tahun / RM 900011\nDPJP Utama : dr. AFG',
      ),
    );
    expect(soap).toMatchObject({ room: '417', bed: '1', floor: '4' });
  });
});
