import { useEffect, useMemo, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { useUI } from '@/store/useUI';
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
import { formatDayNoWeekday } from '@/domain/clinicalDate';
import { composeKonsul } from '@/domain/format/composeKonsul';
import { composeShiftNote } from '@/domain/format/composeShiftNote';
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
  ShiftNote,
} from '@/domain/types';

/**
 * "Hari ini" and "Tanggal ini" were the same words for two different days.
 *
 * They only differ when you are looking at a day that is not today — which is
 * exactly when the distinction matters and exactly when the labels stopped
 * helping. The second one now names what it actually copies: the note on
 * screen.
 */
const RANGE_LABELS: Record<CopyRange, string> = {
  today: 'Hari ini',
  specific: 'SOAP yang dibuka',
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
/**
 * `31-08-2026 07.47` — the default verification stamp.
 *
 * Dots in the time, not a colon, for the reason the jaga stamp uses them: this
 * text gets pasted back into bodies, and `07:47` at the start of a line reads
 * as a section delimiter to the parser.
 */
function verificationStamp(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(at.getDate())}-${pad(at.getMonth() + 1)}-${at.getFullYear()} ${pad(
    at.getHours(),
  )}.${pad(at.getMinutes())}`;
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
  activeShiftNote,
  closings,
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
  /**
   * The jaga note open in the editor, if one is.
   *
   * Its presence is what makes the "SOAP jaga" shape available: a shift note
   * is copied on its own only when it is the thing being looked at, which
   * removes any question about WHICH note the button would send.
   */
  activeShiftNote?: ShiftNote | null | undefined;
  /** Configured closing sentences, so a section subset can drop a trailing one. */
  closings: readonly string[];
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
  /**
   * Which SHAPE of document is being produced.
   *
   * A union rather than the `pdfMode` boolean this replaced. Adding the konsul
   * as a second boolean would have made `!pdfMode && !konsulMode` the
   * condition for "the ordinary daily note", and every future shape would add
   * another term to that expression and another chance to leave one out — the
   * two flags could also both be true, which is a state with no meaning.
   */
  const [shape, setShape] = useState<'harian' | 'ringkas' | 'konsul' | 'jaga'>('harian');
  const pdfMode = shape === 'ringkas';

  /**
   * What the konsul is for. Free text, because the list of things a patient
   * gets referred for is not one this app should be deciding.
   */
  const [konsulPurpose, setKonsulPurpose] = useState('6MWT');
  /**
   * The list shape, for the echo full-study request.
   *
   * A checkbox on the konsul rather than a fourth chip: it is the same
   * document with a different framing, and a separate shape would imply the
   * body differs too.
   */
  const [konsulList, setKonsulList] = useState(false);

  /**
   * The verification stamp, editable.
   *
   * It used to be `nowWita()` evaluated inside the compose memo — the moment
   * the sheet happened to render, with no way to change it. A note verified at
   * 07.47 and copied at 09.10 carried the wrong time, and the one consultant
   * who asks for this line asks for it because the time matters.
   */
  const [verificationTime, setVerificationTime] = useState(() =>
    verificationStamp(new Date()),
  );

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
    /**
     * Opening Salin while a jaga note is on screen defaults to copying THAT
     * note.
     *
     * The alternative — defaulting to the day's SOAP — means the button under
     * your thumb sends something other than what fills the screen behind the
     * sheet, which is the one thing this sheet must never do.
     */
    setShape(activeShiftNote ? 'jaga' : 'harian');
    let cancelled = false;
    void fetchEntryBodies(patient.id)
      .then((days) => {
        if (!cancelled) setAllDays(days);
      })
      .catch((error: unknown) => console.error('[copy] could not read entries', error));
    return () => {
      cancelled = true;
    };
    // `activeShiftNote?.id`, not the object: the note re-identifies on every
    // keystroke while it is being edited, and depending on the object would
    // reset the chosen shape mid-typing.
  }, [open, patient.id, activeShiftNote?.id]);

  const days = useMemo(() => {
    const fetched = allDays.length > 0 ? allDays : [{ date, body }];

    /**
     * The day on screen always copies what is ON SCREEN.
     *
     * `allDays` is a snapshot taken when the sheet opened, so anything typed
     * since — or not yet flushed — is missing from it, and the day being
     * looked at is the one most likely to have just been edited. Trusting the
     * snapshot for that day meant Salin could produce something different from
     * the note visible behind the sheet, which is the one discrepancy this
     * sheet must never have.
     *
     * Other days keep their fetched bodies: they are not open in the editor,
     * so the snapshot is the only truth available for them.
     */
    const pool = fetched.some((day) => day.date === date)
      ? fetched.map((day) => (day.date === date ? { date, body } : day))
      : [...fetched, { date, body }];

    return resolveRange({ range, lastN: 3 }, pool, today, date);
  }, [allDays, range, today, date, body]);

  const composed = useMemo(
    () =>
      shape === 'jaga' && activeShiftNote
        ? // Stands alone. A jaga note is reported when it happens, to whoever
          // is on, and attaching the morning SOAP to it would send a page of
          // findings from hours earlier as though they were current.
          composeShiftNote(activeShiftNote, patient, {
            format,
            bullet,
            includeIdentity,
          })
        : shape === 'konsul'
        ? // Always the day on screen, never a range: a referral describes the
          // patient now. Sections are not offered either — the konsul decides
          // its own contents, and letting the section chips subtract from it
          // would produce a referral missing its diagnosis.
          composeKonsul(body, patient, aliases, {
            purpose: konsulPurpose,
            listStyle: konsulList,
            listFrom: patient.ward ?? '',
            listDate: formatDayNoWeekday(date),
          })
        : pdfMode
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
            ...(active?.verificationTime ? { verificationTime } : {}),
          })
        : composeCopy(days, {
        format,
        sections: selected,
        includeIdentity,
        includeDateHeader,
            aliases,
            patient,
            bullet,
            closings,
          }),
    [
      shape,
      activeShiftNote,
      bullet,
      pdfMode,
      konsulPurpose,
      konsulList,
      closings,
      verificationTime,
      date,
      body,
      days,
      format,
      selected,
      includeIdentity,
      includeDateHeader,
      aliases,
      patient,
    ],
  );

  /**
   * Shift notes are APPENDED to the composed output, not merged into it.
   *
   * Deliberately outside `composeCopy`: that function composes over the body's
   * parsed sections, and a shift note is a sibling field with no position in
   * that structure. Threading it through would mean giving it a fake section
   * id, and every consumer of section ids — tinting, jump targets, the PDF
   * report — would then have to know about a section that does not exist in
   * the body.
   *
   * After everything else because it is chronologically after: the morning
   * SOAP, then what happened on the shift.
   */
  // Renamed from `output` so every consumer below — the leak check, the
  // non-ASCII check, the preview and the clipboard — sees the same string.
  // Leaving the old name on the composed value would have let one of them
  // silently copy something different from what the preview showed.
  const output = composed;

  /**
   * Tell the copy sanitiser that what is on screen is bound for SIMGOS.
   *
   * Only while this sheet is OPEN and the plain format is selected. Leaving it
   * set after the sheet closes would fold every later copy from the note
   * editor to ASCII, quietly stripping `°` from text headed for WhatsApp — the
   * fix for one surface breaking the other.
   */
  const setSimgosPreview = useUI((state) => state.setSimgosPreview);
  useEffect(() => {
    setSimgosPreview(open && format === 'plain');
    return () => setSimgosPreview(false);
  }, [open, format, setSimgosPreview]);

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

  /**
   * Picking a section STARTS a selection; it does not subtract from everything.
   *
   * This used to expand `'all'` into all five groups and then remove the one
   * clicked, so pressing S from the default state meant "everything except S"
   * — the precise opposite of what pressing S looks like it does. Adding a
   * second chip then grew that set, so the more sections you pressed the fewer
   * you got.
   *
   * From `'all'`, a press selects just that group. After that it toggles
   * normally, so a second press adds and pressing the only selected one clears
   * back to the whole note — there is no way to end up with nothing selected
   * and a silently empty copy.
   */
  const toggleGroup = (id: CopyGroupId): void => {
    if (groups === 'all') {
      setGroups([id]);
      return;
    }

    const next = groups.includes(id)
      ? groups.filter((candidate) => candidate !== id)
      : [...groups, id];

    // Empty, or everything, both mean the whole note — and `'all'` is the
    // state that says so on screen.
    setGroups(next.length === 0 || next.length === COPY_GROUPS.length ? 'all' : next);
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
        /*
         * The button names the patient.
         *
         * The mistake worth preventing is not a bad note — it is switching
         * between SIMGOS and Plano a dozen times and copying from the chart you
         * were on a moment ago. A confirmation dialog would be dismissed
         * without reading; a name written on the button you are already
         * pressing is read, because it is where you are looking.
         */
        <button
          type="button"
          onClick={onCopy}
          disabled={!output.trim()}
          className="min-h-tap w-full rounded-lg bg-accent px-4 py-1 text-sm font-medium text-white disabled:opacity-40"
        >
          {copied ? (
            'Tersalin ✓'
          ) : (
            <>
              <span className="block">Salin</span>
              <span className="block truncate text-[11px] font-normal opacity-90">
                {patient.name?.trim() || 'Tanpa nama'}
                {patient.mrn ? ` · RM ${patient.mrn}` : ''}
              </span>
            </>
          )}
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
              // The consultant's preference only ever names `ringkas` or the
              // daily report; a konsul is a decision for this note, not a
              // standing preference, so it is never applied from here.
              setShape(expected.format === 'ringkas' ? 'ringkas' : 'harian');
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
          active={shape === 'harian'}
          onClick={() => {
            setShape('harian');
            setApplied(false);
          }}
        >
          Laporan harian
        </Chip>
        <Chip
          active={shape === 'ringkas'}
          onClick={() => {
            setShape('ringkas');
            setApplied(false);
          }}
        >
          Ringkas (PDF)
        </Chip>
        {activeShiftNote ? (
          <Chip
            active={shape === 'jaga'}
            onClick={() => {
              setShape('jaga');
              setApplied(false);
            }}
          >
            SOAP jaga {activeShiftNote.time}
          </Chip>
        ) : null}
        <Chip
          active={shape === 'konsul'}
          onClick={() => {
            setShape('konsul');
            setApplied(false);
          }}
        >
          Konsul
        </Chip>
      </Group>

      {/*
        Shown only for Ringkas, and only when this consultant asks for the
        line. Everyone else gets no extra field to read past.
      */}
      {shape === 'ringkas' && active?.verificationTime ? (
        <div className="mb-4">
          <label className="mb-1 block text-[11px] text-fg-muted" htmlFor="verifikasi">
            Jam verifikasi
          </label>
          <div className="flex items-center gap-2">
            <input
              id="verifikasi"
              value={verificationTime}
              onChange={(event) => setVerificationTime(event.target.value)}
              className="min-h-tap flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setVerificationTime(verificationStamp(new Date()))}
              className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs text-fg-muted"
            >
              Sekarang
            </button>
          </div>
          <p className="mt-1 text-[11px] text-fg-faint">
            Muncul sebagai <span className="font-mono">_Verifikasi {verificationTime}_</span>
          </p>
        </div>
      ) : null}

      {shape === 'konsul' ? (
        <div className="mb-4">
          <label className="mb-1 block text-[11px] text-fg-muted" htmlFor="konsul-purpose">
            Konsul untuk
          </label>
          <input
            id="konsul-purpose"
            value={konsulPurpose}
            onChange={(event) => setKonsulPurpose(event.target.value)}
            placeholder="6MWT"
            className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
          />
          <label className="mt-2 flex min-h-tap items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              checked={konsulList}
              onChange={(event) => setKonsulList(event.target.checked)}
            />
            Kirim sebagai list pasien (mis. Echocardiography full study)
          </label>
          <p className="mt-1 text-[11px] text-fg-faint">
            Identitas, DPJP, diagnosis, TB dan BB diambil apa adanya dari catatan hari
            ini. S, O, terapi, dan plan tidak disertakan.
          </p>
        </div>
      ) : null}

      {pdfMode ? (
        <p className="mb-4 text-[11px] text-fg-faint">
          Berisi baris Chief/Junior (dikosongkan), blok pembuka apa adanya, daftar
          diagnosis, dan kalimat penutup. Tanpa S, O, terapi, dan plan.
        </p>
      ) : null}

      {/*
        Hidden for konsul as well as ringkas. Neither shape reads the section
        chips, and a control that visibly does nothing is worse than no
        control: it invites the belief that the referral was narrowed when it
        was not.
      */}
      {shape === 'harian' ? (
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

      {/*
        Shift notes, unticked.

        Shown only when the day HAS one — nothing about the ordinary morning
        copy changes for the days that do not, which is most of them.

        Below the format controls and above the preview, so ticking one and
        watching it appear in the preview is a single glance. The preview is
        what makes opt-in safe rather than fiddly: you can see exactly what
        will land in WhatsApp before you press Salin.
      */}
      {/*
        The "Sertakan SOAP jaga" tick list was REMOVED.

        It existed to append shift notes underneath the day's report, which
        modelled a jaga note as part of the daily note. That is not what it is:
        it is its own note that happens to have been written on that day, and
        it has its own entry in the rail, its own editor and its own Salin
        shape. Offering to fold it into the morning report as well gave the
        same note two identities and made "which one did I send" a question.
      */}

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
