import { useEffect, useMemo, useState } from 'react';

import { DateField } from '@/components/common/DateField';
import { IconCheck, IconCopy, IconPlus, IconSparkle, IconTrash } from '@/components/common/Icons';
import { Button, Callout, ChipRow, ChoiceChip, Field, Section, Segmented } from '@/components/common/ui';
import {
  PLACE_LABEL,
  SENSUS_AI_TOOL,
  SOURCE_LABEL,
  buildCensus,
  dpjpCounts,
  dpjpFullName,
  formatCensus,
  knownCodes,
  parseSource,
  readAiCensus,
  sensusAiPrompt,
  sensusAiSystem,
  unassigned,
  type CensusAddress,
  type ParsedSource,
  type SourceKind,
} from '@/domain/census/maker';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { AiError, aiEnabled, askClaudeStructured } from '@/lib/ai';
import { copyText } from '@/lib/clipboard';

/**
 * Buat Sensus — one DPJP's patients, from the lists the wards send.
 *
 * The lists stay on THIS DEVICE (localStorage), never in the synced profile:
 * they hold every patient in the hospital, a few tens of KB each, and they
 * are worth a day. Kept so a reload or a trip to WhatsApp mid-paste loses
 * nothing; dropped once their date has passed.
 */

const STORE = 'plano.sensus.v1';

interface Stored {
  date: string;
  lists: Array<{ text: string; kind: SourceKind | 'auto' }>;
  code: string;
  address: CensusAddress;
}

function load(today: string): Stored {
  const empty: Stored = { date: today, lists: [{ text: '', kind: 'auto' }], code: '', address: 'dokter' };
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    // Yesterday's lists describe yesterday's patients; start clean.
    if (parsed.date !== today || !Array.isArray(parsed.lists)) return empty;
    const lists = parsed.lists
      .filter((list) => list && typeof list.text === 'string')
      .map((list) => ({ text: list.text, kind: list.kind ?? 'auto' }));
    return {
      date: today,
      lists: lists.length > 0 ? lists : empty.lists,
      code: typeof parsed.code === 'string' ? parsed.code : '',
      address: parsed.address === 'prof' ? 'prof' : 'dokter',
    };
  } catch {
    return empty;
  }
}

function save(state: Stored): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    // Private mode or full storage: the page still works, it just forgets.
  }
}

const KIND_OPTIONS: ReadonlyArray<readonly [SourceKind | 'auto', string]> = [
  ['auto', 'Otomatis'],
  ['pjt-ward', SOURCE_LABEL['pjt-ward']],
  ['pjt-icu', SOURCE_LABEL['pjt-icu']],
  ['rsws', SOURCE_LABEL.rsws],
  ['rsuh', SOURCE_LABEL.rsuh],
];

export function SensusMaker(): JSX.Element {
  const today = useClinicalToday();
  const [state, setState] = useState<Stored>(() => load(today));
  const [censusDate, setCensusDate] = useState(today);
  const [mode, setMode] = useState<'aturan' | 'ai'>('aturan');
  const [ai, setAi] = useState<{ key: string; text: string } | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiErrorText, setAiErrorText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const aiOn = aiEnabled('sensus');

  useEffect(() => save(state), [state]);

  const filled = state.lists.filter((list) => list.text.trim());
  const sources: ParsedSource[] = useMemo(() => {
    const kinds = filled.map((list) => (list.kind === 'auto' ? undefined : list.kind));
    const first = filled.map((list, index) => parseSource(list.text, undefined, kinds[index]));
    const known = knownCodes(first);
    return filled.map((list, index) => parseSource(list.text, known, kinds[index]));
    // `filled` is derived from state.lists on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lists]);

  const counts = useMemo(() => dpjpCounts(sources), [sources]);
  const missing = useMemo(() => unassigned(sources), [sources]);
  const code = state.code && counts.some((row) => row.code === state.code) ? state.code : (counts[0]?.code ?? '');

  const rules = useMemo(
    () => (code ? buildCensus({ sources, code, date: censusDate, address: state.address }) : null),
    [sources, code, censusDate, state.address],
  );

  /** What the AI result was computed from; a change makes it stale. */
  const aiKey = `${code}|${censusDate}|${state.address}|${filled.map((list) => list.text).join('\u0000')}`;
  const aiFresh = ai && ai.key === aiKey ? ai.text : null;
  const shown = mode === 'ai' && aiOn ? aiFresh : (rules?.text ?? null);

  const update = (patch: Partial<Stored>): void => setState((current) => ({ ...current, ...patch }));
  const setList = (index: number, patch: Partial<Stored['lists'][number]>): void =>
    setState((current) => ({
      ...current,
      lists: current.lists.map((list, i) => (i === index ? { ...list, ...patch } : list)),
    }));

  const runAi = async (): Promise<void> => {
    if (!code || filled.length === 0) return;
    setAiRunning(true);
    setAiErrorText(null);
    try {
      const { input, truncated } = await askClaudeStructured({
        system: sensusAiSystem(),
        tool: SENSUS_AI_TOOL,
        prompt: sensusAiPrompt({ code, texts: filled.map((list) => list.text) }),
        maxTokens: 8000,
      });
      const groups = readAiCensus(input);
      if (truncated) setAiErrorText('Jawaban AI terpotong; sebagian pasien mungkin hilang. Bandingkan dengan mode Aturan.');
      setAi({ key: aiKey, text: formatCensus({ code, date: censusDate, address: state.address, groups }) });
    } catch (error) {
      setAiErrorText(error instanceof AiError ? error.message : 'Gagal memanggil AI.');
    } finally {
      setAiRunning(false);
    }
  };

  const ruleCount = rules?.entries.length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Section
          title="1 · Tempel list ruangan"
          hint="Satu kotak per pesan: PJT Lantai 4, Lantai 5 dan 6, CVCU/HCU/ICU, RSWS, RSUH — tempel apa adanya. Jenis list dikenali dari judulnya. Tersimpan di perangkat ini saja, dan dikosongkan besok."
        >
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
                      onClick={() =>
                        setState((current) => {
                          const lists = current.lists.filter((_, i) => i !== index);
                          return { ...current, lists: lists.length > 0 ? lists : [{ text: '', kind: 'auto' }] };
                        })
                      }
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
                  <textarea
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
              onClick={() => setState((current) => ({ ...current, lists: [...current.lists, { text: '', kind: 'auto' }] }))}
            >
              List lain
            </Button>
          </div>
        </Section>

        <Section title="2 · DPJP">
          {counts.length === 0 ? (
            <p className="text-xs text-fg-faint">Tempel minimal satu list untuk melihat DPJP-nya.</p>
          ) : (
            <ChipRow>
              {counts.map((row) => (
                <ChoiceChip key={row.code} active={row.code === code} onClick={() => update({ code: row.code })}>
                  {row.code} <span className="opacity-70">· {row.count}</span>
                </ChoiceChip>
              ))}
            </ChipRow>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Tanggal sensus">
              <DateField value={censusDate} onChange={setCensusDate} className="w-40" />
            </Field>
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
          </div>
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
                {aiRunning ? 'Menyusun…' : aiFresh ? 'Susun ulang' : 'Susun dengan AI'}
              </Button>
            }
          >
            {`Semua list dikirim ke AI. Periksa sebelum dikirim — mode Aturan menemukan ${ruleCount} pasien.`}
          </Callout>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                Sensus {code ? dpjpFullName(code) : ''}
              </span>
              <span className="block truncate text-[10px] text-fg-faint">
                {mode === 'ai' && aiOn ? 'Disusun AI' : `${ruleCount} pasien · disusun dengan aturan`}
              </span>
            </span>
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
              (mode === 'ai' && aiOn
                ? 'Tekan "Susun dengan AI".'
                : 'Tempel list dan pilih DPJP; sensusnya muncul di sini.')}
          </p>
        </div>
      </aside>
    </div>
  );
}
