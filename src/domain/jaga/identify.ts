import type { PdfTextItem } from '@/lib/pdfItems';

export type JagaDocumentKind = 'roster' | 'dpjp' | 'jarkom';

/**
 * Which of the three documents this PDF actually is.
 *
 * WHY GUESSING IS BETTER THAN VALIDATING
 *
 * Three file pickers side by side is three chances to drop the right file in
 * the wrong slot, and the failure is quiet: the DPJP roster fed to the jaga
 * parser finds no `HARI` column and produces zero shifts, which the UI would
 * report as "tidak ada baris jaga terbaca" — a message that describes the FILE
 * as broken when it is the slot that is wrong. On the evening before a jaga
 * that is a person re-downloading a PDF that was never the problem.
 *
 * So the document is identified first, from marks that only it carries, and a
 * mismatch says which slot the file belongs in. The import then does not
 * happen — refusing is right, because the alternative is silently replacing a
 * good roster with a parse of the wrong document.
 *
 * Identified by CONTENT rather than filename: these arrive from WhatsApp,
 * where names are mangled, and a renamed file is not a different document.
 */
export function identifyJagaPdf(items: readonly PdfTextItem[]): JagaDocumentKind | null {
  const text = items
    .map((item) => item.text)
    .join(' ')
    .toLowerCase();

  // Order matters: the DPJP roster also contains the words "jadwal jaga", so
  // its own marker has to be tested first or every DPJP file reads as a
  // resident roster.
  if (text.includes('jadwal primary pci') || text.includes('jadwal dpjp utama')) return 'dpjp';
  if (text.includes('jarkom') || (text.includes('nama panggilan') && text.includes('agama'))) {
    return 'jarkom';
  }
  if (text.includes('chief pjt') || text.includes('jadwal jaga ppds')) return 'roster';

  return null;
}

const LABELS: Record<JagaDocumentKind, string> = {
  roster: 'Jadwal Jaga PPDS',
  dpjp: 'Jadwal DPJP',
  jarkom: 'Daftar Jarkom',
};

/**
 * The message for a file dropped in the wrong slot, or one that is neither.
 *
 * Names both what was expected and what this appears to be, because "file
 * salah" alone leaves the user to work out which of three it was — which is
 * the same lookup this feature exists to remove.
 */
export function describeMismatch(
  expected: JagaDocumentKind,
  found: JagaDocumentKind | null,
): string {
  if (found === null) {
    return `File ini tidak dikenali sebagai ${LABELS[expected]}. Pastikan PDF-nya benar dan bukan hasil scan.`;
  }
  return `Ini sepertinya ${LABELS[found]}, bukan ${LABELS[expected]}. Impor di kotak ${LABELS[found]}.`;
}
