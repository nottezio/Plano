/**
 * Reading identity and location out of the note.
 *
 * Every handover already opens with the ward, the room, the bed, the name, the
 * date of birth and the MRN. Asking for those a second time in a form is asking
 * the same person for the same fact twice, and gives it two places to be wrong.
 *
 * Everything here is a READ. Nothing rewrites the note, and the caller decides
 * what to do with what comes back — see `patients.repo` for the rule that
 * derived values may fill an empty field but never overwrite a typed one.
 */

export interface ParsedIdentity {
  name?: string;
  /**
   * Read from the honorific, which is the only place it appears.
   *
   * `Tn.` and `Ny.` carry it unambiguously and every identity line has one, so
   * asking for it again in the form was asking for something already written.
   */
  sex?: 'L' | 'P';
  /** As written, `dd-mm-yyyy`. Not converted: it is displayed, not computed on. */
  birthDate?: string;
  age?: number;
  mrn?: string;
}

export interface ParsedLocation {
  ward?: string;
  room?: string;
  bed?: string;
}

/** `Tn.`, `Ny.`, `Nn.`, `An.` — the marker that a line is an identity line. */
const TITLE = /\b(Tn|Ny|Nn|An|Sdr|Sdri)\.?\s/i;

/**
 * The identity line.
 *
 * Written as `*Ny. Bubi Dg Pajja/ 01-02-1960/ 66 tahun / RM 1478911*`, with the
 * separators and spacing varying freely. Fields are located by what they look
 * like rather than by position: a date is the thing shaped like a date, an MRN
 * is the number after `RM`. Splitting on `/` and trusting the order breaks the
 * moment someone omits the birth date, which happens often.
 */
/**
 * Markers that a line is a template placeholder rather than a real patient.
 *
 * `*(Nama) / (tgl lahir) / (umur) / RM (no)*` matches the identity shape
 * exactly, and filling a record from it writes "(Nama)" as somebody's name.
 */
const PLACEHOLDER = /\((nama|tgl|umur|no|ruang|bagian)[^)]*\)/i;

/**
 * Only the opening block is searched.
 *
 * A note can name more than one patient — a consult reply quotes another, a
 * pasted report carries its own header — and scanning the whole body meant the
 * parser could pick the wrong one and write it into this patient's record.
 * The identity line of THIS patient is in the opening, above the first clinical
 * heading, which is where it is written every time.
 */
const CLINICAL_START =
  /^\s*\*?\s*(S|O|A|P)\s*[:/]|^\s*\*?\s*(Mohon i[zj]in|Plan|Diagnosis|Faktor risiko)/im;

function openingBlock(body: string): string {
  const match = CLINICAL_START.exec(body);
  return match ? body.slice(0, match.index) : body;
}

export function parseIdentity(body: string): ParsedIdentity {
  const line = openingBlock(body)
    .split('\n')
    .map((candidate) => candidate.replace(/[*_]/g, '').trim())
    .find(
      (candidate) =>
        TITLE.test(candidate) && /\bRM\b/i.test(candidate) && !PLACEHOLDER.test(candidate),
    );

  if (!line) return {};

  const result: ParsedIdentity = {};

  /**
   * The MRN must look like one: at least four digits, and no more than twelve.
   *
   * The old pattern accepted any digit run after `RM`, so `RM 5` — or the tail
   * of a date that happened to follow the word — became a record number. A
   * wrong MRN is the single worst thing this parser can produce, because it is
   * the field used to identify the patient to another system.
   */
  const mrn = /\bRM\.?\s*:?\s*([0-9][0-9.\-\s]{2,})/i.exec(line);
  const digits = mrn?.[1]?.replace(/[\s.\-]/g, '');
  if (digits && digits.length >= 4 && digits.length <= 12) result.mrn = digits;

  const birth = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/.exec(line);
  if (birth?.[1]) result.birthDate = birth[1].replace(/\//g, '-');

  const age = /(\d{1,3})\s*(?:tahun|thn|th)\b/i.exec(line);
  if (age?.[1]) result.age = Number(age[1]);

  // The name runs from the title to the first separator that introduces
  // something else — a date, an age, or the MRN.
  // Sdri before Sdr, Nn before Ny: a shorter honorific that prefixes a longer
  // one would match first and take the wrong sex.
  const honorific = /\b(Sdri|Sdr|Tn|Ny|Nn|An)\b/i.exec(line);
  if (honorific?.[1]) {
    const marker = honorific[1].toLowerCase();
    // `An.` is a child of either sex, so it is deliberately not mapped —
    // guessing would put a wrong value into a field nobody re-checks.
    if (marker === 'tn' || marker === 'sdr') result.sex = 'L';
    else if (marker === 'ny' || marker === 'nn' || marker === 'sdri') result.sex = 'P';
  }

  const nameMatch = /((?:Tn|Ny|Nn|An|Sdr|Sdri)\.?\s+[^/,]+)/i.exec(line);
  if (nameMatch?.[1]) {
    const name = nameMatch[1]
      .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b.*$/, '')
      .replace(/\b\d{1,3}\s*(?:tahun|thn|th)\b.*$/i, '')
      .replace(/\bRM\b.*$/i, '')
      .replace(/[\s/,-]+$/, '')
      .trim();
    if (name) result.name = name;
  }

  return result;
}

/**
 * The location, from the opening sentence.
 *
 * `di *PJT Lantai 5 Kamar 517 Bed 3* atas nama`, but also `*PJT Lt. 4 Kamar 418
 * Bed 4*`, `*PJT Lantai 5 kamar 507*` with no bed, and `*CVCU bed 4*` with no
 * room. Ward is whatever precedes the first `Kamar`/`Bed` keyword, so a ward
 * name nobody anticipated still comes through intact.
 */
export function parseLocation(body: string): ParsedLocation {
  const opening = openingBlock(body)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /\batas nama\b/i.test(line));

  if (!opening) return {};

  // The location sits between the emphasis markers in the opening sentence.
  const emphasised = [...opening.matchAll(/\*([^*\n]+)\*/g)].map((match) => match[1] ?? '');
  const candidate = emphasised.find((text) => /\b(kamar|bed|lantai|lt\.?|cvcu|ruang)\b/i.test(text));
  if (!candidate) return {};

  const result: ParsedLocation = {};

  const room = /\bkamar\s*:?\s*([\w-]+)/i.exec(candidate);
  if (room?.[1]) result.room = room[1];

  const bed = /\bbed\s*:?\s*([\w-]+)/i.exec(candidate);
  if (bed?.[1]) result.bed = bed[1];

  const ward = candidate
    .replace(/\bkamar\b.*$/i, '')
    .replace(/\bbed\b.*$/i, '')
    .replace(/[\s,]+$/, '')
    .trim();
  if (ward) result.ward = ward;

  return result;
}

/**
 * Everything the note can tell us about the patient.
 *
 * Returned together because they are read from the same two lines and applied
 * under the same rule: fill what is blank, touch nothing that was typed.
 */
export function parsePatientFacts(body: string): ParsedIdentity & ParsedLocation {
  return { ...parseIdentity(body), ...parseLocation(body) };
}
