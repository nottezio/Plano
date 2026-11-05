import { describe, expect, it } from 'vitest';

import { checkSoap } from './soapCheck';

const run = (body: string, previous?: string) => checkSoap({ body, previous });
const mashed = (body: string) => run(body).find((finding) => finding.kind === 'gibberish');
const typos = (body: string, previous?: string) =>
  run(body, previous).filter((finding) => finding.kind === 'typo').map((finding) => finding.anchor);

describe('gibberish', () => {
  it('flags the example from the ward: a3e 3rjiwj', () => {
    const finding = mashed('S: sesak berkurang a3e 3rjiwj\nO: baik');
    expect(finding?.occurrences?.map((place) => place.text)).toEqual(['a3e', '3rjiwj']);
    expect(finding?.at).toBe('S: sesak berkurang '.length);
  });

  it('flags keys pressed in a row, repeats and vowel-less words', () => {
    for (const word of ['asdfgh', 'lkjh', 'aaaaa', 'tdkdpt', 'zxcv']) {
      expect(mashed(`S: ${word} hari ini`), word).toBeDefined();
    }
  });

  it('stays quiet on what a ward note really contains', () => {
    const body = [
      'S: tdk sesak, dgn kgBB 60, 3x1 tab, 500mg, 24jam, 3hari, 3xsehari',
      'O: SpO2 98%, 120mmHg, HbA1c 6.5, hba1c, T2DM, CHA2DS2VASc 3, S1S2 normal, 6MWT, mmHg, kgBB, CO2',
      'Ur/Cr 30/1.0, K 3.5, TTV baik, xx',
    ].join('\n');
    expect(mashed(body)).toBeUndefined();
  });

  it('skips consultants’ pasted blocks', () => {
    expect(mashed('S: baik\nTS HOM\nasdfgh a3e')).toBeUndefined();
  });
});

describe('typo', () => {
  it('flags a word written once that is one letter off one written twice, and names it', () => {
    const finding = run('pasien baik. pasien sadar. keluhan nyeri dada. pasein tenang').find((entry) => entry.kind === 'typo');
    expect(finding?.anchor).toBe('pasein');
    expect(finding?.message).toContain('“pasien”');
  });

  it('counts yesterday’s note as spelling evidence, not as the typo', () => {
    expect(typos('keluhan nyeri dada. pasein tenang', 'pasien baik. pasien sadar')).toEqual(['pasein']);
    expect(typos('keluhan nyeri dada. pasein tenang', 'pasein baik. pasein sadar')).toEqual([]);
  });

  it('ignores names, capitals, short words and words with digits', () => {
    expect(typos('Rahmat baik. Rahmat sadar. Rahma pulang. pasien baik. pasien sadar. Pasein')).toEqual([]);
    expect(typos('tidak tidak tdak')).toEqual([]);
  });

  it('says nothing when no word is spelled two ways', () => {
    expect(typos('pasien sadar. keluhan sesak. tekanan darah normal.')).toEqual([]);
  });
});
