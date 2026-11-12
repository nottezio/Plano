import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import {
  deleteImage,
  listImages,
  loadDeck,
  putImage,
  saveDeck,
  SlidesStorageError,
  type StoredImage,
} from '@/data/slidesLocal';
import { composeDeck, type Composed, type DeckPatient } from '@/domain/slides/compose';
import type { DeckPhoto } from '@/domain/slides/deck';
import { emptyDeckState, layoutForCount, type DeckState, type ImageKind } from '@/domain/slides/deckState';
import { importToState, type ImportResult } from '@/domain/slides/importPptx';
import { buildPptx, PPTX_MIME } from '@/domain/slides/pptx';
import type { ClinicalDate, SectionAlias } from '@/domain/types';
import { encodeSlideImage, storedToDeckPhoto } from '@/lib/slideImage';

/**
 * Slide MZ's editor state.
 *
 * Firestore cost: ONE `fetchEntryBodies` per open (one read per entry doc while
 * online; the cache when offline) and one more per "Perbarui dari SOAP". No
 * listener, no write. Everything the resident changes is saved to IndexedDB on
 * this device, debounced, and flushed when the editor closes.
 */

export async function loadSlideInputs(patientId: string): Promise<{
  days: Array<{ date: ClinicalDate; body: string }>;
  deck: DeckState | null;
  images: StoredImage[];
}> {
  const [days, deck, images] = await Promise.all([fetchEntryBodies(patientId), loadDeck(patientId), listImages(patientId)]);
  return { days, deck, images };
}

export type DeckStatus = 'loading' | 'start' | 'ready' | 'error';

const SAVE_DELAY_MS = 500;
const PER_SLIDE = 4;

async function imageSize(blob: Blob): Promise<{ widthPx: number; heightPx: number }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { widthPx: bitmap.width, heightPx: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    // Unknown size: fitted as 4:3, which the resident can resize.
    return { widthPx: 1600, heightPx: 1200 };
  }
}

export interface SlideDeckApi {
  status: DeckStatus;
  state: DeckState | null;
  composed: Composed | null;
  images: StoredImage[];
  /** Object URLs for previews, by image id. */
  urls: ReadonlyMap<string, string>;
  storageError: boolean;
  busy: boolean;
  update: (change: (state: DeckState) => DeckState) => void;
  startNew: () => void;
  refreshFromSoap: () => Promise<void>;
  addImages: (files: readonly File[], meta: { kind: ImageKind; date: ClinicalDate; title: string; place: string }) => Promise<void>;
  removeImage: (imageId: string) => Promise<void>;
  importDeck: (result: ImportResult, picked: readonly number[]) => Promise<void>;
  exportBlob: () => Blob | null;
}

export function useSlideDeck(
  patientId: string,
  patient: DeckPatient | null,
  aliases?: readonly SectionAlias[],
): SlideDeckApi {
  const [status, setStatus] = useState<DeckStatus>('loading');
  const [days, setDays] = useState<Array<{ date: ClinicalDate; body: string }>>([]);
  const [state, setState] = useState<DeckState | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [photos, setPhotos] = useState<ReadonlyMap<string, DeckPhoto>>(new Map());
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keyed on the id only: the patient object changes on every snapshot.
  useEffect(() => {
    let live = true;
    setStatus('loading');
    loadSlideInputs(patientId)
      .then((inputs) => {
        if (!live) return;
        setDays(inputs.days);
        setImages(inputs.images);
        setState(inputs.deck);
        setStatus(inputs.deck ? 'ready' : 'start');
      })
      .catch(() => live && setStatus('error'));
    return () => {
      live = false;
    };
  }, [patientId]);

  // Image bytes for the export, and object URLs for the previews.
  useEffect(() => {
    let live = true;
    void Promise.all(images.map((image) => storedToDeckPhoto(image))).then((list) => {
      if (live) setPhotos(new Map(list.map((photo) => [photo.imageId, photo])));
    });
    return () => {
      live = false;
    };
  }, [images]);
  const urls = useMemo(() => new Map(images.map((image) => [image.imageId, URL.createObjectURL(image.blob)])), [images]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  // Debounced save; the latest unsaved state is flushed when the editor closes.
  const pending = useRef<DeckState | null>(null);
  const flush = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    saveDeck(next).catch(() => setStorageError(true));
  }, []);
  useEffect(() => {
    if (!state || !pending.current) return;
    const timer = window.setTimeout(flush, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, flush]);
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const update = useCallback((change: (state: DeckState) => DeckState) => {
    setState((current) => {
      if (!current) return current;
      const next = { ...change(current), updatedAt: Date.now() };
      pending.current = next;
      return next;
    });
  }, []);

  const startNew = useCallback(() => {
    const fresh = { ...emptyDeckState(patientId), updatedAt: Date.now() };
    pending.current = fresh;
    setState(fresh);
    setStatus('ready');
  }, [patientId]);

  const refreshFromSoap = useCallback(async () => {
    setBusy(true);
    try {
      setDays(await fetchEntryBodies(patientId));
    } finally {
      setBusy(false);
    }
  }, [patientId]);

  const storeImages = useCallback(
    async (records: StoredImage[]): Promise<StoredImage[]> => {
      const kept: StoredImage[] = [];
      for (const record of records) {
        try {
          await putImage(record);
          kept.push(record);
        } catch (error) {
          if (error instanceof SlidesStorageError) setStorageError(true);
        }
      }
      // Shown even when storage failed: the export still has them this session.
      setImages((current) => [...current, ...records]);
      return kept;
    },
    [],
  );

  const addImages = useCallback<SlideDeckApi['addImages']>(
    async (files, meta) => {
      setBusy(true);
      try {
        const records: StoredImage[] = [];
        for (const file of files) {
          const encoded = await encodeSlideImage(file);
          records.push({
            imageId: `img-${nanoid(10)}`,
            patientId,
            blob: encoded.blob,
            widthPx: encoded.widthPx,
            heightPx: encoded.heightPx,
            kind: meta.kind,
            date: meta.date,
            place: meta.place,
            caption: meta.title,
          });
        }
        await storeImages(records);
        update((current) => {
          const slides = [...current.imageSlides];
          for (let i = 0; i < records.length; i += PER_SLIDE) {
            const chunk = records.slice(i, i + PER_SLIDE).map((record) => record.imageId);
            slides.push({
              id: `img-slide-${nanoid(8)}`,
              kind: meta.kind,
              title: meta.title,
              date: meta.date,
              layout: layoutForCount(chunk.length),
              imageIds: chunk,
              rects: {},
            });
          }
          return { ...current, imageSlides: slides };
        });
      } finally {
        setBusy(false);
      }
    },
    [patientId, storeImages, update],
  );

  const removeImage = useCallback(
    async (imageId: string) => {
      await deleteImage(imageId).catch(() => setStorageError(true));
      setImages((current) => current.filter((image) => image.imageId !== imageId));
      update((current) => ({
        ...current,
        imageSlides: current.imageSlides.map((slide) => {
          const rects = { ...slide.rects };
          delete rects[imageId];
          return { ...slide, imageIds: slide.imageIds.filter((id) => id !== imageId), rects };
        }),
      }));
    },
    [update],
  );

  const importDeck = useCallback<SlideDeckApi['importDeck']>(
    async (result, picked) => {
      // From the start screen there is no deck yet: the import creates it.
      const current = state ?? emptyDeckState(patientId);
      setBusy(true);
      try {
        // A second import replaces the first: drop what the last one brought in.
        const previous = current.imageSlides.filter((slide) => slide.id.startsWith('imp-')).flatMap((slide) => slide.imageIds);
        await Promise.all(previous.map((id) => deleteImage(id).catch(() => undefined)));
        const base: DeckState = {
          ...current,
          importedDays: {},
          imageSlides: current.imageSlides.filter((slide) => !slide.id.startsWith('imp-')),
          textSlides: current.textSlides.filter((slide) => !slide.id.startsWith('imp-')),
        };
        delete base.importedLab;
        const { state: next, photos: imported } = importToState(result, picked, base);
        const slideOf = new Map(next.imageSlides.map((slide) => [slide.id, slide]));
        const records = await Promise.all(
          imported.map(async (photo) => {
            const blob = new Blob([photo.bytes.slice()], { type: photo.mime });
            const slide = slideOf.get(photo.slideId);
            return {
              imageId: photo.imageId,
              patientId,
              blob,
              ...(await imageSize(blob)),
              kind: slide?.kind ?? 'lainnya',
              date: slide?.date ?? '',
              place: '',
              caption: slide?.title ?? '',
            } satisfies StoredImage;
          }),
        );
        setImages((list) => list.filter((image) => !previous.includes(image.imageId)));
        await storeImages(records);
        const saved = { ...next, updatedAt: Date.now() };
        pending.current = saved;
        setState(saved);
        setStatus('ready');
      } finally {
        setBusy(false);
      }
    },
    [patientId, state, storeImages],
  );

  const composed = useMemo(
    () => (state && patient ? composeDeck({ patient, days, state, photos, ...(aliases ? { aliases } : {}) }) : null),
    [state, patient, days, photos, aliases],
  );

  const exportBlob = useCallback(
    () => (composed ? new Blob([buildPptx(composed.deck)], { type: PPTX_MIME }) : null),
    [composed],
  );

  return {
    status,
    state,
    composed,
    images,
    urls,
    storageError,
    busy,
    update,
    startNew,
    refreshFromSoap,
    addImages,
    removeImage,
    importDeck,
    exportBlob,
  };
}
