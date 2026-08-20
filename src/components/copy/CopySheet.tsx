import { useEffect, useMemo, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import {
  composeCopy,
  resolveRange,
  type CopyDay,
} from '@/domain/format/composeCopy';
import {
  FORMAT_LABELS,
  findMarkdownLeaks,
  findNonAsciiChars,
  type BulletStyle,
} from '@/domain/format/formatters';
import { composePdfReport } from '@/domain/format/pdfReport';
import { describeConfig, primaryDpjp } from '@/domain/dpjp';
import {
  COPY_GROUPS,
  availableGroups,
  sectionsForGroups,
  type CopyGroupId,
} from '@/domain/format/copyGroups';
import { copyText } from '@/lib/clipboard';
import { checkIdentity } from '@/domain/identityCheck';
import { RenderedPreview } from './RenderedPreview';
import type {
  ClinicalDate,
  CopyPreset,
  CopyRange,
  OutputFormat,
  DpjpReportConfig,
  Patient,
  SectionAlias,
} from '@/domain/types';

const RANGE_LABELS: Record<CopyRange, string> = {
  today: 'Hari ini',
  specific: 'Tanggal ini',
  lastN: '3 hari terakhir',
  all: 'Semua hari',
};

/**
 * SPEC F6 — the copy sheet.
 *
 * Four independent axes: format, section subset, range, and whether to include
 * the identity line. They are independent because the real requests are
 * combinations — "terapi saja, plain, hari ini, tanpa nama" for SIMGOS;
 * "semua, WhatsApp, dengan identitas" for the chief.
 *
 * The output is composed on every change and shown as a preview, because a
 * resident pasting into a group chat cannot undo it.
 */
/** Local clock, formatted the way the verification line is written. */
function nowWita(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
}

export function CopySheet({
  open,
  onOpenChange,
  patient,
  body,
  date,
  today,
  aliases,
  presets,
  dpjpFormats,
  bullet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  body: string;
  date: ClinicalDate;
  today: ClinicalDate;
  aliases: readonly SectionAlias[];
  presets: readonly CopyPreset[];
  dpjpFormats: Record<string, DpjpReportConfig>;
  bullet: BulletStyle;
}): JSX.Element {
  const [format, setFormat] = useState<OutputFormat>('whatsapp');
  const [range, setRange] = useState<CopyRange>('specific');
  const [groups, setGroups] = useState<CopyGroupId[] | 'all'>('all');
  /**
   * Identity and date header are no longer options.
   *
   * Templates carry the greeting, ward, identity line and closing INSIDE the
   * note (see templates.ts), so prepending them again printed every header
   * twice. A toggle whose only two states are "correct" and "duplicated" is not
   * a choice, it is a trap — so it is gone rather than defaulted off.
   */
  const includeIdentity = false;
  const includeDateHeader = false;
  const [allDays, setAllDays] = useState<CopyDay[]>([]);
  const [copied, setCopied] = useState(false);
  /**
   * Text you can select and copy, or a rendering of how it will look.
   *
   * Two views rather than one, because they cannot be the same thing: copying
   * from a rendering loses the markers that produced the formatting, so the
   * paste would arrive unbolded. The text view is the one that is real.
   */
  const [preview, setPreview] = useState<'teks' | 'tampilan'>('teks');
  const outputRef = useRef<HTMLTextAreaElement>(null);
  /**
   * The short form three DPJPs want as a PDF: staffing lines, the opening block
   * verbatim, diagnoses, closing. It replaces the section picker entirely
   * rather than sitting beside it, because the shape is fixed — offering group
   * chips next to it would imply a choice that does not exist.
   */
  const [pdfMode, setPdfMode] = useState(false);

  /**
   * A reminder, not a switch.
   *
   * The consultant's expected format is shown next to the Bentuk chips and the
   * matching one is highlighted, but nothing is selected on the user's behalf:
   * a copy sheet that silently changed shape between patients would be
   * unpredictable exactly when it matters.
   */
  const dpjp = useMemo(() => primaryDpjp(body), [body]);
  const expected = dpjp ? dpjpFormats[dpjp.id] : undefined;

  /**
   * The consultant's preferences are OFFERED, never imposed.
   *
   * An earlier version read `expected` directly when composing, which meant
   * choosing "WhatsApp" for MZ silently produced plain text — the chip said one
   * thing and the output was another. A control that does not do what it says
   * is worse than no control.
   *
   * Applying is one tap and it is visible: the switches move, so what you get
   * is always what the sheet shows.
   */
  const [applied, setApplied] = useState(false);
  const active = applied ? expected : undefined;

  const present = useMemo(() => availableGroups(body, aliases), [body, aliases]);

  /**
   * Whole note, or an explicit subset expanded from the chosen groups.
   *
   * "Semua" stays `'all'` rather than every group selected, because the whole
   * note is byte-faithful while a subset is recomposed — and the greeting,
   * identity and closing live outside the five groups entirely.
   */
  const selected = useMemo(
    () => (groups === 'all' ? ('all' as const) : sectionsForGroups(body, aliases, groups)),
    [groups, body, aliases],
  );

  // Loaded once per opening: ranges beyond the current day need other bodies.
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    let cancelled = false;
    void fetchEntryBodies(patient.id)
      .then((days) => {
        if (!cancelled) setAllDays(days);
      })
      .catch((error: unknown) => console.error('[copy] could not read entries', error));
    return () => {
      cancelled = true;
    };
  }, [open, patient.id]);

  const days = useMemo(() => {
    const pool = allDays.length > 0 ? allDays : [{ date, body }];
    return resolveRange({ range, lastN: 3 }, pool, today, date);
  }, [allDays, range, today, date, body]);

  const output = useMemo(
    () =>
      pdfMode
        ? composePdfReport(body, {
            aliases,
            // A consultant who reads the report somewhere that does not render
            // WhatsApp markers gets plain text, whatever chip is selected.
            format: active?.plainText ? 'plain' : format,
            bullet,
            // The consultant's own switches, so choosing "Ringkas (PDF)" for
            // ZD produces a report with a verification time and for MZ one
            // without staffing lines, rather than one shape for everyone.
            staffing: active?.staffing ?? true,
            ...(active?.verificationTime ? { verificationTime: nowWita() } : {}),
          })
        : composeCopy(days, {
        format,
        sections: selected,
        includeIdentity,
        includeDateHeader,
            aliases,
            patient,
            bullet,
          }),
    [pdfMode, body, days, format, selected, includeIdentity, includeDateHeader, aliases, patient],
  );

  const leaks = findMarkdownLeaks(format === 'whatsapp' ? output : '');

  /**
   * Characters SIMGOS renders as `?`.
   *
   * Only the plain formatter folds these out, so selecting the WhatsApp
   * preview by hand and pasting it into SIMGOS produces exactly the question
   * marks reported. The sheet cannot know where a manual copy is going, so it
   * says what is in the text and offers the one-tap fix rather than guessing.
   */
  const nonAscii = useMemo(() => findNonAsciiChars(output), [output]);

  /**
   * Does this note belong to the patient whose chart is open?
   *
   * The mistake this guards is copying one patient's report into another
   * patient's chat — undetectable afterwards, because the message reads as a
   * perfectly coherent report about somebody.
   *
   * It warns rather than blocks. A mismatch has legitimate causes, and a copy
   * button that refused would be worked around within a day.
   */
  const identityCheck = useMemo(() => checkIdentity(patient, body), [patient, body]);

  const applyPreset = (preset: CopyPreset): void => {
    setFormat(preset.format);
    setRange(preset.range);
  };

  const toggleGroup = (id: CopyGroupId): void => {
    const current = groups === 'all' ? COPY_GROUPS.map((group) => group.id) : groups;
    const next = current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id];
    setGroups(next.length === COPY_GROUPS.length ? 'all' : next);
  };

  const onCopy = (): void => {
    void copyText(output).then((ok) => setCopied(ok));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Salin catatan"
      description="Pilih format, bagian, dan rentang tanggal."
      footer={
        <button
          type="button"
          onClick={onCopy}
          disabled={!output.trim()}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {copied ? 'Tersalin ✓' : 'Salin'}
        </button>
      }
    >
      {presets.length > 0 ? (
        <Group label="Preset">
          {presets.map((preset) => (
            <Chip key={preset.id} active={false} onClick={() => applyPreset(preset)}>
              {preset.name}
            </Chip>
          ))}
        </Group>
      ) : null}

      <Group label="Format">
        {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((value) => (
          <Chip
            key={value}
            active={format === value}
            onClick={() => {
              setFormat(value);
              setApplied(false);
            }}
          >
            {FORMAT_LABELS[value]}
          </Chip>
        ))}
      </Group>

      <Group label="Rentang">
        {(Object.keys(RANGE_LABELS) as CopyRange[]).map((value) => (
          <Chip key={value} active={range === value} onClick={() => setRange(value)}>
            {RANGE_LABELS[value]}
          </Chip>
        ))}
      </Group>

      {expected ? (
        <div className="mb-3 rounded-lg border border-border bg-bg-subtle p-2">
          <p className="text-[11px] text-fg-muted">
            {dpjp?.initials} biasanya meminta: <strong>{describeConfig(expected)}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setApplied(true);
              setPdfMode(expected.format === 'ringkas');
            }}
            disabled={applied}
            className="mt-1 min-h-tap text-xs font-medium text-accent underline disabled:text-fg-faint disabled:no-underline"
          >
            {applied ? 'Format ini sedang dipakai' : 'Pakai format ini'}
          </button>
        </div>
      ) : null}

      <Group label="Bentuk">
        <Chip
          active={!pdfMode}
          onClick={() => {
            setPdfMode(false);
            setApplied(false);
          }}
        >
          Laporan harian
        </Chip>
        <Chip
          active={pdfMode}
          onClick={() => {
            setPdfMode(true);
            setApplied(false);
          }}
        >
          Ringkas (PDF)
        </Chip>
      </Group>

      {pdfMode ? (
        <p className="mb-4 text-[11px] text-fg-faint">
          Berisi baris Chief/Junior (dikosongkan), blok pembuka apa adanya, daftar
          diagnosis, dan kalimat penutup. Tanpa S, O, terapi, dan plan.
        </p>
      ) : null}

      {!pdfMode ? (
      <Group label="Bagian">
        <Chip active={groups === 'all'} onClick={() => setGroups('all')}>
          Seluruh catatan
        </Chip>
        {COPY_GROUPS.map((group) => (
          <Chip
            key={group.id}
            active={groups !== 'all' && groups.includes(group.id)}
            disabled={!present.has(group.id)}
            onClick={() => toggleGroup(group.id)}
          >
            {group.label}
          </Chip>
        ))}
      </Group>
      ) : null}

      <div className="mb-1 mt-4 flex items-center gap-2">
        <p className="flex-1 text-xs font-medium text-fg-muted">Pratinjau</p>
        {(
          [
            ['teks', 'Teks'],
            ['tampilan', 'Tampilan'],
          ] as Array<['teks' | 'tampilan', string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={preview === value}
            onClick={() => setPreview(value)}
            className={[
              'min-h-tap rounded-full border px-3 text-[11px]',
              preview === value
                ? 'border-accent bg-bg-subtle font-medium text-accent'
                : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {preview === 'tampilan' ? (
        <>
          <RenderedPreview text={output} />
          <p className="mt-1 text-[11px] text-fg-faint">
            Perkiraan tampilan di WhatsApp. Jangan menyalin dari sini — tanda formatnya
            ikut hilang. Gunakan tab “Teks”.
          </p>
        </>
      ) : (
        <>
          {/*
            A real textarea, not a <pre>.
            
            Read-only, but selectable, scrollable and — the point — tappable to
            select everything at once. On a phone, dragging a selection through
            forty lines inside a sheet is not a realistic way to copy a
            handover.
          */}
          <textarea
            ref={outputRef}
            readOnly
            value={output || '(kosong)'}
            rows={10}
            spellCheck={false}
            /**
             * No select-on-focus.
             *
             * Switching tabs re-mounts this textarea, which refocuses it — and
             * a select-all on focus then wiped a selection the user had just
             * made by hand. Selecting everything is an explicit action now,
             * which is also the only time anyone wants it.
             */
            className="w-full resize-y rounded-lg border border-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed outline-none"
          />
          <button
            type="button"
            onClick={() => outputRef.current?.select()}
            className="mt-1 min-h-tap text-[11px] text-accent underline"
          >
            Pilih semua teks
          </button>
        </>
      )}

      {identityCheck.status === 'mismatch' ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-danger p-2 text-[11px] leading-relaxed"
        >
          <p className="font-semibold text-danger">Identitas tidak cocok</p>
          <p className="mt-0.5 text-fg">
            Catatan ini menyebut{' '}
            <strong>
              {identityCheck.field === 'mrn' ? 'RM ' : ''}
              {identityCheck.noteValue}
            </strong>
            , tetapi pasien yang dibuka adalah{' '}
            <strong>
              {identityCheck.field === 'mrn' ? 'RM ' : ''}
              {identityCheck.recordValue}
            </strong>
            . Periksa sebelum menyalin.
          </p>
        </div>
      ) : null}

      {nonAscii.length > 0 && format !== 'plain' ? (
        <p className="mt-2 rounded-lg border border-border bg-bg-subtle p-2 text-[11px] leading-relaxed text-fg-muted">
          Teks ini memuat karakter yang muncul sebagai “?” di SIMGOS:{' '}
          <span className="font-mono">{nonAscii.join(' ')}</span>. Untuk SIMGOS, pilih format{' '}
          <button
            type="button"
            onClick={() => {
              setFormat('plain');
              setApplied(false);
            }}
            className="font-medium text-accent underline"
          >
            Teks polos
          </button>
          .
        </p>
      ) : null}

      {leaks.length > 0 ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Peringatan: sisa penanda markdown ({leaks.join(' ')}) terdeteksi.
        </p>
      ) : null}
    </Sheet>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'min-h-tap rounded-full border px-3 text-xs disabled:opacity-30',
        active ? 'border-accent bg-bg-subtle font-medium text-accent' : 'border-border text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
