import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BodyEditor } from '@/components/patient/BodyEditor';
import { CopySheet } from '@/components/copy/CopySheet';
import { SectionCopyBar } from '@/components/copy/SectionCopyBar';
import { ChecklistPills } from '@/components/patient/ChecklistPills';
import { IdentitySheet } from '@/components/patient/IdentitySheet';
import { PatientActionsSheet } from '@/components/patient/PatientActionsSheet';
import { TemplatePicker } from '@/components/patient/TemplatePicker';
import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { DateRail } from '@/components/patient/DateRail';
import { RevisionTrail } from '@/components/patient/RevisionTrail';
import { AppShell } from '@/components/common/AppShell';
import { setEntryLocked } from '@/data/repositories/entries.repo';
import { carryForward, carryForwardSummary } from '@/domain/carryForward';
import {
  daysBetween,
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
import type { ClinicalDate } from '@/domain/types';

/** Minimum window the rail offers, so a patient admitted today can still scroll. */

export default function PatientPage(): JSX.Element {
  const { patientId, date: routeDate } = useParams<{ patientId: string; date?: string }>();
  const navigate = useNavigate();
  const today = useClinicalToday();
  const settings = useSession((state) => state.settings());

  const selected: ClinicalDate = routeDate ?? today;
  const { patient, loading, error } = usePatient(patientId);
  const { entry, exists } = useEntry(patientId, selected);
  const entryDates = useEntryDates(patientId);
  const previous = useEntry(patientId, previousDay(selected));

  const [hintDismissed, setHintDismissed] = useState(false);
  const [carrySummary, setCarrySummary] = useState<string | null>(null);
  const [trailOpen, setTrailOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

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
  const locked = entry?.locked === true || (autoLocked && entry?.locked !== false);

  const editor = useBodyEditor({
    patientId: patientId ?? '',
    date: selected,
    entry,
    exists,
    hariRawat,
    locked,
  });

  // SPEC 7.5 — announce presence only while the day is actually editable.
  usePresenceHeartbeat(patientId, selected, !locked);
  const otherDevice = otherDeviceEditing(entry);
  const revisions = useRevisions(patientId, selected, trailOpen);
  const checklist = useChecklist(patientId, selected, settings.checklistItems);

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

  const applyCarryForward = (): void => {
    const result = carryForward(
      previous.entry?.body ?? '',
      settings.carryForwardClearSections,
      settings.sectionAliases,
    );
    editor.setValue(result.body);
    setCarrySummary(carryForwardSummary(result));
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
    [patient.ward, patient.bed].filter(Boolean).join(' ').trim() || null,
    patient.dpjp ? `DPJP: ${patient.dpjp}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const canCarryForward =
    !locked && !exists && editor.value.trim().length === 0 && previous.exists;

  return (
    <AppShell title={patient.name}>
      {/* A note is prose. Letting it run to 2000 px makes it unreadable, so
          the whole column is capped and centred from tablet up — the editor
          still fills the height, only the width is constrained. */}
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-start gap-2">
            {identity ? (
              <p className="min-w-0 flex-1 text-xs text-fg-muted">{identity}</p>
            ) : (
              // Identity is optional metadata, not a precondition. The note is
              // already usable; this is an offer, not a prompt.
              <button
                type="button"
                onClick={() => setIdentityOpen(true)}
                className="min-w-0 flex-1 text-left text-xs text-accent underline"
              >
                Tambah identitas pasien
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionsOpen(true)}
              aria-label="Tindakan pasien"
              className="min-h-tap min-w-tap -mr-2 -mt-2 shrink-0 text-fg-faint"
            >
              ⋯
            </button>
          </div>
          <h2 className="mt-1 text-sm font-semibold">
            {formatDayHeader(selected, patient.admittedAt)}
          </h2>
          {patient.status === 'archived' ? (
            <p className="mt-1 text-[11px] text-fg-faint">
              Pasien terarsip — catatan tetap dapat dibaca, disalin, dan diubah.
            </p>
          ) : null}
          {patient.diagnoses.length > 0 ? (
            <p className="mt-1 text-xs text-fg-faint">{patient.diagnoses.join(', ')}</p>
          ) : null}
        </header>

        <ChecklistPills
          items={settings.checklistItems}
          states={checklist.states}
          progress={checklist.progress}
          onToggle={checklist.toggle}
          disabled={locked}
        />

        <DateRail
          dates={railDates}
          selected={selected}
          today={today}
          datesWithContent={datesWithContent}
          onSelect={goToDate}
        />

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
                if (patientId) void setEntryLocked(patientId, selected, false);
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
          readOnly={locked}
          placeholder="Tulis SOAP hari ini…"
        />

        <SectionCopyBar
          body={editor.value}
          aliases={settings.sectionAliases}
          format="whatsapp"
        />

        {/* SPEC F4 — microcopy only. There is no save button by design. */}
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] text-fg-faint">
          <span className="flex-1">{editor.dirty ? 'Menyimpan…' : 'Tersimpan'}</span>
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            className="min-h-tap px-1 underline"
          >
            Salin…
          </button>
          <button
            type="button"
            onClick={() => setTrailOpen(true)}
            className="min-h-tap px-1 underline"
          >
            Riwayat perubahan
          </button>
        </div>
      </div>

      {editor.conflict ? (
        <ConflictDialog
          conflict={editor.conflict}
          otherDeviceLabel={otherDevice ?? 'perangkat lain'}
          onResolve={editor.resolveConflict}
        />
      ) : null}

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

      <CopySheet
        open={copyOpen}
        onOpenChange={setCopyOpen}
        patient={patient}
        body={editor.value}
        date={selected}
        today={today}
        aliases={settings.sectionAliases}
        presets={settings.copyPresets}
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
