import { describe, expect, it } from 'vitest';

import { labPlans } from './labPlan';

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

  it('ignores a dated lab result above the assessment', () => {
    expect(labPlans('*O :*\nCek DL (30/10/2026): Hb 12')).toEqual([]);
  });
});
