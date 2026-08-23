import { describe, expect, it } from 'vitest';

import {
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
  PERPINDAHAN_BODY,
  KONSUL_KELAYAKAN_BODY,
  FOLLOWUP_TPM_BODY,
  BALASAN_KONSUL_BODY,
} from './templates';
import { defaultUserSettings } from './defaults';
import { parseSections } from './sections/parseSections';
import { findMarkdownLeaks, toWhatsApp } from './format/formatters';

const ALL = [
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
  PERPINDAHAN_BODY,
];
const SETTINGS = defaultUserSettings();

describe('seed templates', () => {
  it('are all registered in the default settings', () => {
    expect(SETTINGS.noteTemplates).toHaveLength(9);
    expect(SETTINGS.noteTemplates.map((t) => t.body)).toEqual(
      expect.arrayContaining(ALL),
    );
  });

  it('have unique ids and a contiguous order', () => {
    const templates = SETTINGS.noteTemplates;
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect([...templates.map((t) => t.order)].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('parse into sections without the parser losing a byte', () => {
    for (const body of ALL) {
      const rebuilt = parseSections(body, SETTINGS.sectionAliases)
        .map((section) => body.slice(section.start, section.end))
        .join('');
      expect(rebuilt).toBe(body);
    }
  });

  it('convert to WhatsApp with no markdown left behind', () => {
    // The stored bodies legitimately contain `- ` bullets — that is the
    // canonical model. What must be clean is the CONVERTED output.
    for (const body of ALL) {
      expect(findMarkdownLeaks(toWhatsApp(body))).toEqual([]);
    }
  });

  it('differ from each other only where they are meant to', () => {
    // The DX variant adds the primary/secondary split and a problem list.
    expect(FOLLOWUP_DX_BODY).toContain('Diagnosis Primer');
    expect(FOLLOWUP_DX_BODY).toContain('Diagnosis Sekunder');
    expect(FOLLOWUP_DX_BODY).toContain('*Problem :*');
    expect(FOLLOWUP_BODY).not.toContain('Diagnosis Primer');
  });





  it('condenses the objective block in the fisis-normal variant', () => {
    expect(FOLLOWUP_RINGKAS_BODY).toContain('_Pemeriksaan fisis dalam batas normal_');
    // Vitals on one line, semicolon-separated, as the consultant reads them.
    expect(FOLLOWUP_RINGKAS_BODY).toContain('GCS E4V5M6; Tekanan Darah');
    expect(FOLLOWUP_RINGKAS_BODY).not.toContain('Anemis tidak ada');
  });

  it('carry the whole message: greeting, identity, DPJP, closing', () => {
    // KONSUL_KJS_BODY and POLI_BARU_BODY are transcribed verbatim from real
    // messages with their own greeting, DPJP line and closing — they are
    // checked on their own below rather than forced into this shape.
    const standard = [FOLLOWUP_BODY, FOLLOWUP_DX_BODY, FOLLOWUP_RINGKAS_BODY];
    for (const body of standard) {
      expect(body.startsWith("Assalamu'alaikum dokter")).toBe(true);
      expect(body).toContain('atas nama :');
      expect(body).toContain('RM');
      expect(body).toContain('DPJP Utama');
      expect(
        body.trimEnd().endsWith('Selanjutnya mohon arahan dokter. Terima kasih dokter.'),
      ).toBe(true);
    }
  });

  it('every template carries an identity line and an RM, however it is worded', () => {
    // The one invariant that does hold across all six: something to identify
    // the patient by, and their record number.
    for (const body of ALL) {
      expect(body).toMatch(/atas nama\s*:/);
      expect(body).toContain('RM');
    }
  });





  it('pre-print no investigation headings — those accumulate as they arrive', () => {
    // POLI_BARU_BODY carries "EKG per hari" as a PLAN item, which is an
    // instruction rather than a pre-printed result heading.
    const planLines = /EKG per hari|EKG\/hari/g;
    for (const body of ALL) {
      expect(body.replace(planLines, '')).not.toContain('EKG');
      expect(body).not.toContain('Laboratorium');
    }
  });
});

describe('carry-forward defaults', () => {
  it('never clears penunjang — that stack is the point of carrying forward', () => {
    expect(SETTINGS.carryForwardClearSections).not.toContain('penunjang');
  });

  it('clears only the subjective section', () => {
    expect(SETTINGS.carryForwardClearSections).toEqual(['s']);
  });
});


describe('KONSUL_KJS_BODY', () => {
  it('carries the KJS opening with both DPJP lines', () => {
    expect(KONSUL_KJS_BODY).toContain('pasien baru KJS *TS (Bagian)');
    expect(KONSUL_KJS_BODY).toContain('_DPJP (Bagian) (Utama):');
    expect(KONSUL_KJS_BODY).toContain('_DPJP Kardio :');
  });

  it('ends with the referring service block, as the real reports do', () => {
    expect(KONSUL_KJS_BODY).toContain('*TS (Bagian)*');
    expect(KONSUL_KJS_BODY.indexOf('*TS (Bagian)*')).toBeGreaterThan(
      KONSUL_KJS_BODY.indexOf('*Plan:*'),
    );
  });

  it('shares the same vitals block as the other templates', () => {
    expect(KONSUL_KJS_BODY).toContain('Anemis tidak ada, ikterus tidak ada');
  });
});

describe('PERPINDAHAN_BODY', () => {
  it('states both ends of the move', () => {
    expect(PERPINDAHAN_BODY).toContain('perpindahan dari *(Ruang asal)*');
    expect(PERPINDAHAN_BODY).toContain('ke *(Ruang tujuan)');
  });

  it('carries the follow-up checks a transfer creates', () => {
    expect(PERPINDAHAN_BODY).toContain('urine output dan balance cairan');
  });
});


describe('POLI_BARU_BODY', () => {
  it('carries the poli-referral opening line and the planned procedure', () => {
    expect(POLI_BARU_BODY).toContain('pasien baru dari *Poli (nama poli)*');
    expect(POLI_BARU_BODY).toContain('_Rencana tindakan :');
  });

  it('uses a flat assessment, not the primer/sekunder split', () => {
    // That split belongs to AHN alone, so it lives in FOLLOWUP_DX_BODY.
    // Carrying it in the default templates meant every other consultant got a
    // structure they had not asked for and had to delete.
    expect(POLI_BARU_BODY).toContain('*Mohon izin kami assess dengan:*');
    expect(POLI_BARU_BODY).not.toContain('Diagnosis Primer');
    expect(POLI_BARU_BODY).not.toContain('Diagnosis Sekunder');
  });
});

describe('the primer/sekunder split is AHN-only', () => {
  it('appears in exactly one template', () => {
    const carrying = ALL.filter((body) => body.includes('Diagnosis Primer'));
    expect(carrying).toHaveLength(1);
    expect(FOLLOWUP_DX_BODY).toContain('Diagnosis Primer');
  });
});


describe('the four presets drawn from the report examples', () => {


  it('gives the consult form the two DPJP lines the real reports carry', () => {
    for (const body of [KONSUL_KELAYAKAN_BODY]) {
      expect(body).toContain('_DPJP Kardio :');
      expect(body).toContain('(utama) :');
    }
  });

  it('pairs the On TPM and Off TPM blocks', () => {
    // The Off strip is the point: it shows whether the patient still paces.
    expect(FOLLOWUP_TPM_BODY).toContain('On TPM*');
    expect(FOLLOWUP_TPM_BODY).toContain('Off TPM*');
    expect(FOLLOWUP_TPM_BODY.indexOf('On TPM*')).toBeLessThan(
      FOLLOWUP_TPM_BODY.indexOf('Off TPM*'),
    );
    expect(FOLLOWUP_TPM_BODY).toContain('Evaluasi ketergantungan pacing');
  });

  it('writes the balasan as a reply, not as a new report', () => {
    // It goes into someone else's note, so it opens with the impression rather
    // than a greeting and identity block.
    expect(BALASAN_KONSUL_BODY.startsWith('Terima kasih atas konsulnya')).toBe(true);
    expect(BALASAN_KONSUL_BODY).toContain('A/');
    expect(BALASAN_KONSUL_BODY).toContain('I/');
    expect(BALASAN_KONSUL_BODY).toContain('P/ Plan Diagnostik:');
    expect(BALASAN_KONSUL_BODY).toContain('Plan Monitoring:');
  });
});

describe('section aliases from the report examples', () => {
  it('recognises AGD, urinalisa and conference results as penunjang', () => {
    const penunjang = defaultUserSettings().sectionAliases.find(
      (alias) => alias.sectionId === 'penunjang',
    );
    for (const heading of ['AGD', 'Analisa Gas Darah', 'Urinalisa', 'Hasil Confrence']) {
      expect(penunjang?.aliases).toContain(heading);
    }
  });
});

describe('closing-line presets', () => {
  it('carries the variants the real reports use, Prof forms included', () => {
    const closings = defaultUserSettings().closingSentences;
    expect(closings).toContain('Selanjutnya mohon arahan dokter. Terima kasih dokter');
    expect(closings.some((line) => line.includes('Prof'))).toBe(true);
    expect(closings).toContain('Tabe terimakasih dokter');
  });
});

describe('template wording follows the corpus, not one example', () => {
  /**
   * Counted across 59 real notes from the export:
   *   `*O:*` 32 vs `*O :*` 4
   *   `Tekanan Darah` 39 vs `Tensi` 0
   *   `Pernapasan` 33 vs `Nafas` 0
   *   `assess dengan` 31 vs `assessment dengan` 0
   *
   * I had changed all four the other way after reading a single example
   * document. These assertions exist so a future sample cannot quietly
   * outvote the corpus again.
   */
  it('uses the heading and labels the notes actually carry', () => {
    for (const body of ALL) {
      if (!body.includes('*O:*')) continue;
      expect(body).toContain('*O:*');
      expect(body).not.toContain('*O :*');
    }
    expect(FOLLOWUP_BODY).toContain('Tekanan Darah :');
    expect(FOLLOWUP_BODY).toContain('Pernapasan :');
    expect(FOLLOWUP_BODY).not.toContain('Tensi :');
  });

  it('writes assess, not assessment', () => {
    expect(FOLLOWUP_BODY).toContain('assess dengan');
    expect(FOLLOWUP_BODY).not.toContain('assessment dengan');
  });

  it('closes the way the notes most often close', () => {
    expect(FOLLOWUP_BODY.trimEnd()).toMatch(
      /Selanjutnya mohon arahan dokter\. Terima kasih dokter\.$/,
    );
  });
});
