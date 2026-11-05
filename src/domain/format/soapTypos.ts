import { isFrozen, type FrozenRange } from './frozenText';
import type { SoapFinding } from './soapCheck';

/**
 * Two checks for text that was typed wrong, not written wrong (2026-11-05).
 *
 * WHY NO DICTIONARY
 *
 * A spell-checker for this corpus would need Indonesian, English and a few
 * thousand drug and lab names, all abbreviated in the ward's own way (`tdk`,
 * `dgn`, `kgBB`, `TS HOM`). A general list flags half of every note and the
 * checker stops being read. So both checks only fire on a SHAPE that real
 * notes do not have, or on a word the note itself spells another way.
 *
 * Like the rest of the checker, these never edit: a finding names the word.
 * Text inside frozen ranges (finished therapy, consultants' pasted blocks) is
 * not ours to correct and is skipped.
 */

const TOKEN = /[\p{L}\p{N}]+/gu;

/** Four neighbouring keys on one row, either direction: `asdf`, `fdsa`, `uiop`. */
const KEY_RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].flatMap((row) =>
  Array.from({ length: row.length - 3 }, (_, i) => row.slice(i, i + 4)).flatMap((run) => [
    run,
    [...run].reverse().join(''),
  ]),
);

/** What may follow a number as one word: `3hari`, `120mmHg`, `6MWT`, `24jam`. */
const AFTER_NUMBER = new Set([
  'hari', 'menit', 'minggu', 'bulan', 'tahun', 'jam', 'detik', 'kali', 'tetes', 'tablet', 'tab', 'kapsul',
  'ampul', 'vial', 'mcg', 'meq', 'mmol', 'mmhg', 'bpm', 'kgbb', 'gtt', 'lpm', 'tpm', 'kcal', 'kkal', 'mwt',
]);

/** Letters, one number, letters, written in lower case, that are real: `hba1c`. */
const LETTERS_NUMBER_LETTERS = new Set(['hba1c', 'h2o', 'cmh2o', 't1dm', 't2dm']);

/**
 * True for a word that looks like keys pressed at random.
 *
 *  - lower-case letters, one number, letters (`a3e`), unless a known term
 *  - a number then 3+ letters (`3rjiwj`), unless a unit or `6MWT`
 *  - 4+ of the same letter, or 4 neighbouring keys (`aaaa`, `asdf`)
 *  - lower case with no vowel at all (`tdkdpt`), or 6 consonants in a row
 *
 * shortcut: a mash with a vowel and no keyboard run (`asjdkh`) passes; upgrade
 * when a real note shows one.
 */
function looksMashed(token: string): boolean {
  const lower = token.toLowerCase();
  if (/^\p{L}+$/u.test(token)) {
    if (token.length < 4 || /^x+$/i.test(token)) return false;
    return (
      /(\p{L})\1{3}/iu.test(token) ||
      KEY_RUNS.some((run) => lower.includes(run)) ||
      (token === lower && token.length >= 5 && (!/[aeiouy]/.test(lower) || /[^aeiouy]{6}/.test(lower)))
    );
  }
  if (/^[a-z]+\d+[a-z]+$/.test(token)) return !LETTERS_NUMBER_LETTERS.has(token);
  // `3x...` is a frequency (`3xsehari`), not a word.
  const afterNumber = /^\d+(?!x)([a-z]{3,})$/.exec(token)?.[1];
  return afterNumber !== undefined && !AFTER_NUMBER.has(afterNumber);
}

interface Word {
  text: string;
  at: number;
}

function wordsOf(text: string): Word[] {
  return [...text.matchAll(TOKEN)].map((match) => ({ text: match[0], at: match.index ?? 0 }));
}

export function checkMashed(body: string, frozen: readonly FrozenRange[]): SoapFinding[] {
  const hits = wordsOf(body).filter(({ text, at }) => !isFrozen(frozen, at) && looksMashed(text));
  const first = hits[0];
  if (!first) return [];
  const shown = hits
    .slice(0, 3)
    .map(({ text }) => `“${text}”`)
    .join(', ');
  return [
    {
      kind: 'gibberish',
      level: 'cek',
      message: `Ada teks yang tampak asal ketik: ${shown}${hits.length > 3 ? ` dan ${String(hits.length - 3)} lainnya` : ''}.`,
      anchor: first.text,
      at: first.at,
      occurrences: hits,
    },
  ];
}

/** One substitution, insertion, deletion or swap of neighbours apart. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.slice(i) === long.slice(i + 1);
}

const MAX_TYPOS = 5;

/** Plain words of 5+ letters: no digits, so `SpO2` and `3rjiwj` are not candidates. */
function plainWords(text: string): Word[] {
  return wordsOf(text).filter(({ text: word }) => /^\p{L}{5,}$/u.test(word));
}

function tally(words: readonly Word[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { text } of words) counts.set(text.toLowerCase(), (counts.get(text.toLowerCase()) ?? 0) + 1);
  return counts;
}

/**
 * A word written once that is one letter off a word the note (or yesterday's)
 * writes at least twice: `pasein` beside `pasien` ×3.
 *
 * Only plain words of 5+ letters, starting lower case (a capital is a name or
 * a heading), sharing the first letter with what they are compared to, and
 * not found in yesterday's note: a word you wrote yesterday is not a typo today.
 *
 * shortcut: a typo that is the only spelling in the note is invisible here,
 * and two valid spellings one letter apart (`nafas`/`napas`) can be flagged,
 * as can a correct word when yesterday's note misspelled it twice (majority wins);
 * the finding asks, it does not correct.
 */
export function checkTypos(body: string, previous: string | undefined, frozen: readonly FrozenRange[]): SoapFinding[] {
  const mine = plainWords(body);
  const here = tally(mine);
  const before = tally(previous ? plainWords(previous) : []);
  const known = [...new Set([...here.keys(), ...before.keys()])]
    .map((word) => ({ word, n: (here.get(word) ?? 0) + (before.get(word) ?? 0) }))
    .filter(({ n }) => n >= 2);
  const out: SoapFinding[] = [];

  for (const { text, at } of mine) {
    if (out.length >= MAX_TYPOS) break;
    const word = text.toLowerCase();
    if (text[0] !== word[0] || here.get(word) !== 1 || before.has(word) || isFrozen(frozen, at)) continue;
    const meant = known
      .filter((candidate) => candidate.word[0] === word[0] && oneEditApart(word, candidate.word))
      .sort((a, b) => b.n - a.n)[0];
    if (!meant) continue;
    out.push({
      kind: 'typo',
      level: 'cek',
      message: `Mungkin salah ketik: “${text}”. Maksudnya “${meant.word}”?`,
      anchor: text,
      at,
    });
  }
  return out;
}
