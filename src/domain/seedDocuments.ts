/**
 * SPEC F8 - starter documents.
 *
 * Standing reference text a resident otherwise retypes: JARKOM announcements,
 * shift-confirmation chats, morning-report requests, and the short discharge
 * block.
 *
 * They are added ON REQUEST from the Documents page, never written
 * automatically at sign-in. An app that silently creates ten documents in
 * someone workspace has made a decision that was not its to make - and the
 * previous version of this app did exactly that with a template collection
 * nothing ever read.
 *
 * Every one is fully editable afterwards, like any other document.
 */
export interface SeedDocument {
  category: string;
  title: string;
  body: string;
}

export const SEED_DOCUMENTS: readonly SeedDocument[] = [
  {
    category: "lainnya",
    title: "Chat Senior Konfirmasi Formasi Jaga",
    body: "TIM JAGA SENIN, 13 JULI 2026\n(KIRIM CHAT KONFIRMASI MINGGU SIANG, PKL 14.00)\n \nELLEN\nSelamat siang dokter, tabe dok,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Chief Jaga PJT* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nJAUHAR\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Chief Konsul* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nMUTIA\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Chief Jaga Non-PJT* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nAUREA\nSelamat siang dokter, tabe dok,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga IGD A* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nRISHKA\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga IGD B* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nSUPEN\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga CVCU PJT* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nICHWAN\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga RSWS/UH* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nGABRIEL\nAssalamualaikum tabe dokter,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga Pediatri* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.\n \nFILLY\nSelamat siang dokter, tabe dok,\nMohon maaf mengganggu. Saya Asad, yang bertugas jaga di Bangsal PJT A pada _Senin, 13 Juli 2026_. Saya ingin mengonfirmasi apakah dokter bertugas sebagai *Jaga Bangsal PJT B* pada hari tersebut. Mohon arahan dan bimbingannya. Terima kasih, dokter.",
  },
  {
    category: "lainnya",
    title: "JARKOM Iuran Pakar",
    body: "Selamat pagi dokter, Tabe dokter, berdasarkan hasil pertemuan forum PAKAR yang telah dilaksanakan pada *Kamis, 05 Februari 2026* \n\nmaka diputuskan akan diberlakukan *IURAN BULANAN PAKAR* untuk kegiatan *Rumah Tangga PAKAR* dengan rincian sebagai berikut:\n\n- Tahap Chief: Rp. 50.000,-/ orang\n- \u2060Tahap Madya: Rp. 100.000,-/ orang\n- \u2060Tahap Junior: Rp. 200.000,-/ orang\n- \u2060Semester 1: Rp. 300.000,-/ orang\n\nIuran dikumpulkan per bulan (Berlaku mulai bulan Februari 2026) dengan batas maksimal setor iuran *Setiap tanggal 10*.\n\nLaporan pencatatan keuangan akan dilaporkan dan diaudit setiap bulannya oleh *Sekretaris Prodi*\n\nPengumpulan Iuran dapat dikirimkan pada:\n\nMARILYN\nBank BNI 1047122905\n\n*Tabe dokter, bukti pembayaran bisa langsung dikirim via WA ke dr. Marilyn (bendahara pakar)*.\n\nTabe terima kasih dokter.",
  },
  {
    category: "lainnya",
    title: "Konfirmasi Kehadiran DPJP  PJ MR",
    body: "Selamat sore dokter, tabe mohon maaf mengganggu dokter. \nIzin dok, saya dengan Tsani PPDS Kardio Semester 1.\n\nMohon izin petunjuk kesediaan dokter untuk berkenan memimpin Morning Report besok, *Senin, 13 Juli 2026* dokter.\n\nSekiranya dokter bisa hadir di jam berapa dokter? Mohon arahannya, terima kasih dokter.",
  },
  {
    category: "lainnya",
    title: "Laporan Kehadiran DPJP  PJ MR",
    body: "Assalamualaikum Dokter\nMohon izin melaporkan konfirmasi kehadiran Pengampu MR, *Senin, 20 Juli 2026*:\n\n*Pimpinan Morning Report terjadwal:*\n\u2022\u2060  \u2060\u2060Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K) (menunggu konfirmasi kehadiran)\n\u2022\u2060  \u2060Prof. Dr. dr. Idar Mappangara, Sp.PD, SpJP(K) (menunggu konfirmasi kehadiran)\n\u2022\u2060  \u2060dr. Almudai, Sp.PD, Sp.JP(K) (menunggu konfirmasi kehadiran)\n\u2022\u2060  \u2060dr. Bogie Putra Palinggi, Sp.JP (konfirmasi kehadiran Pukul 07.00)\n\nTabe terima kasih dokter",
  },
  {
    category: "lainnya",
    title: "Pelaporan Formasi Jaga ke AFM  AFG  ZD",
    body: "Assalamualaikum dokter\nTabe dokter, mohon izin melaporkan tim jaga: \n\n_DPJP Utama : dr. Aussie Fitriani Ghaznawie, Sp.JP, Subsp.Eko(K)_\n_DPJP Tindakan : Dr. dr. Abdul Hakim Alkatiri, SpJP(K)_\n_DPJP Onsite : Dr. dr. Khalid Saleh, Sp.PD-KKV_\n\n*Hari/Tanggal : Senin, 13 Juli 2026*\n\nChief PJT : Ellen\nChief Konsul : Jauhar\nChief Non PJT : Mutia\nIGD A : Aurea\nIGD B : Rishka\nCVCU : Supen\nPediatri : Gaby\nRSWS/UH : Ichwan\nBangsal A : Asad \nBangsal B : Filly\n\nMohon arahannya dokter. Terima kasih dokter.\n\n-----\n*DPJP Utama dan Tindakan setelah Pk. 00.00 WITA*\n_DPJP Utama : dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP, Subsp.PRKV(K)_\n_DPJP Tindakan : Dr. dr. Akhtar Fajar Muzakkir, Sp.JP(K)_",
  },
  {
    category: "lainnya",
    title: "Pelaporan SOAP ke DPJP versi PDF",
    body: "Chief : Malika\nJunior : Ghazi\n\nAssalamualaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lt. 4 Kamar 418 Bed 4* atas nama: \n\n*Tn. Hamzah Rahuddin / 01-01-1973 / 53 thn / RM 1656066*\n\n_DPJP Utama dan Tindakan : Dr. dr. Akhtar Fajar M, SpJP, Subsp. IKKV(K), KI(K)_\n\n_Pasien Post tindakan : CA Standby PCI  (Rabu, 15-07-2026)_\n\n*Diagnosis:*\n- Chronic Coronary Syndrome Clinical Presentation Type III\n- Coronary Artery Disease 2 Vessel Disease, with myocardial bridging at LAD\n- \u2060Myocardial Bridging di LAD\n\nSelanjutnya mohon arahan dokter.  Terima kasih dokter",
  },
  {
    category: "lainnya",
    title: "Pengenalan JARKOM ke Senior",
    body: "Selamat sore dokter.\nTabe dokter, maaf mengganggu, perkenalkan saya Tsani Fauzi PPDS Kardiologi Semester 1 dokter. Mohon izin dokter menyampaikan kalau saya adalah PJ Jarkom untuk kita selama 6 bulan kedepan dokter. \n\nMohon arahan dan bimbingannya dokter, terima kasih banyak sebelumnya dokter.",
  },
  {
    category: "lainnya",
    title: "Permintaan List Pasien Dinas  PJ MR",
    body: "Assalamualaikum dokter, mohon maaf mengganggu dok, izin apakah boleh meminta *List Pasien MR Dinas Senin, 20-06-2026* \nuntuk *MR Selasa, 21-06-2026* dokter? \n\nMohon arahannya dok, terima kasih dokter",
  },
  {
    category: "lainnya",
    title: "Permintaan List Pasien Jaga  PJ MR",
    body: "Assalamualaikum dokter, mohon maaf mengganggu dok, izin apakah boleh meminta *List Pasien MR Jaga Senin, 20-06-2026* \nuntuk *MR Selasa, 21-06-2026* dokter? \n\nMohon arahannya dok, terima kasih dokter",
  },
  {
    category: "pasien",
    title: "Format pasien pulang",
    body: "*Mohon izin kami terapi dengan*\n- Obat-obatan pulang\n\n*Plan:*\n- Rawat jalan hari ini tgl (tanggal)\n- Cek elektrolit kontrol tgl (tanggal)",
  },
];
