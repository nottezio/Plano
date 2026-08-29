import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES } from './aliases';
import { headerToken, jumpTargets } from './jumpTargets';

const ALIASES = DEFAULT_SECTION_ALIASES;

const FULL = [
  '*S:*',
  'Sesak berkurang.',
  '*O:*',
  'Compos mentis',
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
    expect(first).toEqual({
      sectionId: '_identity',
      label: 'Identitas',
      anchorId: null,
      unrecognised: false,
    });
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

  it('gives ttv and penunjang no FIXED slot, but still offers them', () => {
    // They sit inside O in the corpus, so they do not earn one of the five
    // positions that never move. They are still real headings a long note may
    // need to reach, so they follow as unrecognised-tier chips.
    const withTtv = '*O:*\nCompos mentis\n*TTV:*\nTD 120/80\n*Penunjang:*\nHb 12';
    const targets = jumpTargets(withTtv, ALIASES);
    expect(targets.map((t) => t.sectionId).slice(0, 2)).toEqual(['_identity', 'o']);
    expect(targets.find((t) => t.sectionId === 'ttv')?.unrecognised).toBe(true);
    expect(targets.find((t) => t.sectionId === 'penunjang')?.unrecognised).toBe(true);
  });

  it('offers custom sections rather than dropping them', () => {
    // Navigation must not depend on the alias table classifying a heading.
    const custom = '*S:*\nx\n*TS BTKV:*\ny';
    const ts = jumpTargets(custom, ALIASES).find((t) => t.sectionId === 'custom_ts_btkv');
    expect(ts?.label).toBe('TS BTKV');
    expect(ts?.unrecognised).toBe(true);
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

/**
 * Navigation must not depend on the alias table.
 *
 * The first version offered only the five known ids, so a note whose
 * Assessment or Terapi heading was worded in a way the table does not list
 * lost its buttons silently — indistinguishable from the section being absent.
 */
describe('unrecognised headings', () => {
  it('still gets a jump target', () => {
    const note = '*S :*\nx\n*Assesmen Kardiologi :*\nCHF\n*Obat-obatan jaga :*\n- Furosemide';
    const ids = jumpTargets(note, ALIASES).map((t) => t.sectionId);
    expect(ids).toContain('custom_obat_obatan_jaga');
  });

  it('is flagged so the UI can mute it', () => {
    const note = '*S :*\nx\n*Blok aneh :*\ny';
    const odd = jumpTargets(note, ALIASES).find((t) => t.sectionId === 'custom_blok_aneh');
    expect(odd?.unrecognised).toBe(true);
    expect(odd?.label).toBe('Blok aneh');
  });

  it('keeps the known five ahead of the custom ones', () => {
    const note = '*Catatan TS :*\nz\n*S :*\nx\n*O :*\ny';
    const ids = jumpTargets(note, ALIASES).map((t) => t.sectionId);
    // Known sections hold their canonical order regardless of where they sit
    // in the note; customs follow.
    expect(ids.slice(0, 3)).toEqual(['_identity', 's', 'o']);
    expect(ids[3]).toBe('custom_catatan_ts');
  });

  it('offers ttv and penunjang as unrecognised-tier rather than not at all', () => {
    const note = '*O :*\nx\n*Penunjang :*\nHb 12';
    const p = jumpTargets(note, ALIASES).find((t) => t.sectionId === 'penunjang');
    expect(p).toBeDefined();
    expect(p?.unrecognised).toBe(true);
  });

  it('ignores a field that merely labels a value on its own line', () => {
    // Every vitals line in O is technically a section to the parser. A heading
    // owns its line; a field shares it.
    const vitals = [
      '*O :*',
      'Compos mentis',
      'Tekanan Darah : 121/84 mmHg',
      'Nadi : 73 x/menit',
      'Suhu : 36.6 C',
    ].join('\n');
    const ids = jumpTargets(vitals, ALIASES).map((t) => t.sectionId);
    expect(ids).toEqual(['_identity', 'o']);
  });

  it('truncates a very long custom label', () => {
    const note = '*S :*\nx\n*Rencana tindak lanjut bersama tim bedah :*\ny';
    const long = jumpTargets(note, ALIASES).find((t) => t.unrecognised);
    expect(long!.label.length).toBeLessThanOrEqual(10);
  });
});
