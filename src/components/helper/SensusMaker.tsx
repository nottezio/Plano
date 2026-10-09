import { useEffect, useMemo, useRef, useState } from 'react';

import { DateField } from '@/components/common/DateField';
import { DPJPS } from '@/domain/dpjp';
import { IconCheck, IconCopy, IconPlus, IconSearch, IconSparkle, IconTrash } from '@/components/common/Icons';
import { Button, Callout, ChipRow, ChoiceChip, Field, Section, Segmented } from '@/components/common/ui';
import { updateSettings } from '@/data/repositories/settings.repo';
import { useSession } from '@/store/useSession';
import {
  PLACE_LABEL,
  PLACE_ORDER,
  coveredPlaces,
  entriesFor,
  type Place,
  SENSUS_AI_TOOL,
  SOURCE_LABEL,
  buildCensus,
  dpjpCounts,
  dpjpFullName,
  formatCensus,
  identityLine,
  type AiCheck,
  type CensusEntry,
  knownCodes,
  parseSource,
  aiGroups,
  checkAiCensus,
  readAiPatients,
  type AiPatient,
  sensusAiPrompt,
  sensusAiSystem,
  unassigned,
  type ParsedSource,
  type SourceKind,
} from '@/domain/census/maker';
import {
  SENSUS_STORE_KEY,
  SENSUS_STORE_V1_KEY,
  dayOf,
  emptyDay,
  emptyStore,
  findAll,
  lineAt,
  readSensusStore,
  storedDays,
  withDay,
  type SensusDay,
  type SensusList,
  type SensusStore,
} from '@/domain/census/makerStore';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { AiError, aiEnabled, askClaudeStructured } from '@/lib/ai';
import { copyText } from '@/lib/clipboard';
import { formatDmy } from '@/domain/dateDmy';
import { SaveResultButton } from './SaveResult';

/**
 * Buat Sensus — one DPJP's patients, from the lists the wards send.
 *
 * The lists stay on THIS DEVICE (localStorage), never in the synced profile:
 * they hold every patient in the hospital, a few tens of KB each, and they
 * are worth a day or two. Kept per tanggal sensus (`domain/census/makerStore`),
 * so a reload or a trip to WhatsApp mid-paste loses nothing and each day has
 * its own boxes; dropped after a week.
 *
 * The finished census is what goes to the account: Simpan files it under
 * Tersimpan (`domain/helperResults`), synced to every device.
 */

function loadStore(today: string): SensusStore {
  try {
    return readSensusStore(
      localStorage.getItem(SENSUS_STORE_KEY),
      localStorage.getItem(SENSUS_STORE_V1_KEY),
      today,
    );
  } catch {
    return emptyStore();
  }
}

function saveStore(store: SensusStore): void {
  try {
    localStorage.setItem(SENSUS_STORE_KEY, JSON.stringify(store));
    localStorage.removeItem(SENSUS_STORE_V1_KEY);
  } catch {
    // Private mode or full storage: the page still works, it just forgets.
  }
}

const KIND_OPTIONS: ReadonlyArray<readonly [SourceKind | 'auto', string]> = [
  ['auto', 'Otomatis'],
  ['pjt-ward', SOURCE_LABEL['pjt-ward']],
  ['pjt-icu', SOURCE_LABEL['pjt-icu']],
  ['pjt-igd', SOURCE_LABEL['pjt-igd']],
  ['rsws', SOURCE_LABEL.rsws],
  ['rsuh', SOURCE_LABEL.rsuh],
];

export function SensusMaker(): JSX.Element {
  const today = useClinicalToday();
  const [store, setStore] = useState<SensusStore>(() => loadStore(today));
  // The boxes shown are this date's: each tanggal sensus has its own lists.
  const [censusDate, setCensusDate] = useState(today);
  const day = dayOf(store, censusDate);
  const state = { ...store, lists: day.lists };
  const mode = store.mode;
  const setMode = (next: 'aturan' | 'ai'): void => setStore((current) => ({ ...current, mode: next }));
  const [aiRunning, setAiRunning] = useState(false);
  const [aiErrorText, setAiErrorText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const aiOn = aiEnabled('sensus');
  const uid = useSession((s) => s.user?.uid ?? null);
  const mine = useSession((s) => s.settings().sensusDpjps) ?? [];
  const [showAll, setShowAll] = useState(false);
  const setMine = (next: string[]): void => {
    if (uid) void updateSettings(uid, { sensusDpjps: next });
  };

  useEffect(() => saveStore(store), [store]);

  const filled = state.lists.filter((list) => list.text.trim());
  const sources: ParsedSource[] = useMemo(() => {
    const kinds = filled.map((list) => (list.kind === 'auto' ? undefined : list.kind));
    const first = filled.map((list, index) => parseSource(list.text, undefined, kinds[index]));
    const known = knownCodes(first);
    return filled.map((list, index) => parseSource(list.text, known, kinds[index]));
    // `filled` is derived from state.lists on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.lists]);

  const allCounts = useMemo(() => dpjpCounts(sources), [sources]);
  /**
   * Each resident sends their own DPJP's census only. With "DPJP saya" set,
   * the chips are those codes — shown even at 0 patients, because "0 pasien"
   * is still a census that has to go out.
   */
  const filtering = mine.length > 0 && !showAll;
  const counts = filtering
    ? mine.map((c) => ({ code: c, count: allCounts.find((row) => row.code === c)?.count ?? 0 }))
    : allCounts;
  const missing = useMemo(() => unassigned(sources), [sources]);
  const code =
    state.code && counts.some((row) => row.code === state.code) ? state.code : (counts[0]?.code ?? '');
  const covered = useMemo(() => coveredPlaces(sources), [sources]);
  const notPasted = PLACE_ORDER.filter((place: Place) => place !== 'PJT' && !covered.includes(place));
  const therapyAsDx = useMemo(
    () => (code ? entriesFor(sources, code).filter((entry) => entry.dxWasTherapy) : []),
    [sources, code],
  );

  const rules = useMemo(
    () =>
      code && sources.length > 0
        ? buildCensus({ sources, code, date: censusDate, address: state.address, style: state.style })
        : null,
    [sources, code, censusDate, state.address, state.style],
  );

  /** What the AI result was computed from; a change makes it stale. */
  const aiKey = `${code}|${censusDate}|${state.address}|${state.style}|${filled.map((list) => list.text).join('\u0000')}`;
  const ai = code ? day.ai[code] : undefined;
  const aiCurrent = ai && ai.key === aiKey ? ai : null;
  // Built from the stored patients when there are any, so a correction made
  // from the check below shows at once; older results kept only the text.
  const aiFresh = aiCurrent
    ? aiCurrent.patients
      ? formatCensus({ code, date: censusDate, address: state.address, groups: aiGroups(aiCurrent.patients), covers: covered })
      : aiCurrent.text
    : null;
  const aiCheck = useMemo(
    () =>
      aiCurrent?.patients && rules
        ? checkAiCensus({ ai: aiCurrent.patients, rules: rules.entries, sources, texts: filled.map((list) => list.text) })
        : null,
    // `filled` follows day.lists, which `sources` already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiCurrent, rules, sources],
  );
  /** Change the AI's patient list for this DPJP (the check's one-tap fixes). */
  const editAi = (change: (patients: AiPatient[]) => AiPatient[]): void => {
    if (!code || !aiCurrent?.patients) return;
    const patients = change(aiCurrent.patients);
    updateDay((current) => ({ ...current, ai: { ...current.ai, [code]: { ...aiCurrent, patients } } }));
  };
  const usingAi = mode === 'ai' && aiOn;
  const shown = usingAi ? aiFresh : (rules?.text ?? null);

  const update = (patch: Partial<Pick<SensusStore, 'code' | 'address' | 'style'>>): void =>
    setStore((current) => ({ ...current, ...patch }));
  /** Change this date's boxes (and nothing of any other date's). */
  const updateDay = (change: (current: SensusDay) => SensusDay): void =>
    setStore((current) => withDay(current, censusDate, change(dayOf(current, censusDate))));
  const setLists = (change: (lists: SensusList[]) => SensusList[]): void =>
    updateDay((current) => {
      const lists = change(current.lists);
      return { ...current, lists: lists.length > 0 ? lists : emptyDay().lists };
    });
  const setList = (index: number, patch: Partial<SensusList>): void =>
    setLists((lists) => lists.map((list, i) => (i === index ? { ...list, ...patch } : list)));
  const otherDays = storedDays(store).filter((entry) => entry.date !== censusDate);
  const areas = useRef(new Map<number, HTMLTextAreaElement>());
  // Which box's find bar is open (one at a time; reset when the day changes).
  const [findIn, setFindIn] = useState<number | null>(null);
  useEffect(() => setFindIn(null), [censusDate]);

  const runAi = async (): Promise<void> => {
    if (!code || filled.length === 0) return;
    setAiRunning(true);
    setAiErrorText(null);
    try {
      const { input, truncated } = await askClaudeStructured({
        system: sensusAiSystem(),
        tool: SENSUS_AI_TOOL,
        prompt: sensusAiPrompt({
          code,
          texts: filled.map((list) => list.text),
          style: state.style,
          candidates: rules?.entries ?? [],
          noCode: missing,
        }),
        maxTokens: 8000,
      });
      const patients = readAiPatients(input);
      if (truncated) setAiErrorText('Jawaban AI terpotong; sebagian pasien mungkin hilang. Bandingkan dengan mode Aturan.');
      const text = formatCensus({ code, date: censusDate, address: state.address, groups: aiGroups(patients), covers: covered });
      // Kept with the day, so leaving the tab or reloading does not lose it.
      updateDay((current) => ({ ...current, ai: { ...current.ai, [code]: { key: aiKey, text, patients } } }));
    } catch (error) {
      setAiErrorText(error instanceof AiError ? error.message : 'Gagal memanggil AI.');
    } finally {
      setAiRunning(false);
    }
  };

  const ruleCount = rules?.entries.length ?? 0;
  const kjsCount = usingAi
    ? (aiCurrent?.patients?.filter((patient) => patient.kjs).length ?? 0)
    : (rules?.entries.filter((entry) => entry.kjs).length ?? 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Section
          title="1 · Tempel list ruangan"
          hint="Satu kotak per pesan: PJT Lantai 4, Lantai 5 dan 6, CVCU/HCU/ICU, RSWS, RSUH — tempel apa adanya. Jenis list dikenali dari judulnya. Kotak-kotak ini milik tanggal sensus di atas: tiap tanggal punya kotaknya sendiri. Tersimpan di perangkat ini saja, 7 hari."
        >
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Tanggal sensus">
              <DateField value={censusDate} onChange={setCensusDate} className="w-40" />
            </Field>
            {censusDate !== today ? (
              <Button size="sm" variant="ghost" onClick={() => setCensusDate(today)}>
                Hari ini
              </Button>
            ) : null}
            {/* Other days that still have lists on this device. */}
            {otherDays.map((entry) => (
              <ChoiceChip key={entry.date} active={false} onClick={() => setCensusDate(entry.date)}>
                {formatDmy(entry.date)} · {entry.lists} list
              </ChoiceChip>
            ))}
          </div>
          <div className="space-y-3">
            {state.lists.map((list, index) => {
              const parsed = list.text.trim() ? sources[filled.indexOf(list)] : undefined;
              return (
                <div key={index} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs">
                      <span className="font-semibold">List {index + 1}</span>
                      {parsed ? (
                        <span className="text-fg-muted">
                          {' '}
                          · {parsed.label} · {parsed.entries.length} pasien
                        </span>
                      ) : null}
                    </span>
                    {list.text.trim() ? (
                      <button
                        type="button"
                        aria-label={`Cari di list ${index + 1}`}
                        aria-pressed={findIn === index}
                        onClick={() => setFindIn(findIn === index ? null : index)}
                        className={`flex min-h-tap min-w-tap items-center justify-center rounded-lg hover:bg-bg-subtle [@media(pointer:fine)]:min-h-8 ${findIn === index ? 'text-accent' : 'text-fg-faint'}`}
                      >
                        <IconSearch className="h-4 w-4" />
                      </button>
                    ) : null}
                    <select
                      aria-label={`Jenis list ${index + 1}`}
                      value={list.kind}
                      onChange={(event) => setList(index, { kind: event.target.value as SourceKind | 'auto' })}
                      className="min-h-tap w-28 shrink-0 rounded-lg border border-border bg-surface px-2 text-xs sm:w-auto [@media(pointer:fine)]:min-h-8"
                    >
                      {KIND_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Hapus list ${index + 1}`}
                      onClick={() => setLists((lists) => lists.filter((_, i) => i !== index))}
                      className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-faint hover:bg-[var(--danger-soft)] hover:text-danger [@media(pointer:fine)]:min-h-8"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                  {parsed && parsed.kind === 'unknown' ? (
                    <p className="border-b border-border bg-[var(--warn-soft)] px-3 py-1 text-[11px]">
                      Jenis list tidak dikenali dari judulnya — pilih di kanan atas.
                    </p>
                  ) : null}
                  {findIn === index && list.text.trim() ? (
                    <ListFind
                      text={list.text}
                      area={() => areas.current.get(index) ?? null}
                      label={`list ${index + 1}`}
                      onClose={() => setFindIn(null)}
                    />
                  ) : null}
                  <textarea
                    ref={(node) => {
                      if (node) areas.current.set(index, node);
                      else areas.current.delete(index);
                    }}
                    value={list.text}
                    onChange={(event) => setList(index, { text: event.target.value })}
                    rows={list.text ? 6 : 3}
                    placeholder="Tempel list di sini…"
                    aria-label={`Isi list ${index + 1}`}
                    spellCheck={false}
                    // Filled lists stay short on a phone: five pasted lists at full
                    // height put the census a dozen screens down. Resizable.
                    className={`block w-full resize-y bg-transparent px-3 py-2 font-mono text-xs leading-relaxed outline-none placeholder:font-sans placeholder:text-fg-faint ${list.text ? 'max-h-24 focus:max-h-none sm:max-h-none' : ''}`}
                  />
                </div>
              );
            })}
            <Button
              size="sm"
              icon={<IconPlus className="h-4 w-4" />}
              onClick={() => setLists((lists) => [...lists, { text: '', kind: 'auto' }])}
            >
              List lain
            </Button>
          </div>
        </Section>

        <Section
          title="2 · DPJP"
          aside={
            mine.length > 0 ? (
              <Segmented
                label="DPJP yang ditampilkan"
                size="sm"
                value={showAll ? 'semua' : 'saya'}
                onChange={(value) => setShowAll(value === 'semua')}
                options={[
                  ['saya', 'DPJP saya'],
                  ['semua', 'Semua'],
                ]}
              />
            ) : null
          }
        >
          {counts.length === 0 ? (
            <p className="text-xs text-fg-faint">Tempel minimal satu list untuk melihat DPJP-nya.</p>
          ) : (
            <ChipRow>
              {counts.map((row) => (
                <ChoiceChip key={row.code} active={row.code === code} onClick={() => update({ code: row.code })}>
                  {mine.includes(row.code) ? <span aria-label="DPJP saya">★ </span> : null}
                  {row.code} <span className="opacity-70">· {row.count}</span>
                </ChoiceChip>
              ))}
            </ChipRow>
          )}
          {/* Which DPJP is "mine": synced with the account, so every device
              opens on the same census. */}
          <div className="flex flex-wrap items-center gap-2">
            {code ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={!uid}
                onClick={() => setMine(mine.includes(code) ? mine.filter((c) => c !== code) : [...mine, code])}
              >
                {mine.includes(code) ? `Hapus ${code} dari DPJP saya` : `★ Jadikan ${code} DPJP saya`}
              </Button>
            ) : null}
            <select
              aria-label="Tambah DPJP saya"
              value=""
              disabled={!uid}
              onChange={(event) => {
                const next = event.target.value;
                if (next && !mine.includes(next)) {
                  setMine([...mine, next]);
                  setShowAll(false);
                  update({ code: next });
                }
              }}
              className="min-h-tap max-w-[16rem] rounded-lg border border-border bg-surface px-2 text-xs text-fg-muted [@media(pointer:fine)]:min-h-8"
            >
              <option value="">+ DPJP saya…</option>
              {DPJPS.filter((dpjp) => !mine.includes(dpjp.initials)).map((dpjp) => (
                <option key={dpjp.id} value={dpjp.initials}>
                  {dpjp.initials} — {dpjp.name}
                </option>
              ))}
            </select>
          </div>
          {mine.length === 0 ? (
            <p className="text-[11px] text-fg-faint">
              Tandai DPJP yang ditugaskan ke Anda (mis. ARB): hanya itu yang tampil, di semua perangkat Anda.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Sapaan">
              <Segmented
                label="Sapaan"
                size="sm"
                value={state.address}
                onChange={(address) => update({ address })}
                options={[
                  ['dokter', 'Dokter'],
                  ['prof', 'Prof'],
                ]}
              />
            </Field>
            <Field label="Baris pasien">
              <Segmented
                label="Baris pasien"
                size="sm"
                value={state.style}
                onChange={(style) => update({ style })}
                options={[
                  ['asis', 'Apa adanya'],
                  ['front', 'Kode di depan'],
                ]}
              />
            </Field>
          </div>
          {sources.length > 0 && notPasted.length > 0 ? (
            <p className="text-[11px] text-fg-muted">
              Belum ditempel: {notPasted.map((place) => PLACE_LABEL[place]).join(', ')}. Tidak dicantumkan di sensus
              (bukan &quot;0 pasien&quot;).
            </p>
          ) : null}
          {therapyAsDx.length > 0 ? (
            <Callout tone="warn" title="Blok diagnosis berisi terapi">
              {therapyAsDx.map((entry) => entry.asWritten).join('; ')} — ditulis &quot;-&quot;. Isi diagnosisnya
              sebelum dikirim.
            </Callout>
          ) : null}
          {missing.length > 0 ? (
            <Callout tone="warn" title={`${missing.length} pasien tanpa DPJP di list`}>
              <ul className="mt-1 space-y-0.5">
                {missing.map((entry, index) => (
                  <li key={`${entry.key}:${index}`} className="truncate">
                    {PLACE_LABEL[entry.place]} · {entry.location ? `${entry.location} · ` : ''}
                    {entry.rest}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Tidak masuk sensus siapa pun. Tambahkan kode DPJP di barisnya bila perlu.</p>
            </Callout>
          ) : null}
        </Section>
      </div>

      <aside className="min-w-0 space-y-3 lg:sticky lg:top-4">
        {aiOn ? (
          <Segmented
            label="Cara menyusun"
            value={mode}
            onChange={setMode}
            options={[
              ['aturan', 'Aturan'],
              ['ai', 'AI'],
            ]}
          />
        ) : null}

        {mode === 'ai' && aiOn ? (
          <Callout
            tone={aiErrorText ? 'danger' : 'info'}
            title={aiErrorText ?? 'AI membaca list dan memilih pasien; formatnya tetap sama.'}
            action={
              <Button
                size="sm"
                variant="primary"
                icon={<IconSparkle className="h-4 w-4" />}
                disabled={aiRunning || !code || filled.length === 0}
                onClick={() => void runAi()}
              >
                {aiRunning ? 'Menyusun…' : ai ? 'Susun ulang' : 'Susun dengan AI'}
              </Button>
            }
          >
            {`Semua list dikirim ke AI. Periksa sebelum dikirim — mode Aturan menemukan ${ruleCount} pasien.`}
          </Callout>
        ) : null}

        {usingAi && aiCheck ? (
          <AiCheckPanel
            check={aiCheck}
            onRemove={(index) => editAi((patients) => patients.filter((_, i) => i !== index))}
            onAdd={(entry) =>
              editAi((patients) => [
                ...patients,
                {
                  place: entry.place,
                  identity: identityLine(entry, code, state.style),
                  diagnoses: entry.diagnoses,
                  rm: entry.key.startsWith('rm:') ? entry.key.slice(3) : '',
                  sourceLine: entry.raw,
                  dpjpFrom: entry.fromHeader ? 'judul_bagian' : 'baris',
                  kjs: entry.kjs ?? '',
                },
              ])
            }
            onUseDx={(index, entry) =>
              editAi((patients) => patients.map((p, i) => (i === index ? { ...p, diagnoses: entry.diagnoses } : p)))
            }
          />
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                Sensus {code ? dpjpFullName(code) : ''}
              </span>
              <span className="block truncate text-[10px] text-fg-faint">
                {usingAi
                  ? `Disusun AI${aiCurrent?.patients ? ` · ${aiCurrent.patients.length} pasien` : ''}`
                  : `${ruleCount} pasien · disusun dengan aturan`}
                {kjsCount > 0 ? ` · ${kjsCount} KJS` : ''}
              </span>
            </span>
            {/* The AI census is its own saved record ("ARB AI"), so saving it
                never overwrites the rules version, and both can be compared. */}
            <SaveResultButton
              kind="sensus"
              forDate={censusDate}
              subject={usingAi ? `${code} AI` : code}
              title={`Sensus ${code ? dpjpFullName(code) : ''}${usingAi ? ' (AI)' : ''}`.trim()}
              text={shown ?? ''}
              disabled={!shown || !code}
            />
            <Button
              size="sm"
              variant={copied ? 'secondary' : 'primary'}
              disabled={!shown}
              icon={copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
              onClick={() =>
                shown &&
                void copyText(shown).then((ok) => {
                  setCopied(ok);
                  if (ok) window.setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
          <p className="max-h-[70vh] overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
            {shown ??
              (usingAi
                ? ai
                  ? 'List, DPJP, sapaan atau tanggal berubah sejak hasil AI terakhir. Tekan "Susun ulang".'
                  : 'Tekan "Susun dengan AI".'
                : 'Tempel list dan pilih DPJP; sensusnya muncul di sini.')}
          </p>
        </div>
      </aside>
    </div>
  );
}

/**
 * Find in one pasted list: a patient's name, an RM, a DPJP code.
 *
 * The matches are listed as the LINES they are on, so on a phone the answer
 * is readable without opening the keyboard over a five-screen paste. Tapping
 * one selects it in the box and scrolls the box to it.
 */
function ListFind({
  text,
  area,
  label,
  onClose,
}: {
  text: string;
  area: () => HTMLTextAreaElement | null;
  label: string;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => findAll(text, query), [text, query]);
  const shown = hits.slice(0, 30);

  const jump = (start: number, end: number): void => {
    const node = area();
    if (!node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(start, end);
    // Lines before the match times the line height: wrapped lines make it
    // approximate, so the match is put a third of the way down, not at the edge.
    const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 18;
    const line = text.slice(0, start).split('\n').length - 1;
    node.scrollTop = Math.max(0, line * lineHeight - node.clientHeight / 3);
  };

  return (
    <div className="space-y-1 border-b border-border bg-bg-subtle px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter' && hits[0]) jump(hits[0][0], hits[0][1]);
          }}
          placeholder="Cari nama, RM, kode DPJP…"
          aria-label={`Teks yang dicari di ${label}`}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs outline-none focus:border-accent [@media(pointer:fine)]:min-h-8"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-fg-muted" aria-live="polite">
          {query.trim() ? `${hits.length} ditemukan` : ''}
        </span>
      </div>
      {shown.length > 0 ? (
        <ul className="max-h-40 overflow-auto">
          {shown.map(([start, end]) => (
            <li key={start}>
              <button
                type="button"
                onClick={() => jump(start, end)}
                className="block min-h-tap w-full truncate rounded px-1 text-left font-mono text-[11px] text-fg-muted hover:bg-surface hover:text-fg [@media(pointer:fine)]:min-h-8"
              >
                {lineAt(text, start).trim() || '(baris kosong)'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hits.length > shown.length ? (
        <p className="text-[10px] text-fg-faint">{hits.length - shown.length} lagi — persempit pencarian.</p>
      ) : null}
    </div>
  );
}

/**
 * The AI census checked against the rules (`checkAiCensus`).
 *
 * Neither side is assumed right: the rules miss list shapes they have not
 * seen, the AI can claim a patient nobody assigned. Each difference says what
 * the other side made of that patient, and fixes the AI result in one tap —
 * the message above is rebuilt from the corrected list.
 */
function AiCheckPanel({
  check,
  onRemove,
  onAdd,
  onUseDx,
}: {
  check: AiCheck;
  onRemove: (index: number) => void;
  onAdd: (entry: CensusEntry) => void;
  onUseDx: (index: number, entry: CensusEntry) => void;
}): JSX.Element {
  const differences = check.onlyAi.length + check.onlyRules.length + check.dxMissing.length;
  if (differences === 0) {
    return (
      <Callout tone="info" role="status" title={`Dicek dengan Aturan: ${check.matched} pasien cocok, tidak ada selisih.`}>
        Tetap periksa diagnosisnya sebelum dikirim.
      </Callout>
    );
  }
  const row = 'flex items-start gap-2 border-t border-border py-1.5 first:border-t-0';
  return (
    <div role="alert" className="space-y-1 rounded-xl border border-[var(--warn-strong)] bg-[var(--warn-soft)] px-3 py-2 text-xs">
      <p className="font-semibold">
        Dicek dengan Aturan: {check.matched} cocok · {differences} selisih
      </p>
      <p className="text-[11px] text-fg-muted">
        Belum tentu AI yang salah — Aturan juga bisa melewatkan format baru. Periksa list aslinya untuk tiap baris.
      </p>
      <ul>
        {check.onlyAi.map(({ index, patient, rules, inLists }) => (
          <li key={`ai-${index}`} className={row}>
            <span className="min-w-0 flex-1">
              <span className={`font-medium ${inLists ? '' : 'text-danger'}`}>Hanya AI</span> · {patient.identity}
              <span className="block text-[11px] text-fg-muted">{rules}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onRemove(index)}>
              Buang
            </Button>
          </li>
        ))}
        {check.onlyRules.map((entry) => (
          <li key={`rules-${entry.key}`} className={row}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">Hanya Aturan</span> · {entry.asWritten}
              <span className="block text-[11px] text-fg-muted">AI tidak memasukkan pasien ini.</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onAdd(entry)}>
              Tambahkan
            </Button>
          </li>
        ))}
        {check.dxMissing.map(({ index, entry }) => (
          <li key={`dx-${index}`} className={row}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">Diagnosis kosong di AI</span> · {entry.asWritten}
              <span className="block text-[11px] text-fg-muted">Aturan membaca {entry.diagnoses.length} diagnosis.</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onUseDx(index, entry)}>
              Pakai diagnosis Aturan
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
