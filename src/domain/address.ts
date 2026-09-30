/**
 * How a note ADDRESSES its reader — "dokter", "dok" or "Prof" — as opposed to
 * the TITLES of people it names ("Prof. dr. Peter Kabo", "Prof. Dr. dr. …").
 *
 * WHY THIS EXISTS (2026-10-01)
 *
 * Two features read or rewrote the address form by matching the bare word:
 *
 *  - "Ganti ke dokter" replaced EVERY `Prof` in the note with `dokter`, so a
 *    DPJP line `Prof. Dr. dr. X` became `dokter. Dr. dr. X`. "Ganti ke Prof"
 *    turned `konsul dokter anestesi` in a plan into `konsul prof anestesi`.
 *  - The Ringkas report chose its fallback closing from whether `prof`
 *    appeared anywhere above the first heading, and a TS or DPJP named
 *    "Prof. dr. …" in the opening line was enough to sign a note written to
 *    "dokter" off to "Prof".
 *
 * The distinction both were missing: an address is a VOCATIVE, a title comes
 * before a name. `Prof` directly followed by `dr`/`Dr`/`drg` is a title; so is
 * anything on a DPJP line. Both are left alone and ignored.
 *
 * Only the OPENING (the first paragraph) and the CLOSING (the last line, when
 * it reads like one) carry the address. The clinical body in between is never
 * rewritten: "dokter" there is a person being talked about, not to.
 */

export type AddressForm = 'dokter' | 'Prof';

const WORD = /\b(Dokter|dokter|DOKTER|Dok|dok|Prof|prof|PROF)\b/g;
/** Followed by a doctor's title: `Prof. dr.`, `Prof Dr.`, `Prof. drg.` */
const BEFORE_TITLE = /^\.?\s*(?:dr|Dr|DR|drg)\b/;
const DPJP_LINE = /\bDPJP\b/i;
const CLOSING_HINT = /(terima\s*kasih|terimakasih|arahan)/i;

/** Rewrites or inspects the vocatives in one line; titles and DPJP lines are skipped. */
function eachVocative(
  line: string,
  visit: (word: string, sentenceStart: boolean) => string,
): string {
  if (DPJP_LINE.test(line)) return line;
  return line.replace(WORD, (word, _group: string, offset: number) => {
    const isProf = /^prof$/i.test(word);
    if (isProf && BEFORE_TITLE.test(line.slice(offset + word.length))) return word;
    const before = line.slice(0, offset).trimEnd();
    return visit(word, before === '' || /[.!?]$/.test(before));
  });
}

/** Line indexes of the opening paragraph and the closing line. */
function addressLines(body: string): Set<number> {
  const lines = body.split('\n');
  const out = new Set<number>();

  const first = lines.findIndex((line) => line.trim() !== '');
  if (first >= 0) {
    // The first paragraph, at most three lines: a greeting and a report
    // sentence written on separate lines are still the opening.
    for (let i = first; i < lines.length && i < first + 3; i++) {
      if ((lines[i] ?? '').trim() === '') break;
      out.add(i);
    }
  }

  for (let i = lines.length - 1; i > first; i--) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    if (isClosingLine(line)) out.add(i);
    break;
  }
  return out;
}

/**
 * A sign-off: thanks or a request for direction, not a list item.
 * `- Mohon arahan DPJP` in a plan is an instruction; a closing is not bulleted.
 */
export function isClosingLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^[-•*>]|^\d+[.)]/.test(trimmed)) return false;
  return CLOSING_HINT.test(trimmed);
}

function swap(body: string, to: AddressForm): string {
  const targets = addressLines(body);
  return body
    .split('\n')
    .map((line, index) =>
      targets.has(index)
        ? eachVocative(line, (word, sentenceStart) => {
            if (to === 'Prof') {
              if (/^prof$/i.test(word)) return word;
              if (word === word.toUpperCase()) return 'PROF';
              return /^[A-Z]/.test(word) ? 'Prof' : 'prof';
            }
            if (!/^prof$/i.test(word)) return word;
            if (word === 'PROF') return 'DOKTER';
            return sentenceStart ? 'Dokter' : 'dokter';
          })
        : line,
    )
    .join('\n');
}

/**
 * Swap the address to Prof in the opening and closing. Case is preserved
 * (`Dokter` → `Prof`, `dokter` → `prof`); titles and DPJP lines untouched.
 *
 * Named `to…`, not `use…`: `use` is React's hook prefix.
 */
export function toProfForm(body: string): string {
  return swap(body, 'Prof');
}

export function toDokterForm(body: string): string {
  return swap(body, 'dokter');
}

/** The address form used in a piece of text, or null when it names none. */
export function addressIn(text: string): AddressForm | null {
  let found: AddressForm | null = null;
  for (const line of text.split('\n')) {
    eachVocative(line, (word) => {
      found = /^prof$/i.test(word) ? 'Prof' : 'dokter';
      return word;
    });
  }
  return found;
}

/**
 * Who the note is written to: the closing's address, else the opening's,
 * else "dokter". The closing wins because it is the line being replaced.
 */
export function noteAddress(body: string): AddressForm {
  const lines = body.split('\n');
  const targets = [...addressLines(body)].sort((a, b) => b - a);
  for (const index of targets) {
    const form = addressIn(lines[index] ?? '');
    if (form) return form;
  }
  return 'dokter';
}
