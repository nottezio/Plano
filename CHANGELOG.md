# Plano — Yang baru

Ringkasan tiap pembaruan, untuk pengguna. Tampil di Pengaturan → Yang baru.
Catatan teknis lengkap (akar masalah, perbaikan) ada di CHANGES.md.

Entri teratas harus versi yang sedang dirilis; tes gagal bila belum ditulis.

## `2026-10-09.3`
- **Baris pintasan bagian yang terpotong kini bisa digeser dengan mouse.** Di catatan panjang (mis. sensus), pintasan bagian di bawah tanggal melebihi lebar layar, dan di PC sisanya tidak bisa dijangkau. Kini roda mouse menggeser baris itu ke samping, sisi yang masih ada isinya memudar, dan tombol ‹ › muncul di sisi tersebut. Berlaku juga untuk tab Helper dan saringan Tersimpan.
- **Buat Sensus menandai pasien KJS.** Dibaca dari baris pasien: "KJS Uro", "(KJS)", "- KJS BTKV", atau "(BTKV)" di depan nama. Baris yang belum menyebut KJS diberi tanda di belakangnya, mis. "(KJS BTKV)". Jumlah pasien KJS tampil di atas hasil sensus.
- **Diagnosis yang tadinya tidak terbaca:**
  - pasien RSUH yang nomornya tanpa titik ("2 KJS Uro / ARB / …"). Sebelumnya yang terbaca hanya baris "Pasien Baru"-nya, sehingga diagnosisnya "-";
  - blok yang dibagi "Diagnosis Utama :" dan "Diagnosis Sekunder:". Kini keduanya terbaca.
- **Mode AI lebih bisa diandalkan:**
  - AI kini menerima hasil Aturan sebagai daftar periksa, dan daftar pasien tanpa kode DPJP disertai larangan memasukkannya. Dari situlah pasien CVCU Super VIP sebelumnya keliru masuk ke sensus ARB: barisnya tidak memuat kode DPJP mana pun.
  - Hasil AI dicek ulang dengan Aturan per pasien (berdasarkan RM): **Hanya AI**, **Hanya Aturan**, dan **Diagnosis kosong di AI**, masing-masing dengan alasannya. Satu ketukan memperbaiki hasil AI: **Buang**, **Tambahkan**, atau **Pakai diagnosis Aturan**.

## `2026-10-09.2`
- **Buat Sensus: kotak list per tanggal.** Kotak list kini milik **tanggal sensus** yang dipilih. Tiap tanggal punya kotaknya sendiri, jadi list kemarin tidak tercampur dengan hari ini. Tanggal lain yang masih punya list tampil sebagai tombol di samping tanggal (mis. "08/10/2026 · 3 list"), dan bisa dibuka lagi. Tersimpan di perangkat ini 7 hari.
- **Cari di tiap list.** Ikon kaca pembesar di tiap kotak: ketik nama, RM, atau kode DPJP. Baris yang cocok tampil di bawahnya, dan mengetuknya langsung menandai teks itu di kotak.
- **Hasil AI tidak hilang lagi.** Sensus yang disusun AI disimpan bersama tanggalnya, jadi tetap ada setelah pindah tab atau memuat ulang. **Simpan** menyimpannya ke akun sebagai simpanan tersendiri ("… (AI)"), terpisah dari versi Aturan.
- **Jadwal Jaga Pediatri dari WhatsApp.** Di Konfirmasi Jaga, "Tempel Jadwal Pediatri dari WhatsApp": tempel pesannya, periksa daftar hasil bacaannya, lalu **Pakai jadwal ini**. "&" dibaca sebagai dua shift (pagi lalu malam), "A - B" sebagai A (PPDS BTKV) jaga bersama B. Tahun ditentukan dari nama harinya.

## `2026-10-09.1`
- **Hasil Helper bisa disimpan ke akun.** Tombol **Simpan** kini ada di samping **Salin** pada sensus (Buat Sensus), Formasi Jaga, keempat pesan Morning Report, dan laporan Verifikasi List. Yang disimpan tersinkron ke semua perangkat: sensus yang dibuat di HP pagi hari bisa dibuka lagi di PC.
- **Tab baru: Tersimpan.** Semua hasil yang disimpan, dikelompokkan per tanggal. Bisa dicari (judul, nama pasien, RM), disaring per fitur, disalin, diubah, dan dihapus (dengan **Undo**).
- **Satu simpanan per hasil.** Menyimpan lagi sensus DPJP yang sama untuk tanggal yang sama memperbarui simpanan itu, bukan membuat salinan baru. Tombol menunjukkan keadaannya: **Simpan** (belum ada), **Tersimpan** (sama persis), **Perbarui** (teksnya sudah berubah sejak disimpan).
- Yang disimpan hanya hasil akhirnya. List ruangan yang ditempel tetap hanya di perangkat ini, untuk hari itu.

## `2026-10-08.6`
- **List IGD PJT dibaca dengan benar** (format Red/Yellow/Green/Blue Zone). Pasien IGD masuk ke bagian **IGD PJT** di sensus, dari zona mana pun. Pasien **Sisrute** (permintaan rujukan dari RS lain) tidak dihitung sebagai pasien. Tanda tebal (*…*) di baris pasien IGD dibuang.
- **"Verifikasi Sensus" menjadi "Verifikasi List"**, supaya tidak tertukar dengan "Buat Sensus".
- **Peringatan di Helper:** hasil Helper disusun otomatis dari teks yang ditempel, jadi periksa sendiri isinya (nama, RM, DPJP, diagnosis, jumlah pasien) sebelum disalin atau dikirim.

## `2026-10-08.5`
- **Buat Sensus: DPJP saya.** Tandai DPJP yang ditugaskan ke Anda (mis. ARB) lewat "★ Jadikan … DPJP saya" atau "+ DPJP saya…". Setelah itu hanya DPJP tersebut yang tampil dan langsung terpilih, termasuk bila hari ini pasiennya 0. Tersimpan di akun, jadi sama di semua perangkat. "Semua" menampilkan seluruh DPJP lagi.
- **Format sensus mengikuti yang biasa dikirim:**
  - setiap tempat yang list-nya ditempel tetap dicantumkan, termasuk "0 pasien";
  - "Total Pasien", baris kosong di antara pasien, dan tanggal ditulis 08/10/2026;
  - urutan tempat: RSWS, RSUH, IGD PJT, CVCU/HCU/ICU PJT, PJT Lt. 4, 5, 6.
  
  Tempat yang list-nya tidak ditempel tidak dicantumkan, supaya tidak tertulis "0 pasien" padahal belum dicek. Daftarnya tampil di bawah DPJP ("Belum ditempel: …").
- **Baris pasien apa adanya** (bawaan), seperti di list ruangan, mis. "414 Bed 1/ARB/Ny. …". Pilih "Kode di depan" untuk gaya "ARB/414 Bed 1/…". Nama residen di akhir baris tetap dibuang.
- **List IGD PJT** kini dikenali sebagai tempat tersendiri.
- **Blok "Diagnosis" yang ternyata berisi terapi** (obat dan dosis) ditulis "-" dan diberi peringatan, supaya daftar obat tidak terkirim sebagai diagnosis.

## `2026-10-08.4`
- **Tanggal selalu tgl/bln/tahun:** semua kolom tanggal (Hari MR, Jaga mulai dari, Tanggal jaga, Tanggal lab, Tanggal masuk, Tanggal pulang, Jadwal operasi) kini tampil seperti **09/10/2026**. Sebelumnya, di HP berbahasa Inggris tanggal tampil bulan dulu (10/09/2026 untuk 9 Oktober). Tanggal bisa diketik langsung (mis. "9/10" atau "9-10-26"), atau dipilih lewat ikon kalender.
- **Morning Report: pesan ke pengampu.** Di bagian Pesan ada **Ke pengampu**: permintaan kesediaan memimpin MR dan jam hadir, dengan pilihan sapaan **Dokter** atau **Prof**. Salam (pagi/siang/sore/malam) mengikuti jam, dan "besok" hanya dipakai bila MR memang besok. Isi **Perkenalan ke pengampu** (mis. PPDS Kardio Semester 1) di langkah 2.
- **Helper baru: Buat Sensus.** Tempel list dari tiap ruangan (PJT Lantai 4, Lantai 5 dan 6, CVCU/HCU/ICU, RSWS, RSUH), lalu pilih DPJP. Sensus pasiennya tersusun per tempat beserta diagnosisnya, siap disalin.
  - Kode DPJP dipindah ke depan baris, dan nama residen di akhir baris dibuang.
  - Pasien Pulang/Meninggal/Pindah tidak dihitung. Pasien yang tercantum dua kali dihitung sekali.
  - Pasien yang tidak punya kode DPJP di list ditampilkan sebagai peringatan, tidak hilang diam-diam.
  - List hanya tersimpan di perangkat ini dan dikosongkan keesokan harinya.
- **Buat Sensus dengan AI (opsional):** aktifkan di Pengaturan → AI → "Sensus per DPJP dengan AI". AI hanya memilih pasien dan diagnosisnya; format pesannya tetap sama. Seluruh isi list dikirim ke AI, jadi mode Aturan tetap jadi bawaan.

## `2026-10-08.3`
- **Halaman pasien di HP: catatan langsung terlihat.** Sebelumnya catatan baru mulai sekitar satu layar penuh ke bawah, setelah Catatan pasien, Checklist, Custom Checklist, dan Periksa lagi. Kini ketiganya menjadi tombol ringkas di atas catatan, mis. **Catatan •**, **Checklist 0/8**, **Periksa lagi 3**. Ketuk untuk membukanya di lembar bawah. "Tampilkan" di Periksa lagi menutup lembar itu dan langsung menandai bagian catatan yang dimaksud.
- **Satu kepala halaman saja:** judul ganda di atas halaman pasien dihapus, jadi nama pasien tidak lagi tampil dua kali. Tanggal dipersingkat (mis. "Kam, 8 Okt"), dan status Synced/Offline kini berupa titik di samping Salin. Bila offline, tulisan "Offline" tetap tampil.
- **Baris identitas** (RM, umur, ruangan) kini satu baris di HP. **Rel tanggal** tidak lagi memotong "SOAP Awal", dan tanda titik "·" yang membingungkan diganti titik biru penanda hari yang sudah ada catatannya.
- **Papan di HP:** pencarian, urutan (Terbaru ▾), dan ⋯ kini dalam satu baris. Diagnosis di kartu digabung dalam maksimal dua baris, sehingga lebih banyak pasien terlihat sekaligus.
- **Lainnya:** kepala halaman sedikit lebih ramping di semua halaman. Helper tidak lagi menampilkan judulnya dua kali (tanda WIP tetap ada). Pilihan tema "Ikuti sistem" menjadi "Sistem".
- Tablet dan laptop tidak berubah, kecuali tanggal di halaman pasien yang ikut dipersingkat di tablet.

## `2026-10-08.2`
- **Ekspor ke Word untuk dicetak:** di menu ⋯ pasien → **Ekspor ke Word**, catatan yang sedang terbuka (SOAP hari itu, atau SOAP jaga / versi yang dibuka) diunduh sebagai file .docx A4. Isinya persis seperti yang ditulis: *tebal*, _miring_, dan ~~coret~~ menjadi format Word, poin "- " menjadi bullet, dan nomor tetap nomor Anda sendiri.
- Tiap halaman diberi kepala (nama, RM, ruangan, tanggal, hari rawat) dan "Halaman x dari y" di bawah, supaya lembar yang terlepas tetap jelas milik siapa. File bisa diedit dulu di Word sebelum dicetak. Di HP, file langsung dibuka lewat menu Bagikan (ke Word, printer, atau WhatsApp).
- Tersedia juga untuk hari yang sudah terkunci.

## `2026-10-08.1`
- **Periksa lagi memeriksa kalimat pembuka:** "follow up" pada hari pertama pasien, atau "pasien baru" yang masih terbawa ke hari rawat berikutnya, kini ditandai. Pembuka konsul dan perpindahan tidak dinilai.
- **Ruangan di pembuka dicocokkan dengan data pasien:** bila Lt., Kamar, atau Bed di kalimat pembuka berbeda dengan data pasien, Periksa lagi menyebut keduanya. Untuk perpindahan, yang dicocokkan adalah ruangan tujuan.
- **Pengingat 6MWT untuk pasien trio (AFG, AFM, ZD):** sejak H-1 (dan pada hari pulang), Periksa lagi mengingatkan bila 6MWT belum ada di catatan, dan pita "PULANG BESOK · H-1" di kartu papan menampilkan tanda **6MWT**.
- **Catatan tempel bisa diedit di HP:** mengetuk catatan tempel di papan HP kini membuka catatan yang bisa diedit (sebelumnya hanya bisa dibaca).
- **Alat Gambar tidak lagi keluar dari layar:** di bilah papan hanya tombol ✏️ Gambar/Selesai; Pena, Stabilo, Penghapus, warna, Urungkan, dan Hapus semua kini muncul di bilah melayang di bawah layar.
- **Penanda ikut hilang bersama kartunya:** penanda yang ditempel pada kartu pasien kini dihapus bila pasien diarsipkan, dihapus, atau dipindah ke papan lain (Titipan / Pasien saya), sehingga tidak muncul lagi bila pasien dirawat kembali.

## `2026-10-07.2`
- **Gambar di papan pasien:** tombol **✏️ Gambar** di bilah papan (di samping Penanda) membuka mode gambar: **Pena**, **Stabilo**, dan **Penghapus** (menghapus satu garis utuh), empat warna, **Urungkan** (juga Ctrl+Z), dan **Hapus semua** (tekan dua kali). Gambar berada di belakang kartu pasien, jadi kartu tetap terbaca. Tekan **Selesai** atau Esc untuk kembali; selama mode gambar, kartu tidak terbuka saat diketuk.
- Gambar tersimpan **di perangkat ini saja**, terpisah untuk Pasien saya dan Titipan. Tersedia di papan kanvas (laptop/layar lebar); tampilan HP tidak menampilkannya.

## `2026-10-07.1`
- **Pengingat Foley di Periksa lagi:** bila Terapi berisi furosemide (atau Plan memantau balance cairan / urine output) tetapi kateter urin belum tercatat di mana pun di catatan, Periksa lagi mengingatkan: "Pertimbangkan pemasangan, atau tulis bila sudah terpasang." Catatan yang menulis "BAK per kateter", "terpasang DC", atau "Foley" tidak diingatkan.
- **Catatan tempel terpisah antara Pasien saya dan Titipan:** catatan tempel yang ditulis di papan Titipan hanya tampil di Titipan, dan sebaliknya. Catatan tempel lama tetap di Pasien saya.
- **Pulang hari ini dan H-1 lebih menonjol:** kartu pasien kini punya pita penuh di atas, "PULANG HARI INI" (hijau) atau "PULANG BESOK · H-1" (kuning), seperti pita Pemantauan. Rencana pulang dan "Lewat?" tetap memakai tanda kecil di pojok.
- **Kalkulator osmolalitas menjelaskan osmolalitas efektif:** ketuk "Apa itu osmolalitas efektif?" di kartunya: definisi, mengapa urea tidak dihitung, kapan angka efektif yang dipakai (hiponatremia, HHS), contoh perhitungan, dan sumbernya.

## `2026-10-06.1`
- **Periksa lagi tidak lagi salah menandai TS yang sudah ada di daftar DPJP:** "TS Gizi Klinik" kini dikenali sebagai "DPJP Gizi", dan "TS Rehab" sebagai "DPJP KFR". Pemeriksaan kini membandingkan spesialisasinya (termasuk gelar seperti Sp.N, Sp.GK, Sp.KFR), bukan ejaannya. TS yang memang belum ada (mis. TS Neuro tanpa DPJP Neuro) tetap ditandai.
- **Poin dan checklist di Catatan kini konsisten:** Enter pada baris kosong mengakhiri daftar; Backspace pada baris kosong yang baru dibuat menghapusnya dan kembali ke akhir baris sebelumnya, untuk poin maupun checklist. Sebelumnya checklist meninggalkan baris kosong yang memecah daftar, dan di HP aturan ini kadang tidak berjalan sama sekali.
- **Tata letak Panel: Periksa lagi dan info DPJP pindah ke panel kanan:** pemeriksa SOAP kini tetap terlihat saat menggulir catatan. Kartu DPJP menampilkan cara kirim, format laporan, rencana 6MWT, jadwal poli berikutnya dan sesudahnya, serta diagnosis. Panel kanan juga dirapikan (pilihan Pasien/Dokumen, judul panel dengan panah). Tata letak Klasik dan tampilan HP tidak berubah.
- **Kotak pasien Morning Report:** kolom Dinas dan Jaga kini selalu sama tinggi; mengubah ukuran satu kotak tidak lagi membuat kotak lain tidak penuh.
- **Privasi repo:** nama pasien, nomor RM, dan nama residen di data uji dan format bawaan diganti dengan nama samaran. Format bawaan yang sudah Anda tambahkan tidak ikut berubah.

## `2026-10-05.8`
- **Morning Report kini memuat pasien Dinas:** setiap hari kerja punya dua kolom, **Dinas** dan **Jaga**, berdampingan (akhir pekan tetap Jaga Pagi dan Jaga Malam). Laporan Grup Prodi menampilkan blok Dinas sebelum Jaga hari itu. List Jaga yang sudah ditempel sebelumnya tetap di tempatnya.
- **Pesan ke senior bisa untuk Dinas atau Jaga:** pilih di "List yang diminta"; kalimatnya tetap "…apakah boleh meminta list Jaga Senin, 5 Oktober 2026…" (atau "list Dinas …").
- **Tampilan Morning Report baru:** langkah bernomor di kiri, ketiga pesan di kanan (tetap terlihat saat mengisi), kotak **Kesiapan** yang menunjukkan apa yang belum (nama, list terisi, konfirmasi pengampu, blok Zoom), tombol ‹ › yang melompati akhir pekan, dan pengampu dalam satu baris (nama, status, hapus).
- **Tampilan Verifikasi Sensus baru:** dokumen di kiri (bisa ditarik-lepas), hasil di kanan dengan kartu putusan (CLEAN / NOT CLEAN / PARTIAL) dan jumlah per tingkat. Setiap masalah diberi warna tepi sesuai tingkatnya, dan nilai yang berbeda di tabel perbandingan ditandai merah.
- **Sidebar baru:** satu gaya untuk semua menu, dikelompokkan **Bangsal** dan **Fitur**, Pengaturan di bawah, Helper punya ikon sendiri, dan nama **© Avicenna** kembali tampil di samping versi aplikasi.
- **Custom Checklist versi ringkas menampilkan yang belum dicentang lebih dulu:** sebelumnya bila empat langkah pertama sudah dicentang, langkah yang belum tersembunyi di "+N lagi". Kini sisanya ditulis "+N belum" atau "+N selesai".

## `2026-10-05.7`
- **"Memuat…" saat membuka Plano kini paling lama sekitar 3 detik:** riwayat sesi Anda menunjukkan semua jeda lambat (6–17 detik) terjadi sebelum masuk. Penyebabnya: setiap kali dibuka, Firebase menanyakan akun Anda ke server Google dulu, dan di wifi rumah sakit yang lambat (tapi tidak putus) pertanyaan itu menggantung. Selama itu data yang sudah ada di perangkat pun tidak bisa ditampilkan.
- **Sekarang:** bila server belum menjawab dalam 3 detik, Plano dibuka dari data di perangkat, sama seperti saat tidak ada sinyal, lalu sinkron otomatis begitu jaringan menjawab.
- **SOAP tetap aman:** tidak ada yang berubah pada cara menyimpan dan sinkron. Catatan yang Anda ubah tetap tersimpan di perangkat lalu dikirim; versi lama tidak bisa menimpa versi yang lebih baru (tetap digabung seperti biasa).
- **Riwayat sesi lebih rinci:** baris "Lambat" saat membuka kini memisahkan waktu memuat kode dan waktu cek akun, serta menulis "jaringan lambat, dibuka dari perangkat" bila batas 3 detik terpakai.

## `2026-10-05.6`
- **Jadwal yang sudah diimpor kini ikut diperbaiki otomatis:** sebelumnya perbaikan pembaca PDF tidak menyentuh jadwal yang sudah tersimpan, jadi Jadwal DPJP tetap 27 hari. Mulai versi ini setiap impor menyimpan isi PDF-nya, sehingga perbaikan berikutnya langsung berlaku di semua perangkat tanpa impor ulang.
- **Satu kali impor ulang terakhir:** jadwal yang diimpor sebelum versi ini ditandai "Dibaca Plano versi lama — impor ulang PDF ini sekali". Impor ulang **Jadwal DPJP** dan **Jadwal Jaga PPDS** Oktober; setelah itu tidak perlu lagi.
- **INT (residen penyakit dalam yang rotasi di kardiologi) kini tampil di Formasi:** misalnya "Bangsal B : INT 9" pada Sabtu Malam, bukan kosong. Namanya bisa diisi lewat kolom nama di baris konfirmasinya.

## `2026-10-05.5`
- **DPJP di Konfirmasi Jaga kembali terisi:** Jadwal DPJP Oktober sebelumnya hanya terbaca 27 dari 31 hari (5–8 Oktober hilang, DPJP Utama 9 & 24 Oktober kosong), sehingga Formasi 6 Oktober tanpa blok DPJP. **Impor ulang PDF Jadwal DPJP Oktober sekali** agar tanggal yang hilang terisi.
- **Tim jaga malam akhir pekan di pergantian bulan kini bertanggal benar:** Sabtu Malam 31 Oktober sebelumnya tercatat 1 November. Impor ulang Jadwal Jaga PPDS juga dianjurkan.
- **Peringatan tanggal yang tidak terbaca:** kotak jadwal kini menyebut tanggal yang hilang ("Tidak terbaca: 5–8 Okt"), dan Formasi memberi tahu bila DPJP untuk tanggal itu tidak ada di jadwal, lalu membuka "Ubah DPJP" untuk diisi manual.
- **Tampilan Helper baru:** tanggal dipilih dari satu baris (‹ ›, Hari ini, Besok, Pagi/Malam), keempat jadwal tampil sebagai kotak status yang bisa diketuk atau ditarik-lepas PDF-nya, dan di laptop Formasi berdampingan dengan daftar konfirmasi lengkap dengan bilah kemajuan.
- **Stiker baru di papan:** tag **ECHO** (echocardiography) dan 🩻 Rontgen / foto thorax.
- **Jadwal poli Oktober – Desember 2026:** isinya sama dengan jadwal sebelumnya; label periodenya diperbarui.

## `2026-10-05.4`
- **"Memuat…" yang terasa lama kini tercatat:** setiap kali layar memuat 2 detik atau lebih (membuka pasien, memuat catatan, daftar pasien, arsip, memeriksa akses, atau saat aplikasi dibuka), Plano mencatat apa yang ditunggu, berapa lama, berapa tab Plano lain yang terbuka, dan apakah Chrome sempat membuang atau membekukan tab ini. Tidak ada data pasien yang dicatat.
- **Bila terjadi lagi:** buka **Pengaturan → Riwayat sesi** dan kirim tangkapan layarnya. Baris "Lambat" menunjukkan penyebabnya, sehingga perbaikannya tepat sasaran.

## `2026-10-05.3`
- **Tombol Bagian tidak lagi bergeser saat ditekan:** tombol yang dipilih dulu melebar karena tanda ✓ dan huruf tebal, sehingga tombol lain pindah baris. Kini lebar setiap tombol pilihan tetap, di Salin maupun sheet lain.
- **Preview Salin lebih tinggi:** di laptop, tombol Salin pindah ke bawah kolom pilihan (di bawah "Penunjang terbaru saja"), dan jumlah karakter, "Ukuran awal" serta "Pilih semua teks" naik ke baris judul Preview. Kotak Preview kini memanjang sampai ke bawah sheet. Di HP tombol Salin tetap di bawah seperti biasa.
- Menyeret tinggi Preview melewati batas bawah kini kembali ke ukuran penuh; kolom Preview tidak pernah ikut menggulir.

## `2026-10-05.2`
- **Kalkulator melayang di halaman SOAP:** ikon kalkulator di samping tombol Salin (di HP: menu ⋯ → Kalkulator). Panelnya tidak menutupi catatan, jadi tetap bisa menulis sambil menghitung. Di laptop bisa diseret dan diingat posisinya; bisa dilipat dan hasil terakhir tetap terlihat di judulnya.
- **Tab Hitung:** ketik atau pakai tombol angka; hasil langsung tampil, lengkap dengan "Dibaca: …" supaya terlihat bagaimana hitungan itu dimengerti. Titik tiga angka dibaca ribuan (`12.000` = 12000) dan koma dibaca desimal (`3,1`), seperti penulisan di catatan. Enter menghitung dan hasilnya jadi baris berikutnya; ketuk hasil sebelumnya untuk memakainya lagi; **Salin hasil** untuk ditempel.
- **Tab Klinis:** kalkulator yang sama dengan halaman Kalkulator (urine output, osmolalitas, koreksi natrium, konversi satuan).
- **Preview Salin lebih besar:** sheet lebih lebar dan lebih tinggi, kolom pilihan lebih ramping, dan tidak ada lagi ruang kosong di bawah Preview. Tinggi Preview kini sekitar 60% lebih besar di layar laptop.
- **Preview Salin bisa diubah ukurannya:** seret garis di bawah Preview untuk mengubah tingginya, dan garis di antara dua kolom untuk mengubah lebar kolom pilihan (atau pakai tombol panah; klik dua kali untuk mengembalikan). Ukurannya diingat di perangkat ini; **Ukuran awal** mengembalikan keduanya.

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
