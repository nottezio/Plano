import type { GuideStep } from './guide';

/**
 * Panduan List Maker (2 Nov 2026), shown when a list is first opened.
 *
 * A viewer ("lihat saja") has no Tempel tab and cannot accept a Saran, so
 * those steps are left out rather than shown greyed.
 */

/** Per device. */
export const LIST_MAKER_GUIDE_KEY = 'plano.listmaker.guideSeen';

const WELCOME: GuideStep = {
  id: 'welcome',
  title: 'Selamat datang di List Maker',
  lead: 'List Maker menyusun list pasien lantai dari pesan SOAP yang dikirim rekan di grup WhatsApp, dan membaginya ke tim lantai.',
  points: [
    'Satu list = satu lantai atau tim. Semua anggota melihat list yang sama, langsung tersinkron.',
    'Tab di atas: **Denah**, **List**, **Tempel**, **Analisis**, **Riwayat**, **Setelan**.',
    'Panduan ini bisa dibuka lagi kapan saja dari tombol **Panduan**.',
  ],
};

const WELCOME_VIEWER: GuideStep = {
  ...WELCOME,
  points: [
    'Akun Anda hanya bisa melihat list ini; pengisian dilakukan oleh anggota yang bisa mengedit.',
    'Tab di atas: **Denah**, **List**, **Analisis**, **Riwayat**, **Setelan**.',
    'Panduan ini bisa dibuka lagi kapan saja dari tombol **Panduan**.',
  ],
};

const PASTE: GuideStep = {
  id: 'tempel',
  title: '1. Isi list dari WhatsApp',
  lead: 'Di tab **Tempel**: salin pesan SOAP dari grup WhatsApp, lalu tempel di sini.',
  points: [
    'Tempel pesannya (boleh banyak sekaligus), atau buka file **Export chat** (.zip / .txt) lewat **Buka file export…**',
    'Ketuk **Baca**. Belum ada yang tersimpan: periksa dulu pasien baru, pindah kamar/bed, dan SOAP pasien yang sudah keluar.',
    'Centang yang benar, lalu **Simpan**. Tempel tidak pernah mengeluarkan pasien dari list.',
    'Salah tempel? **Batalkan tempel ini…** mengembalikan list ke sebelum Simpan.',
  ],
};

const DENAH: GuideStep = {
  id: 'denah',
  title: '2. Lihat pasien di Denah',
  lead: 'Tab **Denah** menampilkan pasien per kamar dan bed, untuk visite di samping pasien.',
  points: [
    'Ketuk bed untuk membuka SOAP terakhir pasien itu. Di layar lebar bisa membuka beberapa pasien sekaligus.',
    'Kotak **Cari** mencari nama, RM, kamar (mis. 417/2), residen, atau diagnosis; berlaku di Denah dan List.',
    'Warna bed mengikuti status: merah H-1, hijau pulang hari ini.',
  ],
};

const STATUS: GuideStep = {
  id: 'status',
  title: '3. Atur status dan chief',
  lead: 'Buka pasien untuk mengatur status: H-1, pulang hari ini, pulang, atau pindah.',
  points: [
    'Kotak **Saran** di atas Denah/List mengumpulkan usulan: Plan yang menyebut H-1/pulang, dan pasien yang perlu ganti chief.',
    'Saran tidak pernah berjalan sendiri: ketuk **Terima** (atau **Tandai**) untuk memakai, **Abaikan** untuk menolak.',
    'Isi **Chief Bangsal** di bagian atas. Saran ganti chief sudah muncul sejak 16.00 hari sebelumnya (untuk Senin dan setelah tanggal merah: sejak 07.00 hari sebelumnya), jadi terima dulu sebelum list dicetak. Tanggal merah ditandai di Setelan.',
  ],
};

const SEND: GuideStep = {
  id: 'list',
  title: '4. Kirim dan cetak list',
  lead: 'Tombol kirim dan cetak ada di samping tab, di semua tab. Tab **List** menampilkan pratinjau pesan WhatsApp.',
  points: [
    '**Salin teks** untuk dikirim ke grup WhatsApp.',
    '**Cetak**: **Word: List**, **Word: Denah** atau **PDF** (denah + list, 1 file).',
    '**Simpan edisi** (isi **Jam list** di sana) setelah mengirim: list berikutnya menandai **Pasien baru** dan **SOAP baru** sejak edisi ini.',
  ],
};

const SEND_VIEWER: GuideStep = {
  ...SEND,
  lead: 'Tombol kirim dan cetak ada di samping tab, di semua tab.',
  points: ['**Salin teks** untuk dikirim ke WhatsApp, atau **Cetak** untuk Word / PDF.'],
};

const MORE: GuideStep = {
  id: 'lainnya',
  title: '5. Riwayat, Analisis, Setelan',
  lead: 'Yang lain, bila perlu.',
  points: [
    '**Riwayat**: edisi list yang pernah disimpan; salin, cetak ulang, atau pulihkan list ke edisi itu.',
    '**Analisis**: **Bagi pasien** ke residen lantai, pergerakan hari ini (masuk, pulang, pindah kamar), hitungan seminggu, dan riwayat perubahan.',
    '**Setelan**: undang anggota lewat email (lihat saja, atau lihat dan edit), atur junior dan nama panggilan.',
  ],
};

const MORE_VIEWER: GuideStep = {
  ...MORE,
  points: [
    '**Riwayat**: edisi list yang pernah disimpan.',
    '**Analisis**: **Bagi pasien** ke residen lantai, pergerakan hari ini (masuk, pulang, pindah kamar), hitungan seminggu, dan riwayat perubahan.',
  ],
};

/** The steps for this user: an editor gets the whole flow, a viewer only what they can use. */
export function listMakerGuideSteps(editable: boolean): GuideStep[] {
  return editable ? [WELCOME, PASTE, DENAH, STATUS, SEND, MORE] : [WELCOME_VIEWER, DENAH, SEND_VIEWER, MORE_VIEWER];
}
