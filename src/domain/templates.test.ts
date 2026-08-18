import { describe, expect, it } from 'vitest';

import {
  ADMISI_BODY,
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
} from './templates';
import { defaultUserSettings } from './defaults';
import { parseSections } from './sections/parseSections';
import { findMarkdownLeaks, toWhatsApp } from './format/formatters';

const ALL = [
  FOLLOWUP_BODY,
  FOLLOWUP_DX_BODY,
  FOLLOWUP_RINGKAS_BODY,
  ADMISI_BODY,
  KONSUL_KJS_BODY,
  POLI_BARU_BODY,
];
const SETTINGS = defaultUserSettings();

describe('seed templates', () => {
  it('are all registered in the default settings', () => {
    expect(SETTINGS.noteTemplates).toHaveLength(6);
    expect(SETTINGS.noteTemplates.map((t) => t.body)).toEqual(
      expect.arrayContaining(ALL),
    );
  });

  it('have unique ids and a contiguous order', () => {
    const templates = SETTINGS.noteTemplates;
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect(templates.map((t) => t.order).sort()).toEqual([1, 2, 3, 4, 5, 6]);
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

  it('distinguish admission from follow-up by the length of S', () => {
    const sOf = (body: string): string =>
      body.slice(body.indexOf('*S:*'), body.indexOf('*O:*'));

    expect(sOf(ADMISI_BODY).length).toBeGreaterThan(sOf(FOLLOWUP_BODY).length * 3);
    expect(sOf(ADMISI_BODY)).toContain('Faktor resiko koroner');
    expect(sOf(FOLLOWUP_BODY)).not.toContain('Faktor resiko koroner');
  });

  it('share an identical block below S, so one can continue as the other', () => {
    const belowS = (body: string): string => body.slice(body.indexOf('*O:*'));
    expect(belowS(ADMISI_BODY)).toBe(belowS(FOLLOWUP_BODY));
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
    const standard = [FOLLOWUP_BODY, FOLLOWUP_DX_BODY, FOLLOWUP_RINGKAS_BODY, ADMISI_BODY];
    for (const body of standard) {
      expect(body.startsWith("Assalamu'alaikum dokter")).toBe(true);
      expect(body).toContain('atas nama :');
      expect(body).toContain('RM');
      expect(body).toContain('DPJP Utama');
      expect(body.trimEnd().endsWith('Tabe terimakasih dokter')).toBe(true);
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

  it('name the procedure line correctly for each context', () => {
    expect(FOLLOWUP_BODY).toContain('Post Tindakan');
    expect(ADMISI_BODY).toContain('Rencana Tindakan');
  });

  it('say "follow up" or "pasien baru" to match their use', () => {
    expect(FOLLOWUP_BODY).toContain('melaporkan follow up pasien');
    expect(ADMISI_BODY).toContain('melaporkan pasien baru');
  });

  it('pre-print no investigation headings — those accumulate as they arrive', () => {
    for (const body of ALL) {
      expect(body).not.toContain('EKG');
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
  it('puts the diagnosis list and closing before the SOAP body', () => {
    // Not a mistake — this is how a KJS consult is actually structured: the
    // consult question answered first, the workup for whoever reads on.
    const diagnosisAt = KONSUL_KJS_BODY.indexOf('*Diagnosis*');
    const closingAt = KONSUL_KJS_BODY.indexOf('Tabe selanjutnya mohon arahannya');
    const sAt = KONSUL_KJS_BODY.indexOf('*S:*');
    expect(diagnosisAt).toBeGreaterThan(-1);
    expect(diagnosisAt).toBeLessThan(closingAt);
    expect(closingAt).toBeLessThan(sAt);
  });

  it('carries the KJS opening line with placeholders for specialty and DPJP', () => {
    expect(KONSUL_KJS_BODY).toContain('pasien baru KJS *TS (Bagian) (Nama DPJP)*');
    expect(KONSUL_KJS_BODY).toContain('_DPJP Kardio : (Nama DPJP Kardio)_');
  });

  it('shares the same vitals block as the other templates', () => {
    expect(KONSUL_KJS_BODY).toContain('Anemis tidak ada, ikterus tidak ada');
  });
});

describe('POLI_BARU_BODY', () => {
  it('carries the poli-referral opening line', () => {
    expect(POLI_BARU_BODY).toContain('pengantar dari poli di bangsal');
    expect(POLI_BARU_BODY).toContain('Rencana tindakan : (rencana tindakan)');
  });

  it('splits the assessment into Primer, Sekunder and Problem', () => {
    expect(POLI_BARU_BODY).toContain('Diagnosis Primer:');
    expect(POLI_BARU_BODY).toContain('Diagnosis Sekunder:');
    expect(POLI_BARU_BODY).toContain('Problem:');
  });

  it('is distinct from the general admission template', () => {
    expect(POLI_BARU_BODY).not.toBe(ADMISI_BODY);
    expect(POLI_BARU_BODY).not.toContain('Faktor resiko koroner');
  });
});
