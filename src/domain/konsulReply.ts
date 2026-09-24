/**
 * Reading a consult reply — a note where cardiology answers another service.
 *
 * Two samples so far (September 2026) and one in the September export, so
 * these rules are deliberately narrow: they read the two phrases that carry
 * the answer, and fall back to the note's own words whenever those phrases are
 * not there. Guessing more structure from three notes is how a format gets
 * inferred from one person's habit (handoff, recurring pattern 10).
 */

/** Strip the emphasis a line is wrapped in (`*_…_*`, `*…*`, `_…_`). */
function unwrap(line: string): string {
  return line
    .trim()
    .replace(/^[*_]+/, '')
    .replace(/[*_]+$/, '')
    .trim();
}

/**
 * Why cardiology was consulted: the line "Pasien dikonsul(kan) untuk …".
 *
 * Both samples write it on its own line, in italics, between the DPJP block
 * and S. `dikonsul` and `dikonsulkan` both occur. Returns the part after
 * "untuk", which is the actual question.
 */
export function consultQuestion(body: string): string | null {
  for (const line of body.split('\n')) {
    const text = unwrap(line);
    const match = /^pasien\s+dikonsul\w*\s+untuk\s+(.+)$/i.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * The finding inside the cardiology conclusion.
 *
 * Every conclusion opens with the same method statement — "Saat ini evaluasi
 * Kardiologi berdasarkan anamnesis, pemeriksaan fisik, EKG …" — which is
 * identical across patients and says nothing about this one. The answer
 * follows "pasien kami assess dengan …" (a diagnosis) or "pasien termasuk
 * (kategori) …" (a risk category); both occur. When neither phrase is there,
 * the whole sentence is returned rather than a guess at where it starts.
 */
export function conclusionFinding(headingLine: string): string {
  const sentence = unwrap(headingLine);
  const match = /\bpasien\s+(?:kami\s+as+e?s+\w*\s+dengan|termasuk(?:\s+kategori)?)\s+(.+)$/i.exec(
    sentence,
  );
  return (match?.[1] ?? sentence).trim();
}

/**
 * The card preview for a consult reply: the question, then the answer.
 *
 * The board is scanned for WHO a patient is and what was decided. For our own
 * patients that is the assessment list; for a consult it is what we were asked
 * and what we said — the S and O above them are the other service's patient,
 * seen through our eyes, and identical in shape to every other consult.
 */
export function konsulPreview(body: string, conclusionLine: string, after: string): string {
  const question = consultQuestion(body);
  const parts = [
    question ? `Konsul: ${question}` : null,
    conclusionFinding(conclusionLine),
    after.trim() || null,
  ].filter((part): part is string => part !== null && part.length > 0);
  return parts.join('\n');
}
