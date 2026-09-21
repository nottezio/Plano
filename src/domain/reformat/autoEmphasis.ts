/**
 * Put the `*bold*` and `_italic_` back where the ward's format expects them.
 *
 * Read off the worked bangsal note, not invented. In that format:
 *
 *   *Nama/tgl lahir/umur/RM 01714449*      identity, bold
 *   _DPJP Utama dan Tindakan : …_          every DPJP line, italic
 *   _Pasien dirujuk dari RS … _            the referral sentence, italic
 *   *S :*  *O :*                           section headings, bold
 *   *EKG di PJT Lt. 4 (02-09-2026)*        every investigation heading, bold
 *   *Mohon izin kami assessment dengan :*  the two request lines, bold
 *   *Plan :*                               bold
 *   *TS Interna GH*  *A/*  *Plan:*         consult block headings, bold
 *
 * `Selesai:` is deliberately left plain, because it is plain in the worked
 * note. The point is to reproduce that format, not to improve on it.
 *
 * IDEMPOTENT BY CONSTRUCTION
 *
 * Every rule skips a line that already carries a marker. Running this twice
 * must not produce `**S :**`, and running it over a note somebody has
 * hand-formatted must not touch their work — including where they chose
 * differently.
 */

interface Rule {
  readonly test: RegExp;
  readonly mark: '*' | '_';
}

const RULES: readonly Rule[] = [
  // Identity: a slash-separated line carrying an RM number. Matched on the RM
  // rather than the slashes, because a therapy line is full of slashes too.
  { test: /^[^\n]*\bRM\s*\.?\s*\d{4,}[^\n]*$/i, mark: '*' },
  /*
    The same line written without the letters `RM`:
    `Ny. Nuraeni / 3 Juli 1958 / 68 tahun / 1715410`. 28 lines in the corpus,
    all bold, all missed by the rule above — including the blank template
    line, which is how the seeded templates write it.
  */
  { test: /^[^\n]*\/[^\n]*\btahun\b[^\n]*\/[^\n]*$/i, mark: '*' },
  { test: /^\s*DPJP\b[^\n]*$/i, mark: '_' },
  // `dikonsulkan` was missing, and it is the commonest of them (21 lines).
  { test: /^\s*Pasien\s+(?:dikonsul\w*|dirujuk|rujukan|datang|masuk)\b[^\n]*$/i, mark: '_' },
  /*
    A section letter with a COLON. Not with a slash.

    `S/` and `O/` are plain in the corpus, and `A/` and `P/` are plain in 267
    of 289 lines — they open a consulting service's block, where the whole
    convention is that their headings stay plain. The slash form was bolding
    265 lines the ward writes plain, which made another service's assessment
    look like ours.
  */
  { test: /^\s*[SOAP]\s*:\s*$/i, mark: '*' },
  /*
    The request lines. `Selanjutnya mohon arahan …` is NOT one of them: it is
    the closing sentence of the note and the corpus leaves it plain in 118 of
    the lines this rule was bolding.
  */
  { test: /^\s*Mohon\s+i[zj]in\b[^\n]*$/i, mark: '*' },
  { test: /^\s*Plan(?:ning)?\s*:?\s*$/i, mark: '*' },
  { test: /^\s*TS\s+[A-Za-z][\w /]{1,28}$/i, mark: '*' },

  /*
    Investigation headings: a modality word and a date on the same line.

    Requiring the DATE is what keeps this off the findings underneath. `EKG di
    PJT (02-09-2026)` is a heading; `Ventricular pacing rhythm, HR 60 bpm` is
    not, and neither is a sentence that happens to mention an echo.
  */
  {
    test: /^\s*(?:EKG|Laboratorium|Lab|Urinalis\w*|ADT|Foto\s*Thora(?:x|ks?)|MSCT|CT|MRI|USG|Echo\w*|Laporan|Biakan|(?:Hasil\s+)?X-?ray)\b[^\n]*(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\w*\.?\s*\d{2,4})[^\n]*$/i,
    mark: '*',
  },
  /*
    A modality heading with a place and no date: `Echo Hemodinamik IGD`, 17
    lines, all bold. Bounded to five words with no sentence punctuation, so
    `Echo ulang bila klinis memburuk` stays a plan.

    `Lung Ultrasound` is absent from both investigation rules on purpose: its
    heading is plain in 124 of 141 lines.
  */
  {
    test: /^\s*(?:EKG|Laboratorium|Lab|Foto\s*Thora(?:x|ks?)|USG|CT|Echo\w*)(?:\s+[\w().\/-]+){0,4}\s*$/i,
    mark: '*',
  },
];

/** Already marked, at either end, with either marker. */
function marked(line: string): boolean {
  const text = line.trim();
  return /^[*_]/.test(text) || /[*_]$/.test(text);
}

export interface EmphasisResult {
  body: string;
  /** How many lines were marked, for telling the user what happened. */
  changed: number;
}

export function autoEmphasis(body: string): EmphasisResult {
  let changed = 0;

  const lines = body.split('\n').map((line) => {
    if (!line.trim() || marked(line)) return line;
    const rule = RULES.find((candidate) => candidate.test.test(line));
    if (!rule) return line;

    // Leading whitespace stays outside the marker: `  *Plan :*`, not
    // `*  Plan :*`, which WhatsApp renders as a literal asterisk.
    const indent = /^\s*/.exec(line)?.[0] ?? '';
    changed += 1;
    return `${indent}${rule.mark}${line.trim()}${rule.mark}`;
  });

  return { body: lines.join('\n'), changed };
}
