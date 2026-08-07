/**
 * SPEC 14 — seed note templates.
 *
 * Transcribed from real handover notes. They are SEEDS, not rules: every one is
 * editable in Settings, because the expected shape of a handover differs per
 * DPJP, per ward and per consultant preference, and changes without notice.
 * Hardcoding them would mean a redeploy every time someone wants a section
 * moved.
 *
 * The only structural difference between the follow-up and admission forms is
 * the length of S — which is exactly how the two are distinguished in practice.
 * Everything below S is deliberately identical, so a note written from one can
 * be continued as the other without reformatting.
 *
 * Investigations (EKG, laboratorium, echo, laporan tindakan) are NOT in these
 * skeletons on purpose. They accumulate as dated blocks, are carried forward
 * untouched day to day, and are pasted in as they arrive — pre-printing empty
 * headings for them would invite a heading with nothing under it, which reads
 * as "not done" rather than "not yet".
 */

const VITALS = `*O:*
Compos mentis
Tekanan Darah : 
Nadi :  kali/menit, reguler
Pernapasan :  kali/menit
Suhu :  derajat Celcius
SpO2 : % on room air

Anemis tidak ada, ikterus tidak ada
JVP R+2 cmH20
BJ I/II murni reguler, murmur tidak ada
BP Vesikuler, ronkhi dan wheezing tidak ada
Abdomen dalam batas normal
Edema ekstremitas tidak ada, akral teraba hangat.

TB :  cm
BB:  kg`;

const THERAPY_AND_PLAN = `*Mohon izin pasien kami terapi dengan :*
- 

*Plan :*
- Monitoring tanda vital dan hemodinamik
- `;

/** Short S — the daily follow-up. */
export const FOLLOWUP_BODY = `*S:*
- Saat ini keluhan nyeri dada tidak ada, sesak napas tidak ada, berdebar tidak ada.
- BAB dan BAK dalam batas normal.

${VITALS}

*Mohon izin pasien kami assess dengan :*
- 

${THERAPY_AND_PLAN}`;

/**
 * Same as the follow-up, but the assessment is split into primary/secondary
 * diagnoses plus an explicit problem list.
 */
export const FOLLOWUP_DX_BODY = `*S:*
- Saat ini keluhan nyeri dada tidak ada, sesak napas tidak ada, berdebar tidak ada.
- BAB dan BAK dalam batas normal.

${VITALS}

*Mohon izin pasien kami assess dengan :*
Diagnosis Primer : 
- 

*Diagnosis Sekunder :*
- 

*Problem :*
- 

${THERAPY_AND_PLAN}`;

/** Long S — history, review of systems, prior medication, risk factors. */
export const ADMISI_BODY = `*S:*
- Pasien datang dengan pengantar dari 
- Pasien datang dengan keluhan  sejak . Saat ini keluhan sesak napas tidak ada, riwayat sesak napas tidak ada, sesak napas saat aktivitas tidak ada, terbangun malam hari karena sesak tidak ada, pasien dapat baring datar tanpa sesak napas. Berdebar-debar tidak ada, riwayat berdebar-debar tidak ada.
- Keluhan batuk tidak ada. Mual dan muntah tidak ada, nyeri ulu hati tidak ada. Demam tidak ada. BAB dan BAK kesan lancar.
- Riwayat serangan jantung tidak ada. Riwayat stroke tidak ada, riwayat asma tidak ada, riwayat batuk lama tidak ada, riwayat alergi makanan tidak ada, riwayat alergi obat tidak ada.
- Saat ini pasien riwayat berobat 

Faktor resiko koroner:
- Riwayat Hipertensi tidak ada.
- Riwayat Diabetes tidak ada.
- Riwayat Merokok disangkal.
- Riwayat Penyakit Jantung dalam keluarga tidak ada.

${VITALS}

*Mohon izin pasien kami assess dengan :*
- 

${THERAPY_AND_PLAN}`;
