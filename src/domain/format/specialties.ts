/**
 * Which specialty a TS block or a DPJP line names (2026-10-06).
 *
 * WHY. The SOAP checker asked "has every consulting service that answered
 * been added to the DPJP list?" by comparing the first five LETTERS of the TS
 * name with the DPJP lines. Two services that are plainly the same failed it:
 *  - `TS Gizi Klinik` vs `DPJP Gizi`: the name was joined into `giziklinik`
 *    and cut to `gizik`, which `gizi` does not contain;
 *  - `TS Rehab` vs `DPJP KFR`: the same department under two names
 *    (Kedokteran Fisik dan Rehabilitasi), sharing no letters at all.
 * Both were flagged on a note whose header listed them, and a checker that
 * cries wolf twice is read less carefully the third time, when it is right
 * (`TS Neuro` with no DPJP Neuro, on the same note).
 *
 * So the question is asked of specialties, not spellings: each side is read
 * into a set of specialty keys, from its words AND, on the DPJP side, from the
 * consultant's own title (`Sp.N`, `Sp.GK`, `Sp.KFR`), which names the
 * specialty even when the label is generic (`DPJP Konsulen 2`).
 *
 * A name that is in no entry still works: it falls back to its words, each cut
 * to five letters, so `TS Pulmo` still meets `DPJP Pulmonologi` without an
 * entry. Entries are for names that spelling alone cannot connect.
 */

interface Specialty {
  key: string;
  /** Lowercase words or phrases, as written in a TS heading or a DPJP label. */
  names: readonly string[];
  /** Title fragments after `Sp.` / `Subsp.` / `K…` in a consultant's name, normalised (no dots or spaces). */
  titles?: readonly string[];
}

const SPECIALTIES: readonly Specialty[] = [
  { key: 'kardio', names: ['kardio', 'kardiologi', 'jantung', 'kardiovaskular', 'cardio'], titles: ['spjp', 'kkv', 'pdkkv'] },
  { key: 'neuro', names: ['neuro', 'neurologi', 'saraf', 'syaraf', 'neurology'], titles: ['spn', 'sps'] },
  { key: 'gizi', names: ['gizi', 'gizi klinik', 'gk', 'nutrisi', 'nutrition'], titles: ['spgk'] },
  {
    key: 'kfr',
    names: ['kfr', 'rehab', 'rehabilitasi', 'rehabilitasi medik', 'irm', 'fisioterapi', 'kedokteran fisik'],
    titles: ['spkfr'],
  },
  { key: 'hom', names: ['hom', 'khom', 'hematologi', 'onkologi', 'hemato', 'hematoonkologi'], titles: ['khom'] },
  {
    key: 'derven',
    names: ['derven', 'dv', 'dve', 'kulit', 'kulit dan kelamin', 'dermatologi', 'dermato', 'kk'],
    titles: ['spdve', 'spdv', 'spkk'],
  },
  { key: 'pulmo', names: ['pulmo', 'pulmonologi', 'paru', 'respirologi'], titles: ['spp'] },
  { key: 'nefro', names: ['nefro', 'nefrologi', 'ginjal', 'khg', 'ginjal hipertensi'], titles: ['khg'] },
  { key: 'geh', names: ['geh', 'kgeh', 'gastro', 'gastroenterohepatologi', 'gastroenterologi'], titles: ['kgeh'] },
  { key: 'endo', names: ['endo', 'kemd', 'endokrin', 'endokrinologi', 'metabolik'], titles: ['kemd'] },
  { key: 'pti', names: ['pti', 'tropik infeksi', 'infeksi', 'tropik'], titles: ['kpti'] },
  { key: 'geriatri', names: ['geriatri', 'geri'], titles: ['kger'] },
  { key: 'reumato', names: ['reuma', 'rheuma', 'reumatologi', 'rematologi'], titles: ['kr'] },
  { key: 'btkv', names: ['btkv', 'bedah toraks', 'bedah thorax', 'bedah jantung'], titles: ['spbtkv'] },
  { key: 'urologi', names: ['uro', 'urologi'], titles: ['spu'] },
  { key: 'ortho', names: ['ortho', 'orto', 'orthopedi', 'ortopedi', 'ot'], titles: ['spot'] },
  { key: 'obgyn', names: ['obgyn', 'obgin', 'kandungan', 'og', 'obstetri'], titles: ['spog'] },
  { key: 'anak', names: ['anak', 'pediatri', 'pedi', 'ika'], titles: ['spa'] },
  { key: 'jiwa', names: ['jiwa', 'psikiatri', 'kj'], titles: ['spkj'] },
  { key: 'mata', names: ['mata', 'oftalmologi'], titles: ['spm'] },
  { key: 'tht', names: ['tht', 'thtkl', 'tht kl'], titles: ['sptht', 'spthtkl', 'spthtbkl'] },
  { key: 'anestesi', names: ['anestesi', 'anestesiologi', 'anest', 'icu'], titles: ['span', 'spanti'] },
  { key: 'gigi', names: ['gigi', 'gimul', 'bedah mulut', 'bm'], titles: ['spbm'] },
  { key: 'bedah', names: ['bedah', 'bedah umum', 'digestif', 'bedah digestif'], titles: ['spb', 'kbd'] },
  { key: 'bedah-saraf', names: ['bedah saraf', 'bs'], titles: ['spbs'] },
  { key: 'radiologi', names: ['radiologi', 'rad'], titles: ['sprad'] },
  { key: 'interna', names: ['interna', 'ipd', 'penyakit dalam', 'pd'], titles: ['sppd'] },
];

const BY_NAME = new Map<string, string>();
const BY_TITLE = new Map<string, string>();
for (const specialty of SPECIALTIES) {
  for (const name of specialty.names) BY_NAME.set(name, specialty.key);
  for (const title of specialty.titles ?? []) BY_TITLE.set(title, specialty.key);
}

const clean = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Fallback identity for a word no entry knows: its first five letters. */
const stem = (word: string): string => `~${word.slice(0, 5)}`;

/**
 * Specialty keys a label names: the whole label, any run of its words, or
 * (for words no entry knows) their stems.
 *
 * Generic words (`utama`, `konsulen`, `pelimpahan`) are not specialties and
 * are dropped before the fallback, or `DPJP Utama` would "match" a TS whose
 * name happened to start with `utama`.
 */
const GENERIC = new Set(['dpjp', 'ts', 'utama', 'konsulen', 'pelimpahan', 'tindakan', 'onsite', 'raber', 'rawat', 'bersama', 'dan', 'dr', 'klinik', 'spesialis']);

export function specialtiesInLabel(label: string): Set<string> {
  const words = clean(label).split(' ').filter(Boolean);
  const keys = new Set<string>();
  const known = new Set<number>();
  // Longest phrases first, so `gizi klinik` wins over `gizi` + `klinik`.
  for (let size = Math.min(4, words.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      // A word already inside a longer known phrase is not read again:
      // `bedah saraf` is not also `saraf` (neuro).
      if (Array.from({ length: size }, (_, i) => start + i).some((i) => known.has(i))) continue;
      const phrase = words.slice(start, start + size).join(' ');
      const key = BY_NAME.get(phrase);
      if (!key) continue;
      keys.add(key);
      for (let i = start; i < start + size; i += 1) known.add(i);
    }
  }
  words.forEach((word, index) => {
    if (!known.has(index) && !GENERIC.has(word) && word.length >= 3 && !/^\d+$/.test(word)) keys.add(stem(word));
  });
  return keys;
}

/**
 * Specialty keys a consultant's titles name: `Sp.GK (K)`, `Sp.KFR.Ped(K)`,
 * `Sp. PD, KHOM`, `Sp.D.V.E`. Read from the name half of a DPJP line.
 */
export function specialtiesInTitles(name: string): Set<string> {
  const keys = new Set<string>();
  const compact = name.toLowerCase().replace(/[\s.]/g, '');
  for (const match of compact.matchAll(/(?:sp|subsp)([a-z]+)/g)) {
    // Longest known title that the run starts with: `spkfrped` is `spkfr`.
    const run = `sp${match[1] ?? ''}`;
    let best: string | undefined;
    for (const title of BY_TITLE.keys()) {
      if (run.startsWith(title) && (!best || title.length > best.length)) best = title;
    }
    if (best) keys.add(BY_TITLE.get(best)!);
  }
  for (const [title, key] of BY_TITLE) {
    // Consultant-of-internal-medicine titles stand alone: `, KHOM`, `-KKV`.
    if (title.startsWith('k') && new RegExp(`(?:^|[^a-z])${title}(?:[^a-z]|$)`).test(name.toLowerCase().replace(/\./g, ''))) {
      keys.add(key);
    }
  }
  return keys;
}

/** Every specialty a note's DPJP lines cover, from their labels and their consultants' titles. */
export function dpjpSpecialties(body: string): Set<string> {
  const keys = new Set<string>();
  for (const line of body.split('\n')) {
    const match = /DPJP([^:\n]*):?(.*)$/i.exec(line);
    if (!match) continue;
    for (const key of specialtiesInLabel(match[1] ?? '')) keys.add(key);
    for (const key of specialtiesInTitles(match[2] ?? '')) keys.add(key);
  }
  return keys;
}

/**
 * Whether a TS service is in the DPJP list.
 *
 * Any shared key counts: a TS heading with two words (`Gizi Klinik`) is
 * covered by a DPJP line naming either, since nobody writes the same service
 * twice under two labels.
 */
export function consultCovered(service: string, covered: ReadonlySet<string>): boolean {
  const wanted = specialtiesInLabel(service);
  if (wanted.size === 0) return true;
  for (const key of wanted) {
    if (covered.has(key)) return true;
    // An unknown word on either side: compare stems, both ways shortened.
    if (key.startsWith('~')) {
      for (const have of covered) {
        if (have.startsWith('~') && (have.startsWith(key) || key.startsWith(have))) return true;
      }
    }
  }
  return false;
}
