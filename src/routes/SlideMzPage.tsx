import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { AppShell } from '@/components/common/AppShell';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconBack, IconEye, IconPlus, IconRefresh, IconShare } from '@/components/common/Icons';
import { Button, Callout } from '@/components/common/ui';
import { CpptEditor, ImageEditor, LabEditor, OldVersionToggle, SoapEditor, TextEditor } from '@/components/slides/SlideEditors';
import { SlidePreview } from '@/components/slides/SlidePreview';
import { AddImageSheet, ImportReviewSheet, StartChooser, usePptxPicker } from '@/components/slides/SlideSheets';
import { SlideCleanupNotice } from '@/components/slides/SlideCleanupNotice';
import { useSlideDeck } from '@/components/slides/useSlideDeck';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { usePatient } from '@/hooks/usePatient';
import type { DeckPatient } from '@/domain/slides/compose';
import { slideMzFileName } from '@/domain/slides/editMath';
import type { ImportResult } from '@/domain/slides/importPptx';
import { deliverFile } from '@/lib/download';
import { useSession } from '@/store/useSession';

/**
 * Slide MZ: the daily PowerPoint for Prof. Muzakkir Amir's patients.
 *
 * Built from the notes plus photos kept on this device; see `domain/slides`.
 * Firestore: the patient document (the same listener the patient page uses)
 * and one entries read per open. Nothing is written to the server.
 */
export default function SlideMzPage(): JSX.Element {
  const { patientId = '' } = useParams();
  const { patient, loading: patientLoading } = usePatient(patientId);
  const settings = useSession((state) => state.settings());
  const today = useClinicalToday();

  // Keyed on fields, not the object: the patient object is new on every snapshot.
  const name = patient?.name;
  const mrn = patient?.mrn;
  const age = patient?.age;
  const sex = patient?.sex;
  const ward = patient?.ward;
  const room = patient?.room;
  const bed = patient?.bed;
  const deckPatient = useMemo<DeckPatient | null>(
    () =>
      name === undefined
        ? null
        : {
            name,
            ...(mrn !== undefined ? { mrn } : {}),
            ...(age !== undefined ? { age } : {}),
            ...(sex !== undefined ? { sex } : {}),
            ...(ward !== undefined ? { ward } : {}),
            ...(room !== undefined ? { room } : {}),
            ...(bed !== undefined ? { bed } : {}),
          },
    [name, mrn, age, sex, ward, room, bed],
  );
  const deck = useSlideDeck(patientId, deckPatient, settings.sectionAliases);
  const { composed, state, update } = deck;

  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [review, setReview] = useState<ImportResult | null>(null);
  const [confirmOverflow, setConfirmOverflow] = useState(false);
  // The settings panel can be folded away to give the slide the whole width.
  const [panelOpen, setPanelOpen] = useState(true);
  const picker = usePptxPicker(setReview);

  const meta = useMemo(() => composed?.meta ?? [], [composed]);
  const current = meta.find((m) => m.id === selected) ?? meta[0] ?? null;
  const currentSlide = composed?.deck.slides.find((s) => s.id === current?.id) ?? null;
  useEffect(() => {
    if (selected && !meta.some((m) => m.id === selected)) setSelected(null);
  }, [meta, selected]);

  const currentId = current?.id;
  useEffect(() => {
    if (currentId) document.getElementById(`slide-item-${currentId}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentId]);

  const move = (id: string, by: -1 | 1): void => {
    const ids = meta.map((m) => m.id);
    const at = ids.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to]!, ids[at]!];
    update((s) => ({ ...s, order: ids }));
  };
  const toggleHidden = (id: string): void =>
    update((s) => ({ ...s, hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] }));

  const exportNow = (): void => {
    const blob = deck.exportBlob();
    if (blob && patient) void deliverFile(blob, slideMzFileName(patient.name, today));
  };
  const overflowCount = meta.filter((m) => m.overflow && !m.hidden).length;
  const tall = Boolean(state?.tall);
  const imageState = current?.kind === 'images' ? state?.imageSlides.find((s) => s.id === current.id) : undefined;
  const replacing = Boolean(state && (Object.keys(state.importedDays).length > 0 || state.imageSlides.some((s) => s.id.startsWith('imp-'))));

  return (
    <AppShell title="Slide MZ">
      <div className="mx-auto w-full max-w-[110rem] space-y-2 px-3 pb-4 pt-2 md:px-4">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Link
            to={`/p/${patientId}`}
            className="inline-flex min-h-tap items-center gap-1 rounded-lg px-1.5 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg [@media(pointer:fine)]:min-h-9"
          >
            <IconBack className="h-4 w-4" aria-hidden="true" />
            {patient?.name ?? 'Pasien'}
          </Link>
          <h1 className="mr-auto text-base font-semibold text-fg">Slide MZ</h1>
          {deck.status === 'ready' ? (
            <>
              <Button size="sm" variant="quiet" aria-pressed={panelOpen} onClick={() => setPanelOpen((open) => !open)}>
                {panelOpen ? 'Sembunyikan panel' : 'Tampilkan panel'}
              </Button>
              <label
                className="inline-flex min-h-tap cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9"
                title="Semua slide di deck lebih tinggi (4:3) supaya SOAP panjang muat. Bukan 16:9 lagi."
              >
                <input
                  type="checkbox"
                  checked={tall}
                  onChange={(e) => update((current) => ({ ...current, tall: e.target.checked }))}
                  className="h-4 w-4 accent-accent"
                />
                Slide tinggi (4:3)
                {overflowCount > 0 && !tall ? <span className="font-semibold text-danger">· {overflowCount} terlalu panjang</span> : null}
              </label>
              <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
              <Button size="sm" variant="quiet" icon={<IconPlus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
                Gambar
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon={<IconPlus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => {
                  const id = `txt-${nanoid(8)}`;
                  update((s) => ({ ...s, textSlides: [...s.textSlides, { id, title: 'Slide teks', body: '' }] }));
                  setSelected(id);
                }}
              >
                Teks
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon={<IconPlus className="h-4 w-4" aria-hidden="true" />}
                onClick={() => {
                  const id = `cppt-${nanoid(8)}`;
                  update((s) => ({
                    ...s,
                    cpptSlides: [...(s.cpptSlides ?? []), { id, date: today, col2: 'S :\n\nO :\n', col3: 'Diagnosis:\n\nTerapi:\n\nPlan\n' }],
                  }));
                  setSelected(id);
                }}
              >
                CPPT
              </Button>
              <Button size="sm" variant="quiet" onClick={picker.pick}>
                Impor .pptx
              </Button>
              <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
              <Button size="sm" icon={<IconRefresh className="h-4 w-4" aria-hidden="true" />} disabled={deck.busy} onClick={() => void deck.refreshFromSoap()}>
                Perbarui dari SOAP
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<IconShare className="h-4 w-4" aria-hidden="true" />}
                disabled={!composed || deck.busy}
                onClick={() => (overflowCount ? setConfirmOverflow(true) : exportNow())}
              >
                Unduh / Bagikan
              </Button>
            </>
          ) : null}
          {picker.input}
        </div>

        {patient && patient.status !== 'active' ? <SlideCleanupNotice patientIds={[patientId]} /> : null}
        {deck.storageError ? (
          <Callout tone="warn" role="alert" title="Gambar tidak bisa disimpan di perangkat ini">
            Slide tetap bisa diunduh selama halaman ini terbuka, tetapi perubahan dan gambar mungkin hilang setelah ditutup.
          </Callout>
        ) : null}
        {picker.error && deck.status !== 'start' ? <Callout tone="danger" role="alert" title={picker.error} /> : null}

        {deck.status === 'loading' || patientLoading ? <p className="text-sm text-fg-muted">Memuat…</p> : null}
        {deck.status === 'error' ? <Callout tone="danger" role="alert" title="Catatan pasien tidak bisa dimuat." /> : null}
        {deck.status === 'start' ? <StartChooser onNew={deck.startNew} onImportClick={picker.pick} error={picker.error} /> : null}

        {deck.status === 'ready' && composed && state && current ? (
          <div className={`grid gap-3 md:h-[calc(100dvh-5.5rem)] md:grid-cols-[10rem_minmax(0,1fr)] ${panelOpen ? 'xl:grid-cols-[10rem_minmax(0,1fr)_17rem]' : 'xl:grid-cols-[10rem_minmax(0,1fr)]'}`}>
            <ol
              aria-label="Daftar slide"
              className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] md:row-span-2 md:block md:h-full md:space-y-1.5 md:overflow-y-auto md:overflow-x-hidden md:overscroll-contain md:pb-1 md:pr-1 md:[scrollbar-gutter:stable] xl:row-span-1"
            >
              {meta.map((m, index) => {
                const slide = composed.deck.slides.find((s) => s.id === m.id);
                const active = m.id === current.id;
                return (
                  <li key={m.id} id={`slide-item-${m.id}`} className={`w-44 shrink-0 md:w-auto ${m.hidden ? 'opacity-60' : ''}`}>
                    <div className={`rounded-xl border p-1.5 ${active ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface'}`}>
                      <button type="button" className="block w-full text-left" aria-current={active ? 'true' : undefined} onClick={() => setSelected(m.id)}>
                        {slide ? (
                          <SlidePreview slide={slide} urls={deck.urls} tall={tall} />
                        ) : (
                          <div className="flex aspect-video items-center justify-center rounded-md bg-bg-subtle text-xs text-fg-muted">Disembunyikan</div>
                        )}
                        <span className="mt-1 block truncate text-xs text-fg">
                          {index + 1}. {m.label}
                        </span>
                        {m.overflow ? <span className="block text-xs font-semibold text-danger">terlalu panjang</span> : null}
                        {m.staleOverride ? <span className="block text-xs font-semibold text-fg">⚠ SOAP berubah sejak diedit</span> : null}
                      </button>
                      {active ? (
                      <div className="mt-1 flex justify-end gap-0.5 border-t border-border pt-1">
                        <Button size="icon" variant="quiet" aria-label={`Naikkan slide ${index + 1}`} disabled={index === 0} onClick={() => move(m.id, -1)}>
                          ↑
                        </Button>
                        <Button size="icon" variant="quiet" aria-label={`Turunkan slide ${index + 1}`} disabled={index === meta.length - 1} onClick={() => move(m.id, 1)}>
                          ↓
                        </Button>
                        <Button
                          size="icon"
                          variant="quiet"
                          aria-label={m.hidden ? `Tampilkan slide ${index + 1}` : `Sembunyikan slide ${index + 1}`}
                          aria-pressed={m.hidden}
                          onClick={() => toggleHidden(m.id)}
                        >
                          <IconEye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="min-w-0 space-y-3 md:col-start-2 md:h-full md:overflow-y-auto md:overscroll-contain [scrollbar-width:thin] xl:contents">
              <section
                aria-label="Slide terpilih"
                className="min-w-0 space-y-3 xl:flex xl:h-full xl:items-center xl:justify-center xl:space-y-0 xl:rounded-xl xl:bg-bg-subtle xl:p-3 xl:[container-type:size]"
              >
              {currentSlide ? (
                <SlidePreview
                  slide={currentSlide}
                  urls={deck.urls}
                  tall={tall}
                  // At xl the pane has a fixed height: the slide is the largest 16:9 (or 4:3) that fits it both ways.
                  className={tall ? 'xl:!w-[min(100cqw,calc(100cqh*1.3333))]' : 'xl:!w-[min(100cqw,calc(100cqh*1.7778))]'}
                  editable={currentSlide.kind === 'images' || currentSlide.kind === 'text'}
                  onMoveText={(rect) =>
                    update((s) => ({ ...s, textSlides: s.textSlides.map((t) => (t.id === current.id ? { ...t, rect } : t)) }))
                  }
                  onMovePhoto={(imageId, rect) =>
                    update((s) => ({
                      ...s,
                      imageSlides: s.imageSlides.map((slide) => (slide.id === current.id ? { ...slide, rects: { ...slide.rects, [imageId]: rect } } : slide)),
                    }))
                  }
                />
              ) : (
                <Callout
                  title="Slide ini disembunyikan dan tidak ikut diunduh."
                  action={
                    <Button size="sm" onClick={() => toggleHidden(current.id)}>
                      Tampilkan
                    </Button>
                  }
                />
              )}

              </section>
              {panelOpen ? (
              <aside
                aria-label="Pengaturan slide"
                className="space-y-3 rounded-xl border border-border bg-surface p-3 [scrollbar-width:thin] xl:col-start-3 xl:row-start-1 xl:!mt-0 xl:max-h-full xl:self-start xl:overflow-y-auto xl:overscroll-contain"
              >
                {current.kind === 'soap' && current.cpptId ? <CpptEditor cpptId={current.cpptId} meta={current} state={state} update={update} /> : null}
                {current.kind === 'soap' && !current.cpptId ? <OldVersionToggle meta={current} state={state} update={update} /> : null}
                {current.kind === 'soap' && !current.cpptId && currentSlide?.kind === 'soap' ? (
                  <SoapEditor slide={currentSlide} meta={current} update={update} />
                ) : null}
                {current.kind === 'images' && imageState ? (
                  <ImageEditor slideState={imageState} update={update} urls={deck.urls} onRemoveImage={(id) => void deck.removeImage(id)} />
                ) : null}
                {current.kind === 'text' && currentSlide?.kind === 'text' ? (
                  <TextEditor slide={currentSlide} meta={current} state={state} update={update} />
                ) : null}
                {current.kind === 'lab' ? <LabEditor composed={composed} state={state} update={update} /> : null}
                {current.kind === 'title' ? (
                  <p className="text-sm text-fg-muted">Judul diambil dari data pasien (nama, umur, RM, ruangan). Ubah di halaman pasien.</p>
                ) : null}
                {current.kind === 'closing' ? <p className="text-sm text-fg-muted">Slide penutup.</p> : null}
              </aside>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {deck.status === 'ready' ? (
        <AddImageSheet open={addOpen} onOpenChange={setAddOpen} today={today} defaultPlace={patient?.ward ?? ''} onAdd={deck.addImages} />
      ) : null}
      {review ? (
        <ImportReviewSheet
          result={review}
          patientName={patient?.name ?? ''}
          replacing={replacing}
          onCancel={() => setReview(null)}
          onImport={async (picked) => {
            await deck.importDeck(review, picked);
            setReview(null);
          }}
        />
      ) : null}
      {confirmOverflow ? (
        <ConfirmDialog
          title={`${overflowCount} slide terlalu panjang`}
          description="Teks di slide itu akan keluar dari batas slide. Unduh tetap?"
          confirmLabel="Unduh tetap"
          onCancel={() => setConfirmOverflow(false)}
          onConfirm={() => {
            setConfirmOverflow(false);
            exportNow();
          }}
        />
      ) : null}
    </AppShell>
  );
}
