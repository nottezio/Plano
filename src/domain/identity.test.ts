import { describe, expect, it } from 'vitest';

import { displayName, firstMeaningfulLine, hasDisplayName } from './identity';

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
