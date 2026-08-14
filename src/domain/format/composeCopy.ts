import { formatBody, type BulletStyle } from './formatters';
import { copyableSections, mergeSections, parseSections } from '../sections/parseSections';
import { sectionSortIndex } from '../sections/aliases';
import { formatLongDate, hariRawat } from '../clinicalDate';
import type {
  ClinicalDate,
  CopyPreset,
  OutputFormat,
  Patient,
  SectionAlias,
  SectionId,
} from '../types';

/**
 * SPEC 12.4 — composition.
 *
 * The copy engine reads the parsed view and assembles a NEW string. It never
 * touches the stored body; `parseSections` returns slices, and everything here
 * concatenates those slices.
 *
 * One rule earns its own paragraph: when the user copies *all* sections, the
 * body passes through structurally untouched — only the inline formatter runs.
 * Re-composing from parsed blocks would silently normalise the resident's own
 * spacing, and "copy everything" must be byte-faithful apart from the format
 * conversion they explicitly asked for.
 */

export interface CopyDay {
  date: ClinicalDate;
  body: string;
}

export interface ComposeOptions {
  format: OutputFormat;
  /** How bullets are written for WhatsApp; see formatters.ts. */
  bullet?: BulletStyle;
  sections: SectionId[] | 'all';
  includeIdentity: boolean;
  includeDateHeader: boolean;
  aliases: readonly SectionAlias[];
  patient: Patient;
}

/** SPEC 12.4 — the identity line, built from what the patient record has. */
export function identityLine(patient: Patient): string {
  return [
    patient.name,
    patient.age !== undefined ? `${patient.age}th` : null,
    patient.sex,
    patient.mrn ? `RM ${patient.mrn}` : null,
    [patient.ward, patient.bed].filter(Boolean).join(' ').trim() || null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function dayHeading(date: ClinicalDate, admittedAt: ClinicalDate): string {
  return `${formatLongDate(date)} · Hari rawat ke-${hariRawat(date, admittedAt)}`;
}

/**
 * Renders one day's body, honouring the section subset.
 *
 * Blank lines between blocks are normalised to exactly one when composing a
 * subset (SPEC 12.4) — the gaps in the original separated sections that are no
 * longer adjacent, so preserving them would produce ragged holes.
 */
function renderDayBody(body: string, options: ComposeOptions): string {
  if (options.sections === 'all') return body.trim();

  const wanted = new Set(options.sections);
  const merged = mergeSections(parseSections(body, options.aliases))
    // NOT filtered by `empty`. A dated heading like
    // `*Laboratorium PJT (04-08-2026)*` parses as empty whenever its own values
    // are themselves headings (`GDS : 222`). Dropping it would keep the number
    // and lose the date it belongs to, which is worse than an unused heading.
    .filter((section) => wanted.has(section.sectionId))
    .sort(
      (a, b) =>
        sectionSortIndex(a.sectionId, options.aliases) -
        sectionSortIndex(b.sectionId, options.aliases),
    );

  return merged
    .map((section) => {
      const header = section.blocks[0]?.headerLine?.replace(/[ \t]+$/, '');
      // `_intro` has no header; emitting one would invent a section the user
      // never wrote.
      return header ? `${header} ${section.text}`.trim() : section.text;
    })
    .join('\n\n');
}

export function composeCopy(days: readonly CopyDay[], options: ComposeOptions): string {
  const parts: string[] = [];

  if (options.includeIdentity) {
    const identity = identityLine(options.patient);
    if (identity) parts.push(identity);
  }

  const multiDay = days.length > 1;

  for (const day of days) {
    const rendered = renderDayBody(day.body, options);
    if (!rendered.trim() && !options.includeDateHeader) continue;

    const chunk: string[] = [];
    // A date header is forced when several days are in one message: without
    // it, three days of SOAP arrive as one undifferentiated wall of text.
    if (options.includeDateHeader || multiDay) {
      chunk.push(dayHeading(day.date, options.patient.admittedAt));
    }
    if (rendered.trim()) chunk.push(rendered);
    parts.push(chunk.join('\n'));
  }

  return formatBody(parts.join('\n\n').trim(), options.format, options.bullet);
}

/**
 * SPEC F8 — documents run through the same copy engine as SOAP notes.
 *
 * The only difference is that a document has no patient, so there is no
 * identity line and no date header — which is exactly why this is a thin
 * wrapper rather than a second engine.
 */
export function composeDocument(
  body: string,
  sections: SectionId[] | 'all',
  format: OutputFormat,
  aliases: readonly SectionAlias[],
): string {
  if (sections === 'all') return formatBody(body.trim(), format);

  const wanted = new Set(sections);
  const merged = mergeSections(parseSections(body, aliases))
    .filter((section) => wanted.has(section.sectionId) && !section.empty)
    .sort((a, b) => sectionSortIndex(a.sectionId, aliases) - sectionSortIndex(b.sectionId, aliases));

  return formatBody(
    merged
      .map((section) => {
        const header = section.blocks[0]?.headerLine?.replace(/[ \t]+$/, '');
        return header ? `${header} ${section.text}`.trim() : section.text;
      })
      .join('\n\n'),
    format,
  );
}

/** Copies a single section, used by the per-section gutter button (SPEC F6). */
export function composeSection(
  body: string,
  sectionId: SectionId,
  format: OutputFormat,
  aliases: readonly SectionAlias[],
  includeHeader = true,
): string {
  const section = copyableSections(body, aliases).find(
    (candidate) => candidate.sectionId === sectionId,
  );
  if (!section) return '';

  const header = section.blocks[0]?.headerLine?.replace(/[ \t]+$/, '');
  const text = includeHeader && header ? `${header} ${section.text}`.trim() : section.text;
  return formatBody(text, format);
}

/**
 * SPEC 12.5 — resolves a preset's range into the days to include.
 *
 * `available` must be newest-first, which is the order the entries query
 * returns. Ranges are resolved here rather than in the UI so a preset behaves
 * identically from the copy sheet, a chip, or a keyboard shortcut.
 */
export function resolveRange(
  preset: Pick<CopyPreset, 'range' | 'lastN'>,
  available: readonly CopyDay[],
  today: ClinicalDate,
  specificDate?: ClinicalDate,
): CopyDay[] {
  const newestFirst = [...available].sort((a, b) => (a.date < b.date ? 1 : -1));

  switch (preset.range) {
    case 'today': {
      const match = newestFirst.find((day) => day.date === today);
      return match ? [match] : [];
    }
    case 'specific': {
      const match = newestFirst.find((day) => day.date === specificDate);
      return match ? [match] : [];
    }
    case 'lastN': {
      const count = Math.max(1, preset.lastN ?? 3);
      return newestFirst.slice(0, count).reverse();
    }
    case 'all':
      return [...newestFirst].reverse();
  }
}
