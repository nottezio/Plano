import { describe, expect, it } from 'vitest';

import { buildCard, previewDiff, statusRank, STATUS_LABEL } from './board';
import { DEFAULT_CHECKLIST } from './defaults';
import { makePatient } from './testFactories';
import { namesDiagnosis } from './sections/diagnosisHeading';
import { previousFromEntry, previousPreviewFields } from '@/data/repositories/patients.repo';

const ITEMS = DEFAULT_CHECKLIST.map((item) => ({ ...item }));
const TODAY = '2026-08-06';
const YESTERDAY = '2026-08-05';

describe('previewDiff', () => {
  it('lists what was added and removed, ignoring bullets, case and spacing', () => {
    const diff = previewDiff('- CAD 3VD\n- HHD\n- AKI', '1. cad  3VD\n- HHD\n- CKD st 3');
    expect(diff).toEqual({ added: ['CKD st 3'], changed: [], removed: ['AKI'] });
  });

  it('reports a new value or qualifier as ONE changed diagnosis', () => {
    expect(previewDiff('- Pneumonia\n- Hyponatremia (121)', '- Pneumonia (perbaikan)\n- Hyponatremia (121 -> 123)')).toEqual({
      added: [],
      changed: [
        { from: 'Pneumonia', to: 'Pneumonia (perbaikan)' },
        { from: 'Hyponatremia (121)', to: 'Hyponatremia (121 -> 123)' },
      ],
      removed: [],
    });
  });

  it('pairs a diagnosis whose score or class changed', () => {
    expect(previewDiff('- NSTEMI (TIMI 3/7)\n- CHF NYHA III', '- NSTEMI TIMI 4/7\n- CHF NYHA IV').changed).toHaveLength(2);
  });

  it('does not pair two different diagnoses', () => {
    expect(previewDiff('- Hypertension', '- Hypertensive heart disease').changed).toEqual([]);
    expect(previewDiff('- AKI', '- AF')).toEqual({ added: ['AF'], changed: [], removed: ['AKI'] });
  });

  it('ignores the heading line and the truncation mark', () => {
    expect(previewDiff('Diagnosis:\n- HF', 'Mohon izin pasien kami:\n- HF…')).toEqual({ added: [], changed: [], removed: [] });
  });
});

describe('dxChanges on the card', () => {
  it('appears only for today’s note against an earlier one', () => {
    const patient = makePatient({
      preview: '- HF\n- AF',
      previewDate: TODAY,
      prevPreview: '- HF',
      prevPreviewDate: YESTERDAY,
    });
    expect(buildCard(patient, ITEMS, TODAY, false).dxChanges).toEqual({ added: ['AF'], changed: [], removed: [] });
    expect(buildCard({ ...patient, previewDate: YESTERDAY }, ITEMS, TODAY, false).dxChanges).toBeNull();
    expect(buildCard({ ...patient, prevPreview: '- HF\n- AF' }, ITEMS, TODAY, false).dxChanges).toBeNull();
  });

  it('reads the check count only when it is for today', () => {
    const patient = makePatient({ checkCount: 2, checkDate: TODAY });
    expect(buildCard(patient, ITEMS, TODAY, false).checkCount).toBe(2);
    expect(buildCard({ ...patient, checkDate: YESTERDAY }, ITEMS, TODAY, false).checkCount).toBeNull();
  });
});

describe('statusRank', () => {
  const progress = (complete: boolean) => ({ ...buildCard(makePatient(), ITEMS, TODAY, false).progress, complete });
  it('puts the patients with the most left to do first', () => {
    expect(statusRank({ preview: '', previewIsStale: false, progress: progress(false) })).toBe(0);
    expect(statusRank({ preview: '- HF', previewIsStale: true, progress: progress(false) })).toBe(1);
    expect(statusRank({ preview: '- HF', previewIsStale: false, progress: progress(false) })).toBe(2);
    expect(statusRank({ preview: '- HF', previewIsStale: false, progress: progress(true) })).toBe(3);
    expect(STATUS_LABEL).toHaveLength(4);
  });
});

describe('previousPreviewFields', () => {
  it('keeps the stored preview only when it is from an earlier day', () => {
    expect(previousPreviewFields(YESTERDAY, '- HF', TODAY)).toEqual({ prevPreview: '- HF', prevPreviewDate: YESTERDAY });
    expect(previousPreviewFields(TODAY, '- HF', TODAY)).toEqual({});
    expect(previousPreviewFields(undefined, '- HF', TODAY)).toEqual({});
    expect(previousPreviewFields(YESTERDAY, '', TODAY)).toEqual({});
  });
});

describe('namesDiagnosis', () => {
  it('accepts diagnosis headings, with or without the TS lead-in', () => {
    expect(namesDiagnosis('Diagnosis')).toBe(true);
    expect(namesDiagnosis('Assessment')).toBe(true);
    expect(namesDiagnosis('Mohon izin pasien kami diagnosis')).toBe(true);
    expect(namesDiagnosis('Masalah')).toBe(true);
  });

  it('rejects headings that only mention one', () => {
    expect(namesDiagnosis('Plan diagnostik')).toBe(false);
    expect(namesDiagnosis('Terapi')).toBe(false);
  });
});

describe('previousFromEntry', () => {
  const note = '*Mohon izin kami assess dengan:*\n- HF\n- AKI\n\n*Terapi:*\n- Furosemide';
  it('fills the previous preview from yesterday’s note when none is stored', () => {
    const filled = previousFromEntry({}, TODAY, { date: YESTERDAY, body: note });
    expect(filled?.prevPreviewDate).toBe(YESTERDAY);
    expect(filled?.prevPreview).toContain('AKI');
  });

  it('does nothing once that day is recorded, or without a note', () => {
    expect(previousFromEntry({ prevPreviewDate: YESTERDAY }, TODAY, { date: YESTERDAY, body: note })).toBeNull();
    expect(previousFromEntry({}, TODAY, { date: YESTERDAY, body: '  ' })).toBeNull();
    expect(previousFromEntry({}, TODAY, null)).toBeNull();
    expect(previousFromEntry({}, YESTERDAY, { date: YESTERDAY, body: note })).toBeNull();
  });

  it('replaces an older stored day with the newer one', () => {
    expect(previousFromEntry({ prevPreviewDate: '2026-08-01' }, TODAY, { date: YESTERDAY, body: note })?.prevPreviewDate).toBe(
      YESTERDAY,
    );
  });
});
