/**
 * Two consult-reply SOAPs, as written on the ward (September 2026), with the
 * patients' names, dates of birth and RM numbers REPLACED. Structure, headings,
 * spacing and markup are untouched — they are what the tests are about.
 *
 * Kept short where the content is clinical prose the parser never looks at;
 * every heading and marker line is kept exactly.
 */

export const KONSUL_BARU_KJS = `Assalamualaikum dokter. Tabe dokter, mohon izin melaporkan pasien baru KJS *TS Bedah Digestif Prof. Dr. dr. Warsinggih, SpB.Subsp.BD(K), M.Kes* di *PJT Lantai 4 Kamar 415 bed 1* atas nama :

*Tn. Pasien A/ 01-01-1979 / 47 tahun /RM 0000001*

_DPJP Kardio : dr. Aussie Fitriani Ghaznawie, Sp. JP, Subsp EKO(K)_
_DPJP Bedah Digestif (Utama) : Prof. Dr. dr. Warsinggih, SpB.Subsp.BD(K), M.Kes_
_DPJP EMD : Dr. dr. Himawan Sanusi, Sp. PD, K-EMD, FINASIM_

_Pasien dikonsulkan untuk evaluasi dan tatalaksana pasien dengan suspek edema paru, DM tipe 2 non-obese, GIST, post laparatomi reseksi tumor_

*S:*
- Pasien dikonsulkan dengan keluhan sesak nafas sejak sore hari ini.
- Pasien pasca laparatomi tumor intra abdomen tanggal 21-09-2026 

Faktor resiko koroner:
- Riwayat Hipertensi tidak ada.
- Riwayat Diabetes ada.

*O:*
Compos Mentis GCS (E4V5M6)
Tekanan Darah : 124/65 mmHg
Nadi : 149 kali/menit, reguler

BB : 60kg
TB : 170cm

*EKG PJT Lantai 4 (24-09-2026)*
Sinus tachycardia, HR 166 bpm, regular, normoaxis

*Laboratorium PJT (21-09-2026)*
WBC *35.30*
HGB 13.6

*Foto Thorax Post Op (22-09-2026)*
- Lymphadenopathy hilar kanan

*Laporan Operasi Laparotomi Tumor Intra-Abdomen (24-09-2026)*
1. Pasien berbaring dalam posisi supine dan dalam pengaruh general anestesi
9. Operasi selesai

*Echocardiography bedside (24-09-2026)*
- Normal LV Systolic Function, EF 65% (TEICH)

Lung Ultrasound :
Lung sliding (+), Pleural line regular, A Line (+), B line (-)

*Echo Hemodinamik (24/09/2026)*
MAP 84 mmHg

*_Saat ini evaluasi kardiologi berdasarkan anamnesis, pemeriksaan fisik, EKG & pemeriksaan echocardiography bedside, pasien kami assess dengan Tachypnea ec Abdominal Pain. Tidak ada tatalaksana khusus dari bagian Kardiologi_*

*TS Bedah Digestif*
A/
- GIST
- POH-2 laparotomi reseksi tumor
P dan I/
- IVFD Ringer Laktat : Dextrose 5% : Bfluid 1:1:1 per 24 jam
- Ceftriaxone 1 gram per 2 jam per intravena
Tatalaksana lain sesuai TS Anestesi

*TS EMD*
A/
- DM Type II non Obese
P/
Plan diagnostik

Plan Monitoring
- Monitoring tanda vital dan keadaan umum
I/
- Diet DM 1500 kkal

Selanjutnya mohon arahan dokter. Terima kasih dokter.`;

export const KONSUL_DARI_TS = `Assalamualaikum Dokter, tabe dokter, mohon izin melaporkan konsul pasien dari TS Pulmo (Dr. dr. Muh. Ilyas, Sp.PD, K-P, Sp.P(K)) di PJT Lt 4 kamar 420 Bed 5 atas nama :

*Tn. Pasien B / 00000002 / 01-01-1986 / 40 thn*

_DPJP Kardio : dr. Aussie Fitriani Ghaznawie, Sp. JP, Subsp EKO(K)_
_DPJP BTKV (Utama) :  dr. Muhammad Zulfadly Nuralim, M.Ked.Klin, Sp.BTKV_
*DPJP Pulmo : Dr. dr. Muh. Ilyas, Sp.PD, K-P, Sp.P(K)*

_Pasien dikonsul untuk kelayakan bronkoskopi dengan general anestesi_

*S:*
- Pasien keluhan nyeri dada kiri yang sudah dialami sejak 3 tahun yang lalu.

Faktor Risiko Kardiovaskular :
- Riwayat hipertensi ada, tapi tidak terkontrol

*O:*
Compos Mentis GCS (E4V5M6)
Tekanan Darah : 121/81 mmHg

*EKG di PJT Lt. 4 (24-09-2026)*
Sinus rhythm, HR 107 bpm, regular.

*Laboratorium RSWS (24-06-2026):*
WBC : 8.46

*Foto Thorax RSWS (18-9-2026)*
Kesan :
- TB paru lama  aktif  lesi luas disertai infected bronchiectasis

*USG thoraks RSWS (23/09/26)*
Left hemithorax: 
Pleural sliding (+)

*Laporan Torakotomi dan Dekortikasi (15-09-2026)*
1. Pasien diposisikan Right Lateral Decubitus (RLD) di bawah pengaruh anestesi umum.
10. Luka operasi dibersihkan dan ditutup dengan kasa steril. Operasi selesai.

*Saat ini evaluasi Kardiologi berdasarkan anamnesis, pemeriksaan fisik, pemeriksaan EKG, serta echocardiography bedside, pasien termasuk kategori Low Risk (Lee Revised Cardiac Risk Index) 0.9% estimated risk of MACE (Major Adverse Cardiovascular Events) untuk tindakan Bronkoskopi dengan General Anestesi.*

*TS Pulmo*
A/
- Aspergilloma Pulmo Sinistra
- Hipertensi on treatment
P/
- Monitoring tanda vital dan klinis
I/
- Oksigen via nasal kanul 4 lpm
- terapi lain sesuai TS BTKV

*TS BTKV*
A/
- POD-9 Torakotomi Eksplorasi + Dekortikasi
P/
- Observasi
I/
- IVFD NaCl 0.9% 1500 ml / 24 jam
- Terapi lain sesuai TS KJS

Terima kasih dokter, mohon arahannya dokter`;
