import { describe, expect, it } from 'vitest';

import { ADMISI_BODY, FOLLOWUP_BODY, FOLLOWUP_DX_BODY } from './templates';
import { defaultUserSettings } from './defaults';
import { parseSections } from './sections/parseSections';
import { findMarkdownLeaks, toWhatsApp } from './format/formatters';

const ALL = [FOLLOWUP_BODY, FOLLOWUP_DX_BODY, ADMISI_BODY];
const SETTINGS = defaultUserSettings();

describe('seed templates', () => {
  it('are all registered in the default settings', () => {
    expect(SETTINGS.noteTemplates).toHaveLength(3);
    expect(SETTINGS.noteTemplates.map((t) => t.body)).toEqual(
      expect.arrayContaining(ALL),
    );
  });

  it('have unique ids and a contiguous order', () => {
    const templates = SETTINGS.noteTemplates;
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect(templates.map((t) => t.order).sort()).toEqual([1, 2, 3]);
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
