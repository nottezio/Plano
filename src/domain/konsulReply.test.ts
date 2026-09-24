import { describe, expect, it } from 'vitest';

import { conclusionFinding, consultQuestion, konsulPreview } from './konsulReply';
import { DEFAULT_SECTION_ALIASES } from './defaults';
import { parseSections } from './sections/parseSections';
import { jumpTargets } from './sections/jumpTargets';
import { buildPreview } from '@/data/repositories/patients.repo';
import { KONSUL_BARU_KJS, KONSUL_DARI_TS } from './sections/fixtures/konsulReply';

const A = DEFAULT_SECTION_ALIASES;

describe('the cardiology conclusion is the assessment', () => {
  it.each([
    ['pasien baru KJS', KONSUL_BARU_KJS],
    ['konsul dari TS', KONSUL_DARI_TS],
  ])('%s: one A section, starting at the conclusion', (_, body) => {
    const assessments = parseSections(body, A).filter((section) => section.sectionId === 'a');
    expect(assessments).toHaveLength(1);
    expect(assessments[0]?.carriesContent).toBe(true);
    expect(assessments[0]?.headerLine).toMatch(/Saat ini evaluasi kardiologi/i);
    // A heading on screen: owns its line, so the tint and jump layers treat it as one.
    expect(assessments[0]?.ownsLine).toBe(true);
  });

  it('loses nothing: the sections still reassemble the note exactly', () => {
    for (const body of [KONSUL_BARU_KJS, KONSUL_DARI_TS]) {
      const rebuilt = parseSections(body, A).map((s) => body.slice(s.start, s.end)).join('');
      expect(rebuilt).toBe(body);
    }
  });

  it('never reads a TS block’s A/ or P/ as this note’s own', () => {
    const ids = parseSections(KONSUL_DARI_TS, A).map((section) => section.sectionId);
    expect(ids.filter((id) => id === 'a')).toHaveLength(1);
    expect(ids).not.toContain('p');
  });

  it('leaves an ordinary bolded sentence alone', () => {
    const body = '*S:*\n- ok\n\n*Pasien saat ini stabil dan direncanakan pulang besok pagi setelah visite DPJP*\n';
    expect(parseSections(body, A).map((s) => s.sectionId)).not.toContain('a');
  });
});

describe('reading a consult reply', () => {
  it('finds the question, with dikonsul and dikonsulkan', () => {
    expect(consultQuestion(KONSUL_DARI_TS)).toBe('kelayakan bronkoskopi dengan general anestesi');
    expect(consultQuestion(KONSUL_BARU_KJS)).toMatch(/^evaluasi dan tatalaksana/);
    expect(consultQuestion('*S:*\n- tidak ada')).toBeNull();
  });

  it('skips the method statement to the finding, in both phrasings', () => {
    expect(
      conclusionFinding('*_Saat ini evaluasi kardiologi berdasarkan anamnesis, EKG, pasien kami assess dengan Tachypnea ec Abdominal Pain._*'),
    ).toBe('Tachypnea ec Abdominal Pain.');
    expect(
      conclusionFinding('*Saat ini evaluasi Kardiologi berdasarkan EKG, pasien termasuk kategori Low Risk untuk bronkoskopi.*'),
    ).toBe('Low Risk untuk bronkoskopi.');
  });

  it('returns the whole sentence rather than guessing when neither phrase is there', () => {
    expect(conclusionFinding('*Saat ini evaluasi kardiologi: stabil.*')).toBe('Saat ini evaluasi kardiologi: stabil.');
  });

  it('builds question then answer', () => {
    expect(konsulPreview('_Pasien dikonsul untuk X_', '*Saat ini evaluasi kardiologi, pasien termasuk Low Risk*', '\n')).toBe(
      'Konsul: X\nLow Risk',
    );
  });
});

describe('the card preview', () => {
  it('shows the question and the finding, not S and O', () => {
    const preview = buildPreview(KONSUL_DARI_TS, A);
    expect(preview.split('\n')).toEqual([
      'Konsul: kelayakan bronkoskopi dengan general anestesi',
      expect.stringMatching(/^Low Risk \(Lee Revised Cardiac Risk Index\)/),
    ]);
    expect(preview).not.toContain('*S:*');
  });

  it('is unchanged for an ordinary note', () => {
    const body = '*S:*\n- nyeri dada\n\n*Mohon izin kami assess dengan*\n- CAD 3VD\n';
    expect(buildPreview(body, A)).toBe('- CAD 3VD');
  });
});

describe('the jump bar', () => {
  it('offers A and every TS block, in note order', () => {
    const labels = jumpTargets(KONSUL_BARU_KJS, A).map((target) => target.label);
    expect(labels).toEqual(['Identitas', 'S', 'O', 'A', 'TS Bedah Dige…', 'TS EMD']);
  });

  it('does not add TS targets to a note without TS blocks', () => {
    const labels = jumpTargets('*S:*\n- ok\n\n*O:*\n- ok\n', A).map((target) => target.label);
    expect(labels).toEqual(['Identitas', 'S', 'O']);
  });
});
