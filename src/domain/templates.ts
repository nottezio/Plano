/**
 * SPEC 14 — seed note templates.
 *
 * Transcribed from real handover notes. They are SEEDS, not rules: every one is
 * editable in Settings, because the expected shape of a handover differs per
 * DPJP, per ward and per consultant preference, and changes without notice.
 *
 * **The whole message lives in the note body.** Salutation, ward and bed,
 * patient identity, DPJP line, procedure line, the SOAP itself, and the closing
 * — all of it is text in the box, not fields assembled at copy time.
 *
 * That is a deliberate reversal of assembling an identity header during copy.
 * Assembling from fields meant the note on screen was never the message that
 * got sent: you could not read it end to end, proof it, or fix a typo in the
 * greeting without going somewhere else. What is in the box is now exactly what
 * lands in the chat — the only version that can be checked before it goes to a
 * consultant.
 *
 * The only structural difference between the follow-up and admission forms is
 * the length of S, which is exactly how the two are distinguished in practice.
 * Everything below it is identical, so a note written from one can be continued
 * as the other without reformatting.
 *
 * Investigations (EKG, laboratorium, echo, laporan tindakan) are NOT in these
 * skeletons on purpose. They accumulate as dated blocks, are carried forward
 * untouched day to day, and are pasted in as they arrive — pre-printing empty
 * headings would invite a heading with nothing under it, which reads as "not
 * done" rather than "not yet".
 */

/** Greeting, location, identity, DPJP, procedure. */
const OPENING = `Assalamu'alaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di *Ruang  Kamar  Bed *  atas nama : 

*Tn.  /  /  tahun / RM *

_DPJP Utama dan Tindakan : _

_Post Tindakan :  ()_`;

const VITALS = `*O:* 
Compos mentis
Tekanan Darah :  mmHg
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

const CLOSING = `Tabe terimakasih dokter`;

/** Short S — the daily follow-up. */
export const FOLLOWUP_BODY = `${OPENING}

*S:*
- Saat ini keluhan nyeri dada tidak ada, sesak napas tidak ada, berdebar tidak ada.
- BAB dan BAK dalam batas normal.

${VITALS}

*Mohon izin pasien kami assess dengan :*
- 

${THERAPY_AND_PLAN}

${CLOSING}`;

/**
 * Same as the follow-up, but the assessment is split into primary and secondary
 * diagnoses plus an explicit problem list.
 */
export const FOLLOWUP_DX_BODY = `${OPENING}

*S:*
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

${THERAPY_AND_PLAN}

${CLOSING}`;

/**
 * Follow-up with the objective block condensed to one line.
 *
 * Used when the physical examination is unremarkable: vitals run together with
 * semicolons and the rest collapses to `_Pemeriksaan fisis dalam batas normal_`.
 * Copied from a real handover rather than invented — the point of a short form
 * is that it matches what the consultant already reads, not that it is shorter.
 */
export const FOLLOWUP_RINGKAS_BODY = `${OPENING}

*S/*
- 

*O/*
GCS E4V5M6; Tekanan Darah :  mmHg; Nadi :  kali/menit, reguler; Pernapasan :  kali/menit; Suhu :  derajat celcius; Saturasi : % on room air

_Pemeriksaan fisis dalam batas normal_

TB  cm
BB  kg

*Mohon izin pasien kami assess dengan :*
- 

${THERAPY_AND_PLAN}

${CLOSING}`;

/** Long S — history, review of systems, prior medication, risk factors. */
export const ADMISI_BODY = `Assalamu'alaikum dokter. Tabe dokter, mohon izin melaporkan pasien baru di *Ruang  Kamar  Bed *  atas nama : 

*Tn.  /  /  tahun / RM *

_DPJP Utama dan Tindakan : _

_Rencana Tindakan :  ()_

*S:*
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

${THERAPY_AND_PLAN}

${CLOSING}`;
