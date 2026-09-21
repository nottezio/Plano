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
  });

  /**
   * `A/` and `P/` stay plain — a reversal, made on evidence.
   *
   * The old rule came from one worked bangsal note, where the consult block
   * reads `*TS Interna GH*  *A/*  *Plan:*`. Across 237 notes those lines are
   * plain 267 times and bold 22, and every one of the 289 sits inside a TS
   * block — so "inside a consult block" does not explain the bold ones
   * either. The worked note is the minority style.
   *
   * It matters beyond tidiness: bolding another service's assessment makes it
   * read as ours, in a document whose purpose is to say what WE think.
   */
  it('leaves a consulting service\'s own headings plain', () => {
    expect(out('A/')).toBe('A/');
    expect(out('P/')).toBe('P/');
    expect(out('S/')).toBe('S/');
  });

  it('leaves the closing sentence plain', () => {
    // Bolded 118 lines the corpus writes plain.
    expect(out('Selanjutnya mohon arahan dokter. Terima kasih')).toBe(
      'Selanjutnya mohon arahan dokter. Terima kasih',
    );
  });

  describe('measured against the corpus (export of 2026-09-20)', () => {
    it('bolds an identity line written without the letters RM', () => {
      expect(out('Ny. Nuraeni / 3 Juli 1958 / 68 tahun / 1715410')).toBe(
        '*Ny. Nuraeni / 3 Juli 1958 / 68 tahun / 1715410*',
      );
    });

    it('italicises the commonest referral opening', () => {
      expect(out('Pasien dikonsulkan untuk evaluasi dan tatalaksana')).toBe(
        '_Pasien dikonsulkan untuk evaluasi dan tatalaksana_',
      );
    });

    it('bolds investigation headings in the date shapes the ward writes', () => {
      expect(out('Foto thorax RS Batara Siang 2-9-2026')).toBe(
        '*Foto thorax RS Batara Siang 2-9-2026*',
      );
      expect(out('USG Doppler (4 Agu 2026)')).toBe('*USG Doppler (4 Agu 2026)*');
      expect(out('Echo Hemodinamik IGD')).toBe('*Echo Hemodinamik IGD*');
    });

    it('leaves Lung Ultrasound and a plan sentence alone', () => {
      expect(out('Lung Ultrasound (08-09-2026)')).toBe('Lung Ultrasound (08-09-2026)');
      expect(out('Echo ulang bila klinis memburuk, lapor DPJP.')).toBe(
        'Echo ulang bila klinis memburuk, lapor DPJP.',
      );
    });
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
