import { describe, expect, it } from 'vitest';
import { formatSlideUsage, hasMz } from './mzLink';

describe('hasMz', () => {
  it('primary, secondary, detected, none', () => {
    expect(hasMz({ dpjpId: 'mz' }, [])).toBe(true);
    expect(hasMz({ dpjpId: 'afm', dpjpIds: ['afm', 'mz'] }, [])).toBe(true);
    expect(hasMz({ dpjpId: 'afm' }, ['mz'])).toBe(true);
    expect(hasMz({ dpjpId: 'afm' }, [])).toBe(false);
    expect(hasMz({}, [])).toBe(false);
  });
});

describe('formatSlideUsage', () => {
  it('counts images and size in MB with a decimal comma', () => {
    expect(formatSlideUsage({ images: 9, bytes: 6_500_000 })).toBe('9 gambar · 6,2 MB');
    expect(formatSlideUsage({ images: 0, bytes: 0 })).toBe('tanpa gambar');
  });
});
