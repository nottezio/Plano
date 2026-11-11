import { describe, expect, it } from 'vitest';

import { dpjpVisit, dpjpVisitText, visitDpjps } from './dpjpVisit';
import type { FloorPatient } from './report';

function patient(over: Partial<FloorPatient>): FloorPatient {
  return {
    key: 'rm:1', rm: '1', name: 'Tn. Contoh', identity: 'Tn. Contoh', room: '417', bed: '4', floor: '4',
    dpjpId: 'ks', kjsDpjpIds: [], btkv: false, body: '', full: '', chief: 'Kepala', junior: 'Muda',
    senderNick: '', sender: '', sentAt: '2026-11-11T07:00', index: 0, discharge: null, ...over,
  };
}

const SOAP = [
  'Tabe dokter, mohon izin melaporkan follow up pasien di PJT Lantai 4 Kamar 417 Bed 1 atas nama:',
  '',
  'Tn. Contoh / 01-01-1960 / RM 1234500',
  '',
  'S:',
  '- baik',
  '',
  'O:',
  'Compos mentis',
  '',
  'Mohon izin kami assess dengan',
  '- CHF',
  '',
  'Mohon izin kami terapi dengan:',
  '- Furosemide',
  '',
  'Plan:',
  '- Monitoring',
  '',
  '*TS GER*',
  'A/',
  '- Frailty',
].join('\n');

describe('Ringkasan visite DPJP (11 Nov 2026)', () => {
  const own = patient({ key: 'a', room: '420', bed: '6', full: SOAP, discharge: 'tomorrow' });
  const kjs = patient({ key: 'b', room: '417', bed: '1', dpjpId: 'mz', kjsDpjpIds: ['ks'], manualFields: { diagnosis: 'CAD', terapi: 'ASA', plan: 'PCI' } });
  const other = patient({ key: 'c', dpjpId: 'aha' });

  it('lists the DPJPs with a patient, own and KJS counted', () => {
    const dpjps = visitDpjps([own, kjs, other]);
    expect(dpjps.find((d) => d.id === 'ks')?.count).toBe(2);
    expect(dpjps.find((d) => d.id === 'mz')?.count).toBe(1);
  });

  it('takes Dx, Tx and Plan as written, without the TS block; KJS marked; manual fields as typed', () => {
    const rows = dpjpVisit([own, kjs, other], 'ks', 'Lantai 4');
    expect(rows.map((r) => r.patient.key).sort()).toEqual(['a', 'b']);
    const a = rows.find((r) => r.patient.key === 'a')!;
    expect(a).toMatchObject({ kjs: false, dx: ['- CHF'], tx: ['- Furosemide'], plan: ['- Monitoring'] });
    expect(rows.find((r) => r.patient.key === 'b')).toMatchObject({ kjs: true, dx: ['CAD'], tx: ['ASA'], plan: ['PCI'] });
  });

  it('copies as numbered blocks with the H-1 flag', () => {
    const text = dpjpVisitText('ks', '2026-11-11', dpjpVisit([own], 'ks', 'Lantai 4'));
    expect(text).toContain('11/11/2026');
    expect(text).toContain('(H-1)');
    expect(text).toContain('Dx:\n- CHF\nTx:\n- Furosemide\nPlan:\n- Monitoring');
    expect(text).not.toContain('Frailty');
  });
});
