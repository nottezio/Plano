import { compareEntryDates, isIgdEntry } from '@/domain/clinicalDate';
import { dpjpById } from '@/domain/dpjp';
import { bodyHash } from '@/domain/hash';
import { formatLocation } from '@/domain/identity';
import { headingDate } from '@/domain/lab/labMeta';
import type { ClinicalDate, Patient, SectionAlias } from '@/domain/types';
import type { Deck, DeckPhoto, DeckSlide } from './deck';
import { IMAGE_KINDS, type DeckState } from './deckState';
import { fitSoapFont, fitTextPt, textFitsAt } from './fit';
import { geometryFor, slideHeight, TEXT_PT } from './geometry';
import { applyLabOverrides, labGridFromDays, mergeLabGrids, type LabGrid } from './labTable';
import { soapColumns } from './soapColumns';

/**
 * Patient + notes + the resident's local edits → the deck, recomposed on every
 * change. Nothing here is stored: a new SOAP day shows up as a slide the next
 * time the editor opens, and an edit only ever lives in `DeckState`.
 */

export type DeckPatient = Pick<Patient, 'name' | 'mrn' | 'age' | 'sex' | 'ward' | 'room' | 'bed'>;

export interface SlideMeta {
  id: string;
  kind: DeckSlide['kind'];
  label: string;
  hidden: boolean;
  overflow: boolean;
  /** The SOAP changed after the resident edited this slide's copy. */
  staleOverride: boolean;
  /** An imported deck has its own version of this day. */
  hasOldVersion: boolean;
  /** SOAP slides: the `soapOverrides` key (`date`, or `date#2` for a second imported slide). */
  overrideKey?: string;
  /** SOAP slides: hash of the unedited source text, stamped on an override when it is made. */
  sourceHash?: string;
  /** A hand-typed CPPT slide: its id in `state.cpptSlides` (it has no note to override). */
  cpptId?: string;
}

export interface Composed {
  /** Visible slides only, in order. */
  deck: Deck;
  /** Every slide, hidden ones included, in order. */
  meta: SlideMeta[];
  /** Imported + notes lab grid before overrides and the column choice (the editor's date picker). */
  labGrid: LabGrid;
}

const HONORIFIC = /^(?:tn|ny|nn|an|by|sdr|sdri)\.?\s/i;

export function titleLines(patient: DeckPatient): { heading: string[]; subtitle: string } {
  const name = patient.name.trim();
  const prefix = HONORIFIC.test(name) ? '' : patient.sex === 'L' ? 'Tn. ' : patient.sex === 'P' ? 'Ny. ' : '';
  const first = [
    name ? `${prefix}${name}` : '',
    patient.age !== undefined ? `${patient.age} tahun` : '',
    patient.mrn?.trim() ? `RM ${patient.mrn.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' / ');
  const location = formatLocation(patient);
  return {
    heading: [first, location].filter(Boolean),
    subtitle: `DPJP Utama dan Tindakan : ${dpjpById('mz')?.name ?? 'Prof. Muzakkir Amir'}`,
  };
}

const soapId = (date: ClinicalDate): string => `soap-${date}`;

/**
 * Ids in the resident's order; any id the saved order does not know (tomorrow's
 * SOAP day, a slide just added) goes in right after its default predecessor.
 */
export function orderIds(defaults: readonly string[], saved: readonly string[]): string[] {
  const present = new Set(defaults);
  const result = saved.filter((id) => present.has(id));
  defaults.forEach((id, index) => {
    if (result.includes(id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k -= 1) {
      const pos = result.indexOf(defaults[k]!);
      if (pos >= 0) {
        at = pos + 1;
        break;
      }
    }
    result.splice(at, 0, id);
  });
  return result;
}

const EMPTY_GRID: LabGrid = { dates: [], rows: [] };

export function composeDeck(input: {
  patient: DeckPatient;
  days: ReadonlyArray<{ date: ClinicalDate; body: string }>;
  state: DeckState;
  photos: ReadonlyMap<string, DeckPhoto>;
  aliases?: readonly SectionAlias[];
}): Composed {
  const { patient, state } = input;
  const tall = Boolean(state.tall);
  const slideH = slideHeight(tall);
  const days = input.days.filter((day) => day.body.trim());
  const slides = new Map<string, { slide: DeckSlide; meta: Omit<SlideMeta, 'hidden'> }>();
  const defaults: string[] = [];
  const add = (slide: DeckSlide, meta: Omit<SlideMeta, 'hidden' | 'id' | 'kind'>): void => {
    slides.set(slide.id, { slide, meta: { id: slide.id, kind: slide.kind, ...meta } });
    defaults.push(slide.id);
  };
  const plain = { overflow: false, staleOverride: false, hasOldVersion: false };

  const title = titleLines(patient);
  add({ kind: 'title', id: 'title', heading: title.heading, subtitle: title.subtitle }, { label: 'Judul', ...plain });

  // SOAP days: imported ones and Plano's, oldest first.
  const bodies = new Map(days.map((day) => [day.date, day.body]));
  // `compareEntryDates`: the IGD admission note (id `igd`) is the first day, not the last.
  const dates = [...new Set([...Object.keys(state.importedDays), ...bodies.keys()])].sort(
    (a, b) => compareEntryDates(a.slice(0, 10), b.slice(0, 10)) || a.localeCompare(b),
  );
  const location = formatLocation(patient);
  for (const key of dates) {
    // Imported keys may be `date#2` for a second slide of the same day; Plano has one note per day.
    const date = key.slice(0, 10);
    const dayLabel = isIgdEntry(date) ? 'IGD' : headingDate(date);
    const body = bodies.get(key);
    const imported = state.importedDays[key];
    const override = state.soapOverrides[key];
    const usePlano = body !== undefined && !(override?.useOld && imported);
    const source = usePlano ? soapColumns(body, patient.mrn ? { rm: patient.mrn } : {}, input.aliases) : imported!;
    const sourceHash = soapSourceHash(source.col2, source.col3);
    const col2 = override?.col2 ?? source.col2;
    const col3 = override?.col3 ?? source.col3;
    const edited = override?.col2 !== undefined || override?.col3 !== undefined;
    const fit = fitSoapFont(col2, col3, slideH);
    add(
      {
        kind: 'soap',
        id: soapId(key),
        date,
        identitas: [dayLabel, '', location].join('\n').trimEnd(),
        col2,
        col3,
        fontPt: fit.pt,
      },
      {
        label: `SOAP ${dayLabel}`,
        overflow: fit.overflow,
        staleOverride: edited && override!.sourceHash !== sourceHash,
        hasOldVersion: Boolean(imported && body !== undefined),
        overrideKey: key,
        sourceHash,
      },
    );
  }

  // Hand-typed CPPT slides: SOAP layout, by date, after the days Plano has notes for.
  for (const cppt of [...(state.cpptSlides ?? [])].sort((a, b) => a.date.localeCompare(b.date))) {
    const fit = fitSoapFont(cppt.col2, cppt.col3, slideH);
    const day = headingDate(cppt.date);
    add(
      { kind: 'soap', id: cppt.id, date: cppt.date, identitas: [day, '', location].join('\n').trimEnd(), col2: cppt.col2, col3: cppt.col3, fontPt: fit.pt },
      { label: `CPPT ${day}`.trim(), ...plain, overflow: fit.overflow, cpptId: cppt.id },
    );
  }

  // Image slides grouped by kind, newest first within a kind.
  const images = [...state.imageSlides].sort(
    (a, b) => IMAGE_KINDS.indexOf(a.kind) - IMAGE_KINDS.indexOf(b.kind) || b.date.localeCompare(a.date),
  );
  for (const image of images) {
    const photos = image.imageIds.flatMap((id) => {
      const photo = input.photos.get(id);
      if (!photo) return [];
      const rect = image.rects[id];
      return [rect ? { ...photo, rect } : photo];
    });
    if (photos.length === 0 && !(image.layout === 'photoText' && image.text?.trim())) continue;
    add(
      { kind: 'images', id: image.id, title: image.title, layout: image.layout, photos, ...(image.text !== undefined ? { text: image.text } : {}) },
      { label: image.title, ...plain },
    );
  }

  for (const text of state.textSlides) {
    // Like the reference slide's autofit: shrink from 24 pt until the wrapped text fits. A manual size is kept, and flagged when it overflows.
    const rect = text.rect ?? geometryFor(tall).textOnly;
    const fit =
      text.pt !== undefined
        ? { pt: text.pt, overflow: !textFitsAt(text.body, rect, text.pt) }
        : fitTextPt(text.body, rect, TEXT_PT.max, TEXT_PT.floor);
    add(
      { kind: 'text', id: text.id, title: text.title, body: text.body, fontPt: fit.pt, align: text.align === 'center' ? 'ctr' : 'l', rect },
      { label: text.title, ...plain, overflow: fit.overflow },
    );
  }

  const grid = mergeLabGrids(state.importedLab ?? EMPTY_GRID, labGridFromDays(days));
  if (grid.dates.length > 0) {
    const table = applyLabOverrides(grid, state.labOverrides, state.labDates);
    add({ kind: 'lab', id: 'lab', title: 'Laboratorium PJT', dates: table.dates, rows: table.rows }, { label: 'Laboratorium', ...plain });
  }

  add({ kind: 'closing', id: 'closing' }, { label: 'Terima kasih', ...plain });

  const hidden = new Set(state.hidden);
  const ordered = orderIds(defaults, state.order).map((id) => slides.get(id)!);
  return {
    deck: { slides: ordered.filter((entry) => !hidden.has(entry.slide.id)).map((entry) => entry.slide), ...(tall ? { tall: true } : {}) },
    meta: ordered.map((entry) => ({ ...entry.meta, hidden: hidden.has(entry.slide.id) })),
    labGrid: grid,
  };
}

/** The hash an override must carry to count as current for this day's source text. */
export function soapSourceHash(col2: string, col3: string): string {
  return bodyHash(`${col2}\n\u0000\n${col3}`);
}
