/**
 * Does a section heading NAME the diagnosis list?
 *
 * The word has to lead, optionally after "Mohon izin (pasien) kami": "Diagnosis
 * Kerja", "Problem List", "Masalah", "Mohon izin kami assess dengan" qualify;
 * "Plan Diagnostik" and "Pemeriksaan Diagnostik" do not.
 *
 * One rule for every place that looks for the diagnosis: Ringkas (10-10.1,
 * where a substring test listed a TS "Plan Diagnostik" as diagnoses) and the
 * board card's preview (10-10.5), which used the same substring test.
 */
const DIAGNOSIS_HEADING_RE =
  /^(?:(?:mohon\s+)?i[zj]in\s+(?:pasien\s+)?kami\s+)?(?:diagnos|assess|asses|problem|masalah)/;

export function namesDiagnosis(label: string): boolean {
  const flat = label.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return DIAGNOSIS_HEADING_RE.test(flat);
}
