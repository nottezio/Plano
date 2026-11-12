import { useId } from 'react';
import { DateField } from '@/components/common/DateField';
import { Button, Callout, CheckRow, Field, INPUT, Segmented } from '@/components/common/ui';
import { headingDate } from '@/domain/lab/labMeta';
import type { Composed, SlideMeta } from '@/domain/slides/compose';
import type { DeckSlide } from '@/domain/slides/deck';
import {
  IMAGE_KINDS,
  IMAGE_KIND_LABEL,
  type CpptSlideState,
  type DeckState,
  type ImageKind,
  type ImageSlideState,
  type TextSlideState,
} from '@/domain/slides/deckState';
import type { ImageLayout } from '@/domain/slides/geometry';

/**
 * One editor per slide kind. Every change goes into the local `DeckState`;
 * none touches the note (the SOAP is one free-form string and stays as typed).
 */

type Update = (change: (state: DeckState) => DeckState) => void;

const TEXTAREA = `${INPUT} h-44 resize-y py-2 font-mono text-xs leading-relaxed`;

export function SoapEditor({ slide, meta, update }: { slide: Extract<DeckSlide, { kind: 'soap' }>; meta: SlideMeta; update: Update }): JSX.Element {
  const id = useId();
  const key = meta.overrideKey ?? slide.date;
  const setColumn = (column: 'col2' | 'col3', value: string): void =>
    update((s) => ({
      ...s,
      soapOverrides: { ...s.soapOverrides, [key]: { ...s.soapOverrides[key], [column]: value, sourceHash: meta.sourceHash ?? '' } },
    }));
  const override = (change: (o: DeckState['soapOverrides'][string] | undefined) => DeckState['soapOverrides'][string] | null): void =>
    update((s) => {
      const next = { ...s.soapOverrides };
      const value = change(next[key]);
      if (value) next[key] = value;
      else delete next[key];
      return { ...s, soapOverrides: next };
    });
  const resetText = (): void =>
    override((o) => (o?.useOld ? { sourceHash: o.sourceHash, useOld: true } : null));

  return (
    <div className="space-y-3">
      {meta.staleOverride ? (
        <Callout
          tone="warn"
          title="SOAP berubah sejak slide ini diedit"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={resetText}>
                Pakai SOAP baru
              </Button>
              <Button size="sm" onClick={() => override((o) => (o ? { ...o, sourceHash: meta.sourceHash ?? '' } : null))}>
                Tetap
              </Button>
            </div>
          }
        />
      ) : null}
      <p className={`text-xs ${meta.overflow ? 'font-semibold text-danger' : 'text-fg-muted'}`}>
        {meta.overflow ? 'Terlalu panjang: teks sudah 9 pt dan masih keluar slide. Persingkat teks slide ini.' : `Ukuran teks ${slide.fontPt} pt`}
      </p>
      <Field label="Anamnesis dan Pemeriksaan Fisik" htmlFor={`${id}-c2`}>
        <textarea id={`${id}-c2`} className={TEXTAREA} value={slide.col2} onChange={(e) => setColumn('col2', e.target.value)} />
      </Field>
      <Field label="Diagnosis dan Terapi" htmlFor={`${id}-c3`}>
        <textarea id={`${id}-c3`} className={TEXTAREA} value={slide.col3} onChange={(e) => setColumn('col3', e.target.value)} />
      </Field>
      <p className="text-xs text-fg-faint">Perubahan di sini hanya untuk slide; catatan SOAP tidak berubah.</p>
      <Button size="sm" variant="quiet" onClick={resetText}>
        Kembalikan ke teks SOAP
      </Button>
    </div>
  );
}

export function OldVersionToggle({ meta, state, update }: { meta: SlideMeta; state: DeckState; update: Update }): JSX.Element | null {
  if (!meta.hasOldVersion || !meta.overrideKey) return null;
  const key = meta.overrideKey;
  const on = Boolean(state.soapOverrides[key]?.useOld);
  return (
    <CheckRow
      checked={on}
      title="Pakai versi slide lama (dari file .pptx)"
      onChange={(checked) =>
        update((s) => {
          const next = { ...s.soapOverrides };
          const current = next[key];
          if (checked) next[key] = { sourceHash: current?.sourceHash ?? '', ...current, useOld: true };
          else if (current) {
            const { useOld: _drop, ...rest } = current;
            if (rest.col2 !== undefined || rest.col3 !== undefined) next[key] = rest;
            else delete next[key];
          }
          return { ...s, soapOverrides: next };
        })
      }
    />
  );
}

const LAYOUTS: ReadonlyArray<readonly [ImageLayout, string]> = [
  ['one', '1'],
  ['two', '2'],
  ['three', '3'],
  ['four', '4'],
  ['photoText', 'Foto + teks'],
];

export function ImageEditor({
  slideState,
  update,
  onRemoveImage,
  urls,
}: {
  slideState: ImageSlideState;
  update: Update;
  onRemoveImage: (imageId: string) => void;
  urls: ReadonlyMap<string, string>;
}): JSX.Element {
  const id = useId();
  const patch = (change: Partial<ImageSlideState>): void =>
    update((s) => ({ ...s, imageSlides: s.imageSlides.map((slide) => (slide.id === slideState.id ? { ...slide, ...change } : slide)) }));
  const remove = (): void =>
    update((s) => ({ ...s, imageSlides: s.imageSlides.filter((slide) => slide.id !== slideState.id) }));

  return (
    <div className="space-y-3">
      <Field label="Judul slide" htmlFor={`${id}-t`}>
        <input id={`${id}-t`} className={INPUT} value={slideState.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis" htmlFor={`${id}-k`}>
          <select id={`${id}-k`} className={INPUT} value={slideState.kind} onChange={(e) => patch({ kind: e.target.value as ImageKind })}>
            {IMAGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {IMAGE_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal" htmlFor={`${id}-d`}>
          <DateField id={`${id}-d`} value={slideState.date} onChange={(date) => patch({ date })} allowEmpty />
        </Field>
      </div>
      <Segmented label="Tata letak" value={slideState.layout} onChange={(layout) => patch({ layout })} options={LAYOUTS} size="sm" />
      {slideState.layout === 'photoText' ? (
        <Field label="Teks di samping foto" htmlFor={`${id}-x`}>
          <textarea id={`${id}-x`} className={TEXTAREA} value={slideState.text ?? ''} onChange={(e) => patch({ text: e.target.value })} />
        </Field>
      ) : null}
      <ul className="space-y-2" aria-label="Foto di slide ini">
        {slideState.imageIds.map((imageId, index) => (
          <li key={imageId} className="flex items-center gap-2">
            {urls.get(imageId) ? <img src={urls.get(imageId)} alt="" className="h-10 w-14 rounded object-cover ring-1 ring-border" /> : null}
            <span className="min-w-0 flex-1 text-xs text-fg-muted">Foto {index + 1}</span>
            <Button
              size="sm"
              variant="quiet"
              disabled={!slideState.rects[imageId]}
              onClick={() => {
                const rects = { ...slideState.rects };
                delete rects[imageId];
                patch({ rects });
              }}
            >
              Reset posisi
            </Button>
            <Button size="sm" variant="danger" onClick={() => onRemoveImage(imageId)}>
              Hapus
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-faint">Seret foto di pratinjau untuk memindah, tarik titik di sudutnya untuk mengubah ukuran. Foto menempel otomatis ke tepi dan tengah (tahan Alt untuk mematikan) dan boleh keluar dari slide.</p>
      <Button size="sm" variant="danger" onClick={remove}>
        Hapus slide ini
      </Button>
    </div>
  );
}

const TEXT_STEP_PT = 2;
const TEXT_MIN_PT = 8;
const TEXT_MAX_PT = 72;

export function TextEditor({
  slide,
  meta,
  state,
  update,
}: {
  slide: Extract<DeckSlide, { kind: 'text' }>;
  meta: SlideMeta;
  state: DeckState;
  update: Update;
}): JSX.Element | null {
  const id = useId();
  const saved = state.textSlides.find((s) => s.id === slide.id);
  if (!saved) return null;
  const patch = (change: Partial<TextSlideState>): void =>
    update((s) => ({ ...s, textSlides: s.textSlides.map((t) => (t.id === slide.id ? { ...t, ...change } : t)) }));
  const size = (by: number): void => patch({ pt: Math.min(TEXT_MAX_PT, Math.max(TEXT_MIN_PT, slide.fontPt + by)) });
  const auto = saved.pt === undefined;
  return (
    <div className="space-y-3">
      <Field label="Judul slide" htmlFor={`${id}-t`}>
        <input id={`${id}-t`} className={INPUT} value={saved.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Isi" htmlFor={`${id}-b`}>
        <textarea id={`${id}-b`} className={TEXTAREA} value={saved.body} onChange={(e) => patch({ body: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ukuran teks">
        <span className="text-xs font-medium text-fg-muted">Ukuran teks</span>
        <Button size="sm" aria-label="Perkecil teks" onClick={() => size(-TEXT_STEP_PT)}>
          A−
        </Button>
        <span className="min-w-[4.5rem] text-center text-sm text-fg">
          {slide.fontPt} pt{auto ? ' · otomatis' : ''}
        </span>
        <Button size="sm" aria-label="Perbesar teks" onClick={() => size(TEXT_STEP_PT)}>
          A+
        </Button>
        <Button size="sm" variant="quiet" disabled={auto} onClick={() => patch({ pt: undefined })}>
          Otomatis
        </Button>
      </div>
      <Segmented
        label="Perataan teks"
        value={saved.align ?? 'left'}
        onChange={(align) => patch({ align })}
        options={[
          ['left', 'Rata kiri'],
          ['center', 'Tengah'],
        ]}
        size="sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-fg-faint">Seret kotak teks di pratinjau untuk memindah, tarik titik di sudutnya untuk mengubah ukuran kotak. Menempel otomatis; tahan Alt untuk mematikan.</p>
        <Button size="sm" variant="quiet" disabled={!saved.rect} onClick={() => patch({ rect: undefined })}>
          Reset posisi
        </Button>
      </div>
      {meta.overflow ? <p className="text-xs font-semibold text-danger">Terlalu panjang untuk ukuran ini: kecilkan teks, perbesar kotaknya, atau pilih Otomatis.</p> : null}
      <Button size="sm" variant="danger" onClick={() => update((s) => ({ ...s, textSlides: s.textSlides.filter((t) => t.id !== slide.id) }))}>
        Hapus slide ini
      </Button>
    </div>
  );
}

/** A SOAP-layout slide typed by hand (a day with no Plano note, or a note written elsewhere). */
export function CpptEditor({ cpptId, meta, state, update }: { cpptId: string; meta: SlideMeta; state: DeckState; update: Update }): JSX.Element | null {
  const id = useId();
  const saved = (state.cpptSlides ?? []).find((c) => c.id === cpptId);
  if (!saved) return null;
  const patch = (change: Partial<CpptSlideState>): void =>
    update((s) => ({ ...s, cpptSlides: (s.cpptSlides ?? []).map((c) => (c.id === cpptId ? { ...c, ...change } : c)) }));
  return (
    <div className="space-y-3">
      <Field label="Tanggal" htmlFor={`${id}-d`}>
        <DateField id={`${id}-d`} value={saved.date} onChange={(date) => patch({ date })} />
      </Field>
      <p className={`text-xs ${meta.overflow ? 'font-semibold text-danger' : 'text-fg-muted'}`}>
        {meta.overflow ? 'Terlalu panjang: teks sudah 9 pt dan masih keluar slide. Persingkat teksnya.' : 'Ketik bebas; ukuran teks menyesuaikan.'}
      </p>
      <Field label="Anamnesis dan Pemeriksaan Fisik" htmlFor={`${id}-c2`}>
        <textarea id={`${id}-c2`} className={TEXTAREA} value={saved.col2} onChange={(e) => patch({ col2: e.target.value })} />
      </Field>
      <Field label="Diagnosis dan Terapi" htmlFor={`${id}-c3`}>
        <textarea id={`${id}-c3`} className={TEXTAREA} value={saved.col3} onChange={(e) => patch({ col3: e.target.value })} />
      </Field>
      <Button size="sm" variant="danger" onClick={() => update((s) => ({ ...s, cpptSlides: (s.cpptSlides ?? []).filter((c) => c.id !== cpptId) }))}>
        Hapus slide ini
      </Button>
    </div>
  );
}

const LAB_DEFAULT_COLUMNS = 5;

export function LabEditor({ composed, state, update }: { composed: Composed; state: DeckState; update: Update }): JSX.Element {
  const grid = composed.labGrid;
  const shown = state.labDates?.length ? grid.dates.filter((d) => state.labDates!.includes(d)) : grid.dates.slice(-LAB_DEFAULT_COLUMNS);
  const toggleDate = (date: string, on: boolean): void =>
    update((s) => {
      const next = new Set(s.labDates?.length ? s.labDates : shown);
      if (on) next.add(date);
      else next.delete(date);
      return { ...s, labDates: [...next].sort() };
    });

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-fg-muted">Kolom tanggal</legend>
        <div className="flex flex-wrap gap-x-4">
          {grid.dates.map((date) => (
            <CheckRow key={date} checked={shown.includes(date)} title={headingDate(date)} onChange={(on) => toggleDate(date, on)} />
          ))}
        </div>
      </fieldset>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left font-medium text-fg-muted">Pemeriksaan</th>
              {shown.map((date) => (
                <th key={date} className="p-1 font-medium text-fg-muted">
                  {headingDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="p-1 text-left font-normal text-fg">
                  {row.label}
                </th>
                {shown.map((date) => {
                  const key = `${row.label}|${date}`;
                  return (
                    <td key={date} className="p-1">
                      <input
                        aria-label={`${row.label} ${headingDate(date)}`}
                        className={`${INPUT} text-center`}
                        value={state.labOverrides[key] ?? row.cells[date] ?? ''}
                        onChange={(e) => update((s) => ({ ...s, labOverrides: { ...s.labOverrides, [key]: e.target.value } }))}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fg-faint">Nilai diambil dari blok lab di catatan. Mengubah sel di sini hanya mengubah slide.</p>
    </div>
  );
}
