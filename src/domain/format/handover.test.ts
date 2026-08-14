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

describe('WhatsApp is left to make its own bullet list', () => {
  const plan = ['*Plan:*', '- Rawat jalan hari ini', '- Cek elektrolit kontrol'].join('\n');

  it('emits a plain hyphen by default, which WhatsApp turns into a list', () => {
    // The point: hand WhatsApp something it recognises. Producing the bullets
    // ourselves — or suppressing its conversion — both fight the renderer.
    expect(toWhatsApp(plan)).toBe(plan);
    expect(toWhatsApp(plan)).toMatch(/^- /m);
  });

  it('carries no invisible characters in the default output', () => {
    const output = toWhatsApp(plan);
    expect(output).not.toContain('\u200B');
    expect(output).not.toContain('\u00A0');
  });

  it('normalises `* ` to `- ` so pasted text lists the same way', () => {
    expect(toWhatsApp('* Cek DPL')).toBe('- Cek DPL');
  });
});
