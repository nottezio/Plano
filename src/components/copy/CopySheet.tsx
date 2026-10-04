import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { IconCopy } from '@/components/common/Icons';
import { ResizeGrip } from '@/components/common/ResizeGrip';
import {
  Button,
  Callout,
  CheckRow,
  ChipRow,
  ChoiceChip,
  Field,
  INPUT,
  Section,
  Segmented,
} from '@/components/common/ui';
import { useClipboardNote } from '@/store/useClipboardNote';
import { useUI } from '@/store/useUI';
import { composeCopy } from '@/domain/format/composeCopy';
import {
  FORMAT_LABELS,
  findMarkdownLeaks,
  findConvertibleSymbols,
  findNonAsciiChars,
  type BulletStyle,
} from '@/domain/format/formatters';
import { formatDayNoWeekday } from '@/domain/clinicalDate';
import { composeInvasif } from '@/domain/format/composeInvasif';
import { composeKonsul, missingKonsulMeasurements } from '@/domain/format/composeKonsul';
import {
  KONSUL_CUSTOM_ID,
  KONSUL_PRESETS,
  konsulPresetById,
} from '@/domain/format/konsulPresets';
import { composeShiftNote } from '@/domain/format/composeShiftNote';
import { latestPenunjangOnly } from '@/domain/penunjang';
import {
  appliedReportConfig,
  composePdfReport,
  consultantReportOptions,
} from '@/domain/format/pdfReport';
import { describeConfig, primaryDpjp } from '@/domain/dpjp';
import {
  COPY_GROUPS,
  availableGroups,

  type CopyGroupId,
} from '@/domain/format/copyGroups';
import { copyText } from '@/lib/clipboard';
import { checkIdentity } from '@/domain/identityCheck';
import { RenderedPreview } from './RenderedPreview';
import type {
  ClinicalDate,
  CopyPreset,
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
/**
 * SPEC F6 — the copy sheet.
 *
 * Three independent axes: format, section subset, and whether to include
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
  /**
   * Teks polos: spell symbols in ASCII (`→` → `->`) or let the fold delete
   * them. Per device and remembered, because it is a habit about where the
   * text is going, not a property of one note; the note itself is never
   * changed either way.
   */
  const [asciiSymbols, setAsciiSymbolsState] = useState<boolean>(readAsciiSymbols);
  const setAsciiSymbols = (next: boolean): void => {
    setAsciiSymbolsState(next);
    writeAsciiSymbols(next);
  };
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
   * How big the preview is, remembered per device (2026-10-05).
   *
   * `previewHeight` null means "fill the column", which is the default and
   * what a laptop wants; a number is a height the user dragged to. The options
   * column's width is the same idea. Both are habits about this screen, not
   * properties of a note, so neither is ever written to the note.
   */
  const [previewHeight, setPreviewHeightState] = useState<number | null>(() =>
    readSize(PREVIEW_HEIGHT_KEY, MIN_PREVIEW_HEIGHT, MAX_PREVIEW_HEIGHT),
  );
  const [optionsWidth, setOptionsWidthState] = useState<number>(
    () => readSize(OPTIONS_WIDTH_KEY, MIN_OPTIONS_WIDTH, MAX_OPTIONS_WIDTH) ?? DEFAULT_OPTIONS_WIDTH,
  );
  const previewBoxRef = useRef<HTMLDivElement>(null);
  /*
    Remembered from the state itself rather than from the drag's last event: a
    key press changes and "commits" in one event, where a handler would still
    see the old value. The default is stored as nothing.
  */
  useEffect(() => writeSize(PREVIEW_HEIGHT_KEY, previewHeight), [previewHeight]);
  useEffect(
    () => writeSize(OPTIONS_WIDTH_KEY, optionsWidth === DEFAULT_OPTIONS_WIDTH ? null : optionsWidth),
    [optionsWidth],
  );
  /*
    Dragged past the bottom of the column, the box is held at the column's
    height by flex-shrink while the number keeps growing. That number means
    "as tall as it can be", which is what null already means, so it becomes
    null: no stored height that the screen cannot show, and the column never
    has to scroll (which is what moved the preview while hand-selecting).
  */
  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    if (previewHeight === null || !box) return;
    if (box.getBoundingClientRect().height < previewHeight - 1) setPreviewHeightState(null);
  }, [previewHeight, preview]);
  const setPreviewHeight = (next: number | null): void =>
    setPreviewHeightState(
      next === null ? null : Math.round(Math.max(MIN_PREVIEW_HEIGHT, Math.min(next, MAX_PREVIEW_HEIGHT))),
    );
  const setOptionsWidth = (next: number): void =>
    setOptionsWidthState(Math.round(Math.max(MIN_OPTIONS_WIDTH, Math.min(next, MAX_OPTIONS_WIDTH))));
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
  const [shape, setShape] = useState<
    'harian' | 'ringkas' | 'konsul' | 'jaga' | 'invasif'
  >('harian');
  const pdfMode = shape === 'ringkas';

  /**
   * Which referral this is.
   *
   * The two presets carry their own message shape; `Lainnya` falls back to the
   * free-text purpose and the manual checkbox, which is how this worked
   * before. Defaulting to 6MWT rather than to `Lainnya` keeps the sheet
   * opening on the same referral it always did.
   */
  const [konsulPresetId, setKonsulPresetId] = useState<string>('6mwt');
  const konsulPreset = konsulPresetById(konsulPresetId);

  /**
   * What the konsul is for. Free text, because the list of things a patient
   * gets referred for is not one this app should be deciding.
   *
   * Only read when no preset is selected — a preset supplies its own wording,
   * and leaving this editable underneath one would show a value that is not
   * the value being used.
   */
  const [konsulPurpose, setKonsulPurpose] = useState('6MWT');
  /**
   * The list shape, for the echo full-study request.
   *
   * A checkbox on the konsul rather than a fourth chip: it is the same
   * document with a different framing, and a separate shape would imply the
   * body differs too.
   *
   * Still here, and still manual, for `Lainnya`. A referral we have not met
   * yet may well be a list, and the preset table is not the place to guess at
   * which ones.
   */
  const [konsulList, setKonsulList] = useState(false);

  /**
   * What actually reaches the composer.
   *
   * Derived rather than written into the two state variables when the dropdown
   * changes. Writing them would leave the typed purpose overwritten the moment
   * a preset was picked, so switching to `Lainnya` and back would have lost it
   * — and the state would carry a value the user could no longer see.
   */
  const konsulEffective = konsulPreset
    ? { purpose: konsulPreset.purpose, listStyle: konsulPreset.listStyle }
    : { purpose: konsulPurpose, listStyle: konsulList };

  /**
   * Procedure, date and payer for the invasive group message.
   *
   * Asked for rather than read from the note, because none of the three is in
   * it. Inventing a date would be worse than asking: a wrong one sent to the
   * invasive group books a room.
   */
  const [invasifProcedure, setInvasifProcedure] = useState('');
  const [invasifWhen, setInvasifWhen] = useState('');
  const [invasifPayer, setInvasifPayer] = useState('');
  /**
   * The longer "laporan" form, carrying the investigations.
   *
   * A toggle rather than a sixth chip: it is the same message. The short form
   * ends by asking permission to send the investigations and this is that
   * follow-up, so they belong on one control.
   */
  const [invasifPenunjang, setInvasifPenunjang] = useState(false);

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
  const [appliedFor, setAppliedFor] = useState<string | null>(null);
  const active = appliedReportConfig(appliedFor, dpjp?.id, expected);
  const applied = active !== undefined;

  /**
   * What the Ringkas report is composed with, resolved to primitives BEFORE
   * the memo below. The memo used to read `active?.…` inline and list none of
   * it, so applying a consultant's format while Ringkas was already selected
   * changed nothing that the memo watched: the button said "sedang dipakai"
   * and the text was the old one.
   */
  const report = consultantReportOptions(active, { format, verificationTime });
  const reportFormat = report.format;
  const reportStaffing = report.staffing;
  const reportVerificationTime = report.verificationTime;

  const present = useMemo(() => availableGroups(body, aliases), [body, aliases]);

  /**
   * Whole note, or an explicit subset expanded from the chosen groups.
   *
   * "Semua" stays `'all'` rather than every group selected, because the whole
   * note is byte-faithful while a subset is recomposed — and the greeting,
   * identity and closing live outside the five groups entirely.
   */
  const selected = useMemo(
    /*
      Groups, not section ids. The subset is cut from the note by boundary now,
      so which ids happen to sit inside a block never has to be enumerated —
      which is what made an unfamiliar heading a problem.
    */
    () => (groups === 'all' ? ('all' as const) : [...groups]),
    [groups],
  );

  /**
   * The id, not the object: the note re-identifies on every keystroke while it
   * is being edited, and an effect depending on the object would reset the
   * chosen shape mid-typing. Read through this const — not `activeShiftNote`
   * — inside the effect, so the dependency list is complete as written.
   */
  const shiftNoteId = activeShiftNote?.id;

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    /**
     * A reopened sheet starts unapplied. The shape is reset just below, so a
     * surviving application would leave the button disabled and reading
     * "sedang dipakai" over a shape the consultant never asked for — with no
     * way to press it again.
     */
    setAppliedFor(null);
    /**
     * Opening Salin while a jaga note is on screen defaults to copying THAT
     * note.
     *
     * The alternative — defaulting to the day's SOAP — means the button under
     * your thumb sends something other than what fills the screen behind the
     * sheet, which is the one thing this sheet must never do.
     */
    setShape(shiftNoteId ? 'jaga' : 'harian');
  }, [open, shiftNoteId]);

  /**
   * Always the note on screen, and only that note.
   *
   * There used to be a date range here — today, this day, the last three days,
   * every day — and every shape that is actually sent describes ONE day: a
   * daily handover, a consult, an invasive-group message, a jaga note. The
   * multi-day options existed because the composer can take a list, not
   * because anything asked for one, and they sat above the copy button as
   * four ways to send something other than what fills the screen behind the
   * sheet.
   *
   * The body comes from the editor rather than from a fetch, so anything typed
   * and not yet flushed is included. That was already true for this day; now
   * there is no other day to be inconsistent with.
   */
  /**
   * "Penunjang terbaru saja": the note with only the newest block of each
   * investigation (dr. AHA). Off until switched on here or applied with the
   * consultant's format, like every other preference on this sheet; the note
   * itself keeps the whole stack.
   */
  const [latestOnly, setLatestOnly] = useState(false);
  useEffect(() => {
    if (open) setLatestOnly(false);
  }, [open]);
  const trimmed = useMemo(() => latestPenunjangOnly(body, aliases), [body, aliases]);
  const source = latestOnly ? trimmed.text : body;

  const days = useMemo(() => [{ date, body: source }], [date, source]);

  const composed = useMemo(
    () =>
      shape === 'invasif'
        ? composeInvasif(source, patient, aliases, {
            procedure: invasifProcedure,
            scheduledFor: invasifWhen,
            payer: invasifPayer,
            includeInvestigations: invasifPenunjang,
            format,
            bullet,
            asciiSymbols,
          })
        : shape === 'jaga' && activeShiftNote
        ? // Stands alone. A jaga note is reported when it happens, to whoever
          // is on, and attaching the morning SOAP to it would send a page of
          // findings from hours earlier as though they were current.
          composeShiftNote(activeShiftNote, patient, {
            format,
            bullet,
            includeIdentity,
            asciiSymbols,
          })
        : shape === 'konsul'
        ? // Always the day on screen, never a range: a referral describes the
          // patient now. Sections are not offered either — the konsul decides
          // its own contents, and letting the section chips subtract from it
          // would produce a referral missing its diagnosis.
          composeKonsul(source, patient, aliases, {
            purpose: konsulEffective.purpose,
            listStyle: konsulEffective.listStyle,
            listFrom: patient.ward ?? '',
            listDate: formatDayNoWeekday(date),
            format,
            bullet,
            asciiSymbols,
          })
        : pdfMode
        ? composePdfReport(source, {
            aliases,
            // The consultant's own switches, so choosing "Ringkas (PDF)" for
            // ZD produces a report with a verification time and for MZ one
            // without staffing lines, rather than one shape for everyone.
            format: reportFormat,
            bullet,
            asciiSymbols,
            staffing: reportStaffing,
            ...(reportVerificationTime ? { verificationTime: reportVerificationTime } : {}),
            closings,
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
            asciiSymbols,
          }),
    [
      asciiSymbols,
      shape,
      activeShiftNote,
      bullet,
      pdfMode,
      konsulEffective.purpose,
      konsulEffective.listStyle,
      invasifProcedure,
      invasifWhen,
      invasifPayer,
      invasifPenunjang,
      closings,
      reportFormat,
      reportStaffing,
      reportVerificationTime,
      date,
      source,
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
   * Tell the copy sanitiser to STAND DOWN, because what is on screen is a
   * WhatsApp or markdown preview and its non-ASCII characters are correct
   * there.
   *
   * The inverse of what this did before, for the reason recorded on
   * `nonAsciiPreview`: ASCII folding is now the default everywhere, and this
   * is the only place in the app that suspends it. Only while the sheet is
   * OPEN and a non-plain format is selected — leaving it set after the sheet
   * closes would let a `°` reach SIMGOS from the note editor, which is the
   * failure this whole path exists to prevent.
   */
  const setNonAsciiPreview = useUI((state) => state.setNonAsciiPreview);
  useEffect(() => {
    setNonAsciiPreview(open && format !== 'plain');
    return () => setNonAsciiPreview(false);
  }, [open, format, setNonAsciiPreview]);

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
   * The symbols Teks polos rewrites (or, switched off, deletes), read from
   * the note being copied — the composed output has already lost them.
   */
  const symbolHits = useMemo(
    () =>
      format === 'plain'
        ? findConvertibleSymbols(shape === 'jaga' && activeShiftNote ? activeShiftNote.body : body)
        : [],
    [format, shape, activeShiftNote, body],
  );

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

  /**
   * TB/BB for a 6MWT consult. Checked against the note being sent, not the
   * patient record, because that is what the consultant will read.
   */
  const missingMeasurements = useMemo(
    () =>
      shape === 'konsul' ? missingKonsulMeasurements(konsulEffective.purpose, body) : [],
    [shape, konsulEffective.purpose, body],
  );

  const applyPreset = (preset: CopyPreset): void => {
    setFormat(preset.format);
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

  const remember = useClipboardNote((state) => state.remember);
  const patientName = patient.name?.trim() || 'Tanpa nama';
  const whatLabel: Record<typeof shape, string> = {
    harian: 'SOAP harian',
    ringkas: 'SOAP ringkas',
    jaga: 'SOAP jaga',
    invasif: 'Grup invasif',
    konsul: 'Konsul',
  };

  const onCopy = (): void => {
    void copyText(output).then((ok) => {
      setCopied(ok);
      if (ok) {
        remember({
          what: `${whatLabel[shape]} ${date.slice(8, 10)}/${date.slice(5, 7)}`,
          patientId: patient.id,
          patientName,
          mrn: patient.mrn ?? null,
        });
      }
    });
  };

  const chooseShape = (next: typeof shape): void => {
    setShape(next);
    setAppliedFor(null);
  };

  const copyButton = (
    /*
     * The button names the patient.
     *
     * The mistake worth preventing is not a bad note — it is switching
     * between SIMGOS and Plano a dozen times and copying from the chart you
     * were on a moment ago. A name written on the button you are already
     * pressing is read, because it is where you are looking.
     */
    <button
      type="button"
      onClick={onCopy}
      disabled={!output.trim()}
      className="flex min-h-tap w-full items-center gap-3 rounded-xl bg-accent px-4 py-2 text-left text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      <IconCopy width={20} height={20} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] opacity-90">
          {copied ? 'Tersalin ✓' : `Salin ${whatLabel[shape]} · ${FORMAT_LABELS[format]}`}
        </span>
        <span className="block truncate text-sm font-semibold">
          {patientName}
          {patient.mrn ? ` · RM ${patient.mrn}` : ''}
        </span>
      </span>
    </button>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      fill
      title={`Salin · ${patientName}`}
      description={`Catatan ${date.slice(8, 10)}/${date.slice(5, 7)}${patient.mrn ? ` · RM ${patient.mrn}` : ''}`}
      footer={copyButton}
      // On a laptop the button sits under the options instead, and the
      // preview gets this bar's height (2026-10-05).
      footerClassName="sm:hidden"
    >
      <div
        style={{ '--salin-options': `${optionsWidth}px` } as CSSProperties}
        className="relative grid gap-5 sm:h-full sm:min-h-0 sm:grid-cols-[var(--salin-options)_minmax(0,1fr)]"
      >
        {/*
          OPTIONS: their own scroll on a laptop (see Sheet `fill`), with the copy
          button pinned beneath them. The button used to be a full-width footer
          bar under BOTH columns, which took its height from the preview.
        */}
        <div className="flex min-w-0 flex-col gap-3 sm:min-h-0">
        <div className="space-y-5 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:pb-2 sm:pr-2">
          {identityCheck.status === 'mismatch' ? (
            <div>
          <Callout tone="danger" role="alert" title="Identitas tidak cocok">
            Catatan ini menyebut{' '}
            <strong className="text-fg">
              {identityCheck.field === 'mrn' ? 'RM ' : ''}
              {identityCheck.noteValue}
            </strong>
            , tetapi pasien yang dibuka adalah{' '}
            <strong className="text-fg">
              {identityCheck.field === 'mrn' ? 'RM ' : ''}
              {identityCheck.recordValue}
            </strong>
            . Periksa sebelum menyalin.
          </Callout>
        </div>
      ) : null}


          {expected ? (
            /*
             * A reminder, never a switch: the sheet does not change shape by
             * itself between patients. Applying is one visible tap.
             */
            <Callout
              tone={applied ? 'accent' : 'info'}
              title={`${dpjp?.initials ?? 'DPJP'} biasanya meminta`}
              action={
                <Button
                  size="sm"
                  variant={applied ? 'secondary' : 'primary'}
                  disabled={applied}
                  onClick={() => {
                    if (dpjp) setAppliedFor(dpjp.id);
                    setLatestOnly(Boolean(expected.latestPenunjang));
                    // The consultant's preference only ever names `ringkas` or
                    // the daily report; a konsul is never applied from here.
                    setShape(expected.format === 'ringkas' ? 'ringkas' : 'harian');
                  }}
                >
                  {applied ? 'Dipakai ✓' : 'Pakai'}
                </Button>
              }
            >
              {describeConfig(expected)}
            </Callout>
          ) : null}

          {presets.length > 0 ? (
            <Section title="Preset">
              <ChipRow>
                {presets.map((preset) => (
                  <ChoiceChip
                    key={preset.id}
                    active={false}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.name}
                  </ChoiceChip>
                ))}
              </ChipRow>
            </Section>
          ) : null}

          <Section title="Format">
            <Segmented
              label="Format"
              value={format}
              onChange={(value) => {
                setFormat(value);
                setAppliedFor(null);
              }}
              options={(Object.keys(FORMAT_LABELS) as OutputFormat[]).map(
                (value) => [value, FORMAT_LABELS[value]] as const,
              )}
            />
          </Section>

          <Section title="Bentuk">
            <ChipRow>
              <ChoiceChip active={shape === 'harian'} onClick={() => chooseShape('harian')}>
                Laporan harian
              </ChoiceChip>
              <ChoiceChip active={shape === 'ringkas'} onClick={() => chooseShape('ringkas')}>
                Ringkas (PDF)
              </ChoiceChip>
              {activeShiftNote ? (
                <ChoiceChip dashed active={shape === 'jaga'} onClick={() => chooseShape('jaga')}>
                  SOAP jaga {activeShiftNote.time}
                </ChoiceChip>
              ) : null}
              <ChoiceChip active={shape === 'invasif'} onClick={() => chooseShape('invasif')}>
                Grup invasif
              </ChoiceChip>
              <ChoiceChip active={shape === 'konsul'} onClick={() => chooseShape('konsul')}>
                Konsul
              </ChoiceChip>
            </ChipRow>
          </Section>

          {/*
            Shown only for Ringkas, and only when this consultant asks for the
            line. Everyone else gets no extra field to read past.
          */}
          {shape === 'ringkas' && active?.verificationTime ? (
            <Field
              label="Jam verifikasi"
              htmlFor="verifikasi"
              hint={
                <>
                  Muncul sebagai <span className="font-mono">_Verifikasi {verificationTime}_</span>
                </>
              }
            >
              <div className="flex items-center gap-2">
                <input
                  id="verifikasi"
                  value={verificationTime}
                  onChange={(event) => setVerificationTime(event.target.value)}
                  className={`${INPUT} flex-1 font-mono`}
                />
                <Button size="sm" onClick={() => setVerificationTime(verificationStamp(new Date()))}>
                  Sekarang
                </Button>
              </div>
            </Field>
          ) : null}

          {pdfMode ? (
            <p className="text-[11px] leading-relaxed text-fg-faint">
              Berisi baris Chief/Junior (dikosongkan), blok pembuka apa adanya, daftar diagnosis,
              dan kalimat penutup. Tanpa S, O, terapi, dan plan.
            </p>
          ) : null}

          {shape === 'invasif' ? (
            <Section
              title="Grup invasif"
              hint="Identitas, DPJP, diagnosis, TB dan BB diambil apa adanya dari catatan hari ini."
            >
              <Field label="Rencana tindakan" htmlFor="invasif-tindakan">
                <input
                  id="invasif-tindakan"
                  value={invasifProcedure}
                  onChange={(event) => setInvasifProcedure(event.target.value)}
                  placeholder="Advanced PCI"
                  className={INPUT}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Jadwal" htmlFor="invasif-jadwal">
                  <input
                    id="invasif-jadwal"
                    value={invasifWhen}
                    onChange={(event) => setInvasifWhen(event.target.value)}
                    placeholder="Minggu, 16-08-2026"
                    className={INPUT}
                  />
                </Field>
                <Field label="Penjamin" htmlFor="invasif-penjamin">
                  <input
                    id="invasif-penjamin"
                    value={invasifPayer}
                    onChange={(event) => setInvasifPayer(event.target.value)}
                    placeholder="BPJS Kelas I"
                    className={INPUT}
                  />
                </Field>
              </div>
              <CheckRow
                checked={invasifPenunjang}
                onChange={setInvasifPenunjang}
                title="Sertakan pemeriksaan penunjang"
                detail="Bentuk laporan, untuk menyusul pesan singkatnya."
              />
            </Section>
          ) : null}

          {shape === 'konsul' ? (
            <Section
              title="Konsul"
              hint="Identitas, DPJP, diagnosis, TB dan BB diambil apa adanya dari catatan hari ini. S, O, terapi, dan plan tidak disertakan."
            >
              <Field
                label="Konsul untuk"
                htmlFor="konsul-preset"
                {...(konsulPreset ? { hint: konsulPreset.note } : {})}
              >
                <select
                  id="konsul-preset"
                  value={konsulPresetId}
                  onChange={(event) => setKonsulPresetId(event.target.value)}
                  className={INPUT}
                >
                  {KONSUL_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value={KONSUL_CUSTOM_ID}>Lainnya…</option>
                </select>
              </Field>

              {missingMeasurements.length > 0 ? (
                <Callout tone="warn" role="alert" title={`${missingMeasurements.join(' dan ')} belum ada`}>
                  6MWT dilaporkan per meter dan dibaca terhadap ukuran pasien, jadi permintaan tanpa{' '}
                  {missingMeasurements.join('/')} biasanya dikembalikan. Tambahkan di bagian O sebelum
                  mengirim.
                </Callout>
              ) : null}

              {konsulPreset ? null : (
                <>
                  <Field label="Tujuan konsul" htmlFor="konsul-purpose">
                    <input
                      id="konsul-purpose"
                      value={konsulPurpose}
                      onChange={(event) => setKonsulPurpose(event.target.value)}
                      placeholder="mis. 6MWT"
                      className={INPUT}
                    />
                  </Field>
                  <CheckRow
                    checked={konsulList}
                    onChange={setKonsulList}
                    title="Kirim sebagai list pasien bernomor"
                  />
                </>
              )}
            </Section>
          ) : null}

          {/*
            Hidden for every shape but the daily report: the others do not read
            the section chips, and a control that visibly does nothing invites
            the belief that the message was narrowed when it was not.
          */}
          {shape === 'harian' ? (
            <Section title="Bagian">
              <ChipRow>
                <ChoiceChip active={groups === 'all'} onClick={() => setGroups('all')}>
                  Seluruh catatan
                </ChoiceChip>
                {COPY_GROUPS.map((group) => (
                  <ChoiceChip
                    key={group.id}
                    active={groups !== 'all' && groups.includes(group.id)}
                    disabled={!present.has(group.id)}
                    onClick={() => toggleGroup(group.id)}
                  >
                    {group.label}
                  </ChoiceChip>
                ))}
              </ChipRow>
            </Section>
          ) : null}

          {(shape !== 'jaga' && trimmed.removed.length > 0) ||
          (format === 'plain' && symbolHits.length > 0) ? (
            <Section title="Penyesuaian">
              {shape !== 'jaga' && trimmed.removed.length > 0 ? (
                <CheckRow
                  checked={latestOnly}
                  onChange={(next) => {
                    setLatestOnly(next);
                    setAppliedFor(null);
                  }}
                  title="Penunjang terbaru saja"
                  detail={`${trimmed.removed.length} blok lama ${latestOnly ? 'tidak ikut disalin' : 'ikut disalin'}. Catatan tetap utuh.`}
                />
              ) : null}
              {/*
                Teks polos only, and only when the note has something to
                convert. Changes the Preview and the copy together — they are
                the same string — and never the note.
              */}
              {format === 'plain' && symbolHits.length > 0 ? (
                <CheckRow
                  checked={asciiSymbols}
                  onChange={setAsciiSymbols}
                  title="Ubah simbol agar terbaca di SIMGOS"
                  detail={
                    <>
                      {asciiSymbols ? '' : 'Dimatikan — simbol ini dihapus: '}
                      {symbolHits.map((hit, index) => (
                        <span key={hit.symbol}>
                          {index > 0 ? ' · ' : ''}
                          <span className="text-fg">{hit.symbol}</span>
                          {asciiSymbols ? (
                            <>
                              {' '}jadi <span className="font-mono text-fg">{hit.ascii}</span>
                            </>
                          ) : null}
                          {hit.count > 1 ? ` (${hit.count}×)` : ''}
                        </span>
                      ))}
                    </>
                  }
                />
              ) : null}
            </Section>
          ) : null}
        </div>
          <div className="hidden sm:block">{copyButton}</div>
        </div>

        {/*
          Width: a bar in the gutter between the two columns. Laptop only — on a
          phone the columns are stacked and there is no width to trade. A child
          of the GRID, so nothing in either column can clip it.
        */}
        <ResizeGrip
          axis="x"
          label="Lebar kolom pilihan"
          getStart={() => optionsWidth}
          onChange={setOptionsWidth}
          onReset={() => setOptionsWidthState(DEFAULT_OPTIONS_WIDTH)}
          step={24}
          className="absolute inset-y-0 hidden sm:left-[calc(var(--salin-options)+0.25rem)] sm:flex"
        />

        {/*
          PREVIEW: on a laptop a column of fixed height whose TEXT scrolls, not
          the page. Avi copies by selecting in this box by hand; when the sheet
          body scrolled, dragging a selection to the bottom scrolled the body
          and the box moved under the cursor. Below the options on a phone.
        */}
        <div className="flex min-w-0 flex-col gap-2 sm:min-h-0">
          {/*
            One row above the box carries everything that used to sit below it
            (count, Ukuran awal, Pilih semua teks), so the box runs down to the
            bottom of the sheet.
          */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              Preview
            </h3>
            <span className="text-[11px] tabular-nums text-fg-faint">
              · {output.length.toLocaleString('id-ID')} karakter
            </span>
            <span className="flex-1" />
            {previewHeight !== null || optionsWidth !== DEFAULT_OPTIONS_WIDTH ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPreviewHeight(null);
                  setOptionsWidthState(DEFAULT_OPTIONS_WIDTH);
                }}
              >
                Ukuran awal
              </Button>
            ) : null}
            {preview === 'teks' ? (
              <Button size="sm" variant="ghost" onClick={() => outputRef.current?.select()}>
                Pilih semua teks
              </Button>
            ) : null}
            <Segmented
              size="sm"
              label="Preview"
              value={preview}
              onChange={setPreview}
              options={[
                ['teks', 'Teks'],
                ['tampilan', 'Tampilan'],
              ]}
            />
          </div>

          {/*
            ONE box for both views, so the height the user sets applies to
            whichever is showing. Its children are absolutely positioned: the
            box's size comes from the layout (or the drag), never from its
            content, so a long note cannot stretch it.
          */}
          <div
            ref={previewBoxRef}
            style={previewHeight !== null ? { height: previewHeight } : undefined}
            className={[
              'relative min-w-0',
              previewHeight !== null
                ? // A laptop never lets it grow past the column: it shrinks to
                  // fit, and a height that no longer fits snaps back to "fill"
                  // (see the layout effect). A phone scrolls the sheet instead.
                  'shrink-0 sm:min-h-[8rem] sm:shrink'
                : 'h-[26rem] sm:h-auto sm:min-h-[12rem] sm:flex-1',
            ].join(' ')}
          >
            {preview === 'tampilan' ? (
              <div className="absolute inset-0 flex flex-col gap-2 overflow-y-auto overscroll-contain">
                <RenderedPreview text={output} />
                <p className="text-[11px] text-fg-faint">
                  Perkiraan tampilan di WhatsApp. Jangan menyalin dari sini — tanda formatnya ikut
                  hilang. Gunakan “Teks”.
                </p>
              </div>
            ) : (
              /*
                A real textarea, not a <pre>: read-only, but selectable and
                scrollable. No select-on-focus — switching tabs refocuses it,
                and a select-all then wiped a selection made by hand.
              */
              <textarea
                ref={outputRef}
                readOnly
                value={output || '(kosong)'}
                spellCheck={false}
                className="absolute inset-0 h-full w-full resize-none overscroll-contain rounded-xl border border-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed text-fg outline-none"
              />
            )}
          </div>

          <ResizeGrip
            axis="y"
            label="Tinggi preview"
            getStart={() => previewBoxRef.current?.getBoundingClientRect().height ?? MIN_PREVIEW_HEIGHT}
            onChange={setPreviewHeight}
            onReset={() => setPreviewHeight(null)}
            className="-mt-1"
          />

          {nonAscii.length > 0 || leaks.length > 0 ? (
          <div className="space-y-2">
            {/*
              Keyed on the OUTPUT, not on the format chip: Konsul and Grup
              invasif once carried a zero-width space through plain text while
              this stayed silent. With plain selected, a non-ASCII character is
              Plano's fault, and the sheet says so.
            */}
            {nonAscii.length > 0 && format === 'plain' ? (
              <Callout tone="danger" role="alert" title="Masih ada karakter non-ASCII">
                <span className="font-mono">{nonAscii.map(visibleChar).join(' ')}</span> — ini bug
                Plano, mohon laporkan.
              </Callout>
            ) : null}
            {nonAscii.length > 0 && format !== 'plain' ? (
              <Callout
                tone="info"
                title="Karakter ini muncul sebagai “?” di SIMGOS"
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setFormat('plain');
                      setAppliedFor(null);
                    }}
                  >
                    Pakai Teks polos
                  </Button>
                }
              >
                <span className="font-mono">{nonAscii.map(visibleChar).join(' ')}</span>
              </Callout>
            ) : null}
            {leaks.length > 0 ? (
              <Callout tone="danger" role="alert" title="Sisa penanda markdown">
                {leaks.join(' ')}
              </Callout>
            ) : null}
          </div>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * An offending character as something a person can see.
 *
 * The list used to print the characters themselves, and the ones that matter
 * most are invisible: a zero-width space printed between two spaces is a
 * double space. Invisible and space-like characters are shown by code point.
 */
function visibleChar(char: string): string {
  return /[\p{Cf}\p{Zs}\p{Zl}\p{Zp}­᠎]/u.test(char)
    ? `U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') ?? '?'}`
    : char;
}

const ASCII_SYMBOLS_KEY = 'plano.asciiSymbols';

/** On unless switched off; storage that throws (private mode) reads as on. */
function readAsciiSymbols(): boolean {
  try {
    return window.localStorage.getItem(ASCII_SYMBOLS_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeAsciiSymbols(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(ASCII_SYMBOLS_KEY);
    else window.localStorage.setItem(ASCII_SYMBOLS_KEY, 'off');
  } catch {
    // Not remembered; the switch still works for this sheet.
  }
}

const PREVIEW_HEIGHT_KEY = 'plano.salin.previewHeight';
const OPTIONS_WIDTH_KEY = 'plano.salin.optionsWidth';
const MIN_PREVIEW_HEIGHT = 128;
const MAX_PREVIEW_HEIGHT = 4000;
const DEFAULT_OPTIONS_WIDTH = 288;
const MIN_OPTIONS_WIDTH = 224;
const MAX_OPTIONS_WIDTH = 560;

/** A remembered size, or null when none is stored or it is out of range. */
function readSize(key: string, min: number, max: number): number | null {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  } catch {
    return null;
  }
}

/** null forgets the size, which means "the default" on the next open. */
function writeSize(key: string, value: number | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {
    // Not remembered; the size still holds for this sheet.
  }
}
