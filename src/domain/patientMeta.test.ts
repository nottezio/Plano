import { describe, expect, it } from 'vitest';

import { patientMetaChanged } from './patientMeta';

describe('patientMetaChanged (2026-11-01: an autosave writes the patient only when the card changes)', () => {
  const cached = { preview: 'CHF NYHA III', previewDate: '2026-11-01', dpjpId: 'ks', dpjpIds: ['ks', 'pt'], labPlans: [{ test: 'Na', day: 1 }] };

  it('writes when there is no cached copy to compare with', () => {
    expect(patientMetaChanged(undefined, { preview: 'x' })).toBe(true);
  });

  it('skips when every field is what the device already holds (typing in S, O or P)', () => {
    expect(patientMetaChanged(cached, { preview: 'CHF NYHA III', previewDate: '2026-11-01', dpjpId: 'ks', dpjpIds: ['ks', 'pt'] })).toBe(false);
    expect(patientMetaChanged(cached, {})).toBe(false);
  });

  it('writes when the preview, a DPJP, or the lab plans change', () => {
    expect(patientMetaChanged(cached, { preview: 'CHF NYHA II' })).toBe(true);
    expect(patientMetaChanged(cached, { dpjpIds: ['ks'] })).toBe(true);
    expect(patientMetaChanged(cached, { labPlans: [{ test: 'K', day: 1 }] })).toBe(true);
  });

  it('writes a field the document does not have yet', () => {
    expect(patientMetaChanged(cached, { kjs: 'utama' })).toBe(true);
    expect(patientMetaChanged({}, { prevPreview: 'old', prevPreviewDate: '2026-10-31' })).toBe(true);
  });
});
