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
}

function items(...labels: string[]): ChecklistTemplateItem[] {
  return labels.map((label, index) => ({ id: `i${index + 1}`, label }));
}

export const SEED_CHECKLISTS: readonly ChecklistTemplate[] = [
  {
    id: 'poli-tindakan',
    title: 'Pasien poli rencana tindakan',
    context: 'CA standby PCI, advanced PCI, staging PCI, PPM, TPM, EP study',
    items: items(
      'Cek SEP (tindakan apa, DPJP utama dan DPJP tindakan)',
      'Anamnesis + TTV dan EKG pasien',
      'Buka laporan invasif (nyanyian invasif)',
      'Lapor di grup invasif PJT (attach EKG + swipe)',
      'IC + site marking + edukasi',
      'Bikin SOAP (anamnesis panjang)',
      'Pasien baru: lapor ke chief',
      'PDF untuk trio, PPT untuk Prof MZ',
      'SOAP fix ditulis di CPPT',
      'Order lab / order resep',
      'Konsul invasif di sistem (besoknya, sesuai hari H tindakan)',
      'Pastikan ada jadwal rencana kegiatan (SIMGOS → Perencanaan)',
      'Kontak senior minta operan dan nyanyian terakhir',
      'Kirim chief',
      'TTD chief',
    ),
  },
  {
    id: 'pindah-cvcu',
    title: 'Perpindahan pasien dari CVCU',
    items: items(
      'Chat senior paling junior yang stase IACC untuk minta SOAP panjang',
      'Anamnesis singkat (sesak / nyeri / berdebar) + TTV dan EKG pasien',
      'Ubah format dari CVCU ke SOAP bangsal',
      'Cek plan di SOAP panjang (mis. cek lab, koreksi elektrolit)',
      'Bikin SOAP fix → lapor chief, jika ACC lanjutkan sesuai instruksi',
      'Order radiologi / lab',
      'Order resep',
      'SOAP fix ditulis di CPPT',
    ),
  },
  {
    id: 'pindah-igd',
    title: 'Perpindahan pasien dari IGD',
    items: items(
      'Chat senior paling junior yang stase IGD untuk minta SOAP panjang',
      'Anamnesis singkat (sesak / nyeri / berdebar) + TTV dan EKG pasien',
      'Cek plan di SOAP panjang (mis. cek lab, koreksi elektrolit)',
      'Bikin SOAP fix → lapor chief, jika ACC lanjutkan sesuai instruksi',
      'Order radiologi / lab',
      'Order resep',
      'SOAP fix ditulis di CPPT',
      'Pasien IGD yang mau tindakan: buka perencanaan, jadwal tindakan',
    ),
  },
  {
    id: 'pulang-h1',
    title: 'Pasien rencana pulang (H-1)',
    items: items(
      'Centang H-1 di CPPT, atur tanggal pulang',
      'Konsul resep rencana pulang ke chief; jika ACC, order resep pulang',
      'Bikin resume',
      'Bikin kartu kontrol (cek jadwal poli)',
      'Tulis diagnosis pulang di lembar MR1',
      'Resume: ceritakan perjalanan penyakit (ada format)',
      'Faktor risiko — NIHIL: tulis di riwayat penyakit sekarang; ada: ceklist di resume',
      'Cantumkan pemeriksaan fisis awal dan akhir',
      'Indikasi rawat inap (dari IGD) dikosongkan',
      'Isi KIE dan edukasi',
      'Pemeriksaan lain: EKG, echo, hasil CA, hasil 6MWT',
      'Konsul: hasil konsul dengan TS lain',
      'Centang hijau satu saja',
      'Pasien trio atau post tindakan: 6MWT sebelum pulang, pastikan terkonekta',
      'Jika pasien sudah pulang: coding, lihat diagnosis yang tercoder',
    ),
  },
  {
    id: 'konsul-cabg',
    title: 'Pasien konsul CABG (dari BTKV)',
    items: items(
      'Cek riwayat pasien sebelumnya dan DPJP-nya (yang mengerjakan = DPJP-nya)',
      'Tanyakan kapan terakhir minum aspilet dan CPG — stop minimal 5 hari sebelum tindakan',
      'Format SOAP ada di komunitas (cari riwayat pemeriksaan di SIMGOS)',
      'Konsul kelayakan: format "setelah dilakukan anamnesis…" + Lee criteria untuk risiko MACE',
      'Konsul rawat bersama: format "setelah dilakukan anamnesis…" + assessment dan plan',
    ),
  },
];
