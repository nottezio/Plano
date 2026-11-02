import { describe, expect, it } from 'vitest';

import { boldRuns, readGuideSeen, writeGuideSeen } from './guide';
import { LIST_MAKER_GUIDE_KEY as GUIDE_KEY, listMakerGuideSteps as guideSteps } from './listMaker';

describe('guideSteps', () => {
  it('an editor gets the whole flow, starting with Tempel', () => {
    expect(guideSteps(true).map((s) => s.id)).toEqual(['welcome', 'tempel', 'denah', 'status', 'list', 'lainnya']);
  });

  it('a viewer gets no Tempel, no Saran/status step, and nothing it cannot do', () => {
    const steps = guideSteps(false);
    expect(steps.map((s) => s.id)).toEqual(['welcome', 'denah', 'list', 'lainnya']);
    const text = steps.flatMap((s) => [s.lead, ...s.points]).join(' ');
    for (const word of ['**Tempel**', 'Simpan edisi', 'Terima', 'undang']) expect(text).not.toContain(word);
  });

  it('every step has a title, a lead and at least one point, with balanced bold marks', () => {
    for (const step of [...guideSteps(true), ...guideSteps(false)]) {
      expect(step.title).not.toBe('');
      expect(step.lead).not.toBe('');
      expect(step.points.length).toBeGreaterThan(0);
      for (const line of [step.lead, ...step.points]) expect((line.match(/\*\*/g) ?? []).length % 2).toBe(0);
    }
  });
});

describe('boldRuns', () => {
  it('splits bold and plain runs', () => {
    expect(boldRuns('Ketuk **Baca**, lalu **Simpan**.')).toEqual([
      { text: 'Ketuk ', bold: false },
      { text: 'Baca', bold: true },
      { text: ', lalu ', bold: false },
      { text: 'Simpan', bold: true },
      { text: '.', bold: false },
    ]);
  });
});

describe('guide seen flag', () => {
  it('is unseen until written, then seen', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readGuideSeen(storage, GUIDE_KEY)).toBe(false);
    writeGuideSeen(storage, GUIDE_KEY);
    expect(map.get(GUIDE_KEY)).toBe('1');
    expect(readGuideSeen(storage, GUIDE_KEY)).toBe(true);
  });

  it('a storage that throws counts as seen, so it never nags', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readGuideSeen(broken, GUIDE_KEY)).toBe(true);
    expect(() => writeGuideSeen(broken, GUIDE_KEY)).not.toThrow();
  });
});
