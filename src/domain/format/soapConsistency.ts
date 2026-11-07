import { daysBetween, findDayMarkers } from '@/domain/dayMarkers';
import type { FrozenRange } from './frozenText';
import { isFrozen } from './frozenText';
import type { SoapFinding, UrineReading } from './soapCheck';

/**
 * Checks of a note against itself and its own record (batch of 7 Nov 2026).
 *
 * Same contract as the rest of the checker: each fires on a mismatch between
 * things actually written and is silent on any shape it does not recognise.
 * A missed finding is a note the author was already reading; an invented one is
 * how a checker stops being read.
 */

const number = (text: string): number => Number(text.replace(',', '.'));

const TITLES = new Set(['tn', 'ny', 'nn', 'nona', 'an', 'by', 'bayi', 'sdr', 'sdri', 'bpk', 'bapak', 'ibu', 'dr', 'drg', 'prof', 'hj', 'ir']);

/** Words that name a person: titles and initials say nothing about who it is. */
function nameWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !TITLES.has(word));
}

const digitsOf = (text: string): string => text.replace(/\D/g, '').replace(/^0+/, '');

const IDENTITY_RM = /\bRM\s*:?\s*(\d{4,})/i;

/**
 * THE WRONG CHART: the identity line names someone other than this patient,
 * which is what a note pasted from another patient looks like.
 *
 * Only the first RM in the note: a later one may be a quoted referral. The name
 * is compared only when it sits behind a `/` or `,` before the RM, and three
 * shared letters count as the same word, so `Rosnaeni` and `Rosnaini` agree.
 */
export function checkIdentity(body: string, record: { name?: string | undefined; mrn?: string | undefined }): SoapFinding[] {
  const lineMatch = new RegExp(`^.*${IDENTITY_RM.source}.*$`, 'im').exec(body);
  if (!lineMatch) return [];
  const line = lineMatch[0];
  const rm = IDENTITY_RM.exec(line);
  const written = rm?.[1];
  if (!rm || !written) return [];
  const at = lineMatch.index + rm.index;

  const registered = digitsOf(record.mrn ?? '');
  if (registered && digitsOf(written) !== registered) {
    return [{ kind: 'identity-mismatch', level: 'cek', message: `RM di catatan (${written}) beda dengan data pasien (${record.mrn ?? ''}). Ini catatan pasien yang benar?`, anchor: rm[0], at }];
  }

  const before = line.slice(0, rm.index);
  const cut = before.search(/[/,]/);
  if (cut < 0) return [];
  const inNote = nameWords(before.slice(0, cut));
  const inRecord = nameWords(record.name ?? '');
  if (inNote.length === 0 || inRecord.length === 0) return [];
  if (inNote.some((word) => inRecord.some((other) => word.slice(0, 3) === other.slice(0, 3)))) return [];
  const shown = before.slice(0, cut).replace(/[*_]/g, '').trim();
  return [{ kind: 'identity-mismatch', level: 'cek', message: `Nama di catatan (${shown}) beda dengan data pasien (${(record.name ?? '').trim()}). Ini catatan pasien yang benar?`, anchor: shown, at: lineMatch.index + before.indexOf(shown) }];
}

/** Half a unit of the last decimal written, so `0.8` agrees with 0.83 and `0.83` with 0.834. */
function roundingOf(text: string): number {
  const decimals = /[.,](\d+)$/.exec(text)?.[1]?.length ?? 0;
  return 0.5 * 10 ** -decimals + 1e-9;
}

/** `Urine output 1100 cc/24 jam/55kg: 0.83 cc/kgbb/jam`: the rate recomputed from the same line. */
export function checkUrineArithmetic(urine: UrineReading | null): SoapFinding[] {
  if (!urine || urine.rate === null) return [];
  const hours = /(\d+(?:[.,]\d+)?)\s*jam/i.exec(urine.text)?.[1];
  const weight = /(\d+(?:[.,]\d+)?)\s*kg\b/i.exec(urine.text)?.[1];
  const rateText = /(\d+(?:[.,]\d+)?)\s*(?:cc|ml)\s*\/\s*kg/i.exec(urine.text)?.[1];
  if (!hours || !weight || !rateText || !(number(hours) > 0) || !(number(weight) > 0)) return [];
  const expected = urine.volume / number(hours) / number(weight);
  if (Math.abs(expected - urine.rate) <= roundingOf(rateText)) return [];
  return [
    {
      kind: 'arithmetic',
      level: 'cek',
      message: `Urine output tertulis ${String(urine.rate)} cc/kgBB/jam, tapi ${String(urine.volume)} cc/${hours} jam/${weight} kg = ${expected.toFixed(2)}.`,
      anchor: urine.text.slice(0, 4),
      at: urine.at,
    },
  ];
}

/** `1.500` and `1,500` are thousands in a volume; a volume has no decimals worth keeping here. */
const AMOUNT = '(\\d{1,3}[.,]\\d{3}|\\d+)';
const amount = (text: string | undefined): number => Number((text ?? '').replace(/[.,]/g, ''));
const part = (line: string, names: string): number | null => {
  const found = new RegExp(`\\b(?:${names})\\s*:?\\s*${AMOUNT}`, 'i').exec(line);
  return found ? amount(found[1]) : null;
};

/** One balance line with both sides and a written total. Any other shape is left alone. */
export function checkBalanceArithmetic(body: string): SoapFinding[] {
  let offset = 0;
  for (const line of body.split('\n')) {
    const start = offset;
    offset += line.length + 1;
    if (!/\bbalan(?:ce|s)\b/i.test(line)) continue;
    const input = part(line, 'input|intake|masuk');
    const output = part(line, 'output|keluar');
    const total = new RegExp(`=\\s*\\(?\\s*([+-])?\\s*\\)?\\s*${AMOUNT}(?!.*=)`).exec(line);
    if (input === null || output === null || !total) continue;
    const expected = input + (part(line, 'air\\s+metabolisme|AM') ?? 0) - output - (part(line, 'IWL') ?? 0);
    const written = (total[1] === '-' ? -1 : 1) * amount(total[2]);
    if (Math.abs(expected - written) <= 1) continue;
    const signed = expected > 0 ? `+${String(expected)}` : String(expected);
    return [
      {
        kind: 'arithmetic',
        level: 'cek',
        message: `Balance tertulis ${total[0].replace(/^=\s*/, '')} cc, tapi angka di barisnya menghasilkan ${signed} cc.`,
        anchor: line.trim(),
        at: start + line.indexOf(line.trim()),
      },
    ];
  }
  return [];
}

/** `07-11-2026`, `7/11/2026`, `07-11`: an ISO date, in the note's year when none is written. */
function isoFrom(day: string, month: string, year: string | undefined, noteDate: string): string {
  const fullYear = year ? (year.length === 2 ? `20${year}` : year) : noteDate.slice(0, 4);
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const DATE = '(\\d{1,2})[-/](\\d{1,2})(?:[-/](\\d{4}|\\d{2}))?';

/** Words that say how, not what: what is left of a plan line names the test. */
const NOT_A_TEST = new Set(['cek', 'periksa', 'rencana', 'ulang', 'dan', 'darah', 'serum', 'lab', 'laboratorium', 'tanggal', 'tgl', 'hasil', 'pemeriksaan']);

/**
 * A test planned for a day already past, with no trace of it outside the Plan.
 *
 * Past days only: a test dated today is normally still pending at the morning
 * round, and this would fire on every fresh plan. Any mention of the test
 * outside the Plan silences it, because a result is written in many shapes.
 */
export function checkPlannedResult(
  body: string,
  plan: ReadonlyArray<{ line: string; offset: number }>,
  frozen: readonly FrozenRange[],
  noteDate: string,
): SoapFinding[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) return [];
  const planOffsets = new Set(plan.map(({ offset }) => offset));
  let cursor = 0;
  const outside: string[] = [];
  for (const line of body.split('\n')) {
    if (!planOffsets.has(cursor)) outside.push(line.toLowerCase());
    cursor += line.length + 1;
  }
  const elsewhere = outside.join('\n');

  const findings: SoapFinding[] = [];
  for (const { line, offset } of plan) {
    if (!/^[\s\-•*_]*(?:rencana\s+)?(?:cek|periksa)\b/i.test(line)) continue;
    if (/\b(?:batal|dibatalkan|tunda|ditunda|stop|sudah|selesai)\b/i.test(line)) continue;
    const dated = new RegExp(`(?<![\\d/-])${DATE}(?![\\d/-])`).exec(line);
    if (!dated?.[1] || !dated[2]) continue;
    const when = isoFrom(dated[1], dated[2], dated[3], noteDate);
    const ago = daysBetween(when, noteDate);
    if (ago === null || ago <= 0) continue;
    const tests = line
      .slice(0, dated.index)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !NOT_A_TEST.has(word));
    if (tests.length === 0 || tests.some((test) => new RegExp(`\\b${test}\\b`).test(elsewhere))) continue;
    const text = line.trim();
    const at = offset + line.indexOf(text);
    if (isFrozen(frozen, at)) continue;
    findings.push({
      kind: 'planned-no-result',
      level: 'cek',
      message: `“${text.replace(/^[-•*_\s]+/, '').replace(/[*_]+$/, '')}” sudah lewat tanggalnya, tapi hasilnya belum ada di catatan.`,
      anchor: text,
      at,
    });
  }
  return findings;
}

const STARTED = new RegExp(`\\b(?:mulai|dimulai|start|sejak)\\s*(?:tgl\\.?|tanggal)?\\s*:?\\s*${DATE}`, 'i');

/** `(H-5) 6/11`: on this ward a date right after a counter is its start (Avi, 7 Nov 2026). */
const DATE_AFTER_COUNTER = new RegExp(`^\\s*\\)?\\s*[,:]?\\s*${DATE}(?![\\d/-])`);

/**
 * A day counter that disagrees with its own start date: a date right after the
 * counter, or, when the line has one counter, one marked `mulai`/`start`/`sejak`.
 * The start day may count as day 0 or day 1, since both are written.
 */
export function checkCounterAgainstStart(body: string, frozen: readonly FrozenRange[], noteDate: string): SoapFinding[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) return [];
  const findings: SoapFinding[] = [];
  let offset = 0;
  for (const line of body.split('\n')) {
    const start = offset;
    offset += line.length + 1;
    const markers = findDayMarkers(line);
    for (const marker of markers) {
      const bare = DATE_AFTER_COUNTER.exec(line.slice(marker.end));
      const named = markers.length === 1 ? STARTED.exec(line) : null;
      const date = bare ?? named;
      if (!date?.[1] || !date[2]) continue;
      const at = start + marker.start;
      if (isFrozen(frozen, at)) continue;
      const days = daysBetween(isoFrom(date[1], date[2], date[3], noteDate), noteDate);
      if (days === null || days < 0 || marker.value === days || marker.value === days + 1) continue;
      const startText = bare ? `mulai ${date[0].replace(/^[\s),:]+/, '')}` : date[0].trim();
      findings.push({
        kind: 'counter-vs-start',
        level: 'cek',
        message: `${marker.text} tidak cocok dengan ${startText}: pada tanggal catatan ini seharusnya hari ke-${String(days + 1)}.`,
        anchor: marker.text,
        at,
      });
    }
  }
  return findings;
}
