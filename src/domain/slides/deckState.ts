import { headingDate } from '@/domain/lab/labMeta';
import type { ClinicalDate } from '@/domain/types';
import type { ImageLayout, Rect } from './geometry';
import type { LabGrid } from './labTable';

/**
 * What the resident has done to a patient's deck, stored on this device only
 * (`data/slidesLocal.ts`). The deck itself is recomposed from this plus the
 * notes every time, so a new SOAP day appears without anyone touching the deck.
 */

export type ImageKind = 'ekg' | 'thorax' | 'echo' | 'labFoto' | 'luka' | 'laporan' | 'lainnya';

/** Also the default order of image slides in the deck (most reference decks: EKG first). */
export const IMAGE_KINDS: readonly ImageKind[] = ['ekg', 'luka', 'labFoto', 'thorax', 'echo', 'laporan', 'lainnya'];

export const IMAGE_KIND_LABEL: Readonly<Record<ImageKind, string>> = {
  ekg: 'EKG',
  thorax: 'Foto thorax',
  echo: 'Echo/TTE',
  labFoto: 'Lab',
  luka: 'Luka',
  laporan: 'Laporan tindakan',
  lainnya: 'Lainnya',
};

export interface ImageSlideState {
  id: string;
  kind: ImageKind;
  title: string;
  date: ClinicalDate;
  layout: ImageLayout;
  imageIds: string[];
  /** Per image: where the resident put it. Absent = fitted in the layout frame. */
  rects: Record<string, Rect>;
  text?: string;
}

export interface TextSlideState {
  id: string;
  title: string;
  body: string;
  /** Manual size; absent = fit the box (24 pt down). */
  pt?: number | undefined;
  align?: 'left' | 'center' | undefined;
  /** Where the resident put the text box; absent = the reference slide's area. */
  rect?: Rect | undefined;
}

/** A SOAP-layout slide typed by hand: a day Plano has no note for, or a note written elsewhere. */
export interface CpptSlideState {
  id: string;
  date: ClinicalDate;
  col2: string;
  col3: string;
}

export interface SoapOverride {
  col2?: string;
  col3?: string;
  /** Hash of the source the edit was made against; a different hash now means the SOAP changed since. */
  sourceHash: string;
  /** Show the imported deck's version of this day instead of Plano's note. */
  useOld?: boolean;
}

export interface DeckState {
  patientId: string;
  updatedAt: number;
  order: string[];
  hidden: string[];
  soapOverrides: Record<ClinicalDate, SoapOverride>;
  importedDays: Record<ClinicalDate, { col2: string; col3: string }>;
  imageSlides: ImageSlideState[];
  textSlides: TextSlideState[];
  /** Added after the first release: decks saved earlier on a device do not have it. */
  cpptSlides?: CpptSlideState[];
  /** Taller (4:3) slides for the whole deck, for a long SOAP. */
  tall?: boolean;
  labOverrides: Record<string, string>;
  labDates?: ClinicalDate[];
  importedLab?: LabGrid;
}

export function emptyDeckState(patientId: string): DeckState {
  return {
    patientId,
    updatedAt: 0,
    order: [],
    hidden: [],
    soapOverrides: {},
    importedDays: {},
    imageSlides: [],
    textSlides: [],
    labOverrides: {},
  };
}

export function defaultCaption(kind: ImageKind, place: string, date: ClinicalDate): string {
  return [IMAGE_KIND_LABEL[kind], place.trim(), headingDate(date)].filter(Boolean).join(' ');
}

export function layoutForCount(count: number): ImageLayout {
  if (count >= 4) return 'four';
  if (count === 3) return 'three';
  if (count === 2) return 'two';
  return 'one';
}
