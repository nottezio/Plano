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

/**
 * Transcribed from a real note rather than written from memory.
 *
 * The wording matters more than it looks: the ward writes `Tensi` and `Nafas`,
 * not `Tekanan Darah` and `Pernapasan`, and GCS sits on the `*O :*` line with
 * "Compos Mentis". A template that reads almost-right is worse than none —
 * every use starts by correcting it, and the corrections are what get missed at
 * five in the morning.
 *
 * Height, weight and the physical examination sit BELOW the vitals with a blank
 * line between, which is how they are read.
 */
const VITALS = `*O:*
Compos Mentis GCS (E4V5M6)
Tekanan Darah :  mmHg
Nadi :  kali/menit, reguler
Pernapasan :  kali/menit
Suhu :  derajat Celcius
SpO2 : % on room air

TB :  cm
BB :  kg

Anemis tidak ada, ikterus tidak ada
JVP R+2 cmH20
BJ I/II murni reguler, murmur tidak terdengar
BP Vesikuler, ronkhi dan wheezing tidak ada
Abdomen peristaltik kesan normal
Edema ekstremitas tidak ada, akral hangat, CTR < 2 detik`;

const THERAPY_AND_PLAN = `*Mohon izin kami terapi dengan:*
- 

*Plan:*
- Pantau tanda vital dan hemodinamik
- `;

const CLOSING = `Selanjutnya mohon arahan dokter. Terima kasih dokter.`;

/** Short S — the daily follow-up. */
export const FOLLOWUP_BODY = `${OPENING}

*S:*
- Saat ini keluhan nyeri dada tidak ada, sesak napas tidak ada, berdebar tidak ada.
- BAB dan BAK dalam batas normal.

${VITALS}

*Mohon izin kami assess dengan:*
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

*Mohon izin kami assess dengan:*
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

*Mohon izin kami assess dengan:*
- 

${THERAPY_AND_PLAN}

${CLOSING}`;

/**
 * KJS consult — a new patient referred jointly across specialties.
 *
 * Structurally different from every other seed: the diagnosis list and closing
 * come BEFORE the SOAP body, not after. That is not a mistake in the template —
 * it is how these are actually written, because the referring service wants the
 * consult question answered in the first few lines, and the full workup follows
 * for whoever reads further.
 */
export const KONSUL_KJS_BODY = `Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan pasien baru KJS *TS (Bagian) ((Nama DPJP TS))* di *(Ruang) Kamar (no) Bed (no)* atas nama :

*(Nama)/(tgl lahir)/(umur)/RM (no)*

_DPJP (Bagian) (Utama): (Nama DPJP TS)_
_DPJP Kardio : (Nama DPJP Kardio)_

_Pasien dikonsulkan untuk evaluasi dan tatalaksana pasien rencana (tindakan) ((hari, tanggal))_

*S:*
- 
- Keluhan batuk tidak ada. Mual dan muntah tidak ada, nyeri ulu hati tidak ada. Demam tidak ada. BAB dan BAK kesan lancar.
- Riwayat serangan jantung tidak ada. Riwayat stroke tidak ada, riwayat asma tidak ada, riwayat batuk lama tidak ada, riwayat alergi makanan tidak ada, riwayat alergi obat tidak ada.

Faktor resiko koroner:
- Riwayat Hipertensi tidak ada.
- Riwayat Diabetes tidak ada.
- Riwayat Merokok tidak ada.
- Riwayat Penyakit Jantung dalam keluarga tidak ada.

${VITALS}

*Mohon izin kami assess dengan:*
- 

*Mohon izin kami terapi dengan:*
- 

*Plan:*
- Monitoring tanda vital dan hemodinamik

*TS (Bagian)*
A/
- 

P/
- 

${CLOSING}`;

/**
 * New patient referred from poli, admitted directly to a bangsal bed.
 *
 * Distinct from ADMISI_BODY: that one is a general long-S admission, this one
 * carries the specific opening line for a poli referral ("pengantar dari poli
 * di bangsal") and the diagnosis split into Primer / Sekunder / Problem that
 * these referrals are written with.
 */
export const POLI_BARU_BODY = `Assalamualaikum dokter, tabe dokter izin melaporkan pasien baru dari *Poli (nama poli)* di *(Ruang) Kamar (no) Bed (no)* atas nama :

*(Nama)/(tgl lahir)/(umur)/RM (no)*

_DPJP Utama dan tindakan: (Nama DPJP)_

_Rencana tindakan : (tindakan) ((hari, tanggal))_

*S:*
- Pasien masuk pengantar dari poli (nama poli) dengan rencana tindakan : (tindakan) ((hari, tanggal))
- 
- Keluhan nyeri dada tidak ada, riwayat nyeri dada tidak ada. Berdebar tidak ada, riwayat berdebar tidak ada. Sesak nafas tidak ada, riwayat sesak nafas tidak ada.
- Demam tidak ada, batuk dan beringus tidak ada, mual dan muntah tidak ada. BAB dan BAK dalam batas normal.
- Obat rutin disangkal.

Faktor Risiko Kardiovaskular :
- Riwayat hipertensi tidak ada
- Riwayat Diabetes Mellitus tidak ada
- Riwayat merokok tidak ada
- Riwayat keluarga menderita penyakit jantung tidak ada

${VITALS}

*Mohon izin kami assess dengan:*
- 

*Mohon izin kami terapi dengan:*
- 

*Plan:*
- Monitoring tanda vital dan hemodinamik
- EKG per hari
- Rencana tindakan : (tindakan) ((hari, tanggal))

${CLOSING}`;

/**
 * Transfer into the ward — from IGD, CVCU or another floor.
 *
 * The commonest note there is, and it had no template: the opening states both
 * ends of the move, and the plan carries the follow-up checks the transfer
 * itself creates.
 */
export const PERPINDAHAN_BODY = `Assalamualaikum dokter, Tabe dokter, mohon izin melaporkan follow up pasien perpindahan dari *(Ruang asal)* ke *(Ruang tujuan) Kamar (no) Bed (no)* atas nama:

*(Nama)/(tgl lahir)/(umur)/RM (no)*

_DPJP Utama: (Nama DPJP)_

*S:*
- Nyeri dada tidak ada, riwayat nyeri dada ada. Sesak nafas tidak ada, riwayat sesak nafas ada. Berdebar tidak ada, riwayat berdebar tidak ada.
- Keluhan lain mual tidak ada, demam tidak ada, batuk dan beringus tidak ada.
- BAB dan BAK kesan normal.

${VITALS}

*Mohon izin kami assess dengan:*
- 

*Mohon izin kami terapi dengan:*
- 

*Plan:*
- Pantau tanda vital, hemodinamik, urine output dan balance cairan
- EKG/hari

${CLOSING}`;

/**
 * Konsul kelayakan pra-operasi — the largest gap the report examples showed.
 *
 * Three of eight real reports are this shape and no template matched it: the
 * opening names the planned operation, there are TWO DPJP lines (Kardio plus
 * the referring specialty as utama), and it closes with an explicit fitness
 * statement rather than a plan.
 *
 * Split from `rawat bersama` rather than combined, because the two answer
 * different questions — this one answers "is this patient fit for the
 * operation", and per your CABG sheet it needs Lee criteria for MACE risk. A
 * single template carrying both would mean deleting half of it every time, and
 * the half left behind is the one that gets sent by mistake.
 */
export const KONSUL_KELAYAKAN_BODY = `Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan konsul kelayakan tindakan dari *TS (Bagian) ((Nama DPJP TS))* di *(Ruang) Kamar (no) Bed (no)* atas nama :

*(Nama) / (tgl lahir) / (umur) / RM (no)*

_DPJP Kardio : (Nama DPJP Kardio)_
_DPJP (Bagian) (utama) : (Nama DPJP TS)_

_Pasien dikonsulkan untuk kelayakan rencana tindakan (nama tindakan), hari (hari, tanggal)_

*S:*
- 

Faktor risiko kardiovaskular :
- Riwayat hipertensi tidak ada
- Riwayat diabetes tidak ada
- Riwayat merokok tidak ada
- Riwayat penyakit jantung dalam keluarga tidak ada

${VITALS}

*Mohon izin kami assess dengan:*
- 

*Risiko MACE (Lee Revised Cardiac Risk Index) :*
- Penyakit jantung iskemik : 
- Gagal jantung kongestif : 
- Penyakit serebrovaskular : 
- Diabetes dengan insulin : 
- Kreatinin > 2 mg/dL : 
- Operasi risiko tinggi : 
Skor:  — risiko: 

*Kesimpulan kelayakan :*
- Setelah dilakukan anamnesis, pemeriksaan fisis dan pemeriksaan penunjang, pasien dinilai  untuk dilakukan tindakan (nama tindakan).

Selanjutnya mohon arahan dokter. Terima kasih dokter`;



/**
 * Follow-up post-tindakan with a temporary pacemaker.
 *
 * The paired `On TPM` / `Off TPM` ECG blocks appear nine times across the real
 * reports — it is a standing pattern, not an occasional one, and the pair is
 * the point: the Off strip is what shows whether the patient is still pacing
 * dependent.
 */
export const FOLLOWUP_TPM_BODY = `${OPENING}

*S:*
- Saat ini keluhan nyeri dada tidak ada, sesak napas tidak ada, berdebar tidak ada.
- Keluhan pusing atau rasa mau pingsan tidak ada.

${VITALS}

*EKG (Ruang) ((tanggal)) On TPM*
- 

*EKG (Ruang) ((tanggal)) Off TPM*
- 

*Mohon izin kami assess dengan:*
- 

${THERAPY_AND_PLAN}
- Monitoring irama dan capture TPM
- Evaluasi ketergantungan pacing

${CLOSING}`;

/**
 * Balasan konsul to another service.
 *
 * The `I/` … `P/` form, which is structurally unlike every other template here:
 * it is a reply written into someone else's note, so it opens with the
 * impression rather than with a greeting and identity block.
 */
export const BALASAN_KONSUL_BODY = `Terima kasih atas konsulnya dokter.

Setelah dilakukan anamnesis, pemeriksaan fisis dan pemeriksaan penunjang pada pasien:

*(Nama) / (umur) / RM (no)*

A/ 
- 

I/ 
- 

P/ Plan Diagnostik: 
- 

Plan Monitoring: 
- Pantau klinis, tanda vital

Plan Terapi: 
- 

Demikian, terima kasih dokter`;


