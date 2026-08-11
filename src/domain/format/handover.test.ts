import { describe, expect, it } from 'vitest';
import { toWhatsApp } from './formatters';

/** End-to-end against the exact handover the user sent. */
describe('the real handover round-trips unchanged', () => {
  const body = [
    'S :',
    '- Saat ini keluhan nyeri dada, sesak dan berdebar-debar tidak ada.',
    '- BAB kesan normal. BAK via kateter kesan normal',
    '',
    '*Mohon izin kami terapi dengan*',
    '- Aspilet 80mg/24jam/oral (tunda)',
    '- Clopidogrel 75mg/24jam/oral',
    '',
    'Plan Diagnostik:',
    '-',
    '',
    '*Plan:*',
    '- Rawat jalan hari ini tgl 08/08/2026',
  ].join('\n');

  it('keeps every bullet as a hyphen', () => {
    expect(toWhatsApp(body)).toBe(body);
  });

  it('emits no bullet characters at all', () => {
    expect(toWhatsApp(body)).not.toContain('\u2022');
  });
});
