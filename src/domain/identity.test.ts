import { describe, expect, it } from 'vitest';

import {
  clinicalStart,
  displayName,
  firstMeaningfulLine,
  hasDisplayName,
  redactName,
} from './identity';

describe('firstMeaningfulLine', () => {
  it('skips leading blank lines', () => {
    expect(firstMeaningfulLine('\n\n  \nTn. Budi, 52th\nS: sesak')).toBe('Tn. Budi, 52th');
  });

  it('strips markdown-lite decoration', () => {
    expect(firstMeaningfulLine('**Tn. Budi** _52th_')).toBe('Tn. Budi 52th');
  });

  it('strips a leading bullet', () => {
    expect(firstMeaningfulLine('- Ny. Siti')).toBe('Ny. Siti');
  });

  it('returns empty for an empty body', () => {
    expect(firstMeaningfulLine('')).toBe('');
    expect(firstMeaningfulLine('   \n\n  ')).toBe('');
  });
});

describe('displayName', () => {
  it('prefers an explicitly typed name', () => {
    expect(displayName({ name: 'Tn. Budi', preview: 'S: sesak' })).toBe('Tn. Budi');
  });

  it('falls back to the first line of the note', () => {
    expect(displayName({ name: '', preview: 'Ny. Siti, 40th\nS: demam' })).toBe('Ny. Siti, 40th');
  });

  it('treats a whitespace-only name as unset', () => {
    expect(displayName({ name: '   ', preview: 'Tn. A' })).toBe('Tn. A');
  });

  it('truncates a long first line', () => {
    const long = 'x'.repeat(120);
    const result = displayName({ name: '', preview: long });
    expect(result.length).toBeLessThanOrEqual(61);
    expect(result.endsWith('…')).toBe(true);
  });

  it('is empty when nothing has been written yet', () => {
    expect(displayName({ name: '', preview: '' })).toBe('');
    expect(hasDisplayName({ name: '', preview: '' })).toBe(false);
  });
});

describe('clinicalStart', () => {
  it('skips the greeting, identity and DPJP blocks', () => {
    const sections = [
      { sectionId: '_intro', start: 0 },
      { sectionId: 'custom_tn_basra_rm_1068190', start: 80 },
      { sectionId: 'custom_dpjp_utama', start: 140 },
      { sectionId: 's', start: 200 },
      { sectionId: 'o', start: 260 },
    ];
    expect(clinicalStart(sections)).toBe(200);
  });

  it('returns 0 for a free-form note with no recognised heading', () => {
    expect(clinicalStart([{ sectionId: '_intro', start: 0 }])).toBe(0);
  });

  it('starts at O when there is no S', () => {
    expect(
      clinicalStart([
        { sectionId: '_intro', start: 0 },
        { sectionId: 'o', start: 50 },
      ]),
    ).toBe(50);
  });
});

describe('redactName', () => {
  it('removes every occurrence, case-insensitively', () => {
    expect(redactName('Tn. Basra dan basra lagi', 'Basra')).toBe('Tn. — dan — lagi');
  });

  it('ignores a name too short to be meaningful', () => {
    expect(redactName('Ada nyeri', 'A')).toBe('Ada nyeri');
  });

  it('treats regex characters in a name literally', () => {
    expect(redactName('Tn. A. (Bapak)', 'A. (Bapak)')).toBe('Tn. —');
  });
});
