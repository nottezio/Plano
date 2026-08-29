import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES } from './aliases';
import { headerToken, jumpTargets } from './jumpTargets';

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

  /**
   * Labels come from the NOTE, not the alias table.
   *
   * The first version used `labelFor` with an 8-character cutoff, and the
   * default labels straddled it — "Subjektif" is 9, "Objektif" is 8 — so the
   * bar rendered "S" beside "Objektif" for two headers written identically in
   * the body. These pin the replacement rule.
   */
  describe('labels', () => {
    it('uses the token the note itself writes', () => {
      const labels = jumpTargets(FULL, ALIASES).map((target) => target.label);
      expect(labels).toEqual(['Identitas', 'S', 'O', 'A', 'Terapi', 'Plan']);
    });

    it('is consistent for S and O rather than mixing short and long forms', () => {
      const byId = new Map(jumpTargets(FULL, ALIASES).map((t) => [t.sectionId, t.label]));
      expect(byId.get('s')).toBe('S');
      expect(byId.get('o')).toBe('O');
    });

    it('follows the note when a section is spelled out in full', () => {
      const spelled = '*Subjektif:*\nx\n*Objektif:*\ny';
      const labels = jumpTargets(spelled, ALIASES).map((target) => target.label);
      expect(labels).toEqual(['Identitas', 'Subjektif', 'Objektif']);
    });

    it('strips decoration and the delimiter, inside or outside the emphasis', () => {
      expect(headerToken('*S :*')).toBe('S');
      expect(headerToken('*Terapi :*')).toBe('Terapi');
      expect(headerToken('- Penunjang: ')).toBe('Penunjang');
      expect(headerToken('_DPJP Utama: ')).toBe('DPJP Utama');
      expect(headerToken('O/')).toBe('O');
      expect(headerToken(null)).toBeNull();
      expect(headerToken('***')).toBeNull();
    });

    it('falls back to the short form for the corpus prose headers', () => {
      // `a` and `terapi` are routinely written as a full sentence in the real
      // notes. A 29-character button is not an index.
      const prose = [
        '*S :*', 'x',
        '*Mohon izin kami assess dengan :*', '1. CHF',
        '*Mohon izin kami terapi dengan :*', '- Furosemide',
      ].join('\n');
      const byId = new Map(jumpTargets(prose, ALIASES).map((t) => [t.sectionId, t.label]));
      expect(byId.get('a')).toBe('A');
      expect(byId.get('terapi')).toBe('Terapi');
      expect(byId.get('s')).toBe('S');
    });

    it('falls back to the canonical short form when there is no header token', () => {
      // `_intro` has a null headerLine; no known section should ever render
      // an empty button.
      for (const target of jumpTargets(FULL, ALIASES)) {
        expect(target.label.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
