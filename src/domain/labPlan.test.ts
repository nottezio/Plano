import { describe, expect, it } from 'vitest';

import { labDueOn, labPlans } from './labPlan';
import type { ClinicalDate } from './types';

const NOTE = [
  '*O :*',
  '*Lab (29-10-2026)*',
  'Hb 12',
  '*Mohon izin kami assess dengan:*',
  '- ADHF',
  '*Plan :*',
  '- Cek DL, SE (30/10/2026)',
  '- Cek Ur/Cr (31-10-2026)',
  '- EKG (30/10/2026)',
  '- Rencana Echo (30-10-2026)',
  '- Cek elektrolit ulang besok',
].join('\n');

describe('labPlans', () => {
  it('reads dated lab lines below the assessment, as written', () => {
    expect(labPlans(NOTE)).toEqual([
      { date: '2026-10-30', text: '- Cek DL, SE (30/10/2026)' },
      { date: '2026-10-31', text: '- Cek Ur/Cr (31-10-2026)' },
    ]);
  });

  it('reads a daily lab line as due every day, not one every few days (9 Nov 2026)', () => {
    const body = '*O :*\nCek APTT/hari: 52\n*Plan :*\n- Heparin 1000 IU/jam/SP\n- Cek APTT/hari\n- Cek GDS tiap hari\n- Cek INR/3 hari';
    const plans = labPlans(body);
    expect(plans).toEqual([
      { daily: true, text: '- Cek APTT/hari' },
      { daily: true, text: '- Cek GDS tiap hari' },
    ]);
    expect(plans.every((plan) => labDueOn(plan, '2026-11-09' as ClinicalDate))).toBe(true);
    expect(labDueOn({ date: '2026-11-08' as ClinicalDate, text: '- Cek DL (08/11/2026)' }, '2026-11-09' as ClinicalDate)).toBe(false);
  });

  it('ignores a dated lab result above the assessment', () => {
    expect(labPlans('*O :*\nCek DL (30/10/2026): Hb 12')).toEqual([]);
  });
});
