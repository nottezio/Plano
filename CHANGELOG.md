# Plano — Yang baru

Ringkasan tiap pembaruan, untuk pengguna. Tampil di Pengaturan → Yang baru.
Catatan teknis lengkap (akar masalah, perbaikan) ada di CHANGES.md.

Entri teratas harus versi yang sedang dirilis; tes gagal bila belum ditulis.

## `2026-10-05.1`
- **Format bangsal diperbaiki (penting):** sebelumnya angka berkoma bisa terpotong — `Suhu 37,8 C` menjadi `Suhu : 37`, `NE 0,1 mcg` dan `Kalium 3,1` terbelah, dan pembacaan kedua sebuah tanda vital (mis. `HR monitor 130` setelah `nadi 112`) hilang tanpa jejak. Sekarang koma desimal dan isi dalam kurung tidak pernah dipotong, tidak ada temuan yang dibuang, dan kata seperti "sesak nafas" tidak lagi dibaca sebagai frekuensi napas.
- **Pemeriksaan otomatis sebelum menerapkan:** setiap kata dan angka catatan dicocokkan dengan hasilnya (termasuk hasil "Perbaiki dengan AI"). Bila ada yang hilang, daftar kata/angkanya ditampilkan dan tombol **Terapkan** dikunci.
- **Salin per bagian tidak lagi membawa kalimat penutup:** "Tabe terima kasih dokter", "Mohon arahannya dokter. Terima kasih dokter." dan sejenisnya kini dikenali walaupun tidak ada di daftar penutup di Pengaturan. Butir daftar (`- …`) tidak pernah dihapus.
- **Preview Salin tidak ikut bergeser saat diblok:** di laptop, teks Preview kini menggulir di kotaknya sendiri, jadi memblok teks sampai ke bawah tidak lagi menggeser tampilan.
- **Hasil lab disisipkan di tempat yang benar:** tepat **di atas lab terbaru**. Bila belum ada lab, **setelah EKG terakhir**. Sheet lab menuliskan di mana blok akan disisipkan.
- **Bagian atas catatan lebih ringkas:** info DPJP (rute kirim, format, 6MWT, poli, diagnosis) kini satu baris; ketuk untuk detail. "Periksa lagi" tanpa temuan cukup satu baris kecil, dan tombol "Periksa dengan AI" pindah ke samping judulnya.

## `2026-10-04.3`
- **Tampilan sheet dirapikan menyeluruh:** Salin, menu ⋯ pasien, Pembuka & penutup, Ubah ke format bangsal, dan Format hasil lab kini memakai satu gaya yang sama: judul bagian kecil, pilihan berbentuk tombol ringkas dengan tanda ✓, saklar geser untuk pilihan dua-tiga opsi, dan kotak peringatan berwarna sesuai tingkatnya.
- **Salin:** di laptop, pilihan di kiri dan Preview di kanan (tetap terlihat saat menggulir). Peringatan identitas tidak cocok kini paling atas. Tombol salin menyebut bentuk dan formatnya, dan jumlah karakter ditampilkan di bawah Preview.
- **Menu ⋯ pasien:** dikelompokkan (Catatan, AI, Pasien, Pengingat harian, Rencana pulang, Arsipkan) dengan ikon. Pemantauan, Titipan, dan Pin tampil sebagai saklar yang menunjukkan status saat ini. Hapus pasien dipisah di bagian paling bawah.
- **Pembuka & penutup:** menampilkan baris pembuka saat ini; salam, kalimat pembuka, dan penutup yang sedang dipakai diberi tanda ✓.
- **Format bangsal:** ringkasan berupa angka, peringatan "bagian tidak dikenali" berwarna, dan Sebelum/Sesudah lebar berdampingan.
- **Format hasil lab:** sumber di kiri (PDF/gambar bisa diketuk atau **diseret** ke kotak), hasil di kanan.
- Sheet di laptop lebih lebar bila berisi preview. Tombol ✕ tidak lagi berbingkai biru setiap kali sheet dibuka.

## `2026-10-04.2`
- **Bandingkan catatan didesain ulang.** Di atas kini ada pasangan **Dari → Ke**: dua kotak yang menunjukkan catatan mana dibandingkan dengan mana, plus tombol **⇄** untuk menukar sisi.
- Ketuk salah satu kotak untuk memilih catatan: daftar dikelompokkan **per tanggal** (terbaru di atas, dengan keterangan H-1, H-2…). Di bawah tiap tanggal ada SOAP-nya, lalu versi dan SOAP jaga hari itu. Semua hari bisa dipilih, tidak lagi terbatas 12 tombol terakhir.
- **Pilihan cepat** untuk perbandingan yang paling sering: **Hari sebelumnya**, **SOAP asli** (saat membuka versi atau SOAP jaga), dan versi lain hari itu.
- Tampilan **Berdampingan / Tandai perubahan** kini berupa tombol geser yang jelas, dan legenda warna menyebut sisi "Dari" dan "Ke".
- Catatan yang sedang dibuka ditandai **dibuka**.

## `2026-10-04.1`
- **Versi SOAP:** ketuk **+ Versi** di baris atas catatan (atau ⋯ → Buat versi SOAP) untuk membuat salinan SOAP hari ini, mis. versi khusus dr. AHA. Versi bisa diedit bebas; **SOAP aslinya tidak berubah**. Satu hari bisa punya beberapa versi.
- **Nama versi bisa diubah:** ketuk namanya di kepala editor. Nama awal mengikuti DPJP di catatan (mis. "Versi dr. AHA"). SOAP jaga juga bisa diberi nama.
- **Penunjang terbaru saja:** saat membuat versi, centang ini untuk menyisakan hanya EKG, Lab, Foto Thorax, Echo… dengan tanggal terbaru dari tiap jenis. Daftar blok yang dihilangkan ditampilkan sebelum versi dibuat. Hanya bagian di atas assessment yang dipangkas; rencana di Plan tidak tersentuh. Tersedia juga sebagai tombol di versi yang sudah ada.
- **Salin dari versi** memakai isi versi itu, dengan semua bentuk (Laporan harian, Ringkas, Konsul…).
- **Bandingkan** kini mencantumkan versi dengan namanya, jadi versi bisa dibandingkan dengan SOAP asli, dengan versi lain, atau dengan hari sebelumnya.
- **Format DPJP:** pilihan baru **Penunjang terbaru saja** di Pengaturan → Format DPJP. Bila aktif, "Pakai format ini" di Salin langsung memangkas penunjang lama dari teks yang disalin (catatan tetap utuh), dan versi baru untuk DPJP itu tercentang otomatis. Untuk dr. AHA, aktifkan sekali di Pengaturan.
- SOAP jaga tetap seperti sebelumnya (tombol **+ SOAP jaga**, format jaga, jam bisa diubah); kini tampil sebagai salah satu catatan lain di hari itu.

## `2026-10-03.1`
- **Bookmark baris di SOAP:** taruh kursor di sebuah baris, lalu ketuk ikon bookmark di toolbar. Baris itu diberi tanda biru di tepi kiri, dan namanya muncul di bar lompat atas (setelah S/O/A/Terapi). Ketuk untuk langsung menggulir ke baris tersebut — tanpa membuka keyboard — dan baris itu disorot sebentar. Ketuk ikon bookmark lagi di baris yang sama untuk menghapusnya.
- Bookmark tersimpan di pasien dan ikut tersinkron ke perangkat lain. Bookmark tetap ada di hari berikutnya bila barisnya terbawa, dan tetap menempel saat isi baris diedit (mis. `K 3,1` diubah jadi `K 3,5`).
- Bila baris yang di-bookmark sudah tidak ada di catatan terbaru, bar atas menampilkan "n bookmark tidak ditemukan · Hapus".
- **Konfirmasi Jaga akhir pekan menyebut shift-nya:** Formasi kini `*Hari/Tanggal : Sabtu Pagi, 5 September 2026*` (atau *Sabtu Malam*), dan pesan konfirmasi ke residen juga menyebut `_Sabtu Pagi, 5 September 2026_`. Hari kerja tetap tanpa Pagi/Malam.
- Formasi shift **Pagi** tidak lagi mencantumkan blok "DPJP setelah Pk. 00.00 WITA", karena tim pagi sudah serah terima sebelum tengah malam. Shift Malam dan hari kerja tetap mencantumkannya.
- **Salin → Teks polos mengubah simbol agar terbaca di SIMGOS**, tidak lagi menghapusnya: `→` jadi `->`, `↑` jadi `(naik)`, `↓` jadi `(turun)`, `±` jadi `+/-`, `µg` jadi `mcg`, `β` jadi `beta`, `✓` jadi `(v)`, dan lainnya. Berlaku di Preview dan teks yang disalin; catatan aslinya tidak berubah. Bisa dimatikan lewat centang "Ubah simbol agar terbaca di SIMGOS" (diingat di perangkat ini).
- **Perbaikan angka di teks polos:** `½ tab` dulu menjadi `12 tab` dan `10³/µL` menjadi `103/uL`. Sekarang menjadi `1/2 tab` dan `10^3/uL`, selalu.

## `2026-10-02.4`
- **Format hasil lab memakai tanggal dari PDF:** judul blok kini `*Laboratorium PJT (02-10-2026)*` — tanggal diambil dari **Tgl. Registrasi** (saat sampel diambil), bukan tanggal catatan. Lab IGD yang diambil 23:36 dan keluar lewat tengah malam tetap tertulis tanggal pengambilan.
- Judul mengikuti unit pengirim di PDF: **Laboratorium PJT**, **Laboratorium IGD**, CVCU, HCU PJT, atau poli sesuai yang tercetak. Judul dan tanggal tetap bisa diubah.
- Bila beberapa PDF dari tanggal berbeda digabung, muncul peringatan; judul memakai tanggal terbaru.
- Teks tempelan tanpa kepala laporan memakai tanggal catatan, seperti sebelumnya.

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
