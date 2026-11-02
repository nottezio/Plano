import type { GuideStep } from './guide';

/**
 * Panduan Helper (2 Nov 2026): one step per tool, in tab order. The tools
 * share a page, never data, so each step stands on its own.
 */

/** Per device. */
export const HELPER_GUIDE_KEY = 'plano.helper.guideSeen';

export const HELPER_GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang di Helper',
    lead: 'Helper berisi empat alat untuk urusan administrasi bangsal, satu per tab, plus **Tersimpan**.',
    points: [
      'Tab: **Konfirmasi Jaga**, **Verifikasi List**, **Buat Sensus**, **Morning Report**, **Tersimpan**.',
      'Tiap alat menyusun pesan dari teks atau PDF yang Anda masukkan. **Periksa sendiri hasilnya** (nama, RM, DPJP, diagnosis, jumlah pasien) sebelum disalin atau dikirim.',
      'Panduan ini bisa dibuka lagi kapan saja dari tombol **Panduan**.',
    ],
  },
  {
    id: 'jaga',
    title: '1. Konfirmasi Jaga',
    lead: 'Menyusun Formasi Jaga dan pesan konfirmasi dari jadwal, tanpa mencocokkan inisial satu per satu.',
    points: [
      'Impor jadwal sekali sebulan di kotak **Jadwal**: mulai dari **Jadwal Jaga PPDS** (PDF), lalu **Jadwal DPJP**, **Daftar Jarkom**, dan **Jadwal Jaga Pediatri** (PDF, atau tempel pesan WhatsApp-nya).',
      'Pilih tanggal dan **Shift**. Isi **Nama saya** dan **Pos saya** sekali saja.',
      '**Salin Formasi** untuk grup; tiap orang punya pesan konfirmasi sendiri dengan tombol **Salin**. Centang **Terkonfirmasi** setelah dibalas.',
      'Nama tidak cocok? Buka **Salah orang?** dan pilih baris Jarkom yang benar.',
    ],
  },
  {
    id: 'sensus',
    title: '2. Verifikasi List',
    lead: 'Memeriksa list bangsal terhadap denahnya: pasien yang hilang, dobel, atau beda kamar.',
    points: [
      'Perlu AI: aktifkan di **Pengaturan → Fitur AI** dengan API key Anda.',
      'Masukkan PDF **DENAH PASIEN** dan **LIST PASIEN**, lalu **Transkripsi dan periksa**.',
      'Baca peringatan transkripsi dulu, lalu kerjakan **Saran** satu per satu. PDF tidak disimpan.',
    ],
  },
  {
    id: 'buatsensus',
    title: '3. Buat Sensus',
    lead: 'Sensus pasien satu DPJP, dari list yang dikirim tiap ruangan.',
    points: [
      '**1 · Tempel list ruangan**: pilih **Tanggal sensus**, tempel list tiap ruangan. Tersimpan per tanggal, jadi aman bolak-balik ke WhatsApp.',
      '**2 · DPJP**: pilih **DPJP saya**, atur **Sapaan** dan **Baris pasien** bila perlu.',
      '**Cara menyusun**: **Aturan** (di perangkat) atau **AI** (**Susun dengan AI**). Cek kotak **Perlu dicek** sebelum dikirim.',
      'Salin hasilnya, dan **Simpan** agar masuk ke Tersimpan.',
    ],
  },
  {
    id: 'mr',
    title: '4. Morning Report',
    lead: 'Tiga pesan dari satu tempat: minta list ke senior, laporan Grup Prodi, dan konfirmasi Grup PAKAR.',
    points: [
      '**Tanggal MR**: pilih hari MR dan sejak kapan jaganya dihitung.',
      '**Minta list ke senior**: isi **Nama Anda** dan list yang diminta, lalu salin pesan **Ke senior**.',
      'Tempel list yang dikirim di **Pasien Dinas dan Jaga**.',
      'Di **Pesan**, salin **Laporan Grup Prodi** dan **Konfirmasi Grup PAKAR**. Pengaturan dan isinya ikut akun, di semua perangkat.',
    ],
  },
  {
    id: 'tersimpan',
    title: '5. Tersimpan',
    lead: 'Semua hasil yang Anda **Simpan** dari keempat alat, di semua perangkat akun ini.',
    points: [
      'Dikelompokkan menurut tanggal hasilnya (tanggal sensus, shift), bukan waktu menyimpan.',
      'Cari dengan nama atau RM pasien untuk menemukan sensus tempat ia tercantum.',
    ],
  },
];
