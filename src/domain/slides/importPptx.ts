import { isoDate } from '@/domain/sections/investigationHeading';
import type { ClinicalDate } from '@/domain/types';
import { zipEntries } from '@/lib/unzip';
import { layoutForCount, type DeckState, type ImageKind } from './deckState';
import { mergeLabGrids, type LabGrid } from './labTable';

/**
 * Continue a deck someone else started: read their .pptx and turn each slide
 * into Slide MZ's own pieces (SOAP days, photos, lab columns, text), so the
 * whole deck is rebuilt in one style and stays editable (owner's option B).
 *
 * The residents' decks share one shape (PowerPoint "Parcel": a SOAP table whose
 * first header cell is "Identitas", a lab table starting "Pemeriksaan", title +
 * picture slides), so recognition is by that shape, not by guessing at prose.
 * Anything else is kept as "tidak dikenali" text + photos rather than dropped.
 *
 * Read with regular expressions over the slide XML, not a DOM: it runs the same
 * in the browser and in tests, and only text, tables and picture links are needed.
 */

export interface ImportedPhoto {
  name: string;
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
}

export type ImportedSlide = { index: number } & (
  | { kind: 'title'; text: string }
  | { kind: 'soap'; date: ClinicalDate | null; col2: string; col3: string }
  | { kind: 'images'; title: string; date: ClinicalDate | null; imageKind: ImageKind; photos: ImportedPhoto[] }
  | { kind: 'lab'; grid: LabGrid }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'closing' }
  | { kind: 'unknown'; text: string; photos: ImportedPhoto[] }
);

export interface ImportResult {
  slides: ImportedSlide[];
  /** Pictures in a format a slide cannot carry here (EMF, WMF, TIFF…). */
  skippedPictures: number;
  aspect: '16:9' | '4:3' | 'other';
}

/** First match wins: "Luka post PPM" is a wound photo, not a procedure report. */
const KIND_WORDS: ReadonlyArray<readonly [RegExp, ImageKind]> = [
  [/\bluka\b/i, 'luka'],
  [/\b(?:ekg|ecg)\b/i, 'ekg'],
  [/\b(?:thorax|thoraks|toraks|x-?ray|cxr|rontgen)\b/i, 'thorax'],
  [/\b(?:echo\w*|tte|tee|ekokardiogra\w*)\b/i, 'echo'],
  [/\b(?:laporan|cag|pci|ppm|tpm|eps|holter|ablasi\w*|treadmill|rhc|kateterisasi)\b/i, 'laporan'],
  [/\blab\w*/i, 'labFoto'],
];

export function guessImageKind(caption: string): ImageKind {
  return KIND_WORDS.find(([pattern]) => pattern.test(caption))?.[1] ?? 'lainnya';
}

/** Spaces allowed around the separators: decks carry `21- 09-2026`. */
const DATE = /(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})/;

function firstDate(text: string): ClinicalDate | null {
  const m = DATE.exec(text);
  return m ? isoDate(m[1]!, m[2]!, m[3]!) : null;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

/** Text of an XML fragment, one line per `a:p`; `a:br` becomes a line break. */
function textOf(xml: string): string {
  const paragraphs = xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[\s\S]*?<\/a:p>/g) ?? [];
  return paragraphs
    .map((p) =>
      (p.match(/<a:t>[\s\S]*?<\/a:t>|<a:br\/>|<a:br>[\s\S]*?<\/a:br>/g) ?? [])
        .map((piece) => (piece.startsWith('<a:br') ? '\n' : decodeXml(piece.slice(5, -6))))
        .join(''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tables(xml: string): string[][][] {
  return (xml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/g) ?? []).map((tbl) =>
    (tbl.match(/<a:tr\b[\s\S]*?<\/a:tr>/g) ?? []).map((tr) => (tr.match(/<a:tc\b[\s\S]*?<\/a:tc>/g) ?? []).map(textOf)),
  );
}

interface Shape {
  title: boolean;
  text: string;
}

function textShapes(xml: string): Shape[] {
  return (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []).map((sp) => ({
    title: /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(sp) || /<p:cNvPr[^>]*name="Title"/.test(sp),
    text: textOf(sp),
  }));
}

function mimeOf(path: string): ImportedPhoto['mime'] | null {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.png$/i.test(path)) return 'image/png';
  return null;
}

function labGridFromTable(rows: string[][]): LabGrid {
  const header = rows[0] ?? [];
  const columns = header.map((cell, i) => (i === 0 ? null : firstDate(cell)));
  const dates = [...new Set(columns.filter((d): d is ClinicalDate => d !== null))].sort();
  return {
    dates,
    rows: rows.slice(1).flatMap((row) => {
      const label = row[0]?.trim();
      if (!label) return [];
      const cells: Partial<Record<ClinicalDate, string>> = {};
      row.forEach((value, i) => {
        const date = columns[i];
        if (date && value.trim()) cells[date] = value.trim();
      });
      return [{ label, cells }];
    }),
  };
}

export async function readPptx(buffer: ArrayBuffer): Promise<ImportResult> {
  const entries = await zipEntries(
    buffer,
    /^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|media\/.+)$/,
  );
  const files = new Map(entries.map((e) => [e.name, e.data]));
  const decoder = new TextDecoder('utf-8');
  const read = (name: string): string => {
    const data = files.get(name);
    return data ? decoder.decode(data) : '';
  };

  const presentation = read('ppt/presentation.xml');
  if (!presentation) throw new Error('Bukan file PowerPoint (.pptx).');
  const size = /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(presentation);
  const ratio = size ? Number(size[1]) / Number(size[2]) : 0;
  const aspect = Math.abs(ratio - 16 / 9) < 0.02 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.02 ? '4:3' : 'other';

  const presRels = new Map(
    [...read('ppt/_rels/presentation.xml.rels').matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map(
      (m) => [m[1]!, m[2]!] as const,
    ),
  );
  const order = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => presRels.get(m[1]!))
    .filter((target): target is string => Boolean(target))
    .map((target) => `ppt/${target.replace(/^\/?ppt\//, '')}`);

  let skippedPictures = 0;
  const slides: ImportedSlide[] = [];

  order.forEach((path, index) => {
    const xml = read(path);
    if (!xml) return;
    const relPath = path.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const rels = new Map(
      [...read(relPath).matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const),
    );

    const photos: ImportedPhoto[] = [];
    for (const pic of xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) ?? []) {
      const relId = /r:embed="([^"]+)"/.exec(pic)?.[1];
      const target = relId ? rels.get(relId) : undefined;
      if (!target) continue;
      const media = `ppt/${target.replace(/^\.\.\//, '')}`;
      const mime = mimeOf(media);
      const bytes = files.get(media);
      if (!mime || !bytes) {
        skippedPictures += 1;
        continue;
      }
      photos.push({ name: media.split('/').pop()!, bytes, mime });
    }

    const tbls = tables(xml);
    const shapes = textShapes(xml);
    const title = shapes.find((s) => s.title)?.text ?? '';
    const body = shapes.filter((s) => !s.title).map((s) => s.text).filter(Boolean).join('\n\n');
    const allText = [title, body].filter(Boolean).join('\n');

    const soap = tbls.find((t) => /^identitas/i.test(t[0]?.[0]?.trim() ?? ''));
    const lab = tbls.find((t) => /^pemeriksaan/i.test(t[0]?.[0]?.trim() ?? ''));
    if (soap) {
      const row = soap[1] ?? [];
      slides.push({ index, kind: 'soap', date: firstDate(row[0] ?? ''), col2: row[1] ?? '', col3: row[2] ?? '' });
    } else if (lab) {
      slides.push({ index, kind: 'lab', grid: labGridFromTable(lab) });
    } else if (tbls.length > 0) {
      const tableText = tbls.flat().map((row) => row.join(' | ')).join('\n');
      slides.push({ index, kind: 'unknown', text: [allText, tableText].filter(Boolean).join('\n'), photos });
    } else if (photos.length > 0) {
      const caption = title || allText.split('\n')[0] || '';
      slides.push({ index, kind: 'images', title: caption, date: firstDate(caption), imageKind: guessImageKind(caption), photos });
    } else if (/^terima\s*kasih\W*$/i.test(allText.trim())) {
      slides.push({ index, kind: 'closing' });
    } else if (index === 0) {
      slides.push({ index, kind: 'title', text: allText });
    } else if (allText) {
      slides.push({ index, kind: 'text', title: title || allText.split('\n')[0]!, body: title ? body : allText.split('\n').slice(1).join('\n') });
    }
  });

  return { slides, skippedPictures, aspect };
}

const EMPTY_GRID: LabGrid = { dates: [], rows: [] };

/**
 * The picked slides merged into a deck state. Photos come back separately for
 * the caller to store; their ids are the ones the new image slides reference.
 */
export function importToState(
  result: ImportResult,
  picked: readonly number[],
  state: DeckState,
  idPrefix = 'imp',
): { state: DeckState; photos: Array<{ imageId: string; slideId: string } & ImportedPhoto> } {
  const next: DeckState = {
    ...state,
    importedDays: { ...state.importedDays },
    imageSlides: [...state.imageSlides],
    textSlides: [...state.textSlides],
  };
  const photos: Array<{ imageId: string; slideId: string } & ImportedPhoto> = [];
  const keep = new Set(picked);

  const addImages = (slideId: string, kind: ImageKind, title: string, date: ClinicalDate | null, list: ImportedPhoto[]): void => {
    if (list.length === 0) return;
    const imageIds = list.map((photo, k) => {
      // The image store holds every patient: the id must not repeat across patients.
      const imageId = `${state.patientId}-${slideId}-${k}`;
      photos.push({ imageId, slideId, ...photo });
      return imageId;
    });
    next.imageSlides.push({ id: slideId, kind, title, date: date ?? '', layout: layoutForCount(list.length), imageIds, rects: {} });
  };

  for (const slide of result.slides) {
    if (!keep.has(slide.index)) continue;
    const id = `${idPrefix}-${slide.index}`;
    switch (slide.kind) {
      case 'soap':
        if (slide.date) {
          // Decks often carry two slides for one day (morning and evening); keep both, `date#2` after `date`.
          let key = slide.date;
          for (let n = 2; key in next.importedDays; n += 1) key = `${slide.date}#${n}`;
          next.importedDays[key] = { col2: slide.col2, col3: slide.col3 };
        } else next.textSlides.push({ id, title: 'SOAP (tanggal tidak terbaca)', body: [slide.col2, slide.col3].filter(Boolean).join('\n\n') });
        break;
      case 'images':
        addImages(id, slide.imageKind, slide.title, slide.date, slide.photos);
        break;
      case 'lab':
        next.importedLab = mergeLabGrids(next.importedLab ?? EMPTY_GRID, slide.grid);
        break;
      case 'text':
        next.textSlides.push({ id, title: slide.title, body: slide.body });
        break;
      case 'unknown':
        if (slide.text) next.textSlides.push({ id: `${id}-t`, title: `Tidak dikenali (slide ${slide.index + 1})`, body: slide.text });
        addImages(`${id}-i`, 'lainnya', `Tidak dikenali (slide ${slide.index + 1})`, null, slide.photos);
        break;
      case 'title':
      case 'closing':
        break;
    }
  }
  return { state: next, photos };
}
