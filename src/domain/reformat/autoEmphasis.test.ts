import { describe, expect, it } from 'vitest';

import { autoEmphasis } from './autoEmphasis';

const out = (body: string): string => autoEmphasis(body).body;

describe('autoEmphasis', () => {
  it('bolds the identity line by its RM number', () => {
    // Matched on the RM rather than the slashes: a therapy line is full of
    // slashes too.
    expect(out('Tn. H. Anwar Sjarida/02-12-1949/76 Tahun/RM 01714449')).toBe(
      '*Tn. H. Anwar Sjarida/02-12-1949/76 Tahun/RM 01714449*',
    );
  });

  it('leaves a therapy line alone despite its slashes', () => {
    expect(out('- Amlodipin 5 mg/24 jam/oral')).toBe('- Amlodipin 5 mg/24 jam/oral');
  });

  it('italicises every DPJP line', () => {
    expect(out('DPJP Utama dan Tindakan : Prof. Muzakkir')).toBe(
      '_DPJP Utama dan Tindakan : Prof. Muzakkir_',
    );
  });

  it('italicises the referral sentence', () => {
    expect(out('Pasien dirujuk dari RS Ibnu Sina dengan diagnosis TAVB')).toBe(
      '_Pasien dirujuk dari RS Ibnu Sina dengan diagnosis TAVB_',
    );
  });

  it('bolds the section headings', () => {
    expect(out('S :\nO :')).toBe('*S :*\n*O :*');
  });

  it('bolds an investigation heading, and not the finding under it', () => {
    // The date is what separates them. `Ventricular pacing rhythm, HR 60 bpm`
    // is not a heading, and neither is a sentence that mentions an echo.
    const text = out('EKG di PJT Lt. 4 (02-09-2026)\nVentricular pacing rhythm, HR 60 bpm');
    expect(text).toBe('*EKG di PJT Lt. 4 (02-09-2026)*\nVentricular pacing rhythm, HR 60 bpm');
  });

  it('bolds the request lines and the consult headings', () => {
    expect(out('Mohon izin kami terapi dengan:')).toBe('*Mohon izin kami terapi dengan:*');
    expect(out('TS Interna GH')).toBe('*TS Interna GH*');
    expect(out('A/')).toBe('*A/*');
  });

  it('leaves Selesai plain, as the worked note has it', () => {
    // Reproducing the format, not improving on it.
    expect(out('Selesai:')).toBe('Selesai:');
  });

  it('is idempotent', () => {
    const once = out('S :\nDPJP Utama : dr. X');
    expect(out(once)).toBe(once);
  });

  it('never touches a line somebody has already marked', () => {
    // Including where they chose differently.
    expect(out('_S :_')).toBe('_S :_');
  });

  it('keeps indentation outside the marker', () => {
    // `*  Plan :*` renders the asterisk literally in WhatsApp.
    expect(out('  Plan :')).toBe('  *Plan :*');
  });

  it('reports how many lines it marked', () => {
    expect(autoEmphasis('S :\nO :\nhalo').changed).toBe(2);
  });
});
