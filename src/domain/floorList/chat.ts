/**
 * List Maker, step 1: a WhatsApp paste → separate messages (12.8).
 *
 * Three shapes reach this, and all three are handled because colleagues use
 * all three:
 *
 *   iOS export      `[10/9/26, 6:27:01 AM] Sender: text`
 *   Android export  `10/9/26, 06:27 - Sender: text`
 *   copied messages `[06:27, 9/10/2026] Sender: text`
 *   markdown export `[6.27] **Sender:** text` under `## 9 October 2026`
 *
 * …plus text with no headers at all (one SOAP copied on its own, or several
 * pasted one after another), which is split at each report opening.
 *
 * DATES ARE READ, NEVER GUESSED. The only use of `sentAt` is ordering — "the
 * latest message about a patient wins" — and chat order already gives that,
 * so a date this cannot read leaves `sentAt` empty instead of inventing one.
 */

export interface ChatMessage {
  /** ISO `YYYY-MM-DDTHH:mm`, or '' when the paste carried no readable stamp. */
  sentAt: string;
  /** As the export names them ("Jul 26 - dr. Contoh Satu", "You"), or ''. */
  sender: string;
  text: string;
  /** Position in the paste: the tie-breaker when stamps are equal or absent. */
  index: number;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  januari: 1, februari: 2, maret: 3, mei: 5, juni: 6, juli: 7, agustus: 8,
  oktober: 10, desember: 12,
};

const pad = (n: number): string => String(n).padStart(2, '0');

function to24(hour: number, ampm: string | undefined): number {
  if (!ampm) return hour;
  const pm = /p/i.test(ampm);
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

function year4(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * `a/b/c` is month-first in an English-locale export and day-first in an
 * Indonesian one. A part over 12 settles it; otherwise `monthFirst` decides
 * (true for the bracketed iOS form, which follows the phone's US locale in
 * every export seen so far).
 */
function isoDate(a: number, b: number, c: number, monthFirst: boolean): string | null {
  let month = monthFirst ? a : b;
  let day = monthFirst ? b : a;
  if (month > 12 && day <= 12) [month, day] = [day, month];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year4(c)}-${pad(month)}-${pad(day)}`;
}

interface Header {
  at: number;
  end: number;
  sentAt: string;
  sender: string;
}

// [10/9/26, 6:27:01 AM] Sender:
const IOS = /^‎?\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AP]\.?M\.?)?\]\s+([^:\n]{1,80}):\s?/gim;
// 10/9/26, 06:27 - Sender:
const ANDROID = /^‎?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2})[:.](\d{2})\s*([AP]\.?M\.?)?\s+-\s+([^:\n]{1,80}):\s?/gim;
// [06:27, 9/10/2026] Sender:
const COPIED = /^‎?\[(\d{1,2})[:.](\d{2})(?:\s*([AP]\.?M\.?))?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s+([^:\n]{1,80}):\s?/gim;
// [6.27] **Sender:** under "## 9 October 2026"
const MD_DAY = /^##\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/gim;
const MD = /^\[(\d{1,2})[.:](\d{2})\]\s+\*\*([^*\n]{1,80}):\*\*\s?/gim;

function headers(text: string): Header[] {
  const found: Header[] = [];
  for (const m of text.matchAll(IOS)) {
    const date = isoDate(Number(m[1]), Number(m[2]), Number(m[3]), true);
    const time = `${pad(to24(Number(m[4]), m[6]))}:${m[5]}`;
    found.push({ at: m.index, end: m.index + m[0].length, sentAt: date ? `${date}T${time}` : '', sender: (m[7] ?? '').trim() });
  }
  for (const m of text.matchAll(ANDROID)) {
    const date = isoDate(Number(m[1]), Number(m[2]), Number(m[3]), true);
    const time = `${pad(to24(Number(m[4]), m[6]))}:${m[5]}`;
    found.push({ at: m.index, end: m.index + m[0].length, sentAt: date ? `${date}T${time}` : '', sender: (m[7] ?? '').trim() });
  }
  for (const m of text.matchAll(COPIED)) {
    const date = isoDate(Number(m[4]), Number(m[5]), Number(m[6]), false);
    const time = `${pad(to24(Number(m[1]), m[3]))}:${m[2]}`;
    found.push({ at: m.index, end: m.index + m[0].length, sentAt: date ? `${date}T${time}` : '', sender: (m[7] ?? '').trim() });
  }
  if (found.length === 0) {
    const days = [...text.matchAll(MD_DAY)].map((m) => {
      const month = MONTHS[(m[2] ?? '').toLowerCase()];
      return { at: m.index, date: month ? `${m[3]}-${pad(month)}-${pad(Number(m[1]))}` : '' };
    });
    for (const m of text.matchAll(MD)) {
      const day = [...days].reverse().find((d) => d.at < m.index)?.date ?? '';
      const time = `${pad(Number(m[1]))}:${m[2]}`;
      found.push({ at: m.index, end: m.index + m[0].length, sentAt: day ? `${day}T${time}` : '', sender: (m[3] ?? '').trim() });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

/** A line that opens a report: where a header-less paste is split. */
const OPENING = /^\s*(?:\*?chief\s*:|\*?assalam|\*?selamat\s+(?:pagi|siang|sore|malam)|\*?tabe\s+(?:dok|prof))/i;

function splitBare(text: string): string[] {
  const lines = text.split('\n');
  const starts: number[] = [];
  for (const [i, line] of lines.entries()) {
    if (!OPENING.test(line)) continue;
    // Only an opening that leads into a report, not "Tabe iye dokter".
    const near = lines.slice(i, i + 6).join(' ');
    if (!/melaporkan|mengirimkan/i.test(near)) continue;
    // "Chief :" then "Assalamualaikum…" two lines later is ONE message.
    const previous = starts.at(-1);
    if (previous !== undefined && i - previous <= 4 && /^\s*\*?chief\s*:/i.test(lines[previous] ?? '')) continue;
    starts.push(i);
  }
  if (starts.length <= 1) return [text];
  const out: string[] = [];
  if (starts[0]! > 0) out.push(lines.slice(0, starts[0]).join('\n'));
  for (const [k, start] of starts.entries()) out.push(lines.slice(start, starts[k + 1] ?? lines.length).join('\n'));
  return out;
}

export function splitChat(raw: string): ChatMessage[] {
  const text = raw.replace(/\r\n?/g, '\n').replace(/[‎‏‪-‮]/g, '');
  const found = headers(text);
  if (found.length === 0) {
    return splitBare(text)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part, index) => ({ sentAt: '', sender: '', text: part, index }));
  }
  return found
    .map((header, k) => ({
      sentAt: header.sentAt,
      sender: header.sender,
      text: text.slice(header.end, found[k + 1]?.at ?? text.length).trim(),
      index: k,
    }))
    .filter((message) => message.text !== '');
}
