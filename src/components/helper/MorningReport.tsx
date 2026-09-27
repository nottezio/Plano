import { useEffect, useMemo, useRef, useState } from 'react';

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
  pengampuFor,
  readMrConfig,
  readMrDay,
  shiftKey,
  shiftLabel,
  staleMrDays,
  weekday,
  type MrShift,
  type Pengampu,
} from '@/domain/mr/morningReport';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { useSyncedDraft } from '@/hooks/useSyncedDraft';
import { copyText } from '@/lib/clipboard';
import { useSession } from '@/store/useSession';

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

  return (
    <section className="space-y-6">
      <p className="text-xs text-fg-muted">
        Pilih tanggal MR. Jaga yang dilaporkan, pesan ke senior, laporan Grup Prodi, dan konfirmasi
        Grup PAKAR disusun dari situ. Semua isian tersimpan di akun dan ikut ke perangkat lain.
      </p>
      {!uid ? (
        <p className="text-[11px] text-danger">Belum masuk akun: isian tidak tersimpan.</p>
      ) : null}

      {/* 1. Date and range */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">1. Tanggal MR</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-fg-muted">
            Hari MR
            <input
              type="date"
              value={mrDate}
              onChange={(event) => event.target.value && setMrDate(event.target.value)}
              className="mt-1 block min-h-tap rounded-lg border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <label className="text-xs text-fg-muted">
            Jaga mulai dari
            <input
              type="date"
              value={start}
              max={mrDate}
              onChange={(event) => {
                if (!uid || !event.target.value) return;
                const value = event.target.value;
                setMrDayField(uid, mrDate, 'start', value === defaultCoverStart(mrDate) ? null : value);
              }}
              className="mt-1 block min-h-tap rounded-lg border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
        </div>
        <p className="text-[11px] text-fg-faint">
          {longDateText(mrDate)} · {shifts.length} jaga
          {day.start ? ' (rentang diubah manual — mis. hari libur)' : ''}
          {isWeekend ? ' · Catatan: tanggal ini jatuh di akhir pekan.' : ''}
        </p>
      </div>

      {/* 2. Request to the senior */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">2. Minta list ke senior</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-xs text-fg-muted">
            Nama Anda
            <SyncedInput
              key={`sender:${String(uid)}`}
              remote={config.sender}
              onWrite={(value) => uid && setMrConfigField(uid, 'sender', value)}
              placeholder="mis. Avi"
            />
          </label>
          <label className="flex-1 text-xs text-fg-muted">
            Jaga yang diminta
            <select
              value={shiftKey(target)}
              onChange={(event) => uid && setMrDayField(uid, mrDate, 'target', event.target.value)}
              className="mt-1 block min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg"
            >
              {shifts.map((shift) => (
                <option key={shiftKey(shift)} value={shiftKey(shift)}>
                  {shiftLabel(shift)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <MessageBox
          label="Pesan ke senior"
          text={buildRequestMessage({ sender: config.sender, mrDate, shift: target })}
        />
      </div>

      {/* 3. Patients per shift */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">3. Pasien per jaga</h3>
        <p className="text-[11px] text-fg-faint">
          Tempel list dari senior apa adanya. Nomor, huruf tebal, dan “Diagnosis:” dirapikan
          otomatis; kosongkan untuk “(Tidak ada pasien)”.
        </p>
        {shifts.map((shift) => (
          <ShiftPatients
            key={`${mrDate}:${shiftKey(shift)}`}
            shift={shift}
            remote={day.patients?.[shiftKey(shift)] ?? ''}
            onWrite={(text) => uid && setMrPatients(uid, mrDate, shiftKey(shift), text)}
          />
        ))}
      </div>

      {/* 4. Pengampu */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          4. Pengampu MR {dayName(mrDate)}
          {day.pengampu ? '' : ' (jadwal mingguan)'}
        </h3>
        <ul className="space-y-2">
          {pengampu.map((entry, index) => (
            <li key={index} className="space-y-1 rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <SyncedInput
                  key={`${mrDate}:name:${index}:${pengampu.length}`}
                  remote={entry.name}
                  onWrite={(name) =>
                    setPengampu(pengampu.map((p, i) => (i === index ? { ...p, name } : p)))
                  }
                  className="flex-1"
                  ariaLabel={`Nama pengampu ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setPengampu(pengampu.filter((_, i) => i !== index))}
                  className="min-h-tap shrink-0 rounded-lg px-3 text-xs text-danger"
                  aria-label={`Hapus ${entry.name || 'pengampu'}`}
                >
                  Hapus
                </button>
              </div>
              <StatusPicker
                key={`${mrDate}:status:${index}:${pengampu.length}`}
                name={entry.name}
                status={entry.status}
                presets={config.statuses}
                onChange={(status) =>
                  setPengampu(pengampu.map((p, i) => (i === index ? { ...p, status } : p)))
                }
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPengampu([...pengampu, { name: '', status: DEFAULT_STATUS }])}
            className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
          >
            + Pengampu
          </button>
          {day.pengampu ? (
            <button
              type="button"
              onClick={() => uid && setMrDayField(uid, mrDate, 'pengampu', null)}
              className="min-h-tap rounded-lg px-3 text-xs font-medium text-fg-muted"
            >
              Kembalikan ke jadwal {dayName(mrDate)}
            </button>
          ) : null}
        </div>
      </div>

      {/* 5. Messages */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">5. Pesan</h3>
        {!config.zoom.trim() ? (
          <p className="text-[11px] text-fg-muted">
            Blok Zoom belum diisi — tambahkan di Pengaturan MR di bawah agar ikut di laporan Prodi.
          </p>
        ) : null}
        <MessageBox
          label="Laporan Grup Prodi"
          text={buildProdiMessage({
            mrDate,
            shifts,
            patients: day.patients ?? {},
            pengampu,
            zoom: config.zoom,
          })}
        />
        <MessageBox label="Konfirmasi Grup PAKAR" text={buildPakarMessage({ mrDate, pengampu })} />
      </div>

      <MrSettings uid={uid} config={config} />
    </section>
  );
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
        className="block min-h-tap w-full rounded-lg border border-border bg-surface px-2 text-xs text-fg"
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
      className={`mt-1 block min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg ${className}`}
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
  return (
    <label className="block space-y-1 rounded-lg border border-border p-2">
      <span className="flex items-center gap-2 text-xs font-medium">
        <span className="flex-1">{shiftLabel(shift)}</span>
        <span className="text-[11px] font-normal text-fg-muted">
          {text.trim() ? `${count} pasien` : 'Tidak ada pasien'}
        </span>
      </span>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={text.trim() ? Math.min(12, text.split('\n').length + 1) : 2}
        placeholder="1. Tn. … / tgl lahir / umur / RM … / ruangan / DPJP : …&#10;Diagnosis:&#10;- …"
        className="block w-full rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-[12px] text-fg"
      />
      {parsed.unplaced.length > 0 ? (
        <span className="block text-[11px] text-danger">
          {parsed.unplaced.length} baris sebelum pasien pertama ikut disalin apa adanya — hapus bila
          bukan bagian laporan.
        </span>
      ) : null}
      {text.trim() && count === 0 ? (
        <span className="block text-[11px] text-danger">
          Tidak ada baris yang terbaca sebagai pasien; teks disalin apa adanya.
        </span>
      ) : null}
    </label>
  );
}

function MessageBox({ label, text }: { label: string; text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-medium">{label}</span>
        <button
          type="button"
          onClick={() =>
            void copyText(text).then((ok) => {
              setCopied(ok);
              if (ok) window.setTimeout(() => setCopied(false), 1500);
            })
          }
          className="min-h-tap shrink-0 rounded-lg border border-accent px-3 text-xs font-medium text-accent"
        >
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <p className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted">
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
    <details className="rounded-lg border border-border p-2">
      <summary className="min-h-tap cursor-pointer py-2 text-sm font-medium">Pengaturan MR</summary>
      <div className="space-y-3 pt-2">
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
      className="mt-1 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-fg"
    />
  );
}
