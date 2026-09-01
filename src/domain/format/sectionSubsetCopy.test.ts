import { describe, expect, it } from 'vitest';

import { composeCopy } from './composeCopy';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

/**
 * Copying a subset of sections, 2026-09-01.
 *
 * `headerLine` is the header PREFIX only — `"*S :*"` — with its line break
 * already stripped. Two of the three places that re-emit it joined header and
 * body with a SPACE, so every section-subset copy ran the heading into the
 * first finding: `*S :* - Sesak nafas ada, ...` on one line. The third place
 * used a newline and was correct, which is why whole-note copies looked fine.
 */
const BODY = [
  '*S :*',
  '- Sesak nafas ada, berdebar tidak ada.',
  '- Batuk lendir ada.',
  '',
  '*O :*',
  'Compos mentis',
  '',
  '*Mohon izin kami assesst dengan*',
  '- Congestive Heart Failure NYHA II (HFpEF)',
].join('\n');

const OPTIONS = {
  format: 'whatsapp' as const,
  includeIdentity: false,
  includeDateHeader: false,
  aliases: ALIASES,
  patient: makePatient({ name: 'Ny. Siati', mrn: '881487' }),
  bullet: 'hyphen' as const,
};

describe('section subset copy', () => {
  it('puts the body on the line after the header', () => {
    const out = composeCopy([{ date: '2026-09-01', body: BODY }], {
      ...OPTIONS,
      sections: ['s'],
    });
    expect(out).toContain('*S :*\n- Sesak nafas ada');
    expect(out).not.toContain('*S :* - Sesak');
  });

  it('copies only the section asked for', () => {
    const out = composeCopy([{ date: '2026-09-01', body: BODY }], {
      ...OPTIONS,
      sections: ['s'],
    });
    expect(out).toContain('Sesak nafas ada');
    expect(out).not.toContain('Compos mentis');
    expect(out).not.toContain('Congestive Heart Failure');
  });

  it('keeps the header on its own line for a prose heading too', () => {
    const out = composeCopy([{ date: '2026-09-01', body: BODY }], {
      ...OPTIONS,
      sections: ['a'],
    });
    expect(out).toContain('*Mohon izin kami assesst dengan*\n- Congestive Heart Failure');
  });

  it('still emits several sections separated by a blank line', () => {
    const out = composeCopy([{ date: '2026-09-01', body: BODY }], {
      ...OPTIONS,
      sections: ['s', 'o'],
    });
    expect(out).toContain('*S :*\n- Sesak nafas ada');
    expect(out).toContain('*O :*\nCompos mentis');
  });

  it('leaves the whole-note copy unchanged', () => {
    const out = composeCopy([{ date: '2026-09-01', body: BODY }], {
      ...OPTIONS,
      sections: 'all',
    });
    expect(out).toContain('*S :*\n- Sesak nafas ada');
  });
});
