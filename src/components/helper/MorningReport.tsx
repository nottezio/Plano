import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DateField } from '@/components/common/DateField';

import {
  dropMrDays,
  setMrConfigField,
  setMrDayField,
  setMrPatients,
  setMrWeekdayPengampu,
} from '@/data/repositories/morningReport.repo';
import {
  DEFAULT_STATUS,
  buildPakarMessage,
  buildPengampuInviteMessage,
  type PengampuAddress,
  buildProdiMessage,
  buildRequestMessage,
  coveredShifts,
  dayName,
  defaultCoverStart,
  defaultMrDate,
  longDateText,
  parsePatients,
  parsePengampuMessage,
  parseShiftKey,
  partLabel,
  pengampuFor,
  mrReadiness,
  readMrConfig,
  readMrDay,
  shiftKey,
  stepMrDate,
  shiftLabel,
  staleMrDays,
  weekday,
  type MrShift,
  type Pengampu,
} from '@/domain/mr/morningReport';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useSyncedDraft } from '@/hooks/useSyncedDraft';
import { copyText } from '@/lib/clipboard';
import type { HelperResultKind } from '@/domain/helperResults';
import { SaveResultButton } from './SaveResult';
import { useSession } from '@/store/useSession';
import { Button, Callout, Field, INPUT, Section, Segmented } from '@/components/common/ui';
import { IconBack, IconCheck, IconChevronRight, IconCopy, IconPlus, IconTrash } from '@/components/common/Icons';

/**
 * Morning Report confirmator — WIP.
 *
 * Three messages from one working state: the request to a senior for a
 * jaga's list, the Prodi report built from the lists, and the PAKAR
 * attendance confirmation. The state (lists, pengampu statuses) and the
 * settings (name, Zoom block, statuses, weekly pengampu) live on the profile
 * and follow the account to every device.
 */

const WEEKDAYS: Array<[string, string]> = [
  ['1', 'Senin'],
  ['2', 'Selasa'],
  ['3', 'Rabu'],
  ['4', 'Kamis'],
  ['5', 'Jumat'],
];

export function MorningReport(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const rawConfig = useSession((state) => state.profile?.morningReport);
  const rawDays = useSession((state) => state.profile?.mrDays);
  const today = useClinicalToday();

  const config = useMemo(() => readMrConfig(rawConfig), [rawConfig]);
  const [mrDate, setMrDate] = useState(() => defaultMrDate(today));
  const day = useMemo(() => readMrDay(rawDays?.[mrDate]), [rawDays, mrDate]);

  // Housekeeping once per visit: drafts past the keep window are removed.
  const pruned = useRef(false);
  useEffect(() => {
    if (!uid || !rawDays || pruned.current) return;
    pruned.current = true;
    dropMrDays(uid, staleMrDays(rawDays, today));
  }, [uid, rawDays, today]);

  const shifts = useMemo(() => coveredShifts(mrDate, day.start), [mrDate, day.start]);
  const start = shifts[0]?.date ?? defaultCoverStart(mrDate);
  // The stored target when it is still in range, else the latest jaga (the
  // one whose list is usually still missing the evening before).
  const stored = day.target && shifts.some((s) => shiftKey(s) === day.target) ? parseShiftKey(day.target) : null;
  const target: MrShift = stored ?? shifts[shifts.length - 1] ?? { date: start, part: 'full' };
  const pengampu = pengampuFor(mrDate, day, config);

  const setPengampu = (next: Pengampu[]): void => {
    if (uid) setMrDayField(uid, mrDate, 'pengampu', next);
  };

  const isWeekend = weekday(mrDate) === 0 || weekday(mrDate) === 6;
  /** The invitation's address form; per visit, since it depends on who is next asked. */
  const [inviteAddress, setInviteAddress] = useState<PengampuAddress>('dokter');

  const readiness = mrReadiness({
    sender: config.sender,
    shifts,
    patients: day.patients ?? {},
    pengampu,
    zoom: config.zoom,
  });
  const readyCount = readiness.filter((item) => item.ok).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      {/* Left: the inputs, in the order the evening goes. */}
      <div className="min-w-0 space-y-6">
        {!uid ? (
          <Callout tone="danger" title="Belum masuk akun">
            Isian tidak tersimpan.
          </Callout>
        ) : null}

        <Step n={1} title="Tanggal MR">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Hari MR" htmlFor="mr-date">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMrDate(stepMrDate(mrDate, -1))}
                  aria-label="Hari MR sebelumnya"
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-xl border border-border text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-10"
                >
                  <IconBack className="h-4 w-4" />
                </button>
                <DateField id="mr-date" value={mrDate} onChange={setMrDate} className="w-40" />
                <button
                  type="button"
                  onClick={() => setMrDate(stepMrDate(mrDate, 1))}
                  aria-label="Hari MR berikutnya"
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-xl border border-border text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-10"
                >
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <Field label="Jaga mulai dari" htmlFor="mr-start">
              <DateField
                id="mr-start"
                value={start}
                max={mrDate}
                onChange={(value) => {
                  if (!uid || !value) return;
                  setMrDayField(uid, mrDate, 'start', value === defaultCoverStart(mrDate) ? null : value);
                }}
                className="w-40"
              />
            </Field>
            {mrDate !== defaultMrDate(today) ? (
              <Button size="sm" variant="ghost" onClick={() => setMrDate(defaultMrDate(today))}>
                MR berikutnya
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-fg-muted">
            <span className="font-medium text-fg">{longDateText(mrDate)}</span> · {shifts.length} list dilaporkan
            {day.start ? ' · rentang diubah manual (mis. hari libur)' : ''}
          </p>
          {isWeekend ? (
            <Callout tone="warn">Tanggal ini jatuh di akhir pekan.</Callout>
          ) : null}
        </Step>

        <Step n={2} title="Minta list ke senior">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama Anda">
              <SyncedInput
                key={`sender:${String(uid)}`}
                remote={config.sender}
                onWrite={(value) => uid && setMrConfigField(uid, 'sender', value)}
                placeholder="mis. Avi"
                ariaLabel="Nama Anda"
              />
            </Field>
            <Field label="Perkenalan ke pengampu">
              <SyncedInput
                key={`senderRole:${String(uid)}`}
                remote={config.senderRole}
                onWrite={(value) => uid && setMrConfigField(uid, 'senderRole', value)}
                placeholder="mis. PPDS Kardio Semester 1"
                ariaLabel="Perkenalan ke pengampu"
              />
            </Field>
            <Field label="List yang diminta" htmlFor="mr-target">
              <select
                id="mr-target"
                value={shiftKey(target)}
                onChange={(event) => uid && setMrDayField(uid, mrDate, 'target', event.target.value)}
                className={INPUT}
              >
                {shifts.map((shift) => (
                  <option key={shiftKey(shift)} value={shiftKey(shift)}>
                    {shiftLabel(shift)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[11px] text-fg-faint lg:hidden">Pesannya ada di bagian Pesan di bawah.</p>
          <p className="hidden text-[11px] text-fg-faint lg:block">Pesannya ada di kolom kanan.</p>
        </Step>

        <Step
          n={3}
          title="Pasien Dinas dan Jaga"
          hint="Tempel list dari senior apa adanya. Nomor, huruf tebal, dan “Diagnosis:” dirapikan otomatis; kosongkan untuk “(Tidak ada pasien)”."
        >
          {/*
            One row per date, its lists side by side: Dinas | Jaga on a
            weekday, Jaga Pagi | Jaga Malam on a weekend. Stacked on a phone.
          */}
          <div className="space-y-4">
            {groupByDate(shifts).map(([date, parts]) => (
              <div key={date} className="space-y-1.5">
                <p className="text-xs font-semibold text-fg-muted">{longDateText(date)}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {parts.map((shift) => (
                    <ShiftPatients
                      key={`${mrDate}:${shiftKey(shift)}`}
                      shift={shift}
                      remote={day.patients?.[shiftKey(shift)] ?? ''}
                      onWrite={(text) => uid && setMrPatients(uid, mrDate, shiftKey(shift), text)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step
          n={4}
          title={`Pengampu MR ${dayName(mrDate)}`}
          aside={
            <span className="text-[11px] text-fg-faint">
              {day.pengampu ? 'diubah untuk tanggal ini' : 'dari jadwal mingguan'}
            </span>
          }
        >
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {pengampu.map((entry, index) => (
              <li key={index} className="grid gap-2 bg-surface p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_auto] sm:items-start">
                <SyncedInput
                  key={`${mrDate}:name:${index}:${pengampu.length}`}
                  remote={entry.name}
                  onWrite={(name) => setPengampu(pengampu.map((p, i) => (i === index ? { ...p, name } : p)))}
                  ariaLabel={`Nama pengampu ${index + 1}`}
                  placeholder="Nama dan gelar"
                />
                <StatusPicker
                  key={`${mrDate}:status:${index}:${pengampu.length}`}
                  name={entry.name}
                  status={entry.status}
                  presets={config.statuses}
                  onChange={(status) => setPengampu(pengampu.map((p, i) => (i === index ? { ...p, status } : p)))}
                />
                <button
                  type="button"
                  onClick={() => setPengampu(pengampu.filter((_, i) => i !== index))}
                  className="flex min-h-tap min-w-tap items-center justify-center justify-self-end rounded-xl text-fg-faint hover:bg-[var(--danger-soft)] hover:text-danger [@media(pointer:fine)]:min-h-10"
                  aria-label={`Hapus ${entry.name || 'pengampu'}`}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
            {pengampu.length === 0 ? (
              <li className="bg-surface px-3 py-3 text-xs text-fg-faint">Belum ada pengampu untuk tanggal ini.</li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<IconPlus className="h-4 w-4" />}
              onClick={() => setPengampu([...pengampu, { name: '', status: DEFAULT_STATUS }])}
            >
              Pengampu
            </Button>
            {day.pengampu ? (
              <Button size="sm" variant="ghost" onClick={() => uid && setMrDayField(uid, mrDate, 'pengampu', null)}>
                Kembalikan ke jadwal {dayName(mrDate)}
              </Button>
            ) : null}
          </div>
        </Step>

        <MrSettings uid={uid} config={config} />
      </div>

      {/* Right: what gets sent. Sticky on a laptop, so it stays in view while the list is pasted. */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
        <section
          aria-labelledby="mr-ready"
          className={[
            'rounded-xl border px-3 py-2.5',
            readyCount === readiness.length ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-bg-subtle',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <h3 id="mr-ready" className="flex-1 text-xs font-semibold">
              Kesiapan MR {dayName(mrDate)}
            </h3>
            <span className="text-[11px] font-medium text-fg-muted">
              {readyCount}/{readiness.length}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1 text-[11px]">
            {readiness.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]',
                    item.ok ? 'bg-accent text-white' : 'ring-1 ring-border-strong',
                  ].join(' ')}
                >
                  {item.ok ? '✓' : ''}
                </span>
                <span className="flex-1">{item.label}</span>
                <span className={item.ok ? 'text-fg-muted' : 'font-medium text-[var(--warn-strong)]'}>
                  {item.detail}
                </span>
                <span className="sr-only">{item.ok ? 'siap' : 'belum'}</span>
              </li>
            ))}
          </ul>
        </section>

        <Section title="Pesan">
          <div className="space-y-3">
            <MessageBox
              label="Ke senior"
              sub={`Minta list ${shiftLabel(target)}`}
              save={{ kind: 'mr-senior', forDate: mrDate, subject: '', title: 'MR · minta list ke senior' }}
              text={buildRequestMessage({ sender: config.sender, mrDate, shift: target })}
            />
            <MessageBox
              label="Ke pengampu"
              sub="Minta kesediaan memimpin MR dan jam hadir"
              save={{ kind: 'mr-pengampu', forDate: mrDate, subject: '', title: 'MR · undangan pengampu' }}
              extra={
                <Segmented
                  label="Sapaan"
                  size="sm"
                  value={inviteAddress}
                  onChange={setInviteAddress}
                  options={[
                    ['dokter', 'Dokter'],
                    ['prof', 'Prof'],
                  ]}
                />
              }
              text={buildPengampuInviteMessage({
                sender: config.sender,
                senderRole: config.senderRole,
                mrDate,
                today,
                hour: new Date().getHours(),
                address: inviteAddress,
              })}
            />
            <MessageBox
              label="Laporan Grup Prodi"
              sub="Dari langkah 3 dan 4, pagi hari MR"
              save={{ kind: 'mr-prodi', forDate: mrDate, subject: '', title: 'MR · laporan Grup Prodi' }}
              text={buildProdiMessage({
                mrDate,
                shifts,
                patients: day.patients ?? {},
                pengampu,
                zoom: config.zoom,
              })}
            />
            <MessageBox
              label="Konfirmasi Grup PAKAR"
              sub="Dari langkah 4"
              save={{ kind: 'mr-pakar', forDate: mrDate, subject: '', title: 'MR · konfirmasi Grup PAKAR' }}
              text={buildPakarMessage({ mrDate, pengampu })}
            />
          </div>
        </Section>
      </aside>
    </div>
  );
}

/** A numbered step: the number says the order, the title what it is for. */
function Step({
  n,
  title,
  hint,
  aside,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-accent"
        >
          {n}
        </span>
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {hint ? <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p> : null}
      {children}
    </section>
  );
}

/** Shifts grouped by date, dates in order, parts in report order. */
function groupByDate(shifts: readonly MrShift[]): Array<[string, MrShift[]]> {
  const groups = new Map<string, MrShift[]>();
  for (const shift of shifts) groups.set(shift.date, [...(groups.get(shift.date) ?? []), shift]);
  return [...groups];
}

const CUSTOM = '__custom__';

/**
 * One line per pengampu: a preset from the account's list, or free text when
 * the confirmation says something the presets do not ("hadir via Zoom").
 * A status that is not a preset opens straight into the text field.
 */
function StatusPicker({
  name,
  status,
  presets,
  onChange,
}: {
  name: string;
  status: string;
  presets: readonly string[];
  onChange: (status: string) => void;
}): JSX.Element {
  const isPreset = presets.includes(status);
  const [typing, setTyping] = useState(!isPreset);
  return (
    <div className="space-y-1">
      <select
        value={typing || !isPreset ? CUSTOM : status}
        onChange={(event) => {
          if (event.target.value === CUSTOM) {
            setTyping(true);
            return;
          }
          setTyping(false);
          onChange(event.target.value);
        }}
        aria-label={`Status ${name || 'pengampu'}`}
        className={`${INPUT} text-xs`}
      >
        {presets.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value={CUSTOM}>Ketik sendiri…</option>
      </select>
      {typing || !isPreset ? (
        <SyncedInput
          remote={status}
          onWrite={onChange}
          ariaLabel={`Status bebas ${name || 'pengampu'}`}
          placeholder="mis. konfirmasi hadir via Zoom"
        />
      ) : null}
    </div>
  );
}

function SyncedInput({
  remote,
  onWrite,
  placeholder,
  ariaLabel,
  className = '',
}: {
  remote: string;
  onWrite: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}): JSX.Element {
  const [value, setValue] = useSyncedDraft(remote, onWrite);
  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`${INPUT} ${className}`}
    />
  );
}

function ShiftPatients({
  shift,
  remote,
  onWrite,
}: {
  shift: MrShift;
  remote: string;
  onWrite: (text: string) => void;
}): JSX.Element {
  const [text, setText] = useSyncedDraft(remote, onWrite);
  const parsed = useMemo(() => parsePatients(text), [text]);
  const count = parsed.patients.length;
  const filled = text.trim().length > 0;
  return (
    /*
      A column whose textarea GROWS to fill it. The Dinas and Jaga cards share
      a grid row, so they always have the same height; a textarea with its own
      fixed height left the shorter one ending above its card's edge, and
      dragging one box's resize handle moved the other card but not its box.
    */
    <label className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface focus-within:border-accent">
      <span className="flex items-center gap-2 border-b border-border bg-bg-subtle px-3 py-1.5 text-xs font-medium">
        <span className="flex-1">{partLabel(shift.part)}</span>
        <span className="sr-only">{shiftLabel(shift)}</span>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
            filled ? 'bg-[var(--accent-soft)] text-accent' : 'bg-surface text-fg-faint ring-1 ring-border',
          ].join(' ')}
        >
          {filled ? `${count} pasien` : 'Tidak ada pasien'}
        </span>
      </span>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={filled ? Math.min(12, text.split('\n').length + 1) : 2}
        placeholder="1. Tn. … / tgl lahir / umur / RM … / ruangan / DPJP : …&#10;Diagnosis:&#10;- …"
        className="block w-full grow resize-y bg-surface px-3 py-2 font-mono text-[12px] text-fg outline-none placeholder:text-fg-faint"
      />
      {parsed.unplaced.length > 0 ? (
        <span className="block border-t border-border px-3 py-1.5 text-[11px] text-danger">
          {parsed.unplaced.length} baris sebelum pasien pertama ikut disalin apa adanya — hapus bila
          bukan bagian laporan.
        </span>
      ) : null}
      {filled && count === 0 ? (
        <span className="block border-t border-border px-3 py-1.5 text-[11px] text-danger">
          Tidak ada baris yang terbaca sebagai pasien; teks disalin apa adanya.
        </span>
      ) : null}
    </label>
  );
}

function MessageBox({
  label,
  sub,
  text,
  extra,
  save,
}: {
  label: string;
  sub?: string;
  text: string;
  /** Where Simpan files it (see `domain/helperResults`). */
  save?: { kind: HelperResultKind; forDate: string; subject: string; title: string };
  /** A control for the message's form, under the title row. */
  extra?: ReactNode;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{label}</span>
          {sub ? <span className="block truncate text-[10px] text-fg-faint">{sub}</span> : null}
        </span>
        {save ? <SaveResultButton {...save} text={text} /> : null}
        <Button
          size="sm"
          variant={copied ? 'secondary' : 'primary'}
          icon={copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
          onClick={() =>
            void copyText(text).then((ok) => {
              setCopied(ok);
              if (ok) window.setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>
      {extra ? <div className="border-b border-border px-3 py-1.5">{extra}</div> : null}
      <p className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
        {text}
      </p>
    </div>
  );
}

function MrSettings({
  uid,
  config,
}: {
  uid: string | null;
  config: ReturnType<typeof readMrConfig>;
}): JSX.Element {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex min-h-tap cursor-pointer items-center gap-2 px-3 text-sm font-medium [@media(pointer:fine)]:min-h-10">
        <IconChevronRight className="h-4 w-4 text-fg-muted transition-transform group-open:rotate-90" />
        <span className="flex-1">Pengaturan MR</span>
        <span className="text-[11px] font-normal text-fg-faint">Zoom, status, jadwal pengampu</span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3">
        <label className="block text-xs text-fg-muted">
          Blok Zoom (Meeting ID, Passcode, Host Key, link) — ditempel sekali, tersimpan di akun Anda
          saja
          <SyncedArea
            key={`zoom:${String(uid)}`}
            remote={config.zoom}
            onWrite={(value) => uid && setMrConfigField(uid, 'zoom', value)}
            rows={6}
          />
        </label>
        <label className="block text-xs text-fg-muted">
          Pilihan status kehadiran (satu per baris)
          <SyncedArea
            key={`statuses:${String(uid)}`}
            remote={config.statuses.join('\n')}
            onWrite={(value) =>
              uid &&
              setMrConfigField(
                uid,
                'statuses',
                value.split('\n').map((line) => line.trim()).filter(Boolean),
              )
            }
            rows={4}
            list
          />
        </label>
        <ImportFromSent uid={uid} />
        <div className="space-y-2">
          <p className="text-xs text-fg-muted">
            Jadwal pengampu mingguan (satu nama per baris). Dipakai untuk tanggal yang daftarnya
            belum diubah.
          </p>
          {WEEKDAYS.map(([weekday, label]) => (
            <label key={weekday} className="block text-xs text-fg-muted">
              {label}
              <SyncedArea
                key={`pengampu:${weekday}:${String(uid)}`}
                remote={(config.pengampu[weekday] ?? []).join('\n')}
                onWrite={(value) =>
                  uid &&
                  setMrWeekdayPengampu(
                    uid,
                    weekday,
                    value.split('\n').map((line) => line.trim()).filter(Boolean),
                  )
                }
                rows={4}
                list
              />
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

/** Lines as stored: trimmed, blanks dropped. */
const listForm = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

/**
 * The weekly schedule taken from confirmations already sent: paste one or
 * several, and each weekday block found replaces that weekday's list. Names
 * are copied exactly as sent, titles included; statuses are ignored here
 * (they belong to the date they were sent for).
 */
function ImportFromSent({ uid }: { uid: string | null }): JSX.Element {
  const [text, setText] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const blocks = useMemo(() => parsePengampuMessage(text), [text]);
  return (
    <div className="space-y-1">
      <label className="block text-xs text-fg-muted">
        Ambil jadwal dari pesan PAKAR yang pernah dikirim (boleh beberapa sekaligus)
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDone(null);
          }}
          rows={4}
          placeholder="Pengampu MR, Senin, …:&#10;Pimpinan Morning Report terjadwal:&#10;- Dr. dr. … (menunggu konfirmasi kehadiran)"
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-fg"
        />
      </label>
      {text.trim() ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-[11px] text-fg-muted">
            {blocks.length > 0
              ? blocks
                  .map((block) => `${WEEKDAYS[block.weekday - 1]?.[1] ?? '?'}: ${block.pengampu.length} nama`)
                  .join(' · ')
              : 'Belum terbaca: perlu baris “Pengampu MR, <hari>, …” lalu daftar bertanda - atau •.'}
          </span>
          <button
            type="button"
            disabled={!uid || blocks.length === 0}
            onClick={() => {
              if (!uid) return;
              for (const block of blocks) {
                setMrWeekdayPengampu(uid, String(block.weekday), block.pengampu.map((entry) => entry.name));
              }
              setDone(`${blocks.length} hari diperbarui.`);
              setText('');
            }}
            className="min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent disabled:opacity-40"
          >
            Pakai sebagai jadwal
          </button>
        </div>
      ) : null}
      {done ? <p className="text-[11px] text-fg-muted">{done}</p> : null}
    </div>
  );
}

function SyncedArea({
  remote,
  onWrite,
  rows,
  list = false,
}: {
  remote: string;
  onWrite: (value: string) => void;
  rows: number;
  /** Stored as a list: an echo that differs only in blank lines is not a change. */
  list?: boolean;
}): JSX.Element {
  const [value, setValue] = useSyncedDraft(
    remote,
    onWrite,
    800,
    list ? (a, b) => listForm(a) === listForm(b) : undefined,
  );
  return (
    <textarea
      value={value}
      onChange={(event) => setValue(event.target.value)}
      rows={rows}
      className="mt-1 block w-full rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-fg outline-none focus:border-accent"
    />
  );
}
