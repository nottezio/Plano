import { describe, expect, it } from 'vitest';

import { pick } from './RevisionTrail';

describe('pick — choosing two versions to compare', () => {
  it('adds the first and the second', () => {
    expect(pick(pick([], 'a'), 'b')).toEqual(['a', 'b']);
  });

  it('unpicks one that is already chosen', () => {
    expect(pick(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('drops the oldest pick when a third is chosen', () => {
    // Rather than refusing: refusing makes the user work out which to clear
    // before they can do what they are already doing.
    expect(pick(['a', 'b'], 'c')).toEqual(['b', 'c']);
  });
});
