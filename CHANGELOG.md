# Plano — Yang baru

Ringkasan tiap pembaruan, untuk pengguna. Tampil di Pengaturan → Yang baru.
Catatan teknis lengkap (akar masalah, perbaikan) ada di CHANGES.md.

Entri teratas harus versi yang sedang dirilis; tes gagal bila belum ditulis.

## `2026-09-30.1`
- **Pengingat harian di kartu pasien:** EKG dan Urine output, atau pengingat buatan sendiri (Pengaturan → Pengingat harian). Pasang per pasien sebagai "Hari ini" atau "Setiap hari" lewat tekan lama kartu atau menu ⋯ pasien. Ketuk penanda di kartu untuk mencentang; centang hilang sendiri besok.
- **Hitungan hari (H-1, POD-2…) di Periksa lagi:** semua hitungan yang belum berubah tampil sebagai chip yang bisa digeser. Ketuk untuk melompat ke barisnya, **+1** untuk menaikkan satu per satu.
- **Periksa lagi mengenali urine output yang sama dengan kemarin** — dalam bentuk apa pun yang biasa ditulis (UO, Produksi urin, Diuresis, BAK, cc/kgBB/jam).
- **Pengaturan ditata ulang:** kotak cari, lompat ke kelompok, dan tombol yang lebih besar.
- **Yang baru:** daftar perubahan ini, di Pengaturan.

## `2026-09-29.8`
- Kalimat pembuka konsul KJS dan konsul kelayakan tindakan disesuaikan dengan format SOAP terbaru.
- Pembuka tidak lagi merusak kalimat pembuka template poli.
- **Impor data:** berkas ekspor Plano bisa dimasukkan ke akun ini (pindah akun, akun hilang). Hanya menambah, tidak pernah menimpa; impor dua kali tidak membuat duplikat.

## `2026-09-29.7`
- Masuk hanya dengan Google, ditegakkan juga di server.
- Halaman Admin didesain ulang.
- Bagian bawah sidebar kiri dirapikan menjadi satu kartu ringkas.
- Cari di Arsip bisa memilih tempat mencari: identitas, catatan arsip, atau isi SOAP.
- Catatan jaga di arsip selalu urut tanggal dibuat.
- Menambah SOAP jaga cukup satu ketukan, dari template.

## `2026-09-29.6` — audit bug
- Audit seluruh aplikasi (sinkronisasi, editor, papan, pembaca catatan, login). Temuan yang terbukti diperbaiki dari akarnya, dengan tes.

## `2026-09-29.5`
- Penanda kardiologi: PCI, EP study/ablasi, BTKV.
- Nama pasien tampil saat menyalin, dan ada peringatan bila isi clipboard milik pasien lain.
- Kartu pasien memperbarui dirinya sendiri.
- Helper punya tombol kembali.
- Kartu di Arsip menampilkan catatan arsip.
- Pegangan geser kartu paling atas tidak lagi tertutup header.

## `2026-09-29.4`
- Pembaruan aplikasi di HP: ditemukan sendiri, dipasang dengan satu ketukan, dan ada pengganti Ctrl+Shift+R.
- HP tidak lagi lama "Memuat" menunggu halaman login Google.

## `2026-09-29.3`
- "Salin dari hari sebelumnya" tidak lagi mengosongkan HR di blok EKG atau echo.

## `2026-09-29.2`
- Periksa lagi tidak lagi menyalahkan plan yang tidak ada, dan setiap Tampilkan menuju baris yang benar.
- Pemeriksaan AI dibangun ulang: menambah yang tidak terlihat oleh aturan, dengan kutipan dari catatan.
- Halaman Dokumen dan Checklist didesain ulang.

## `2026-09-29.1`
- Dropdown terbaca di mode gelap.
- "Salin dari hari sebelumnya" mengosongkan TTV bagaimanapun ditulis.
- Periksa lagi membaca tanda vital sesuai cara bangsal menulis, dan diam bila catatan sudah baik.

## `2026-09-28.6`
- Header papan jauh lebih ringkas: satu baris di laptop, dua baris di HP yang tersembunyi saat menggulir.

## `2026-09-28.5`
- Header papan tetap di tempat.
- Mengetik di catatan yang baru dibuka tidak lagi hilang atau melompat ke akhir.
- Pencarian bisa melihat isi catatan pasien arsip; halaman Arsip dibangun ulang.

## `2026-09-28.4`
- PDF lab dibaca lebih tepat; PDF radiologi, echo dan tindakan dikenali, tidak dibaca sebagai lab.

## `2026-09-28.1`
- Catatan dibangun ulang: daftar dan isi berdampingan di laptop, layar penuh di HP, bisa dicari, disematkan dan diurutkan. Hapus masuk ke Sampah.
