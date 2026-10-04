import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { describeLabPlacement, insertLabBlock, labPlacement } from './insertLab';

const NEW = '*Laboratorium PJT (05-10-2026)*\nHGB 11.2';

const WITH_LABS = [
  '*O :*',
  'Tensi : 110/70 mmHg',
  '',
  '*EKG PJT Lt. 4 (04-10-2026)*',
  'SR 72',
  '',
  '*Laboratorium PJT (03-10-2026)*',
  'HGB 12.1',
  '',
  '*Laboratorium IGD (01-10-2026)*',
  'HGB 13.0',
  '',
  '*Mohon izin kami assess dengan*',
  '- ADHF',
].join('\n');

describe('insertLabBlock', () => {
  it('goes directly above the newest lab', () => {
    const out = insertLabBlock(WITH_LABS, NEW, ALIASES);
    expect(out).toContain('SR 72\n\n*Laboratorium PJT (05-10-2026)*\nHGB 11.2\n\n*Laboratorium PJT (03-10-2026)*');
    expect(labPlacement(WITH_LABS, ALIASES)).toEqual({
      rule: 'above-lab',
      heading: '*Laboratorium PJT (03-10-2026)*',
    });
  });

  it('finds the newest by date even when an older one is written first', () => {
    const body = WITH_LABS.replace('(03-10-2026)', '(30-09-2026)').replace('(01-10-2026)', '(02-10-2026)');
    const out = insertLabBlock(body, NEW, ALIASES);
    expect(out).toContain('HGB 12.1\n\n*Laboratorium PJT (05-10-2026)*\nHGB 11.2\n\n*Laboratorium IGD (02-10-2026)*');
  });

  it('goes after the last EKG when the note has no lab', () => {
    const body = [
      '*O :*',
      'Tensi : 110/70 mmHg',
      '',
      '*EKG PJT (04-10-2026)*',
      'SR 72',
      '',
      '*EKG IGD (01-10-2026)*',
      'AF RVR',
      '',
      '*Foto Thorax (01-10-2026)*',
      'CTR 60%',
      '',
      '*Mohon izin kami assess dengan*',
      '- ADHF',
    ].join('\n');
    const out = insertLabBlock(body, NEW, ALIASES);
    expect(out).toContain('AF RVR\n\n*Laboratorium PJT (05-10-2026)*\nHGB 11.2\n\n*Foto Thorax (01-10-2026)*');
    expect(describeLabPlacement(labPlacement(body, ALIASES))).toBe(
      'Belum ada lab di catatan — disisipkan setelah EKG IGD (01-10-2026).',
    );
  });

  it('falls back to the end of O with neither', () => {
    const body = '*O :*\nTensi : 110/70 mmHg\n\n*Mohon izin kami assess dengan*\n- ADHF';
    const out = insertLabBlock(body, NEW, ALIASES);
    expect(out).toBe(
      '*O :*\nTensi : 110/70 mmHg\n\n*Laboratorium PJT (05-10-2026)*\nHGB 11.2\n\n*Mohon izin kami assess dengan*\n- ADHF',
    );
  });

  it('changes nothing else in the note', () => {
    const out = insertLabBlock(WITH_LABS, NEW, ALIASES);
    expect(out.replace(`${NEW}\n\n`, '')).toBe(WITH_LABS);
  });
});
