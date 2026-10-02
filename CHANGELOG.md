# Plano — Yang baru

Ringkasan tiap pembaruan, untuk pengguna. Tampil di Pengaturan → Yang baru.
Catatan teknis lengkap (akar masalah, perbaikan) ada di CHANGES.md.

Entri teratas harus versi yang sedang dirilis; tes gagal bila belum ditulis.

## `2026-10-02.3`
- **Tombol back kini naik ke halaman induk, seperti aplikasi.** Back dari pasien kembali ke papan (atau ke Arsip, bila pasien dibuka dari Arsip) — tidak lagi melewati setiap hari yang sempat dibuka. Berpindah tab (Arsip, Kalkulator, Pengaturan…) tidak menumpuk: back dari tab mana pun kembali ke papan, dan back di papan menutup aplikasi.
- **Back menutup sheet atau dialog yang terbuka** dulu (checklist cepat, menu pasien, Alat), bukan meninggalkan halaman.
- **Kembali ke daftar, posisi gulir tetap:** papan, Arsip, dan Dokumen kembali ke posisi terakhir, tidak lagi dari atas.
- Dibuka langsung dari tautan ke halaman pasien atau dokumen, back tetap menuju induknya, tidak keluar aplikasi.
- **Arsip bisa dilipat:** ketuk nama bulan atau minggu untuk membuka/menutup daftarnya. Bulan terbaru terbuka, bulan lama tertutup; pilihan diingat di perangkat ini. **Buka semua / Tutup semua** di atas daftar. Saat mencari atau memfilter, semua bulan otomatis terbuka.

## `2026-10-02.2`
- **Sisipkan → EKG hari ini** kini mengisi lantai dari bangsal pasien: `*EKG PJT Lt. 4 (02-10-2026)*`. Bila bangsal belum diisi, tetap `PJT Lt. ...`.
- **Toolbar format di bawah catatan didesain ulang:** ikon yang jelas (Undo, Redo, Bold, Italic, daftar poin/bernomor), menu **Sisipkan** yang menampilkan isi tiap blok sebelum disisipkan, dan menu **Rapikan** berisi "Tebalkan semua judul bagian" dan "Ubah • menjadi -" (dulu tombol "Aa*" dan "•→-").
- **Istilah Inggris bila padanan Indonesianya janggal:** Preview, Pin, Undo, Synced, Offline/Online, Pending, Hard refresh, browser.
- **Konfirmasi Jaga mengingatkan jadwal kedaluwarsa:** bila Jadwal Jaga PPDS, DPJP, atau Pediatri sudah lewat dari tanggal yang dikonfirmasi — atau habis dalam 3 hari — muncul peringatan dan kartu impornya diberi warna.
- **Kalkulator:** label urea kini "Ureum ÷ 6", tanpa nama sistem rumah sakit.
- **Arsip:** setiap bulan dibagi per minggu (Senin–Minggu), mis. "Minggu 2 · 5–11 Okt".

## `2026-10-02.1`
- **Lebih jarang "Memuat…":** daftar pasien kini tetap tersambung selama aplikasi terbuka. Kembali ke Aktif dari halaman pasien, atau membuka Arsip lagi, langsung tampil tanpa memuat ulang. Membuka pasien dari papan langsung menampilkan kartunya. "Memuat…" kini hanya muncul saat aplikasi benar-benar baru dibuka.

## `2026-10-01.4`
- **Versi HP tidak lagi hilang saat bentrok dengan laptop.** Bila simpanan HP ditolak server karena catatan sudah diubah di perangkat lain, teks HP kini tetap di layar dan digabung (baris berbeda) atau ditanyakan lewat dialog bentrok (baris yang sama) — tidak lagi diam-diam diganti teks laptop. Teks yang ditolak juga selalu masuk Riwayat perubahan sebagai "versi offline belum digabung".
- **Pengingat konsul ICU post-op (dr. Nuralim Mallapasi):** isi "Jadwal operasi (BTKV)" di pengingat pasien (tekan lama kartu / menu ⋯). Untuk pasien dr. Muhammad Nuralim Mallapasi, kartu menampilkan "Konsul ICU post-op" pada H-1 operasi, bisa dicentang.
- **Stiker PPM dan TPM** (permanent / temporary pacemaker) di grup Tindakan kardiologi.

## `2026-10-01.3`
- **Kanvas HP dibuat ulang:** setiap pasien jadi blok kecil (nama, kamar/bed, DPJP, progres, pengingat, Pulang/H-1), tiga per baris. Ketuk untuk membuka pasien, tekan lama untuk checklist. Tekan **Atur** lalu seret blok ke kotak lain — blok yang ditimpa bertukar tempat; **Rapikan** merapatkan celah. Susunan HP tersimpan di akun, terpisah dari laptop; pertama kali mengikuti urutan kanvas laptop.

## `2026-10-01.2`
- **Order obat tidak diminta pada hari pasien pulang.** Checklist, warna kartu, "Belum: …" dan filter papan mengabaikannya bila tanggal pulang = hari itu (H-1 tetap diminta). Langkah lain bisa diatur sama: Pengaturan → Checklist harian → "Lewati saat pulang hari ini".
- **Urutan visite:** urutan papan baru mengikuti rute keliling PJT Lantai 4 — 420 → 421 → 412 … 419 → 411 → 401 … 410 — bed naik di tiap kamar.
- **Kanvas di HP:** di Urutan sendiri, HP menampilkan kanvas yang disusun di laptop, diperkecil agar muat; cubit atau − / + untuk memperbesar, ketuk kartu untuk membuka pasien. Susunan laptop kini tersimpan di akun. Pilihan "Daftar" tetap ada.

## `2026-10-01.1`
- **"Ganti ke dokter / Prof" tidak lagi mengubah gelar DPJP.** Hanya sapaan di paragraf pembuka dan kalimat penutup yang diganti; "Prof. dr. …", baris DPJP, dan isi SOAP tidak tersentuh.
- **Salin Ringkas memakai sapaan catatan.** Penutup tidak lagi berubah jadi "Prof" hanya karena ada gelar Prof di baris pembuka; kalimat penutup catatan sendiri dipakai walau tidak ada di daftar Pengaturan.
- **Kalkulator ditata ulang:** dikelompokkan (Ginjal & cairan, Elektrolit, Konversi satuan, Alat lain), dua kolom di laptop, dan setiap kartu punya daftar **Rujukan**.
- **Konversi satuan baru:** Ureum ↔ BUN ↔ mmol/L, kreatinin mg/dL ↔ µmol/L, glukosa mg/dL ↔ mmol/L.
- **Urine output:** poliuria kini > 3 L/24 jam (definisi baku), bukan > 3 cc/kgbb/jam; oliguria mengikuti KDIGO 2012.
- **Catatan di kartu pasien:** dua baris di kartu, dan ketuk untuk membaca seluruhnya di panel yang melayang — tidak lagi menimpa kartu di bawahnya.

## `2026-09-30.3`
- **Kalkulator osmolalitas menampilkan rentang dan ambang:** efektif < 275 = hipotonik; efektif > 300 atau total > 320 = ambang HHS (bila GDS ≥ 600, konsensus 2024); total normal 275–295. Sumber tertulis di kartu. Rentang normal total bisa diganti di Pengaturan → Rentang rujukan lab.

## `2026-09-30.2`
- **Kalkulator osmolalitas diperbaiki:** kolom urea kini memilih **Ureum** (seperti di hasil lab, dibagi 6) atau **BUN** (dibagi 2.8). Sebelumnya ureum dibagi 2.8 seperti BUN, sehingga suku urea terhitung 2,14× terlalu besar (ureum 180 → +64, seharusnya +30).
- Menampilkan **osmolalitas efektif (tonisitas)** tanpa urea — nilai yang dipakai untuk menilai hiponatremia sebelum koreksi natrium — di samping osmolalitas total.
- Hasil baru muncul setelah ketiga kolom diisi (dulu langsung muncul dengan glukosa dan urea dianggap 0).
- Label rendah/normal/tinggi hanya muncul bila rentang osmolalitas diisi di Pengaturan → Rentang rujukan lab.

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
