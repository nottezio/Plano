import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BodyEditor } from '@/components/patient/BodyEditor';
import { CopySheet } from '@/components/copy/CopySheet';
import { ChecklistPills } from '@/components/patient/ChecklistPills';
import { CompareSheet } from '@/components/patient/CompareSheet';
import { IdentitySheet } from '@/components/patient/IdentitySheet';
import { PatientActionsSheet } from '@/components/patient/PatientActionsSheet';
import { ReformatSheet } from '@/components/patient/ReformatSheet';
import { IdentityBar } from '@/components/patient/IdentityBar';
import { LabSheet } from '@/components/patient/LabSheet';
import { PatientNotes, usePatientNotes } from '@/components/patient/PatientNotes';
import { PatientTodos } from '@/components/patient/PatientTodos';
import { ScrollToTop } from '@/components/patient/ScrollToTop';
import { OpeningSheet } from '@/components/patient/OpeningSheet';
import { TemplatePicker } from '@/components/patient/TemplatePicker';
import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { DateRail } from '@/components/patient/DateRail';
import { RevisionTrail } from '@/components/patient/RevisionTrail';
import { AppShell } from '@/components/common/AppShell';
import { fetchEntryBodies, setEntryLocked } from '@/data/repositories/entries.repo';
import { fillPatientFromNote } from '@/data/repositories/patients.repo';
import { carryForward, carryForwardSummary } from '@/domain/carryForward';
import { formatLocation } from '@/domain/identity';
import { insertIntoObjective } from '@/domain/lab/parseLab';
import { describeConfig, dpjpById, primaryDpjp } from '@/domain/dpjp';
import { parseSections } from '@/domain/sections/parseSections';
import {
  daysBetween,
  formatShortDate,
  formatDayHeader,
  previousDay,
  shouldAutoLock,
  yesterdayHint,
} from '@/domain/clinicalDate';
import { useBodyEditor } from '@/hooks/useBodyEditor';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useChecklist } from '@/hooks/useChecklist';
import { useEntry, useEntryDates } from '@/hooks/useEntry';
import { usePatient } from '@/hooks/usePatient';
import { otherDeviceEditing, usePresenceHeartbeat } from '@/hooks/usePresence';
import { useRevisions } from '@/hooks/useRevisions';
import { useSession } from '@/store/useSession';
import { useUI } from '@/store/useUI';
import type { ClinicalDate } from '@/domain/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** Minimum window the rail offers, so a patient admitted today can still scroll. */

export default function PatientPage(): JSX.Element {
  const { patientId, date: routeDate } = useParams<{ patientId: string; date?: string }>();
  const navigate = useNavigate();
  const today = useClinicalToday();
  const settings = useSession((state) => state.settings());

  const selected: ClinicalDate = routeDate ?? today;
  const { patient, loading, error } = usePatient(patientId);
  const { entry, exists, loading: entryLoading } = useEntry(patientId, selected);
  const entryDates = useEntryDates(patientId);
  const previous = useEntry(patientId, previousDay(selected));

  const [hintDismissed, setHintDismissed] = useState(false);
  const [carrySummary, setCarrySummary] = useState<string | null>(null);
  const [trailOpen, setTrailOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [reformatOpen, setReformatOpen] = useState(false);
  const paneOpen = useUI((state) => state.contextPaneOpen);
  const togglePane = useUI((state) => state.toggleContextPane);

  const hariRawat = patient ? daysBetween(patient.admittedAt, selected) + 1 : 1;

  /**
   * SPEC F4 — past entries auto-lock after 48 h.
   *
   * Derived from the calendar rather than stored by a job, so it is correct on
   * a device that was offline for a week. An explicit `locked: false` means the
   * user unlocked it, and that decision outranks the derived value.
   */
  const autoLocked = shouldAutoLock(
    selected,
    new Date(),
    settings.timezone,
    settings.dayRolloverHour,
  );
  /**
   * Locked while the entry is still loading.
   *
   * This is the bug that wiped a day's note after a mobile sign-in. Until the
   * snapshot arrives, `entry` is null, so the editor's `serverText` is '' — an
   * empty, WRITABLE document standing in for one that may be full. A redirect
   * sign-in reloads the whole page and lands you straight back on the note, so
   * that window is exactly when a keystroke or a force-flush would land, and
   * the write would replace the real body with what was typed into the blank.
   *
   * An editor that does not yet know what it is editing must not be editable.
   */
  const locked =
    entryLoading || entry?.locked === true || (autoLocked && entry?.locked !== false);

  const editor = useBodyEditor({
    patientId: patientId ?? '',
    date: selected,
    entry,
    exists,
    hariRawat,
    locked,
  });

  /**
   * A settled copy of the note, for everything derived from it.
   *
   * `primaryDpjp` and `parsePatientFacts` each walk the whole body, and both
   * were running on every keystroke — on a note carrying three days of EKG and
   * a full plan, that is thousands of characters re-parsed per character typed.
   * That is where the lag came from.
   *
   * None of these consumers needs to be current to the keystroke: the DPJP
   * reminder and the identity fill are both fine a moment late. The editor
   * itself still updates instantly, because it reads `editor.value` directly.
   */
  const settledBody = useDebouncedValue(editor.value, 400);

  /**
   * Learn identity and location from the note.
   *
   * Runs when the note settles rather than on every keystroke, and fills only
   * fields that are still blank — a name typed into the identity form outranks
   * a line in a note, and overwriting a corrected MRN with the uncorrected one
   * from the note text is the worst possible reading of "keep them in sync".
   */
  useEffect(() => {
    if (!patient || editor.dirty) return;
    const written = fillPatientFromNote(patient, settledBody);
    if (written) {
      void written.catch((error: unknown) =>
        console.error('[patient] could not fill from note', error),
      );
    }
  }, [patient, editor.dirty, settledBody]);

  // SPEC 7.5 — announce presence only while the day is actually editable.
  usePresenceHeartbeat(patientId, selected, !locked);
  const otherDevice = otherDeviceEditing(entry);
  const revisions = useRevisions(patientId, selected, trailOpen);
  const checklist = useChecklist(patientId, selected, settings.checklistItems);
  const notesSync = usePatientNotes(patient ?? null);

  /**
   * Read from the note, not from a field. The DPJP line is already there, and
   * a second place to record the same fact is a second place for it to be
   * wrong.
   */
  /**
   * Today's note first, the patient's stored consultant second.
   *
   * A day that has not been written yet names nobody, and "no DPJP" on a blank
   * page is not a fact about the patient — it is a fact about the page. The
   * stored value comes from the last day that did name someone, which is the
   * answer the user actually wants at 6am before rounds.
   */
  const dpjp = useMemo(
    () => primaryDpjp(settledBody) ?? (patient?.dpjpId ? dpjpById(patient.dpjpId) : null),
    [settledBody, patient?.dpjpId],
  );
  const dpjpFormat = dpjp ? settings.dpjpFormats[dpjp.id] : undefined;

  /**
   * Publish the reporting format to the sidebar while this patient is open.
   *
   * Cleared on unmount so the rail never shows a format belonging to a patient
   * that is no longer on screen — a stale reminder is worse than none, because
   * it is indistinguishable from a current one.
   */
  const setDpjpHint = useUI((state) => state.setDpjpHint);
  useEffect(() => {
    if (dpjp && dpjpFormat) {
      setDpjpHint({
        initials: dpjp.initials,
        name: dpjp.name,
        description: describeConfig(dpjpFormat),
      });
    } else {
      setDpjpHint(null);
    }
    return () => setDpjpHint(null);
  }, [dpjp, dpjpFormat, setDpjpHint]);

  const railDates = useMemo(
    () => buildRail(patient?.admittedAt ?? today, today, entryDates),
    [patient?.admittedAt, today, entryDates],
  );
  const datesWithContent = useMemo(() => new Set(entryDates), [entryDates]);

  const hint = useMemo(
    () =>
      hintDismissed
        ? null
        : yesterdayHint({
            now: new Date(),
            tz: settings.timezone,
            rolloverHour: settings.dayRolloverHour,
            selectedDate: selected,
            hasYesterdayEntry: previous.exists,
          }),
    [hintDismissed, settings.timezone, settings.dayRolloverHour, selected, previous.exists],
  );

  const goToDate = (next: ClinicalDate): void => {
    editor.flush();
    navigate(`/p/${patientId}/${next}`);
  };

  /**
   * Copy the previous note forward.
   *
   * Sources from the newest earlier day that actually HAS content, not strictly
   * from yesterday. A patient admitted Friday and reviewed Monday has two empty
   * days in between, and "yesterday was empty so there is nothing to copy" is
   * wrong in exactly the situation where retyping hurts most.
   */
  const applyCarryForward = (): void => {
    if (!patientId) return;

    void fetchEntryBodies(patientId)
      .then((days) => {
        const source = days
          .filter((day) => day.date < selected && day.body.trim().length > 0)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

        if (!source) {
          setCarrySummary('Tidak ada catatan sebelumnya untuk disalin.');
          return;
        }

        const result = carryForward(
          source.body,
          settings.carryForwardClearSections,
          settings.sectionAliases,
        );
        editor.setValue(result.body);
        setCarrySummary(`${carryForwardSummary(result)} (dari ${formatShortDate(source.date)})`);
      })
      .catch((error: unknown) => console.error('[patient] carry-forward failed', error));
  };

  if (loading) {
    return (
      <AppShell title="Pasien">
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Memuat…</p>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell title="Pasien">
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-fg-muted">{error ?? 'Pasien tidak ditemukan.'}</p>
          <Link to="/" className="mt-3 inline-block text-sm text-accent underline">
            Kembali ke papan
          </Link>
        </div>
      </AppShell>
    );
  }

  const identity = [
    patient.name?.trim() || null,
    patient.age ? `${patient.age}th` : null,
    patient.sex,
    patient.mrn ? `RM ${patient.mrn}` : null,
    formatLocation(patient) || null,
    patient.dpjp ? `DPJP: ${patient.dpjp}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Any empty day qualifies. The old `!exists` condition meant the offer
  // vanished the moment the document was materialised — which happens on the
  // first keystroke, or when a template is inserted and then cleared.
  const canCarryForward = !locked && editor.value.trim().length === 0;

  return (
    <AppShell title={patient.name}>
      {/*
        Two columns from 1280 px, one below it.

        Capping everything at max-w-3xl and centring it was still a phone layout
        — it just had margins. On a laptop the note deserves the width it has,
        and the things you consult WHILE writing (which day, what is still
        outstanding) belong beside it rather than stacked above it, where every
        one of them pushed the text further down the screen.

        The note column keeps a readable measure; the rail and checklist move
        into a sidebar that does not move when the note grows.

        `overflow-x-clip`, NOT `overflow-hidden`: `overflow: hidden` makes this
        element the scroll container for anything `position: sticky` inside it,
        which is why the identity bar sat still at the top of the note instead
        of following the scroll. `clip` contains the same horizontal overflow
        without creating a scroll container.
      */}
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-x-clip xl:max-w-none xl:flex-row xl:gap-6 xl:pr-4">
        {/*
          `min-w-0` is load-bearing, not decoration.

          A flex item defaults to `min-width: auto`, which means it refuses to
          shrink below the intrinsic width of its content. A long unbroken line
          in the note therefore pushed this column wider than the row, the fixed
          sidebar was shoved past the viewport edge, and the whole page grew a
          horizontal scrollbar. `min-w-0` lets the column shrink and the text
          wrap instead.
        */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/*
          One row, not three.

          The date heading and the action buttons were on separate lines with an
          empty slot between them where the identity line used to be, so the
          header spent three rows and a gap saying what fits on one.
        */}
        <header className="flex items-center gap-2 border-b border-border px-4 py-2">
          {/* Browser back exists, but on an installed PWA there is no chrome to
              show it, and on desktop the note fills the window. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Kembali ke papan"
            className="min-h-tap min-w-tap shrink-0 text-fg-muted"
          >
            <span aria-hidden="true">←</span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {formatDayHeader(selected, patient.admittedAt)}
            </h2>
            {!identity ? (
              // Identity is optional metadata, not a precondition. The note is
              // already usable; this is an offer, not a prompt.
              <button
                type="button"
                onClick={() => setIdentityOpen(true)}
                className="text-left text-[11px] text-accent underline"
              >
                Tambah identitas pasien
              </button>
            ) : dpjpFormat ? (
              <p className="truncate text-[11px] text-fg-faint">
                {dpjp?.initials} — {describeConfig(dpjpFormat)}
              </p>
            ) : patient.diagnoses.length > 0 ? (
              <p className="truncate text-[11px] text-fg-faint">
                {patient.diagnoses.join(', ')}
              </p>
            ) : null}
          </div>

          {!locked ? (
            <button
              type="button"
              onClick={() => setLabOpen(true)}
              className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs font-medium"
            >
              Lab
            </button>
          ) : null}
          {!locked ? (
            <button
              type="button"
              onClick={() => setOpeningOpen(true)}
              disabled={editor.value.trim().length === 0}
              className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-40"
            >
              Pembuka
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            className="min-h-tap shrink-0 rounded-lg bg-accent px-3 text-xs font-medium text-white"
          >
            Salin
          </button>
          <button
            type="button"
            onClick={togglePane}
            aria-label={paneOpen ? 'Sembunyikan panel samping' : 'Tampilkan panel samping'}
            aria-expanded={paneOpen}
            className="hidden min-h-tap min-w-tap shrink-0 text-fg-faint xl:block"
          >
            <span aria-hidden="true">{paneOpen ? '⇥' : '⇤'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            aria-label="Bandingkan dengan hari sebelumnya"
            title="Bandingkan hari"
            className="min-h-tap min-w-tap shrink-0 text-fg-faint"
          >
            <span aria-hidden="true">⇄</span>
          </button>
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="Tindakan pasien"
            className="min-h-tap min-w-tap shrink-0 text-fg-faint"
          >
            ⋯
          </button>
        </header>

        {patient.status === 'archived' ? (
          <p className="border-b border-border px-4 py-1 text-[11px] text-fg-faint">
            Pasien terarsip — catatan tetap dapat dibaca, disalin, dan diubah.
          </p>
        ) : null}

        <IdentityBar
          patient={patient}
          showInitialsOnly={settings.privacy.boardShowInitialsOnly}
          hariRawat={hariRawat}
          onEdit={() => setIdentityOpen(true)}
        />

        <div className="xl:hidden">
          <PatientNotes sync={notesSync} />
        </div>

        <div className="xl:hidden">
          <PatientTodos patient={patient} />
        </div>

        <div className="xl:hidden">
          <ChecklistPills
            items={settings.checklistItems}
            states={checklist.states}
            progress={checklist.progress}
            onToggle={checklist.toggle}
            disabled={locked}
          />
        </div>

        <div className="xl:hidden">
          <DateRail
            dates={railDates}
            selected={selected}
            today={today}
            datesWithContent={datesWithContent}
            onSelect={goToDate}
          />
        </div>

        {hint ? (
          <Banner tone="info">
            <span className="flex-1">{hint.message}</span>
            <button
              type="button"
              onClick={() => goToDate(hint.yesterday)}
              className="font-medium text-accent underline"
            >
              Buka
            </button>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              className="text-fg-faint"
            >
              Tutup
            </button>
          </Banner>
        ) : null}

        {otherDevice ? (
          <Banner tone="muted">
            <span className="flex-1">
              Perangkat lain ({otherDevice}) sedang membuka catatan ini. Anda tetap bisa
              menulis.
            </span>
          </Banner>
        ) : null}

        {editor.remoteChangedWhileDirty && !editor.conflict ? (
          <Banner tone="muted">
            <span className="flex-1">Perubahan dari perangkat lain digabungkan otomatis.</span>
          </Banner>
        ) : null}

        {locked ? (
          <Banner tone="muted">
            <span className="flex-1">
              Catatan terkunci{autoLocked ? ' otomatis setelah 48 jam' : ''}.
            </span>
            <button
              type="button"
              onClick={() => {
                if (!patientId) return;
                void setEntryLocked(patientId, selected, false).catch((error: unknown) =>
                  console.error('[patient] unlock failed', error),
                );
              }}
              className="font-medium text-accent underline"
            >
              Buka kunci
            </button>
          </Banner>
        ) : null}

        {canCarryForward ? (
          <Banner tone="info">
            <span className="flex-1">Hari ini masih kosong.</span>
            <button
              type="button"
              onClick={applyCarryForward}
              className="font-medium text-accent underline"
            >
              Salin dari hari sebelumnya
            </button>
          </Banner>
        ) : null}

        {carrySummary ? <Banner tone="muted">{carrySummary}</Banner> : null}

        {/* Empty day only — see TemplatePicker for why this is never automatic. */}
        {!locked && editor.value.trim().length === 0 ? (
          <TemplatePicker
            templates={settings.noteTemplates}
            onPick={(body) => editor.setValue(body)}
          />
        ) : null}

        <BodyEditor
          value={editor.value}
          onChange={editor.setValue}
          onBlur={editor.flush}
          aliases={settings.sectionAliases}
          tint={settings.sectionTint}
          readOnly={locked}
          placeholder="Tulis SOAP hari ini…"
        />

        {/* SPEC F4 — microcopy only. There is no save button by design. */}
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] text-fg-faint">
          <span className="flex-1">{editor.dirty ? 'Menyimpan…' : 'Tersimpan'}</span>
          {!locked ? (
            <button
              type="button"
              onClick={() => setReformatOpen(true)}
              className="min-h-tap px-1 underline"
            >
              Format bangsal
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTrailOpen(true)}
            className="min-h-tap px-1 underline"
          >
            Riwayat perubahan
          </button>
        </div>

      {editor.conflict ? (
        <ConflictDialog
          conflict={editor.conflict}
          otherDeviceLabel={otherDevice ?? 'perangkat lain'}
          onResolve={editor.resolveConflict}
        />
      ) : null}

      <ReformatSheet
        open={reformatOpen}
        onOpenChange={setReformatOpen}
        body={editor.value}
        onApply={editor.setValue}
      />

      <CompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        patientId={patientId ?? ''}
        today={selected}
        todayBody={editor.value}
      />

      <IdentitySheet
        open={identityOpen}
        onOpenChange={setIdentityOpen}
        patient={patient}
      />

      <PatientActionsSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        patient={patient}
      />

        </div>

        {/* Sidebar: fixed-width context, scrolls independently. */}
        {/* Collapsing gives the note the full width. The state persists, so a
            preference set once survives navigation and reloads. */}
        {/*
          Sticky to the viewport, scrolling on its own.
          
          It used to scroll with the note, so on a long note the checklist —
          the thing you tick WHILE reading — was somewhere off the top of the
          screen. `max-h` plus its own overflow means a long checklist still
          scrolls without dragging the note with it.
        */}
        <aside
          className={[
            'sticky top-0 max-h-[100dvh] w-[300px] shrink-0 flex-col gap-4',
            'overflow-y-auto overflow-x-hidden py-4',
            paneOpen ? 'hidden xl:flex' : 'hidden',
          ].join(' ')}
        >
          <PatientNotes sync={notesSync} />

          <PatientTodos patient={patient} />

          <section>
            <h3 className="mb-1.5 text-xs font-semibold text-fg-muted">Tanggal</h3>
            <DateRail
              dates={railDates}
              selected={selected}
              today={today}
              datesWithContent={datesWithContent}
              onSelect={goToDate}
              orientation="vertical"
            />
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold text-fg-muted">Checklist</h3>
            <ChecklistPills
              items={settings.checklistItems}
              states={checklist.states}
              progress={checklist.progress}
              onToggle={checklist.toggle}
              disabled={locked}
              orientation="vertical"
            />
          </section>
        </aside>
      </div>

      <LabSheet
        open={labOpen}
        onOpenChange={setLabOpen}
        date={selected}
        onInsert={(text) => {
          // Into the objective block, after any existing dated investigations.
          // Appending to the end put lab results below Plan, where they read
          // wrong and where the "O + Penunjang" copy group would miss them.
          const boundaries = parseSections(editor.value, settings.sectionAliases).map(
            (section) => ({
              sectionId: section.sectionId,
              start: section.start,
              end: section.end,
            }),
          );
          editor.setValue(insertIntoObjective(editor.value, text, boundaries));
        }}
      />

      <ScrollToTop />

      <OpeningSheet
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        body={editor.value}
        greetings={settings.greetings}
        openingSentences={settings.openingSentences}
        closingSentences={settings.closingSentences}
        onApply={(next) => {
          editor.setValue(next);
          setOpeningOpen(false);
        }}
      />

      <CopySheet
        open={copyOpen}
        onOpenChange={setCopyOpen}
        patient={patient}
        body={editor.value}
        date={selected}
        today={today}
        aliases={settings.sectionAliases}
        presets={settings.copyPresets}
        dpjpFormats={settings.dpjpFormats}
        bullet={settings.whatsappBullet}
      />

      <RevisionTrail
        open={trailOpen}
        onOpenChange={setTrailOpen}
        revisions={revisions}
        currentBody={editor.value}
        onRestore={editor.restoreRevision}
      />
    </AppShell>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'info' | 'warn' | 'muted';
  children: React.ReactNode;
}): JSX.Element {
  const toneClass =
    tone === 'warn'
      ? 'border-[var(--card-step-2-accent)] text-[var(--card-step-2-accent)]'
      : tone === 'info'
        ? 'border-border bg-bg-subtle'
        : 'border-border text-fg-muted';

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2 text-xs ${toneClass}`}>
      {children}
    </div>
  );
}

/**
 * The rail spans admission → today, with a minimum window, plus any date that
 * already has an entry so a back-dated note stays reachable.
 */
/**
 * Days that actually have a note, plus today.
 *
 * This used to render every calendar day since admission, which on a long stay
 * meant scrolling past two weeks of empty chips to reach the three days that
 * had anything in them. A rail is for navigation, and an empty day is not a
 * destination — today is the only exception, because that is where writing
 * starts.
 */
function buildRail(
  _admittedAt: ClinicalDate,
  today: ClinicalDate,
  entryDates: readonly ClinicalDate[],
): ClinicalDate[] {
  const dates = new Set<ClinicalDate>(entryDates);
  dates.add(today);
  return [...dates].sort();
}
