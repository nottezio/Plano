import { describe, expect, it } from 'vitest';

import { classifyProseHeader } from './classifyProseHeader';
import { jumpTargets } from './jumpTargets';
import { parseSections } from './parseSections';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';

/**
 * Every spelling of the assessment heading seen across the three real note
 * formats (IGD, CVCU, bangsal). They differ by a doubled letter each time,
 * which is why this is a stem and not a list.
 */
const ASSESS_SPELLINGS = [
  'Mohon izin kami assess dengan:',
  'Mohon izin kami assest dengan:',
  'Mohon izin kami assesst dengan :',
  'Mohon izin kami asses dengan:',
  'Mohon izin kami assessment dengan:',
  'Mohon izin kami asessment dengan:',
];

const TERAPI_SPELLINGS = [
  'Mohon izin kami terapi dengan',
  'Mohon izin kami terapi dengan:',
  'Mohon izin kami terapi dengan :',
];

describe('classifyProseHeader', () => {
  it.each(ASSESS_SPELLINGS)('resolves %s to the assessment section', (heading) => {
    expect(classifyProseHeader(heading)).toBe('a');
  });

  it.each(TERAPI_SPELLINGS)('resolves %s to the terapi section', (heading) => {
    expect(classifyProseHeader(heading)).toBe('terapi');
  });

  it('does not fire on a heading that merely mentions the word', () => {
    // `*Riwayat terapi sebelumnya:*` is a history heading. Classifying it
    // would pull a past medication list into the plan sent to the DPJP.
    expect(classifyProseHeader('Riwayat terapi sebelumnya')).toBeNull();
    expect(classifyProseHeader('Evaluasi terapi kemarin')).toBeNull();
  });

  it('classifies only assessment and terapi', () => {
    // S, O and Plan are matched by the alias table in all three note formats,
    // so a stem for them would be pure false-positive surface.
    expect(classifyProseHeader('Rencana tindak lanjut bersama tim bedah')).toBeNull();
    expect(classifyProseHeader('Subjektif tambahan')).toBeNull();
  });

  it('leaves the TS shorthand alone', () => {
    // `A/` and `P/` belong to a consulting service's own block.
    expect(classifyProseHeader('A')).toBeNull();
    expect(classifyProseHeader('P')).toBeNull();
    expect(classifyProseHeader('TS BTKV')).toBeNull();
  });

  it('ignores punctuation and emphasis differences', () => {
    expect(classifyProseHeader('Mohon izin kami assess dengan')).toBe('a');
    expect(classifyProseHeader('mohon izin kami ASSESS dengan :')).toBe('a');
  });
});

describe('real note formats', () => {
  const igd = [
    '*S:*', '- Nyeri dada kiri.',
    '*O :*', 'Compos mentis', 'Tensi : 164/105 mmHg',
    '*EKG di IGD PJT (24-08-2026)*', 'Sinus Rhythm',
    '*Mohon izin kami assest dengan:*', '- Unstable Angina Pectoris',
    '*Mohon izin kami terapi dengan*', '- IVFD NaCl 0.9%',
    '*Plan*', '- Monitoring Tanda vital',
  ].join('\n');

  const cvcu = [
    '*S :*', '- Nyeri dada tidak ada.',
    '*O :*', '*A – Airway*', 'Paten.',
    '*Mohon izin kami assesst dengan :*', '- Unstable Angina Pectoris',
    '*Mohon izin kami terapi dengan :*', '- IVFD NaCL 0,9%',
    '*Plan :*', '- Monitoring Tanda vital',
  ].join('\n');

  const bangsal = [
    '*S:*', '- Nyeri dada ada berkurang.',
    '*O:*', 'Compos Mentis', 'Tekanan Darah : 137/95 mmHg',
    '*Mohon izin kami assess dengan:*', '- Unstable Angina Pectoris',
    '*Mohon izin kami terapi dengan:*', '- IVFD NaCL 0,9%',
    '*Plan:*', '- Monitoring Tanda vital',
  ].join('\n');

  it.each([
    ['IGD', igd],
    ['CVCU', cvcu],
    ['bangsal', bangsal],
  ])('offers all six jump targets for the %s format', (_name, note) => {
    expect(jumpTargets(note, ALIASES).map((t) => t.sectionId)).toEqual([
      '_identity',
      's',
      'o',
      'a',
      'terapi',
      'p',
    ]);
  });

  it('resolves the assessment for copy and tinting, not only for jumping', () => {
    // The same miss meant "copy just the assessment" had never worked on
    // these notes either.
    const ids = parseSections(igd, ALIASES).map((section) => section.sectionId);
    expect(ids).toContain('a');
    expect(ids).toContain('terapi');
  });

  it('does not target a TS block written in the shorthand', () => {
    const withTs = [
      '*Mohon izin kami assess dengan:*', '- milik kami',
      '*TS BTKV*',
      '*A/*', '- milik TS',
      '*P/*', '- rencana TS',
    ].join('\n');
    const targets = jumpTargets(withTs, ALIASES);
    expect(targets.filter((t) => t.sectionId === 'a')).toHaveLength(1);
    // The TS plan must not become this note's Plan button.
    expect(targets.map((t) => t.sectionId)).not.toContain('p');
  });

  it('keeps EKG and lab blocks out of the bar', () => {
    expect(jumpTargets(igd, ALIASES).map((t) => t.label)).not.toContain('EKG di IGD PJT');
  });
});
