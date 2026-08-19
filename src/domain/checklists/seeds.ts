/**
 * Reusable checklists — the things that get forgotten.
 *
 * Distinct from the daily patient checklist, which tracks one patient through
 * one day and resets at midnight. These are procedures: a sequence you work
 * through once for a particular situation, then reset and use again for the
 * next patient in the same situation.
 *
 * Transcribed from the sheets rather than paraphrased. A checklist that has
 * been reworded is one nobody trusts, because the reader cannot tell whether an
 * item was changed on purpose.
 *
 * Every one is editable, and these are seeds rather than fixtures: the ward
 * changes what it wants and a redeploy is the wrong unit of change for that.
 */

export interface ChecklistTemplateItem {
  id: string;
  label: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  /** Shown under the title — when this list applies. */
  context?: string;
  items: ChecklistTemplateItem[];
  /**
   * The "Catatan" under a sheet: rules that qualify the items rather than
   * being steps themselves.
   *
   * Kept as notes rather than folded into the list, because turning a caveat
   * into a tickable step changes what ticking means — "Faktor risiko: kalau
   * NIHIL tulis di riwayat" is not something you do once and finish.
   */
  notes?: string[];
}

function items(...labels: string[]): ChecklistTemplateItem[] {
  return labels.map((label, index) => ({ id: `i${index + 1}`, label }));
}

export const SEED_CHECKLISTS: readonly ChecklistTemplate[] = [
  {
    id: 'poli-tindakan',
    title: 'Pasien poli untuk CA standby + PPM + EP study',
    context: 'Termasuk advanced PCI, staging PCI, TPM',
    items: items(
      'Cek SEP (tindakan apa, DPJP utama dan DPJP tindakan)',
      'Anamnesis + TTV dan EKG pasien',
      'Buka laporan invasif (nyanyian invasif)',
      'Lapor di grup invasif PJT (attach EKG + swipe)',
      'IC + site marking + edukasi',
      'Bikin SOAP (pakai anamnesis panjang). Untuk pasien baru lapor ke chief. PDF untuk trio, PPT untuk Prof MZ',
      'SOAP fix tulis di CPPT, order lab / order resep',
      'Konsul invasif di sistem (besoknya) sesuai hari H tindakan',
      'Pastikan sudah ada jadwal rencana kegiatan (di SIMGOS = Perencanaan)',
    ),
    notes: [
      'Untuk pasien IGD yang mau tindakan: buka perencanaan, jadwal tindakan (yang belum ada rencana).',
      'Kalau dari poli, biasanya sudah direncanakan dari poli.',
    ],
  },
  {
    id: 'pindah-cvcu',
    title: 'Perpindahan pasien CVCU',
    items: items(
      'Chat senior paling junior yang lagi stase IACC untuk meminta SOAP panjang',
      'Anamnesis singkat (sesak / nyeri / berdebar) + TTV dan EKG pasien (ubah format dari CVCU ke SOAP)',
      'Cek plan di SOAP panjang, misal cek lab / koreksi elektrolit',
      'Bikin SOAP fix → lapor chief, jika ACC lanjutkan sesuai instruksi',
      'Order radiologi / lab',
      'Order resep',
      'SOAP fix tulis di CPPT',
    ),
    notes: [
      'Untuk pasien IGD yang mau tindakan: buka perencanaan, jadwal tindakan (yang belum ada rencana).',
    ],
  },
  {
    id: 'pindah-igd',
    title: 'Perpindahan pasien IGD',
    items: items(
      'Chat senior paling junior yang lagi stase IGD untuk meminta SOAP panjang',
      'Anamnesis singkat (sesak / nyeri / berdebar) + TTV dan EKG pasien',
      'Cek plan di SOAP panjang, misal cek lab / koreksi elektrolit',
      'Bikin SOAP fix → lapor chief, jika ACC lanjutkan sesuai instruksi',
      'Order radiologi / lab',
      'Order resep',
      'SOAP fix tulis di CPPT',
    ),
  },
  {
    id: 'pulang-h1',
    title: 'Pasien rencana pulang (H-1)',
    items: items(
      'Centang H-1 di CPPT, atur tanggal pulang',
      'Konsul untuk resep rencana pulang ke chief; jika sudah ACC, order resep pulang (centang)',
      'Bikin resume',
      'Bikin kartu kontrol (cek jadwal poli)',
      'Tulis diagnosis pulang di lembar MR1',
    ),
    notes: [
      'Resume: SOAP panjang; ceritakan perjalanan penyakit pasien (ada format).',
      'Faktor risiko: kalau NIHIL tulis semua di riwayat penyakit sekarang; kalau ada, ceklist satu-satu di kolom resume.',
      'Pemeriksaan fisis awal dan akhir dicantumkan.',
      'Indikasi rawat inap (dari IGD) dikosongkan.',
      'Isi KIE dan edukasi.',
      'Pemeriksaan lainnya: EKG, echo, hasil CA, hasil 6MWT.',
      'Konsul: hasil konsul dengan TS lain.',
      'Jangan lupa centang hijau-hijau, 1 saja.',
      'Resume dibikin H-1. Jika pasien sudah pulang, jangan lupa coding — lihat diagnosis yang tercoder.',
      'Pasien trio atau post tindakan: jangan lupa 6MWT sebelum pulang. Kalau sudah 6MWT, PASTIKAN sudah terkonekta.',
    ],
  },
  {
    id: 'konsul-cabg',
    title: 'Pasien konsul mau CABG (dari BTKV)',
    items: items(
      'Cek riwayat pasien sebelumnya dan sama DPJP siapa (yang mengerjakan, itu berarti DPJP-nya)',
      'Tanyakan kapan terakhir minum aspilet dan CPG — harus di-stop minimal 5 hari sebelum tindakan',
      'Format SOAP ada di komunitas (cari riwayat pemeriksaan di SIMGOS)',
    ),
    notes: [
      'Konsul KELAYAKAN: cukup format "setelah dilakukan anamnesis…", tambahkan Lee criteria untuk risiko MACE.',
      'Konsul RAWAT BERSAMA: format "setelah dilakukan anamnesis…" ditambah Assessment dan Plan.',
    ],
  },
];
