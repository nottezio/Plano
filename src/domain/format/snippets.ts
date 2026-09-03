import type { ClinicalDate } from '../types';
import { formatShortDateNoWeekday } from '../clinicalDate';

/**
 * Blocks of boilerplate a resident retypes every admission.
 *
 * These replaced the "Sisipkan bagian" dropdown, which inserted a bare `*O:*`
 * heading. That saved five characters of a heading anyone can type, on a
 * screen where the actual work is the paragraph underneath it — Avicenna's
 * word for it was redundant, and it was.
 *
 * Every snippet keeps its blanks as `...`. A template that guesses at a value
 * is worse than one that leaves a hole: a hole is visible in the note and in
 * the message that goes to the chief, and an invented number is not.
 */
export interface Snippet {
  id: string;
  label: string;
  /** `date` is the clinical day of the note being edited. */
  build: (date: ClinicalDate) => string;
}

export const SNIPPETS: readonly Snippet[] = [
  {
    id: 'ekg',
    label: 'EKG hari ini',
    /**
     * The heading only, dated, with the reading left blank.
     *
     * The date is the note's clinical day rather than today's wall clock: a
     * note written after midnight for the previous day must carry that day's
     * date, which is the same rule the rest of the app follows.
     */
    build: (date) => `*EKG di PJT (${formatShortDateNoWeekday(date)})*\n`,
  },
  {
    id: 'anamnesis',
    label: 'Anamnesis panjang',
    build: () =>
      [
        '- Pasien masuk dengan keluhan nyeri dada kiri yang sudah dialami sejak ..., dengan NRS (...). Keluhan nyeri dada kiri tembus belakang dan terasa menjalar ke lengan kiri, dengan durasi .... Keluhan disertai keringat dingin, mual dan muntah tidak ada. Riwayat nyeri dada sebelumnya ada namun dirasakan hilang timbul. Keluhan sesak nafas tidak ada, riwayat sesak nafas tidak ada. DOE (-), PND (-), orthopneu (-). Pasien dapat berbaring terlentang. Keluhan dan riwayat berdebar sebelumnya tidak ada.',
        '- Keluhan lain berupa : Demam tidak ada, batuk tidak ada, rasa mual dan muntah tidak ada, BAK dan BAB kesan normal.',
        '- Pasien rujukan dari RS ... dan telah mendapat terapi : ',
        '',
      ].join('\n'),
  },
  {
    id: 'faktor-risiko',
    label: 'Faktor risiko kardiovaskular',
    build: () =>
      [
        'Faktor Risiko Kardiovaskular :',
        '- Riwayat hipertensi ...',
        '- Riwayat diabetes melitus ...',
        '- Riwayat merokok ...',
        '- Riwayat penyakit jantung di keluarga tidak ada',
        '',
      ].join('\n'),
  },
];

/**
 * Insert a snippet at the caret.
 *
 * A newline is added BEFORE the block when the caret is mid-line, so a snippet
 * dropped at the end of an existing sentence starts on its own line instead of
 * running into it. Nothing is added when the line is already empty, which is
 * where these are normally inserted.
 */
export function insertSnippet(
  text: string,
  caret: number,
  snippet: string,
): { text: string; selectionStart: number; selectionEnd: number } {
  const before = text.slice(0, caret);
  const needsBreak = before.length > 0 && !before.endsWith('\n');
  const block = `${needsBreak ? '\n' : ''}${snippet}`;
  const next = `${before}${block}${text.slice(caret)}`;
  const at = caret + block.length;
  return { text: next, selectionStart: at, selectionEnd: at };
}
