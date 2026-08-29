import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES } from './aliases';
import { jumpTargets } from './jumpTargets';
import type { SectionAlias } from '../types';

const ALIASES = DEFAULT_SECTION_ALIASES;

const FULL = [
  '*S:*',
  'Sesak berkurang.',
  '*O:*',
  'Compos mentis',
  'Tekanan Darah : 121/84 mmHg',
  '*A:*',
  'CHF NYHA II',
  '*Terapi:*',
  '- Furosemide 40 mg',
  '*Plan:*',
  '- Echo besok',
].join('\n');

describe('jumpTargets', () => {
  it('always offers identity, targeting the page top rather than a section', () => {
    // Identity is the sticky header, not part of the body — there is no anchor
    // in the mirror to scroll to.
    const [first] = jumpTargets('', ALIASES);
    expect(first).toEqual({ sectionId: '_identity', label: 'Identitas', anchorId: null });
  });

  it('offers nothing but identity for an empty note', () => {
    expect(jumpTargets('', ALIASES)).toHaveLength(1);
  });

  it('lists the standard sections of a full note', () => {
    expect(jumpTargets(FULL, ALIASES).map((target) => target.sectionId)).toEqual([
      '_identity',
      's',
      'o',
      'a',
      'terapi',
      'p',
    ]);
  });

  it('omits sections the note does not contain', () => {
    const partial = '*S:*\nSesak berkurang.\n*O:*\nCompos mentis';
    // A button that scrolls nowhere teaches distrust of the whole row.
    expect(jumpTargets(partial, ALIASES).map((target) => target.sectionId)).toEqual([
      '_identity',
      's',
      'o',
    ]);
  });

  it('keeps a fixed order even when the note is written out of order', () => {
    // Free-form body, stable index over it: buttons must not move under the
    // thumb because this author put Terapi above A.
    const reordered = ['*Plan:*', 'x', '*Terapi:*', 'y', '*A:*', 'z', '*S:*', 'w'].join('\n');
    expect(jumpTargets(reordered, ALIASES).map((target) => target.sectionId)).toEqual([
      '_identity',
      's',
      'a',
      'terapi',
      'p',
    ]);
  });

  it('points each target at the first occurrence anchor', () => {
    const repeated = '*O:*\nfirst\n*O:*\nsecond';
    const o = jumpTargets(repeated, ALIASES).find((target) => target.sectionId === 'o');
    expect(o?.anchorId).toBe('sec-o');
    // One button, not two: "jump to O" means the first one.
    expect(jumpTargets(repeated, ALIASES).filter((t) => t.sectionId === 'o')).toHaveLength(1);
  });

  it('does not offer ttv or penunjang', () => {
    // They sit inside O in every note in the corpus, so their buttons would
    // land within a screen of the O button.
    const withTtv = '*O:*\nCompos mentis\n*TTV:*\nTD 120/80\n*Penunjang:*\nHb 12';
    const ids = jumpTargets(withTtv, ALIASES).map((target) => target.sectionId);
    expect(ids).not.toContain('ttv');
    expect(ids).not.toContain('penunjang');
  });

  it('does not offer custom sections', () => {
    const custom = '*S:*\nx\n*TS BTKV:*\ny';
    expect(
      jumpTargets(custom, ALIASES).every((target) => !String(target.sectionId).startsWith('custom_')),
    ).toBe(true);
  });

  it('uses a short alias when the user renamed a section', () => {
    const renamed: SectionAlias[] = ALIASES.map((alias) =>
      alias.sectionId === 'p' ? { ...alias, label: 'Rencana' } : alias,
    );
    const p = jumpTargets(FULL, renamed).find((target) => target.sectionId === 'p');
    expect(p?.label).toBe('Rencana');
  });

  it('falls back to the short form when the alias is too wide for a button', () => {
    const renamed: SectionAlias[] = ALIASES.map((alias) =>
      alias.sectionId === 'p' ? { ...alias, label: 'Plan & Monitoring' } : alias,
    );
    const p = jumpTargets(FULL, renamed).find((target) => target.sectionId === 'p');
    expect(p?.label).toBe('Plan');
  });
});
