# Plano — Yang baru

Ringkasan tiap pembaruan, untuk pengguna. Tampil di Pengaturan → Yang baru.
Catatan teknis lengkap (akar masalah, perbaikan) ada di CHANGES.md.

Entri teratas harus versi yang sedang dirilis; tes gagal bila belum ditulis.

## `2026-10-31.8`
- **Salin di HP: preview langsung terlihat.** Pilihan Format, Bentuk, Bagian dan Penyesuaian kini dilipat menjadi satu baris ringkasan, misalnya *WhatsApp · Laporan harian · Seluruh catatan*. Ketuk baris itu untuk mengubahnya. Teks yang akan disalin langsung tampil saat lembar Salin dibuka, tanpa perlu menggulir. Preset dan peringatan identitas tetap terlihat. Di laptop tidak ada perubahan. Pilihan dibuka atau dilipat diingat di perangkat ini.

## `2026-10-31.7`
- **Gagal sinkron kini terlihat.** Bila server menolak menyimpan perubahan (misalnya izin akses), status di pojok tidak lagi menulis "Synced". Muncul tanda merah **Gagal sinkron**; ketuk untuk melihat penyebabnya dan apa yang perlu dilakukan. Tanda tetap ada sampai Anda menekan **Mengerti**, meskipun perubahan berikutnya berhasil. Baris di bawah catatan kini menulis "Tersimpan di perangkat ini" saat offline, dan memberi tahu bila ada perubahan yang ditolak.

## `2026-10-31.6`
- **Tab di tablet.** Aplikasi yang terpasang kini menampilkan deretan tab di bagian atas layar tablet (lebar 768 px ke atas), seperti di komputer. Ketuk + untuk tab baru, ketuk × untuk menutup (kini selalu terlihat di layar sentuh), geser tab untuk mengubah urutan. HP tidak berubah.

## `2026-10-31.5`
- **Kirim ke rekan: pengirim kini menyimpan salinan di Arsip.** Saat rekan menekan Terima, ia mendapat salinan pasien beserta semua catatan dan checklist hariannya di papannya. Pasien di papan pengirim tidak lagi hilang, melainkan masuk Arsip dengan alasan *Pindah* dan catatan "Diserahkan ke …", lengkap dengan riwayat revisinya. Menerima pasien perlu koneksi internet.

## `2026-10-31.4`
- **Perbaikan Ubah SOAP: terapi tidak lagi hilang.** Bila SOAP pasien yang sudah ada di list diganti dengan teks yang berisi ringkasan singkat (hanya Diagnosis) lalu SOAP lengkap pasien yang sama, yang tersimpan adalah ringkasannya, sehingga list hanya menampilkan diagnosis. Sekarang SOAP lengkap yang dipakai.

## `2026-10-31.3`
- **Format hasil lab: lebih ringan di HP.** PDF yang sudah ditampilkan atau dibaca kini dilepas dari memori, jadi menambah beberapa PDF berturut-turut tidak lagi membuat aplikasi makin berat.

## `2026-10-31.2`
- **Format hasil lab: pratinjau PDF.** Setelah mengambil PDF, kotak di kiri kini menampilkan halaman PDF-nya sebagai pembanding. Tombol *Teks hasil lab* di atasnya membuka teks yang bisa dikoreksi seperti biasa. PDF tetap dibaca di perangkat ini dan tidak diunggah.

## `2026-10-31.1`
- **Keamanan data pasien diperketat.** Pemilik pasien kini tidak bisa dikeluarkan dari pasiennya sendiri oleh anggota lain. Tidak ada yang berubah di layar.
- **Pembaruan aplikasi lebih rapi.** Cache versi lama kini selalu terhapus saat aplikasi diperbarui.

## `2026-10-30.10`
- **Kanvas: menggeser kartu lebih halus.** Kartu kini mengikuti penunjuk tanpa tersendat (papan diperbarui sekali per bingkai, bukan tiap gerakan mouse). Saat menyeret kartu mendekati tepi atas atau bawah layar, halaman ikut bergulir, jadi kartu bisa dibawa jauh ke bawah dalam satu seretan.

## `2026-10-30.9`
- **Sticky Catatan pasien dan Lab hari ini kini berurutan seperti Urutan visite.** Pasien di kedua sticky tersusun mengikuti rute visite bangsal (kamar demi kamar, bed naik), apa pun urutan papan yang sedang dipakai. Pasien yang di-Pin tetap di atas, sama seperti di papan.

## `2026-10-30.8`
- **Sticky Catatan pasien dan Lab hari ini lebih jelas di HP.** Di HP keduanya ditambahkan lewat tombol ⋯ di samping pencarian (bukan *+ Tambah*, yang hanya ada di layar lebar). Di tampilan Kanvas HP, kotak kecilnya dulu hanya bertuliskan "Catatan"; sekarang judulnya *Catatan pasien* / *Lab hari ini* dan isinya langsung terlihat (nama: catatan, atau nama: lab hari ini). Ketuk untuk membuka dan mengedit.

## `2026-10-30.7`
- **Pembacaan SOAP dan List lebih tepat untuk gaya tulis lantai lain (dipelajari dari grup PJT Lantai 5).** Judul *"Mohon Izin prof, pasien kami assest dengan:"*, *"… assest pasien dengan"*, *"… asessment dengan"* dan *"Mohon ijn kami terapi dengan"* kini terbaca sebagai Diagnosis dan Terapi. Sebelumnya diagnosis ikut tersalin sebagai bagian O, dan di List bisa muncul laporan kateterisasi dari O sebagai diagnosis.
- **Judul S dan O tanpa titik dua** (baris berisi hanya `S`, `O`, atau `S;`) kini dikenali.
- **Kamar:** "Kamar 508 B" dan "Kamar 508 A ," kini 508B/508A (dulu keduanya 508), "Kamar VIP 502" / "Kamar Super VIP 501" kini 502/501, "Kamr 510" (salah ketik) dan "Lantai 5 Bed 508 A" juga terbaca.
- **List Pasien yang ditempel:** pasien dengan "513 bad 1/" (salah ketik bed) tidak lagi hilang, dan diagnosisnya tidak lagi menempel ke pasien di atasnya. Pasien yang tertulis dua kali di satu list memakai entri yang ada isinya. Garis pemisah yang menempel dengan tulisan ("_____List Pasien Lt. 6") tidak lagi masuk ke isi pasien.
- **DPJP:** bila SOAP hari ini lupa menulis baris DPJP, list tetap memakai DPJP dari laporan sebelumnya untuk pasien yang sama.

## `2026-10-30.6`
- **Strip kuning catatan di kartu pasien kini mati secara default.** Catatan pasien sudah tampil di sticky *Catatan pasien*, jadi strip kuning di bawah kartu di papan disembunyikan. Bisa dinyalakan lagi di Pengaturan → Papan & harian → *Catatan di kartu pasien*. Catatannya sendiri tidak berubah.

## `2026-10-30.5`
- **Perbaikan Tempel (Baca): terapi tidak lagi hilang.** Bila pesan ringkasan pendek ("Post Tindakan", hanya Diagnosis dan jam Verifikasi) dikirim setelah SOAP lengkap pasien yang sama, list memakai ringkasan itu dan Terapi hilang. Sekarang pesan tanpa Terapi tidak menggantikan SOAP yang sudah punya Terapi; Chief dan Junior dari ringkasan tetap terbaca.

## `2026-10-30.4`
- **Perbaikan Kirim ke rekan: pasien tidak lagi masuk Arsip atau hilang.** Dulu pasien yang diterima ikut membawa keadaannya di papan pengirim: bila pengirim sudah mengarsipkan (mis. "Pindah ruang/RS"), membuang ke sampah, atau menandainya Titipan, pasien muncul di Arsip, sampah, atau tab Titipan penerima, sehingga terlihat hilang. Sekarang pasien yang diterima selalu masuk papan aktif penerima, di *Pasien saya*. Pasien yang sudah terlanjur masuk Arsip penerima bisa diaktifkan kembali dari Arsip.

## `2026-10-30.3`
- **Sticky Catatan pasien.** Di papan, *+ Tambah → Sticky Catatan pasien* menempelkan satu sticky berisi semua pasien di papan itu: nama · kamar/bed · DPJP, dan di bawahnya catatan pasien. Catatan bisa langsung diedit di sticky; isinya sama dengan *Catatan pasien* di halaman SOAP, jadi perubahan di salah satu tempat langsung muncul di tempat lain.
- **Sticky Lab hari ini.** *+ Tambah → Sticky Lab hari ini* menampilkan lab yang direncanakan hari ini per pasien, dibaca dari Plan SOAP: baris cek lab yang diberi tanggal hari ini, mis. `- Cek DL, SE (30/10/2026)`. Hanya dibaca; ubah di Plan SOAP. Pasien yang SOAP-nya belum disimpan ulang sejak pembaruan ini muncul setelah SOAP-nya dibuka atau diedit.

## `2026-10-30.2`
- **Kirim ke rekan lewat username.** Di bagian *Kirim ke rekan*, ketik `@username` rekan (yang ia pilih di halaman Akun), lalu Kirim. Email Google tetap bisa dipakai. Username dicek ke server, jadi perlu koneksi internet; bila tidak ditemukan, muncul pesan dan pasien tidak terkirim.

## `2026-10-30.1`
- **Halaman Akun baru.** Buka dari Pengaturan → Akun → *Buka halaman Akun*. Di sini tampil nama dan email Google Anda, tombol Keluar, dan pilihan **username** (mis. `@dr.rina`). Username tidak bisa dicari atau didaftar oleh pengguna lain; nanti rekan bisa mengirim pasien ke Anda cukup dengan mengetik username itu. Menyimpan username perlu koneksi internet.

## `2026-10-29.10`
- **Kirim ke rekan tanpa mengetik email.** Rekan yang satu list List Maker dengan Anda kini muncul sebagai pilihan nama di bagian *Kirim ke rekan*: ketuk namanya lalu Kirim. Email Google tetap bisa dipakai untuk rekan di luar list Anda. Saat menunggu, menu pasien menampilkan nama rekan, bukan alamat email.

## `2026-10-29.9`
- **Kirim pasien ke rekan (serah terima).** Di menu pasien (⋯) ada bagian baru *Kirim ke rekan*: isi email Google rekan, lalu tekan Kirim pasien. Rekan melihat kiriman itu di atas papannya dengan tombol Terima dan Tolak. Setelah diterima, pasien beserta semua catatan, versi dan checklist-nya pindah ke papan rekan dan hilang dari papan Anda. Sebelum diterima pasien tetap di papan Anda, dan kiriman bisa dibatalkan. Rekan perlu online untuk melihat kiriman.

## `2026-10-29.8`
- **Denah di HP: tombol zoom diganti ketuk dua kali.** Tombol + / − / Muat dihapus karena menutupi isi plan. Sekarang ketuk dua kali di area kosong plan untuk beralih antara muat di layar dan ukuran terbaca, berpusat di titik yang diketuk. Cubit dua jari tetap bisa. Ketuk dua kali pada nama pasien tidak memperbesar (ketukan pertama sudah membuka SOAP).

## `2026-10-29.7`
- **Perbaikan denah List Maker: pasien baru di bed yang masih terisi.** Dulu pasien lama digeser ke bed kosong berikutnya di kamar itu, seolah pindah bed. Sekarang pasien dengan SOAP terbaru menempati bed itu, dan pasien lama ditulis di bawah kamar (tanpa nomor bed) sampai ditandai pulang atau pindah. Berlaku di denah layar, PDF dan Word.

## `2026-10-29.6`
- **Selotip sticky note kembali menempel di luar kertas.** Selotip di .5 digeser masuk ke dalam kertas; sekarang kembali menjuntai di atas tepi seperti semula. Agar tidak terpotong, kotak kartu yang tingginya dibatasi di kanvas diberi ruang 8 px di atasnya. Warna selotip tetap mengikuti tulisan catatan.

## `2026-10-29.5`
- **Perbaikan: selotip sticky note tidak lagi hilang.** Selotip di atas sticky note terpotong atau hilang pada catatan yang tingginya dibatasi atau yang terletak di tepi atas kanvas. Sekarang selotip digambar di dalam kertas dan berwarna mengikuti tulisan catatan, jadi tetap terlihat di catatan berwarna pucat juga.
- **Denah di HP: zoom lebih mudah.** Tombol + / − / Muat melayang di kanan bawah plan dan ikut saat plan digulir, jadi bisa dipakai satu tangan. Zoom lewat tombol berpusat pada bagian yang sedang terlihat, tidak lagi melompat ke pojok kiri atas plan. Cubit dua jari tetap bisa.

## `2026-10-29.4`
- **Perbaikan: menyorot teks di HP tidak lagi membuka kamus.** Di HP, menahan atau mengetuk dua kali sebuah kata yang digarisbawahi merah membuka menu kamus (saran kata, "Add to dictionary", Delete) dan menyulitkan memilih teks. Pemeriksa ejaan kini dimatikan di perangkat layar sentuh, di semua kolom ketik (SOAP, catatan, sticky). Di laptop tidak berubah.

## `2026-10-29.3`
- **Catatan di kartu: panel terbuka dari strip-nya.** Ketuk strip catatan, panelnya kini tumbuh dari strip itu sendiri (warna dan lebar sama), tanpa judul yang mengulang nama pasien dan tanpa celah. Catatan pendek yang sudah tampil utuh tidak lagi bisa diketuk, karena panelnya hanya akan mengulang isi yang sama.
- **Warna chip dan catatan tidak lagi keruh.** Chip pengingat dan strip catatan memakai warna penuh, bukan tint transparan yang ikut berwarna hijau kartu. Centang selesai memakai warna tulisan kartu.
- **Pengingat selesai dilipat.** Dua pengingat atau lebih yang sudah selesai jadi satu chip "✓ 2 pengingat" (ketuk untuk membuka dan membatalkan centang), sehingga KJS dan pengingat yang belum selesai tidak turun ke baris sendiri.

## `2026-10-29.2`
- **Shelf kini sama di laptop dan HP.** Isi shelf (nama, terlipat atau tidak, dan pasien di dalamnya) dibagi antara kanvas laptop dan kanvas HP: shelf yang dibuat atau diisi di satu perangkat muncul di perangkat lain, termasuk Pasien saya dan Titipan terpisah. Posisi kartu tidak ikut dibagi, karena layarnya berbeda. Shelf yang sebelumnya dibuat di HP dipindahkan otomatis. Bila laptop dan HP mengubah shelf hampir bersamaan, yang terakhir menyimpan yang dipakai.

## `2026-10-29.1`
- **Perbaikan: "H-1 hari ini" setelah SOAP diedit.** Bila SOAP kemarin diedit hari ini di List Maker dan Plan-nya ditulis "H-1 hari ini", saran Plan dulu menawarkan "pulang hari ini". Sekarang saran membaca hari SOAP terakhir diedit, jadi "H-1 hari ini" berarti pulang besok (merah).

## `2026-10-28.11`
- **List Maker: kode DPJP kuning bisa diatur, dan MAA ikut.** Di denah, kode AAU dan YP berwarna kuning. Sekarang MAA juga, dan pilihannya ada di Atur cetak → Denah → "Kode DPJP berwarna kuning": ketuk kode DPJP untuk menyalakan atau mematikan. Berlaku di denah layar, PDF dan Word, disimpan di perangkat ini. "Kembalikan bawaan denah" mengembalikan AAU, YP, MAA.

## `2026-10-28.10`
- **Perbaikan: lokasi IGD di Salin.** Pasien IGD kini ditulis `IGD PJT Redzone bed 1`, seperti di grup, bukan `IGD PJT Bed Redzone 1`. Berlaku di Grup invasif, Konsul, catatan jaga, dan di mana pun lokasi pasien tampil. Bed berupa angka saja tetap `Bed 4`.

## `2026-10-28.9`
- **Pencatat kursor hilang (sementara).** Bila kursor hilang saat mengetik, aplikasi kini mencatat ke Pengaturan → catatan sesi ("Kursor hilang"): kursor pindah ke apa (tombol, dialog, tidak ke mana-mana), atau catatan tiba-tiba terkunci. Tanpa isi catatan dan tanpa nama pasien. Kirim isi catatan sesi itu bila terjadi lagi.

## `2026-10-28.8`
- **Visite: dua kolom.** Kiri: Diagnosis, Terapi, Plan. Kanan: pemeriksaan penunjang (EKG, Lab, Foto thorax, Laporan tindakan, Echo). Di layar sempit (HP) tetap satu kolom dengan urutan Diagnosis, penunjang, Terapi, Plan.
- **Perbaikan: judul bagian tidak lagi ikut di Visite.** `*Mohon izin kami assest dengan*` (tanpa titik dua) masih tampil sebagai baris pertama Diagnosis. Sekarang judul yang berdiri sendiri di barisnya selalu dibuang, dengan atau tanpa titik dua: juga `Plan`, `Mohon izin kami terapi dengan`, `T/`. Ini juga memperbaiki "Tanpa judul bagian" di Salin untuk judul-judul itu.
- **Perbaikan: `*Mohon izin kami assess dengan: *`** (spasi sebelum bintang penutup) kini dibaca sebagai judul yang berdiri sendiri, sehingga warna bagian, tombol lompat, dan Salin memperlakukannya dengan benar.

## `2026-10-28.7`
- **Visite: ringkasan pasien untuk visite DPJP.** Tombol papan klip baru di kartu pasien (di HP: tekan lama kartu → Visite) dan di samping Salin di halaman pasien. Isinya, dalam urutan tetap: DPJP dan chief, Diagnosis, EKG terbaru, Lab terbaru, Foto thorax terbaru, Laporan tindakan terbaru, Echo (hanya kesimpulan atau EF), Terapi, dan Plan kita. Teks disalin apa adanya dari SOAP, tidak diubah; blok TS tidak ikut ke Plan.
- **"Terbaru" berarti blok bertanggal yang paling baru** di catatan, sama seperti "Penunjang terbaru saja". EKG dan lab yang panjang dilipat ke 4 baris; ketuk "+n baris" untuk membuka. Bagian yang tidak ada di catatan tidak ditampilkan, dan disebut di bawah ("Tidak ada di catatan: …").
- **Dari papan, pindah pasien tanpa menutup:** tombol Sebelumnya/Berikutnya atau geser ke samping, mengikuti urutan papan. Bila SOAP hari ini belum ditulis, Visite memakai catatan terakhir dan menandainya "bukan hari ini".

## `2026-10-28.6`
- **Papan: status baru "Usul H-1".** Di menu pasien → Rencana pulang ada pilihan "Usul H-1", cara kerjanya seperti usul H-1 di List Maker: pasien belum punya tanggal pulang, hanya usulan yang menunggu keputusan DPJP. Kartu di kanvas menampilkan strip kuning di atas, bergaris putus di bawahnya: "Usul pulang besok · H-1 · n hari" (di HP: "Usul"). Usul tidak kedaluwarsa sendiri. Pilih H-1, pulang hari ini, atau isi tanggal pulang untuk menutupnya; di bawah pilihan ada tombol "Jadikan H-1" dan "Batalkan usul". Papan dan List Maker belum saling menyalin usulnya.

## `2026-10-28.5`
- **Judul penunjang tanpa bintang kini dikenali.** `Laboratorium PJT (09-09-2026)`, `Analisa Gas Darah 14-09-2026 jam 06:29 :`, `EKG IGD PJT Kanan Posterior (11-10-2026 pukul 19.34)` dan `Foto Thorax RSUD X (24-09-2026): …` kini dibaca sebagai judul blok, sama seperti versi yang ditebalkan. Sebelumnya hanya yang bertanda bintang yang dikenali, jadi ratusan judul lab, EKG, AGD, dan echo di export tidak punya warna bagian dan tampil sebagai satu gumpalan O. Catatan setelah tanggal ("onset 6 jam", "Post Lytic") ikut menjadi bagian judul.
- **"Penunjang terbaru saja" ikut mengenali bentuk-bentuk itu.** Tanggal tanpa kurung, jam di dalam kurung, dan catatan setelah tanggal tidak lagi membuat blok lama lolos dari pemangkasan.
- **Baris tanggal di bawah Assessment tetap rencana.** `EKG (05-10-2026)` di bawah Plan atau Terapi, atau yang diawali "-", tidak pernah dijadikan judul.
- **Judul sub-bagian yang lebih panjang** (mis. "Faktor Risiko Kardiovaskular :") dikenali bila berdiri sendiri di satu baris; baris berisi nilai tetap memakai batas lama.
- **Format hasil lab kini juga membaca PDF non-lab.** Seret PDF radiologi (foto thorax, CT), ekokardiografi, atau laporan tindakan (angiografi, EP study, ablasi, PPM) ke sheet yang sama: yang diambil hanya bagian yang biasa Anda tulis di catatan, dengan judul bertanggal. Radiologi: baris Kesan (`*Foto Thorax PJT (04-09-2026)*`). Echo: baris Conclusion. Angiografi: baris pembuluh (Left Main, LAD, …), Kesimpulan, dan Saran. EP study, ablasi, PPM: Kesimpulan (PPM juga baris generator dan lead). Teks disalin apa adanya; hanya bullet yang dirapikan. Beberapa PDF bisa ditambahkan, tiap satu bisa dihapus dari daftar sebelum disisipkan. Laporan yang belum didukung (mis. programming PPM) ditolak dengan pesan, bukan disisipkan kosong.
- **Hasil lab: baris baru terbaca.** Bilirubin total/direk, ALP, GGT, HbA1c (juga yang tercetak "HbA 1c"), serta retikulosit dan Ret-HE kini masuk ke ringkasan lab, tidak lagi ke "Lain-lain". Pecahan IPF/LFR/MFR/HFR dikenali tetapi tidak dicetak.

## `2026-10-28.4`
- **List Maker: pemberitahuan saran dirombak jadi satu kotak "Saran".** Dua kotak kuning (saran Chief Bangsal dan saran dari Plan: H-1, pulang hari ini, usul H-1) kini satu kartu di atas Denah dan List, dengan jumlah dan ringkasan ("3 soal pulang · 3 ganti chief") di barisnya. Tiap pasien satu baris: kamar/bed dan nama (ketuk untuk membuka SOAP), kalimat sarannya dengan nilai yang diusulkan ditandai, lalu tombol jawaban di kanan. Di HP tombol Abaikan menjadi ikon ×.
- **Ketukan terlihat jadinya.** Baris yang Anda ketuk berubah menjadi centang dan hasilnya ("H-1", "Chief → dr. Kirana", "Diabaikan") sekitar satu detik, baru melipat, sehingga daftar tidak melompat saat jempol masih di layar.
- **Tidak lagi menenggelamkan list.** Hanya empat baris pertama yang tampil, sisanya di "Lihat n lainnya". Kartu bisa dilipat dengan ketukan di judulnya (diingat di perangkat ini). Saran chief tetap punya "Terima semua" dan "Abaikan semua". Di luar jam dinas, satu baris tenang di bawahnya menyebut berapa pasien ganti chief dan kapan.
- Isi saran dan aturan kapan muncul tidak berubah; tidak ada yang diterapkan tanpa ketukan.

## `2026-10-28.3`
- **Denah: tombol "Tampilkan usul H-1".** Di atas denah ada tombol dengan jumlah pasien yang H-1-nya baru usul. Bila dinyalakan, pasien itu diberi latar kuning dan tag [usul] di denah, di kotak DPJP, dan di kotak residen, plus satu baris daftar nama (ketuk untuk membuka SOAP) dan keterangan di legenda. Mati secara bawaan, diingat di perangkat ini. Tidak memengaruhi cetakan (itu tetap diatur di Atur cetak).

## `2026-10-28.2`
- **Analisis: daftar pasien hari ini kini di paling atas**, tepat di bawah tombol "Ubah nama bagian" dan "Salin ringkasan"; grafik pindah ke bawahnya.
- **Panel kanan di tab List tidak lagi tertutup tab.** Panel "Jam list / Simpan edisi / Kirim / ekspor" menempel di bawah deret tab, bukan di belakangnya, sehingga bagian atasnya tidak terpotong. Bila panelnya lebih tinggi dari layar, panel menggulir sendiri sehingga bagian bawahnya tetap terjangkau.

## `2026-10-28.1`
- **Salin: "Tanpa judul bagian".** Saat Anda memilih bagian tertentu (mis. hanya A), muncul pilihan untuk membuang baris judulnya ("Mohon izin kami assess dengan:"). Mati secara bawaan, jadi judul tetap ikut sampai Anda mencentangnya. Untuk "Seluruh catatan" pilihannya tidak muncul dan teks tetap utuh.
- **Pindahkan kepemilikan list.** Pemilik list kini bisa menjadikan anggota lain sebagai pemilik (penanggung jawab) lewat tombol **Jadikan pemilik** di Setelan → Anggota, dengan satu pertanyaan konfirmasi yang menyebut nama orangnya. Pemilik lama tetap menjadi editor. Hanya anggota yang sudah menerima undangan yang bisa dipilih. **Butuh deploy firestore.rules.**
- **Tab Analisis diperbarui dengan grafik.** Ringkasan hari ini kini satu bilah angka; di bawahnya empat grafik: jumlah pasien di lantai (kurva dua minggu), masuk/pulang/pindah per hari, pasien per DPJP, dan sudah berapa hari pasien di list. Arahkan kursor (atau sentuh) untuk melihat angkanya. Tabel 7 hari pindah ke bagian lipat "Angka per hari".
- **Tombol kembali ke atas tidak lagi menutupi batang gulir.** Tombol kini berada di dalam area isi, dengan jarak dari batang gulir, lebih kecil dan lebih tenang.
- **Catatan, Kalkulator, dan Checklist ditata ulang.** Daftar catatan dan checklist kini satu tumpukan baris yang dipisah garis tipis (bukan dinding kartu) tanpa garis warna acak di tepi; tab "Catatan | Catatan jaga" bergaris bawah; tombol baru berupa ikon +; judul catatan lebih besar; bilah format tidak lagi menampilkan batang gulir. Kalkulator memakai kerangka halaman yang sama dengan Arsip dan Dokumen, hasil hitung tampil sebagai blok yang menonjol, dan pilihan ganda tidak lagi berupa blok warna penuh.
- **Jendela pratinjau pasien dan kartu yang dilipat.** Jendela kecil kini dua baris: nama dan tanggal (tidak lagi terpotong "Hari ini"), lalu pilihan tampilan Asli/SIMGOS/WA dalam satu kontrol, Salin RM, dan Buka. Tab Checklist/Custom/Catatan di bawahnya bergaris atas, bukan kotak. Kartu yang dilipat menampilkan nama, DPJP, progres, dan panah buka (bukan tanda +).

## `2026-10-26.7`
- **Kartu pasien: "3 cek" kembali menjadi bendera dan angka** (⚑ 3). Arti angkanya tetap muncul di tooltip dan pembaca layar.
- **Nama Chief di kartu lebih menonjol.** Tulisan "Chief" tetap redup, tetapi namanya kini tebal, penuh warna, dan sedikit lebih besar.
- **Arsip, Dokumen, dan Pengaturan memakai satu kerangka halaman.** Sebelumnya tiap halaman punya lebar, jarak atas, dan jarak antarbagian sendiri-sendiri, sehingga isi bergeser ke samping saat pindah halaman. Kini ketiganya sama lebar dan sejajar kiri-kanan, dengan bilah atas yang sama (jarak 12 px antarbaris) dan judul bagian yang sama (lebih banyak ruang di atasnya daripada di bawahnya).
  - **Arsip:** filter (DPJP, Ruang, Alasan, Bulan) di atas, lalu "Cari di" yang kini lebih tenang sehingga tidak menyaingi filter. Baris, bulan, dan minggu diberi jarak lebih lega.
  - **Dokumen:** kartu lebih lega, jarak antarkelompok lebih jelas, label kelompok sama dengan Arsip.
  - **Pengaturan:** di layar lebar daftar kelompok (Utama, Tema, Tampilan, dst.) menjadi kolom di kiri yang tetap terlihat dan menandai kelompok yang sedang dibaca; di HP tetap deret chip tanpa batang gulir. Kolom pencarian memakai gaya yang sama dengan halaman lain.

## `2026-10-26.6`
- **Tema baru: Senja.** Pengaturan kini punya bagian **Tema** di atas. Mode warna tampil sebagai pratinjau: Sistem, Terang, Gelap, dan **Senja**. Senja adalah mode gelap yang lembut: latar biru-abu senja (bukan hitam), teks krem hangat yang tidak menyilaukan, dan warna kartu checklist, H-1, dan pulang tetap jelas dibedakan. Cocok untuk jaga panjang di bangsal yang terang maupun redup. Palet aksen tetap bisa dipilih di atasnya; "Hitam pekat" hanya untuk mode Gelap. "Warna aplikasi" pindah ke bagian Tema.
- **Pilihan "Usul H-1" di menu Warna tidak lagi bertuliskan "(kuning)".** Kuning hanya berlaku di cetakan denah, bukan di aplikasi.
- **"Ubah SOAP" menjadi "Update SOAP"** di tombol pasien List Maker, supaya tujuannya jelas (memperbarui SOAP tanpa lewat tab Tempel).
- **Kanvas HP: posisi setelah Selesai sama dengan saat Atur.** Sebelumnya tampilan menggeser seluruh susunan ke kiri sampai kolom paling kiri terisi, sehingga posisi yang disimpan berubah. Kini kolom tetap di tempatnya; hanya baris kosong di atas yang dilewati.

## `2026-10-26.5`
- **Nama bagian di Analisis bisa diubah.** Di tab Analisis, pengedit list menekan **Ubah nama bagian**, lalu mengetik nama baru untuk "Pindah ruangan", "Rencana H-1 (pulang besok)", "Sudah pulang", dan bagian lain (termasuk "Di lantai"). Nama dipakai di blok, kotak hitungan, tabel 7 hari, dan ringkasan WhatsApp, dan dibagikan ke semua anggota list. Kosongkan kolomnya untuk kembali ke nama bawaan.
- **Tag [usul] di cetakan bisa diganti tulisan dan warnanya.** Di Atur cetak → Denah, setelah "Tandai usul H-1" dinyalakan, ada kolom tulisan (bawaan "usul") dan pilihan warna (kuning, oranye, biru, ungu, toska, abu-abu, hitam; merah dan hijau tidak ditawarkan karena sudah berarti H-1 dan pulang hari ini). Berlaku di PDF, Word, dan legenda. Disimpan di perangkat ini.
- **Pilihan warna rencana pulang punya "Usul H-1 (kuning)".** Di panel Atur pasien, menu Warna kini: Tanpa warna, Usul H-1, H-1 (merah), Pulang hari ini (hijau). Memilih Usul H-1 sama dengan Tandai usul dari saran Plan: pasien tidak diberi warna merah, tercatat di Analisis, dan menunggu keputusan DPJP. Memilih H-1 atau Pulang hari ini menutup usulnya; Tanpa warna juga menghapus usul.
- **Tampilan tag di Setelan → Warna list dirapikan.** Tiap tag kini satu kartu: nama, warna, dan Hapus di baris pertama; aturan Otomatis di bawahnya selebar kartu; deret DPJP di barisnya sendiri; lalu pilihan cetak. Sebelumnya deret DPJP menempel di sebelah menu dan baris-barisnya tidak sejajar.
- **Shelf di kanvas HP.** Di mode Atur ada tombol **+ Shelf**. Seret blok pasien ke shelf untuk menyimpannya (blok keluar dari grid), **Keluarkan** mengembalikannya ke grid. Shelf bisa diberi nama, dilipat, dan dihapus (pasien di dalamnya kembali ke grid). Pasien saya dan Titipan punya shelf sendiri, maksimal 6 per tampilan. Ketuk baris di shelf untuk membuka pasien.

## `2026-10-26.4`
- **Kanvas di HP kini selalu minimal 3 kolom.** Pada versi sebelumnya HP sempit (di bawah 400 px) mendapat dua kolom, sehingga blok jadi lebar dan susunan lama bergeser. Kini 3 kolom di semua HP, 4 dan 5 kolom di layar yang lebih lebar. Baris penanda di blok dibuat lebih rapat agar muat.
- **Tombol + tidak lagi menutup blok terakhir.** Kanvas diberi ruang kosong di bawahnya.

## `2026-10-26.3`
- **Tampilan blok di kanvas HP didesain ulang.** Blok lebih tinggi dan, di HP sempit, dua kolom. Blok pasien menampilkan bed dan kode DPJP, nama, bilah progres, penanda pulang/EKG/pengingat, dan cincin pemantauan. Catatan tempel punya pita judul dan keadaan kosong yang lebih tenang.
- **Ruang kosong di tampilan HP dipangkas.** Di luar mode Atur, blok digambar mulai dari sudut kiri atas bagian grid yang terpakai, sehingga baris dan kolom kosong di awal tidak mendorong blok ke tengah layar. Posisi tersimpan tidak berubah, dan mode Atur tetap menampilkan seluruh grid.

## `2026-10-26.2`
- **Tab Setelan di List Maker dirapikan.** Isinya kini dikelompokkan: **Tim** (anggota dan undangan), **Nama dan residen** (roster junior, nama panggilan pengirim), **Tampilan list** (warna list), dan **Zona berbahaya** (hapus list, atau keluar dari list). Judul blok lebih jelas, keterangan lebih pendek, dan daftar nama panggilan yang panjang (lebih dari 5 pengirim) terlipat sampai dibuka.
- **Mengeluarkan anggota kini perlu dua ketukan.** "Keluarkan" dan "Keluar dari list ini" menanyakan dulu dengan menyebut nama orangnya ("Keluarkan dr. X dari list?"), lalu **Ya, keluarkan** atau **Batal**; pertanyaan hilang sendiri setelah beberapa detik. Sebelumnya satu ketukan langsung mengeluarkan.
- **Perubahan yang ditolak kini terlihat.** Mengubah peran, mengeluarkan anggota, mengubah roster junior atau nama panggilan menampilkan "Tersimpan ✓" bila berhasil, dan pesan "Perubahan belum tersimpan" bila ditolak (misalnya tidak punya izin). Sebelumnya kegagalan tidak terlihat.

## `2026-10-26.1`
- **"Usul H-1" kini dibedakan dari H-1.** Bila Plan SOAP menulis "Usul H-1", List Maker menanyakan lebih dulu: **Tandai usul** (belum pasti, menunggu DPJP) atau **Sudah pasti H-1**. Pasien yang ditandai usul tidak diberi warna merah, tetapi tercatat di tab Analisis pada blok baru "Usul H-1 (menunggu konfirmasi DPJP)" beserta lama menunggunya, dan ikut di ringkasan WhatsApp.
- **Usul disetujui.** Saat SOAP berikutnya menulis "H-1 hari ini", saran berubah menjadi **Usul disetujui — tandai H-1**. Satu ketukan menjadikannya H-1 merah dan menutup usulnya; tidak ada yang berubah sendiri. Bila DPJP menolak, tekan **Batalkan usul** di panel Atur pasien.
- **Usul H-1 di cetakan (opsional).** Di Atur cetak → Denah ada pilihan "Tandai usul H-1". Mati (bawaan): cetakan sama seperti sebelumnya. Nyala: tag kuning [usul] muncul di samping nama pada PDF dan Word, tanpa warna merah, dan legenda menjelaskannya.
- **Catatan.** Pasien baru dengan Plan "Usul H-1" yang sudah lama tidak lagi ditandai "kemungkinan sudah pulang" hanya karena usul itu, karena usul bukan rencana pulang.

## `2026-10-25.4`
- **"Titik pulih" di Riwayat baru dibaca saat dibuka.** Sebelumnya 30 titik pulih dibaca setiap kali Riwayat dibuka, walau daftarnya terlipat. Kini hanya dibaca saat Anda membuka "Titik pulih". Tombol "Pulihkan list ke edisi ini…" selalu tampil untuk pengedit dan mencari titik pulih edisi itu saat ditekan.

## `2026-10-25.3`
- **Riwayat List Maker kini dikelompokkan per hari.** Hari terbaru terbuka, hari lain terlipat; ketuk tanggal untuk membuka atau menutup. Hanya 10 edisi terbaru yang dimuat, dan tombol "Muat edisi lebih lama" menambah 10 lagi bila perlu. Halaman tidak lagi memanjang tanpa batas, dan membuka Riwayat tidak lagi membaca 60 edisi sekaligus, jadi pemakaian kuota Firebase turun.

## `2026-10-25.2`
- **SOAP yang diubah lewat "Ubah SOAP" kini dihitung terbaru.** Sebelumnya lencana tetap menulis "SOAP 24/10" dan tidak pernah "SOAP baru" untuk SOAP yang baru diubah, karena yang dibaca adalah jam pesan aslinya. Kini jam saat diubah yang dipakai, dan di jendela SOAP tertulis "diubah 25/10/2026 19:05". SOAP yang diubah sebelum versi ini tetap memakai jam pesan aslinya; ubah sekali lagi untuk memperbaruinya.

## `2026-10-25.1`
- **Warna H-1 / Pulang hari ini di List Maker kini ikut hari.** Pasien yang ditandai H-1 hari ini otomatis menjadi hijau (pulang hari ini) besok, tanpa perlu ditandai ulang. Kolom "Tanggal pulang" ikut terisi saat Anda memilih warna. Tanda lama yang masih tersimpan dibaca dari riwayat pasien; bila riwayatnya tidak ada, tanda tetap seperti semula dan bisa dipilih ulang.
- **SOAP dengan beberapa pasien bernomor kini terbaca semua.** Pesan seperti "1. Ny. … / RM …" lalu "2. Tn. … / RM …" di bawah satu kalimat pembuka sebelumnya hanya membaca pasien pertama, sehingga pasien kedua (misalnya DPJP dr. MAA) tidak masuk. Kini tiap pasien terbaca dengan kamar, bed, DPJP, dan A/Terapi/Plan masing-masing. Kamar yang ditulis di baris "Kamar 421 Bed 4" juga terbaca.

## `2026-10-24.6`
- **Chief Bangsal di List Maker.** Ada kotak baru "Chief Bangsal" di samping Chief. Saat jam dinas (Senin–Jumat 07.00–16.00), List Maker menampilkan pasien yang masih dengan chief sebelumnya (masuk malam, akhir pekan, atau dari Poli lewat Chief Jaga) dan menyarankan pindah ke Chief Bangsal. Chief tidak berubah sendiri: tekan **Terima** per pasien atau **Terima semua**. **Abaikan** menyembunyikan saran sampai jam dinas berikutnya (berguna di tanggal merah). Pasien yang belum punya chief juga disarankan; bila diabaikan, tidak muncul lagi. Bila "Ganti chief" diisi, saran memakai nama itu. Di luar jam dinas ada satu baris pengingat, misalnya "3 pasien ganti chief · Senin 26/10 07.00".
- **Catatan Visite bersama.** Tombol "Catatan Visite" di List Maker membuka satu catatan per list yang dilihat semua anggota list. Hanya pembuat list dan anggota dengan izin edit yang bisa mengubahnya. Di laptop/PC catatan terbuka di jendela kecil yang tetap di atas SIMGOS; di HP terbuka sebagai lembar. Bila dua orang mengetik bersamaan, tulisan keduanya digabung, tidak ada yang hilang.
- **Jendela kecil Catatan tidak tertutup lagi saat pindah tab.** Sebelumnya jendela kecil ikut tertutup begitu Anda membuka tab lain di Plano. Kini tetap terbuka sampai Anda menutupnya (menutup atau memuat ulang tab Plano di browser tetap ikut menutupnya).

## `2026-10-24.5`
- **Tidak ada perubahan yang terlihat di aplikasi.** Hanya penyiapan pratinjau lokal untuk pengembangan; versi yang dipublikasikan berjalan seperti biasa.

## `2026-10-24.4`
- **Penanda di kartu pakai kata, bukan simbol.** Tanda ⚑ kini tertulis "3 cek" (hal yang perlu diperiksa lagi di catatan hari ini), dan penanda yang disembunyikan tertulis "+2 lagi". Di HP tidak ada tooltip, jadi artinya sekarang terbaca langsung.

## `2026-10-24.3`
- **Kartu pasien lebih ringkas.** Di bagian nama hanya tersisa yang membantu menemukan pasien (nama, tempat tidur, DPJP, RM). Tanda ★ dan Chief pindah ke satu baris kecil di bawah kartu. Deret penanda (pengingat, pulang, EKG, KJS) paling banyak tiga, sisanya "+n"; pengingat dan KJS · Kardio selalu tampil. Perubahan diagnosis kini satu baris ("2 baru · 1 diubah"); rincian ada di halaman pasien.

## `2026-10-24.2`
- **Strip "Pemantauan" terbaca di mode gelap.** Tulisan putih pada merah terang mode gelap sulit dibaca; kini memakai tulisan gelap. Strip Pemantauan dan strip "Pulang" juga tidak lagi menjorok 2–4 px keluar dari tepi kartu.

## `2026-10-24.1`
- **Laporkan masalah / saran fitur.** Di Pengaturan → Akun & aplikasi kini ada formulir untuk mengirim laporan masalah atau saran fitur langsung ke pemilik Plano, juga saat offline (terkirim begitu tersambung). Laporan masalah otomatis menyertakan versi aplikasi, jenis perangkat, dan Riwayat sesi, tanpa isi catatan.
- **Kesalahan kini tercatat di Riwayat sesi** ("Kesalahan"), dengan layar tempat terjadinya, agar masalah bisa ditelusuri tanpa harus diulang.

## `2026-10-23.7`
- **Judul kartu tanpa nomor urut.** Pasien yang belum diisi identitasnya memakai baris diagnosis pertama sebagai judul kartu; nomor "1." di depannya kini tidak ikut tampil.

## `2026-10-23.6`
- **Rapikan tampilan baru.** Kolom cari di papan tidak lagi menyempit di layar laptop 1024 px; pilihan aktif pada tombol pilihan (mis. Daftar/Kanvas, format Salin) kini jelas terlihat di mode gelap; kepala kartu pasien lebih ringan.

## `2026-10-23.5`
- **Perbaikan "Gagal masuk" setelah memilih akun Google.** Bila jendela Google menutupi Plano (misalnya di HP Android yang membukanya sebagai tab baru), masuk bisa gagal walau akun sudah benar dan sudah disetujui. Kini masuk tersimpan dengan benar.

## `2026-10-23.4`
- **Gagal masuk kini tercatat.** Bila masuk dengan Google gagal, penyebabnya dicatat di Pengaturan → Riwayat sesi ("Gagal masuk dengan Google") dan pesan di layar menyebut jenis kesalahannya. Kirim tangkapan layar Riwayat sesi bila masih terjadi.

## `2026-10-23.3`
- **Tampilan baru yang lebih rapi.** Latar abu-abu lembut dengan kartu putih, bayangan halus, dan tombol yang seragam di seluruh aplikasi. Teks kecil diperbesar satu tingkat agar lebih mudah dibaca di bangsal. Logo Plano kini tampil di menu samping dan halaman masuk.
- **Lebih cepat dibuka.** Hanya papan dan halaman pasien yang dimuat saat aplikasi dibuka; layar lain dimuat saat pertama kali dibuka (tetap bisa offline). Papan dan header tidak lagi memakai efek blur yang memberatkan HP.
- **Papan di HP kini mulai dari Daftar.** Kanvas tetap satu ketukan di sebelahnya dan pilihan Anda diingat.
- **Papan kosong menjelaskan cara memakai Plano** dalam tiga langkah, dengan tombol Tambah pasien pertama.
- **Menu Tindakan pasien lebih ringkas.** Status pasien dan empat aksi harian di atas; fitur catatan lain dan AI dilipat di "Catatan lainnya"; Zona berbahaya dilipat.
- **Pengaturan dibuka dengan grup Utama:** Tampilan, Format catatan, Preset salin, Privasi, dan Akun.

## `2026-10-23.2`
- **Pengaturan lebih tahan hilang.** Perbaikan untuk pengaturan (termasuk bagian yang dikosongkan saat "Salin dari hari sebelumnya") yang kadang kembali ke semula. Plano tidak lagi menulis ulang pengaturan setiap kali dibuka tanpa alasan.

## `2026-10-23.1`
- **Ikon aplikasi baru, lebih sederhana:** huruf "P" dengan denyut EKG di dalamnya. Lebih jelas dibaca saat kecil di layar utama dan tab browser. Ikon di layar utama baru berubah setelah Plano diperbarui; di iPhone mungkin perlu dihapus lalu ditambahkan ulang ke Layar Utama.

## `2026-10-22.2`
- **Ikon aplikasi diganti dengan logo baru Plano** (jantung dengan EKG dan daftar). Ikon di layar utama baru berubah setelah Plano diperbarui; di iPhone mungkin perlu dihapus lalu ditambahkan ulang ke Layar Utama.

## `2026-10-22.1`
- **Hemat kuota Firebase.** Aplikasi kini jauh lebih sedikit membaca data: tanda "sedang mengetik" hanya dikirim saat benar-benar mengetik, riwayat perubahan hanya dimuat saat dibuka, dan riwayat List Maker hanya dimuat penuh di tab Riwayat/Analisis.
- **SOAP checker: post PCI.** Bila PCI direncanakan atau pasien post PCI, Plano mengingatkan bila belum ada cek DR, Ur, Cr, dan HbA1c.
- **Akun "Hanya list".** Admin bisa menerima pengguna baru hanya untuk melihat list pasien (tanpa SOAP). Mereka melihat list yang mengundang mereka, tanpa bisa mengubah.
- **List Maker: saran H-1 kini terlihat jelas** di atas list, lengkap dengan tombol Tandai dan Abaikan.
- **Catatan: Toggle** (bagian yang bisa dilipat, seperti Notion). Ketik /toggle atau pilih dari menu Sisipkan.
- **Catatan di jendela kecil.** Tombol ⧉ membuka catatan di jendela kecil yang selalu di atas, jadi bisa menulis sambil melihat SIMGOS (Chrome/Edge di komputer).
- **Ikon aplikasi baru.**

## `2026-10-20.1`
- **Kartu pasien kembali menampilkan diagnosis.** Bila bagian assessment memakai sub-judul seperti "Diagnosa Utama :", "Diagnosa Sekunder :" atau "Problem :", kartu sebelumnya menampilkan seluruh SOAP. Kini kartu menampilkan isi assessment. Kartu yang sudah terlanjur salah akan benar sendiri setelah catatannya diubah sekali.
- **Residen sebagai Daftar ikut ke PDF dan Word.** Pilihan Kotak/Daftar di layar kini juga mengatur cetakan (satu kolom ke bawah), dan bisa diubah juga di Atur cetak.
- **"+ Catatan" di papan kini bernama "+ Sticky Note".**

## `2026-10-19.1`
- **Catatan: toolbar lebih lengkap.** Urungkan/Ulangi, pilihan gaya blok (Teks, Judul 1–3, Kutipan), coret, panel warna teks dan **stabilo**, menu Sisipkan (garis pemisah, tanggal hari ini, tanggal dan jam), serta Bersihkan format.
- **Catatan: pegangan ⠿ untuk menyeret baris dihapus.** Di HP, tombol ↑ ↓ tetap ada.
- **List Maker: list CVCU/HCU/ICU kini terbaca.** List pasien CVCU (tempat di baris sendiri, identitas di baris berikutnya) dibaca per bed, lengkap dengan DPJP, residen, dan diagnosis, walau penulisnya berganti setiap hari (dr. PT, dr MAA, dr/ PT, Prof.PK, "/ ARB", "(… Pasien dr MAA)"). Bed kosong dilewati. SOAP dari "CVCU Bed 9" juga tercatat di ruang CVCU.
- **List Maker, Residen: "Tidak ada yang pegang" kini "Tidak di-FU"** dan selalu di kotak terakhir (di aplikasi, Word, dan PDF).
- **Residen bisa ditampilkan sebagai Kotak atau Daftar** (satu kolom ke bawah). Pilihan diingat di perangkat ini.

## `2026-10-18.2`
- **Catatan kini terasa seperti Notion.** Ketik di awal baris: `- ` untuk poin, `1. ` untuk nomor, `[] ` untuk checklist (`[x] ` sudah dicentang), `# ` / `## ` / `### ` untuk judul, `---` untuk garis pemisah.
- **Ketik `/` untuk memilih blok** (Teks, Judul, Daftar berpoin, Daftar bernomor, Checklist, Pemisah). Bisa diketik untuk menyaring, mis. `/che`.
- **Daftar bisa bertingkat.** Tab / Shift+Tab (atau tombol ⇥ ⇤ di HP) untuk menjorokkan. Enter pada baris kosong keluar satu tingkat; Backspace di awal baris mengubahnya jadi teks biasa.
- **Memindahkan baris:** di laptop, seret pegangan ⠿ di kiri baris; di HP, tombol ↑ ↓ di toolbar. Sub-baris ikut pindah.
- **Checklist:** yang dicentang dicoret dan dipudarkan; ⋯ → **Pindahkan yang selesai ke bawah** untuk merapikan. Menempel beberapa baris ke checklist menjadi satu item per baris.
- Ukuran teks (Kecil/Besar) diganti judul. Catatan lama tetap tampil sama, termasuk warna dan ukurannya. Perbarui Plano di HP dan laptop pada hari yang sama.

## `2026-10-18.1`
- **Sisipkan punya tiga blok baru:** *Mohon izin kami assess dengan*, *Mohon izin kami terapi dengan* sekaligus *Plan*, dan judul **Laboratorium** bertanggal dengan lantai pasien (mis. *Laboratorium PJT Lt. 5 (18-10-2026)*), sama seperti judul EKG. Kursor langsung berada di poin kosong pertama, siap diketik.
- **Menu Sisipkan kini berurutan seperti SOAP:** keluhan, anamnesis, pemeriksaan fisik, faktor risiko, EKG, Laboratorium, assess, terapi + Plan. Menu bisa digulir bila layar pendek.
- **Papan: Catatan, Shelf, Penanda, dan Gambar kini satu tombol "+ Tambah".** Baris atas papan jadi lebih lega. Penanda dibuka di dalam menu yang sama.

## `2026-10-17.1`
- **Rak kini bernama Shelf, dan Pasien saya serta Titipan punya shelf masing-masing.** Shelf yang dibuat di Titipan hanya tampil di Titipan.
- **Kartu di dalam shelf bisa diurutkan.** Seret kartu lewat pegangan ⠿ ke posisi lain di shelf; garis biru menunjukkan tempat jatuhnya.
- **List Maker: baris tab menempel di atas** saat halaman digulir, jadi pindah tab tidak perlu menggulir ke atas. Hanya baris tab yang menempel, tipis, tidak menutupi isi.
- **Kotak Tempel bisa digeser dan diubah ukurannya** (seret judulnya; ubah ukuran dari sudut kanan bawah). Posisi dan ukurannya diingat di perangkat ini.

## `2026-10-16.5`
- **List Maker: bisa dipulihkan bila tempel salah.** Sebelum setiap Simpan di Tempel, dan setiap kali Simpan edisi, keadaan list disimpan otomatis. Setelah tempel ada tombol **Batalkan tempel ini**; di tab Riwayat ada **Pulihkan list ke edisi ini** dan daftar **Titik pulih**. Sebelum memulihkan, ditampilkan dulu pasien mana yang dikembalikan dan mana yang dihapus. Pemulihan itu sendiri juga bisa dibatalkan.
- **Tombol Tempel di tab List.** Membuka kotak tempel melayang di atas list; list di belakangnya langsung berubah setelah disimpan.
- **Atur cetak untuk PDF dan Word.** Di tab List (dan Riwayat): pilih orientasi, jumlah kolom list, dan ukuran huruf untuk list dan denah, dengan pratinjau halaman. Disimpan di perangkat ini.
- **Tabel residen kini langsung di bawah kotak DPJP**, tidak lagi selalu di halaman baru — bila denah panjang, tidak ada lagi halaman yang hampir kosong. Bisa dikembalikan ke halaman baru di Atur cetak.
- **Rak di papan (urutan sendiri).** Tombol **+ Rak** membuat laci di papan. Seret kartu ke rak untuk menyimpannya, mis. pasien pulang yang berkasnya belum selesai. Rak bisa diberi nama, ditutup, digeser, dan kartunya dikeluarkan lagi.

## `2026-10-16.4`
- **Tab desktop diperbaiki.** Tab kini mengisi seluruh tinggi bilah, jadi bisa diklik di bagian mana pun (sebelumnya hanya separuh bawah; bagian atasnya malah menggeser jendela). Tab yang tidak aktif tampil sebagai blok abu-abu lembut, bukan garis putih terang; tab yang aktif menyatu dengan halaman di bawahnya.
- **Beberapa warna yang selama ini tidak tampil kini muncul sesuai rancangan.** Header atas dan toolbar format kini semi-transparan dengan benar; di kartu pasien, teks keterangan sekunder sedikit lebih redup dan garis pemisah serta jalur progres kini terlihat; beberapa garis tepi merah/aksen kini berwarna benar.

## `2026-10-16.3`
- **Tab bisa digeser untuk mengubah urutan.** Tekan dan seret tab ke kiri atau kanan. Tab lain bergeser memberi tempat, seperti di Chrome.
- **Tab lebih besar dan lebih jelas.** Bilah tab kini lebih tinggi, tab lebih lebar, dan tulisannya lebih besar; tombol **+** dan **×** juga diperbesar. Tab yang tidak aktif kini tampil berbingkai, sehingga tidak lagi terlihat seperti tulisan biasa.

## `2026-10-16.2`
- **Tab seperti browser di aplikasi Plano terpasang (desktop).** Fitur ini hanya untuk Plano yang diinstal di laptop/PC, tidak di tab browser atau HP.
  - Tiap tab memuat satu halaman Plano (Aktif, List Maker, Helper, pasien, dan lainnya).
  - **+** membuka tab baru. Ctrl+klik atau klik tengah pada menu atau tautan membuka halamannya di tab baru di belakang.
  - **×** atau klik tengah pada tab menutupnya. Ctrl+Tab dan Ctrl+Shift+Tab berpindah antar-tab.
  - Tab tetap tersimpan setelah aplikasi ditutup.
- **Tab bisa diletakkan di baris judul jendela**, di samping tombol tutup/perkecil. Klik tanda panah (˄) di baris judul untuk menyalakan atau mematikannya. Bila dimatikan, tab tampil tepat di bawah baris judul.

## `2026-10-16.1`
- **Beberapa jendela SOAP sekaligus (laptop/desktop).** Tiap pasien yang dibuka dari denah atau list mendapat jendelanya sendiri, tersusun bertumpuk. Klik sebuah jendela untuk membawanya ke depan; Esc menutup jendela paling depan. Paling banyak 4 jendela; yang paling lama tertutup lebih dulu. Di HP tetap satu.
- **Atur pasien kini terbuka di samping SOAP** (laptop/desktop). Jendela melebar ke kiri sehingga teks SOAP tetap setinggi semula. Di HP, Atur pasien menggantikan teks SOAP, dengan tombol **Kembali ke SOAP**.
- **Analisis → Riwayat perubahan dikelompokkan per hari.** Tiap hari punya judul dan jumlah perubahannya. Hari terbaru terbuka; hari sebelumnya tertutup dan bisa dibuka. Riwayat kini bergulir di dalam kotaknya sendiri, tidak lagi memanjangkan halaman.
- **Tag otomatis "Pasien baru" kini benar untuk pasien yang ditambahkan dini hari.** Pasien yang ditambahkan antara pukul 00.00–08.00 WITA sebelumnya dianggap pasien kemarin.
- **Pembacaan SOAP diperbaiki:**
  - "Kamar 510 Bed bed 4" kini terbaca bed 4.
  - Karakter tak terlihat di depan nama pasien dibuang.
  - Laporan konsul tanpa judul diagnosis (misalnya konsul echo) kini membawa paragraf "Saat ini evaluasi kardiologi …" ke list.

## `2026-10-14.7`
- **Halaman terakhir list di PDF kini terisi seperti kolom biasa.** Teks mengalir dari atas ke bawah kolom 1, lalu kolom 2, dan seterusnya. Sebelumnya halaman terakhir dibagi rata ke 4 kolom sehingga SOAP satu pasien tersebar tipis.

## `2026-10-14.5`
- **Word List dan PDF kini memakai halaman mendatar (landscape).** Bagian LIST PASIEN tercetak dalam 4 kolom dengan huruf lebih kecil (6,5 pt, sebelumnya 7,5 pt), sehingga lebih banyak isi per halaman. Di PDF, halaman denah tetap tegak; hanya halaman list yang mendatar.
- **Analisis: tombol "Salin ringkasan untuk WhatsApp".** Menyalin ringkasan hari itu (rencana pulang hari ini, H-1, sudah pulang, pindah ruangan, pindah kamar, masuk list) dengan kode DPJP tiap pasien, tanpa jam, siap ditempel di grup.

## `2026-10-14.4`
- **Denah di HP bisa dicubit untuk memperbesar.** Cubit dengan dua jari di denah untuk memperbesar atau memperkecil. Yang membesar hanya denahnya, bukan seluruh halaman, dan bagian di bawah jari tetap di tempatnya. Pembesaran bisa sampai 2× ukuran penuh. Geser dengan satu jari seperti biasa.
- Tombol **Perbesar / Muat di layar** tetap ada sebagai jalan pintas. Tingkat pembesaran terakhir diingat di perangkat ini.

## `2026-10-14.3`
- **Buat Sensus (mode AI): hasil AI lama tidak lagi dipakai setelah aplikasi diperbarui.** Hasil AI disimpan per DPJP. Sebelumnya, hasil yang dibuat saat aplikasi masih salah membaca list (misalnya pasien Prof. IM masuk ke Prof. MZ) tetap tampil setelah perbaikan. Kini hasil seperti itu ditandai usang dan perlu **Susun ulang**.
- **AI kini diberi tahu bentuk-bentuk judul DPJP** seperti "Prof. IM 1 Pasien" dan "Dr.AHA (1 pasien)". Setiap judul DPJP mengakhiri bagian DPJP di atasnya.
- Bila AI tetap memasukkan pasien ke DPJP yang salah, pemeriksaan di bawah hasil AI akan menandainya sebagai **Hanya AI** beserta DPJP menurut aturan.

## `2026-10-14.2`
- **Buat Sensus: diagnosis dari list Lantai 5–6 kini terbaca.** Judul diagnosis seperti "- Mohon izin pasien kami assess dengan :" (diawali tanda strip), "Mohon Izin prof, pasien kami assest dengan:", dan "A/" sebelumnya tidak dikenali, sehingga diagnosis pasien tampil "-". Diagnosis yang ditulis langsung di bawah baris pasien tanpa judul (seperti di list CVCU) kini juga terbaca.
- **Buat Sensus: pasien kini masuk ke DPJP yang benar.** Judul seperti "Prof. IM 1 Pasien" dan "Prof. PK 3 Pasien" sebelumnya tidak dikenali, sehingga pasien Prof. IM masuk ke Prof. MZ dan pasien Prof. PK masuk ke dr. AHN.
- **List Maker (Tempel list):** judul "Dr.AHA (1 pasien)" dan "Prof. MZ ( 3 Pasien)" kini dikenali (sebelumnya pasiennya masuk ke DPJP di atasnya). Pasien bernomor "1..519" juga tidak lagi terlewat. Diagnosis tanpa judul kini tampil sebagai bagian Diagnosis.

## `2026-10-14.1`
- **Buat Sensus: semua list boleh ditempel sekaligus dalam satu kotak.** Sebelumnya satu kotak dianggap satu list, sehingga bila IGD, RSUH, RSWS, Lantai 5–6, CVCU, dan Lantai 4 ditempel bersama, semua pasien masuk ke "IGD PJT". Kini tiap list dipisah dan dikenali dari judulnya, termasuk bagian "Pasien Baru / Pulang" yang ada di atas salam list RSWS dan RSUH. Di atas kotak tampil rincian tiap list dan jumlah pasiennya.
- **List IGD tanpa nomor pasien kini terbaca.** Baris seperti "IGD Redzone Bed 1 Ny. … / RM … / dr MAA -> dr AHA" sebelumnya terlewat semua (0 pasien). Hal yang sama berlaku untuk pasien Lantai 5–6 yang ditulis tanpa nomor ("511 bed 3/ny.…").
- **Jumlah pasien di kotak kini dihitung sekali per pasien.** Pasien yang tercantum di "Pasien Baru" dan juga di bawahnya tidak lagi terhitung dua kali (RSWS: 19, sesuai list).
- Tanda residen dua huruf seperti "(Ai)" kini dibuang dari baris sensus, sama seperti "(Iska)".

## `2026-10-13.15`
- **Tampilan List Maker diperbarui.**
  - **HP:** tanggal dan chief tidak lagi berantakan, dan keenam tab muat di layar.
  - **Tab List kini enak dibaca.** Satu baris per pasien berisi kamar/bed, kode DPJP, identitas, residen, dan tanda. Tombolnya cukup satu, **Atur**, yang membuka pengaturan pasien itu. Ketuk baris pasien untuk membuka SOAP.
  - **Ekspor dalam satu kotak:** Jam list dan **Simpan edisi**, lalu **Salin teks**, **Word: List**, **Word: Denah**, dan **PDF**. Pratinjau pesan WhatsApp bisa dibuka-tutup.
  - **Atur pasien dikelompokkan:** Residen, Rencana pulang, Tag, dan Status pasien. Tiap tombol status punya warna sendiri: Pulang hijau, Pindah ruangan oranye, Kamar/bed biru.
  - Tab **Anggota** kini bernama **Setelan**.
- **Warna aplikasi.** Di Pengaturan → Tampilan → **Warna aplikasi** tersedia 7 pilihan warna: Biru, Toska, Ungu, Hijau, Oranye, Merah muda, Grafit. Latar bisa dipilih: Standar, Kertas hangat, atau Hitam pekat (untuk layar OLED saat jaga malam). Pengaturan ini tersimpan di perangkat masing-masing.
- **Tombol utama di mode gelap kini lebih jelas** (teks gelap di atas warna terang).

## `2026-10-13.14`
- **Jam "disimpan" di Riwayat kini sesuai jam HP.** Sebelumnya tampil dalam jam UTC, terlambat 8 jam. Jam pada daftar "Sudah keluar" juga diperbaiki.
- **Edisi bisa dihapus.** Di tab Riwayat, tekan **Hapus edisi** lalu konfirmasi. Tombol **Simpan edisi** kini tidak menyimpan dua kali bila tertekan dua kali.
- **Operkan ke teman lain & ganti chief per pasien.** Isi di **Atur pasien**. Isian ini tampil di kartu pasien dan di dua kotak terpisah pada halaman residen (Word, PDF, dan aplikasi).
- **Nama residen** di tabel residen kini lebih besar daripada baris pasiennya.
- **"(belum diisi)"** diganti menjadi **"Tidak ada yang pegang"**.
- **Pasien bagian lain yang dikonsulkan ke divisi** (mis. KJS Aritmia ke Prof. MZ) kini masuk bagian **KJS** di kotak DPJP tersebut, bukan sebagai pasien utamanya. Tulisan "KJS ARITMIA" tanpa junior bangsal dikenali otomatis, atau atur lewat **Pemegang → Div. Aritmia**.

## `2026-10-13.13`
- **SOAP dari grup kini memperbarui pasien manual tanpa RM.** Pasien manual yang diinput tanpa RM sebelumnya muncul dua kali saat SOAP-nya ditempel. Sekarang SOAP itu dicocokkan dengan nama pasien di kamar yang sama dan menggantikan isi pasien manual tersebut. SOAP berikutnya dicocokkan lewat RM.

## `2026-10-13.12`
- **Pasien manual kini tampil sama dengan pasien dari WhatsApp.** Isinya ditulis seperti laporan dari grup: pembuka dengan kamar/bed, identitas, DPJP Utama, lalu assess/terapi/plan. Jendela SOAP, tombol lompat, dan salin per bagian kini bekerja sama persis. Pasien manual yang sudah tersimpan ikut tampil dengan bentuk baru.
- **Tag yang tidak ikut dicetak.** Di **Anggota → Warna list**, hilangkan centang **Ikut dicetak di Word/PDF** untuk tag kerja (mis. tanda SOAP sudah diperbarui). Tag tersebut hanya tampil di layar. Label **SOAP baru** juga tidak pernah ikut dicetak.
- **PDF: Denah + List** (tab List) membuat satu file berisi denah, kotak DPJP, tabel residen, dan list. Pilih **Simpan sebagai PDF** di jendela cetak.
- **Tab baru: Analisis.** Menampilkan pergerakan pasien di lantai:
  - pasien masuk, sudah pulang, pindah ruangan, dan pindah kamar pada tanggal list;
  - rencana pulang hari ini dan rencana H-1;
  - jumlah per hari selama 7 hari;
  - riwayat semua perubahan (siapa, kapan).
- **Cek dengan slaber perawat** (di tab Analisis). Buka file Word laporan dinas/timbang terima perawat. List dicocokkan berdasarkan RM, lalu ditampilkan:
  - pasien kardiologi yang ada di slaber tapi belum ada di list;
  - pasien di list yang tidak ada di slaber;
  - pasien dengan kamar/bed yang berbeda.

## `2026-10-13.11`
- **Tempel: SOAP yang disalin satu per satu kini terbaca.** Pesan yang disalin sendiri (tahan → Salin) tidak membawa jam kirim. Akibatnya SOAP itu tidak pernah dianggap lebih baru dan tombol **Baca** seperti tidak merespons. Sekarang pesan tanpa jam dianggap terkirim saat ditempel. Baca juga selalu memberi jawaban: ada perubahan, semua sudah sama, atau tidak ada pasien yang terbaca.
- **Pasien manual bisa diperbarui.** SOAP dari grup kini menggantikan isi pasien yang diinput manual. Dari denah, buka pasien lalu **Ubah isi** untuk mengubahnya.
- **Tanda SOAP terbaru.** Label **SOAP baru** (dengan jam) muncul bila SOAP masuk setelah list terakhir disimpan. Label abu-abu **SOAP tgl/bln** muncul bila belum ada SOAP pada tanggal list. Label tampil di kartu List, di denah, dan di jendela SOAP.

## `2026-10-13.10`
- **Warna list kini berupa tag.** Warna tambahan tampil sebagai label berwarna, mis. **[Pasien NP]**, di belakang baris pasien, dan tidak lagi mewarnai seluruh identitas. Pasien H-1 tetap merah (pulang hari ini tetap hijau) dan tetap membawa tagnya. Satu pasien bisa punya beberapa tag. Pasang atau lepas tag di **Atur pasien** atau di kartu tab List.
- **Tag otomatis.** Di **Anggota → Warna list**, tiap warna bisa dipasang otomatis untuk:
  - pasien baru (belum ada di list hari sebelumnya);
  - pasien DPJP tertentu, mis. NP, atau YP dan AAU;
  - KJS BTKV;
  - konsul/KJS;
  - pasien yang dipegang divisi;
  - pasien yang belum ada junior.

  Tag otomatis bisa dilepas per pasien.
- **Pasien dengan dua DPJP** (mis. utama ZD, KJS Aritmia MZ) kini ditulis lengkap hanya di kotak DPJP utama. Di bagian KJS kotak MZ cukup ditulis singkat dan abu-abu, mis. "420 Bed 2/Tn. X → ZD", di denah maupun Word. Pasien tetap terhitung "+ KJS".
- **Pasien dengan DPJP utama dari bagian lain** (mis. TM) yang masuk list karena KJS Aritmia MZ:
  - dari list rekan: baris di bawah judul "KJS" kini dibaca, tidak lagi dilewati;
  - dari SOAP: dicatat sebagai KJS MZ, bukan pasien MZ sendiri.

  Bila tidak ada junior bangsal yang tertulis, pasien ini otomatis masuk blok "tidak di-FU".
- **Divisi lebih tepat.** Pasien yang punya SOAP dari grup lantai, atau yang junior-nya tertulis, tetap dipegang residen bangsal, walaupun ada konsul KJS Aritmia.

## `2026-10-13.9`
- **Pasien yang dipegang divisi.** Contohnya konsul dari bagian lain ke divisi Aritmia: pasien tetap masuk list, tetapi tidak di-FU residen bangsal. Pasien seperti ini kini masuk blok sendiri, **"Divisi Aritmia (tidak di-FU)"**, dan tidak lagi muncul sebagai "(belum diisi)" atau ikut terhitung untuk chief. Tulisan "KJS ARITMIA" dikenali otomatis. Bisa juga diatur manual lewat kolom **Pemegang** di kartu pasien.
- **Residen bernomor.** Di tabel residen Word dan di denah, pasien tiap residen kini bernomor, dan jumlahnya tertulis di samping nama.
- **Tombol Hapus diperkecil** agar tidak tertekan tidak sengaja. Tetap perlu konfirmasi.
- **Atur pasien dari denah.** Ketuk pasien di denah, lalu **Atur pasien**. Isinya sama dengan kartu di tab List: junior, chief, warna, rencana pulang, pemegang, Pulang, Pindah, Kamar/bed.

## `2026-10-13.8`
- **Word: Denah.** Halaman residen kini berbentuk **tabel**, tiga kolom. Tiap kotak berisi satu junior: nama dan jumlah pasien di atas, lalu daftar pasiennya. Bagian "Operkan ke Tmn Lain" dan "Ganti Chief" tetap ada di bawahnya.
- **Per DPJP** di denah aplikasi kembali seperti sebelumnya.

## `2026-10-13.7`
- **Hapus pasien.** Pasien yang salah masuk atau dobel bisa dihapus dari list dan denah: tombol **Hapus** di kartu tab List dan di jendela SOAP, lalu konfirmasi **Ya, hapus**. Pasien yang pulang tetap pakai **Pulang** agar tercatat.
- **Tempel export chat lebih aman.** Export chat mencakup beberapa hari, jadi bisa berisi pasien yang sudah pulang kemarin. Pasien baru yang kemungkinan sudah keluar kini **tidak dicentang**, dengan alasannya:
  - tidak ada di list terbaru dalam chat itu;
  - Plan menyebut pulang pada hari sebelumnya;
  - tidak ada SOAP lebih dari 36 jam.

  Centang bila pasien memang masih dirawat.
- **Warna list sendiri.** Merah (H-1) dan hijau (pulang hari ini) tetap. Di tab **Anggota → Warna list**, tambahkan warna lain untuk lantai ini (mis. Pre-op, Tunggu ICU) dari 7 pilihan warna, lalu pilih di kolom warna pasien. Warna dan namanya tampil di kartu, denah, dan Word.
- **Cari pasien** di tab List dan Denah: nama, RM, kamar (417/2), residen, DPJP, atau diagnosis. Di denah, hasil ditandai dan sisanya diredupkan, plus daftar hasil di atas yang bisa diketuk.
- **HP: halaman tidak lagi bergeser ke samping** saat denah diperbesar.

## `2026-10-13.6`
- **List Maker: roster junior lantai.** Di tab **Anggota**, isi nama junior yang bertugas di lantai . Nama junior/chief yang tertulis sedikit berbeda di SOAP atau list (berspasi, huruf kecil, salah satu huruf, atau disingkat) ditampilkan sesuai ejaan roster:
  - di denah, blok Residen, pesan List, dan Word;
  - juga pada data pasien yang sudah tersimpan, tanpa perlu tempel ulang.

  Nama chief dicocokkan ke kolom **Chief**. Nama hanya diganti bila tepat satu nama roster yang cocok, jadi dua residen dengan nama mirip tidak pernah tergabung.
- Kolom Junior di tab List kini menawarkan nama dari roster.

## `2026-10-13.5`
- **Impor list: nama residen tidak lagi tercampur catatan.** Pada baris seperti "…/dr. Didi/FU Ari - KJS BTKV", tambahan "- KJS BTKV" sebelumnya ikut terbaca sebagai bagian nama junior. Akibatnya muncul blok residen palsu "Ari - KJS BTKV", "Imelda - KJS BTKV", dan "Indah - KJS BTKV". Sekarang catatan itu dibuang dari nama, sedangkan pasien tetap ditandai KJS BTKV.

## `2026-10-13.4`
- **List Maker: denah di HP kini benar-benar denah.** Sebelumnya di HP kamar ditampilkan sebagai daftar bertumpuk. Sekarang tata letaknya sama dengan di laptop, dan diperkecil agar seluruh lantai muat di layar:
  - 420 dan 421 di atas;
  - kamar kiri dan kanan sejajar per baris;
  - Nurse Station dan 411 di tengah.

  Ketuk pasien untuk membuka SOAP lengkap. Tombol **Perbesar** menampilkan denah ukuran penuh untuk digeser ke samping, dan **Muat di layar** mengecilkannya kembali. Pilihan ini diingat di perangkat.
- **Impor list: "FU" menandai junior.** "… / FU Ari - dr. Didi" dan "dr. Didi / dr. FU Avi" kini terbaca junior Ari/Avi dengan chief Didi. "FU Ari" tidak lagi ikut tercetak di identitas pasien.

## `2026-10-13.3`
- **Sensus: DPJP di list IGD dan CVCU/HCU/ICU kini terbaca.** Sebelumnya pasien dengan tulisan seperti di bawah ini masuk **Perlu dicek**:
  - "/DPJP Prof PK" (dengan kata DPJP);
  - "RM 1724699 dr. AHN" (kode sesudah RM tanpa garis miring);
  - "dr. KS (KJS BTKV) (Haliim - Malik)" (lebih dari satu kurung).

  Pada list IGD dan CVCU yang Anda kirim, semua 30 pasien kini mendapat DPJP-nya; 6 pasien tadi tidak lagi masuk Perlu dicek.
- **Nama residen dalam kurung** ("(Haliim - Hendra)", "(Arago - dr. Hendra)") tidak lagi ikut tercetak di sensus. Catatan seperti "(KJS BTKV)" tetap ada.

## `2026-10-13.2`
- **Blok TS kini dikenali walau tidak ditebalkan.** Rekan biasa menulis "TS Neuro", "Ts EMD", atau "TS GH/" pada barisnya sendiri. Sebelumnya hanya "*TS BTKV*" (tebal) yang terbaca sebagai judul. Pada 328 dari 517 laporan di grup Lt 4/Lt 5, isi TS (A/, P/, I/) ikut terbaca sebagai **Plan kita**. Sekarang:
  - **Salin → Plan** tidak lagi ikut menyalin rencana konsulen; isi TS masuk ke **Terapi + TS**.
  - Tombol lompat di header dan pewarnaan bagian juga menampilkan setiap blok TS.
- **"Plan" tanpa titik dua** tetap dikenali sebagai Plan kita walau sesudah Terapi ada "Selesai :" atau judul lain. Plan yang tidak terbaca turun dari 33 ke 5 laporan.

## `2026-10-13.1`
- **Pemeriksa SOAP: hitungan hari yang dibekukan tidak lagi diingatkan.** "H-3" pada obat di bawah **Selesai**, pada baris yang di-**STOP**, dan di dalam blok **TS** (disalin apa adanya dari SOAP konsulen) tidak lagi dianggap "belum berubah dari kemarin". Hanya hitungan hari milik kita yang diperiksa.
- **List Maker: impor list dari rekan di luar Plano.** Tempel pesan **List Pasien** yang mereka kirim ke grup di tab Tempel, maka pasiennya terbaca: kamar/bed, DPJP, identitas, junior/chief, serta diagnosis, terapi dan plan.
  - Tiga bentuk list yang ada di grup Lt 4 dan Lt 5 terbaca, termasuk list pendek ("🫀 dr. ZD — 2 pasien").
  - Baris di bawah judul **KJS** dilewati, karena pasien yang sama sudah tercantum di bawah DPJP-nya sendiri.
  - **SOAP selalu didahulukan**: baris dari list tidak pernah menimpa SOAP, sedangkan SOAP selalu menggantikan baris list. Pasien dari list ditandai "dari list" di Tempel.

## `2026-10-12.15`
- **List Maker, perbaikan:**
  - **Setelah menghapus list**, list berikutnya tidak lagi menampilkan kotak "Menghapus…". Begitu pula isian di tab lain (Tempel, List, Riwayat) tidak terbawa saat berpindah list.
  - **Menyimpan hasil Tempel (termasuk file export WhatsApp) kini langsung selesai**, tidak perlu pindah tab dulu. Semua pasien disimpan sekaligus dalam satu kali kirim.
  - Kotak **"Ada data lama"** hanya muncul bila list itu memang punya data dari sebelum versi 12.12. Di list baru tidak muncul lagi.
- **Kotak SOAP di denah: lompat ke bagian.** Ada deretan tombol (Diagnosis, S, O, Assessment, Terapi, Plan, TS …) dan judul berwarna yang tetap terlihat saat digulir, seperti di hasil sensus.
- **Jumlah per DPJP lebih jelas:** "dr. AFG : 2 pasien (1 kardio, 1 KJS BTKV)". Bila semua pasiennya BTKV: "1 pasien KJS BTKV". Sebelumnya "1 pasien (1 BTKV)" terbaca seperti 2 pasien.

## `2026-10-12.14`
- **Pembacaan SOAP lebih andal**, diuji pada contoh baru: grup Lt 4 (1–22 September, 402 laporan) dan Lt 5 (5–12 Oktober, 114 laporan).
  - **List Maker**: semua laporan Lt 4 kini terbaca lengkap. Sebelumnya 29 laporan kosong Diagnosis/Terapi-nya karena judulnya berbeda, mis. "Mohon izin dok, pasien kami diagnosis dengan", "Mohon izin kami asses pasien dengan", atau "Mohon Izin Kami Asses:".
  - **Kamar**: "Lt .4" dan "PJT Kamar 417" (tanpa nomor lantai) kini terbaca lantai 4. "Kamar Super VIP" / "Supervip" dikenali sebagai **411**. Laporan pasien yang masih di **IGD** tidak lagi masuk list lantai; namanya ditampilkan terpisah di Tempel.
  - **KJS TS Lain** juga dihitung bila DPJP Utama dari bagian lain (mis. "DPJP Urologi (Utama)", "DPJP GH (Utama)"), walau pesannya tidak menulis "KJS".
- **Bagian catatan lebih sering dikenali** (dipakai Pemeriksa SOAP, Salin, Ringkas): judul "Mohon izin kami … dengan" tanpa titik dua, berbagai ejaan *assess/assesst/assesment*, dan baris "Plan" saja tepat setelah Terapi. Dari 516 laporan rekan, Assessment yang tidak terbaca turun dari 171 ke 3, Terapi dari 144 ke 5, dan Plan dari 120 ke 17.
- **Pemeriksa SOAP: konsul TS** kini mengenali "Rheumatologi" = "Rheuma", "GH" / "Ginjal-HT", "Endrokrin" = EMD, dan "Infeksi Tropis" = PTI, sehingga tidak lagi salah mengingatkan.

## `2026-10-12.13`
- **Pemeriksa SOAP: pengingat pemantauan antikoagulan.** Bila Terapi berisi heparin tapi Plan belum ada APTT, muncul saran **"Cek APTT/hari"**; bila warfarin (termasuk Simarc/Notisil) tapi belum ada INR, saran **"Cek INR/3 hari"**. Tidak muncul untuk LMWH, heparin flush, obat yang di-stop, atau yang ada di bawah "Selesai".
- **Warfarin (protokol RSWS): pilih pembulatan dosis.** Bila total mingguan hasil hitungan jatuh di antara dua langkah dosis, pilih **Ke bawah / Terdekat / Ke atas**; total tiap pilihan langsung terlihat.
- **Kotak DPJP di sidebar dihapus.** Isinya sudah tampil di halaman pasien (di atas catatan atau di panel samping).
- **List Maker:**
  - **Pindah kamar/bed di lantai yang sama**: tombol **Kamar/bed…** di tiap pasien. Tercatat siapa dan kapan; SOAP lama yang masih menulis kamar sebelumnya tidak memindahkan pasien kembali.
  - **Kotak pasien ikut berwarna**: merah untuk H-1, hijau untuk pulang hari ini.
  - **Warnai per DPJP**: centang di atas pesan list untuk mewarnai tiap bagian DPJP (seperti hasil sensus), dengan tombol lompat ke tiap DPJP. Yang disalin tetap teks biasa.
  - **Pasien manual tidak harus pediatri**: semua DPJP bisa dipilih.
  - **Kolom chief lebih rapi**: nama chief kini di dalam satu kotak, tidak lagi menggeser baris atas.
  - **Hapus list** (khusus pemilik): di tab Anggota, **Hapus list…** lalu konfirmasi. Menghapus pasien, SOAP, dan riwayat edisi untuk semua anggota; perlu koneksi internet.

## `2026-10-12.12`
- **List Maker: status pasien kini diatur tangan, tidak lagi ditebak dari SOAP.** Merah (H-1), hijau (pulang hari ini), pulang dan pindah dulu dibaca otomatis dari isi Plan — terlalu berisiko salah. Sekarang:
  - Lantai punya **daftar pasien tetap**. Menempel pesan baru hanya **memperbarui SOAP dan mengusulkan pasien baru**; tidak ada pasien yang keluar dari list karena tempel.
  - Di **Tempel**, perubahan ditampilkan dulu: pasien baru (centang untuk masuk), kamar/bed berubah (centang untuk ikut pindah), dan pasien yang sudah keluar tapi ada SOAP baru (tidak masuk lagi kecuali dicentang).
  - Di **List**, tiap pasien: junior, chief, **warna** (tanpa / H-1 / pulang hari ini) atau **tanggal rencana pulang** (merah sehari sebelumnya, hijau pada harinya), tombol **Pulang** dan **Pindah…** (ICU, CVCU, HCU, ICCU, lantai lain, atau tulis sendiri). Semua tercatat siapa dan kapan, dan bisa **Kembalikan**.
  - Bila Plan menyebut H-1 / pulang hari ini, muncul **saran** — tekan **Tandai** atau **Abaikan**; tidak pernah diterapkan sendiri.
  - Anggota "Lihat dan edit" bisa mengubah status.
- **Jam list bebas ditulis** (04.00, 16.00, 19.00, atau jam lain). **Simpan edisi** menyimpan pesan dan denah saat dikirim; lihat dan unduh Word-nya lagi di tab baru **Riwayat**.
- **Catatan pulang / pindah** terpisah dari list: siapa yang pulang atau pindah sejak edisi terakhir, siap disalin.
- **Data lama:** list yang dibuat sebelum versi ini muncul kosong; tekan **Pindahkan data lama** sekali untuk memasukkan pasien terakhirnya. Setelah itu periksa warnanya — warna dari versi lama tidak ikut.

## `2026-10-12.11`
- **Perbaikan: halaman bisa digulir melewati batas** (layar kosong di bawah, sidebar ikut terangkat). Terjadi di denah List Maker yang punya pasien merah/hijau; kini tidak lagi, di semua halaman.
- **List Maker: bisa membuat lebih dari satu list.** Pilih **+ List baru** di samping nama list; tiap list punya anggota dan isinya sendiri.
- **Kotak SOAP bisa digeser dan diubah ukurannya** (tablet/laptop): tarik bagian judulnya untuk memindahkan, tarik sudut kanan bawah untuk mengubah ukuran. Posisi dan ukurannya diingat di perangkat ini.
- **Ubah SOAP**: anggota "Lihat dan edit" bisa memperbaiki SOAP yang ditempel dari WhatsApp langsung di kotak SOAP. Diagnosis, terapi, DPJP, dan merah/hijau mengikuti hasil ubahan. Menempel ulang pesan yang sama tidak menimpa ubahan; pesan baru dari grup tetap menggantikannya.
- **Chief lebih dari satu**: di **Chief hari ini** tambahkan beberapa nama (Enter atau koma). Bila hanya satu chief, semua pasien otomatis memakainya; bila lebih, pilih chief tiap pasien di tab List (ada pengingat jumlah pasien yang belum ada chief).
- **Denah simetris**: kamar kiri dan kanan kini sejajar per baris (tablet/laptop), sama seperti di Word.

## `2026-10-12.10`
- **List Maker: pasien manual (pediatri).** Di tab List, **+ Pasien manual (pediatri)**: pilih kamar, bed dan DPJP (pediatri di urutan atas), tulis identitas, lalu **Diagnosis, Terapi, Plan**. Pasien langsung muncul di denah (kode DPJP pediatri oranye), di tabel DPJP, di pesan List, dan di Word.
  - Pasien manual **tetap di list setiap hari** tanpa perlu laporan harian, sampai dihapus (**Hapus pasien manual**) atau Plan-nya menulis pulang hari ini. **Ubah isi** untuk memperbarui diagnosis/terapi/plan.
  - Bisa ditambah oleh anggota "Lihat dan edit".
- **Pesan yang berisi lebih dari satu laporan** (mis. ringkasan lalu SOAP lengkap pasien yang sama, atau dua pasien dalam satu pesan) kini dibaca semua; tidak ada pasien yang terlewat.

## `2026-10-12.9`
- **List Maker: ekspor Word.** Dua tombol di atas tab: **Word: List Pasien** dan **Word: Denah**, untuk dicetak (mis. di ruang MR).
  - **List Pasien**: A4, tiga kolom, huruf kecil, teks hitam; yang bertanda *…* jadi tebal; nomor halaman di bawah.
  - **Denah**: halaman 1 berisi denah lantai (420 dan 421 di atas, kamar kiri, Nurse Station dan 411 di tengah, kamar kanan) lalu tabel per DPJP (tiga per baris, pasien KJS di bawah DPJP-nya). Halaman 2 berisi jumlah pasien per chief, blok tiap junior, lalu "Operkan ke Tmn Lain" dan "Ganti Chief" untuk diisi tangan.
  - Warna sama seperti di layar: **merah** H-1, **hijau** pulang hari ini, kode DPJP pediatri oranye; keterangan warna ada di kaki setiap halaman.
- **Hanya anggota yang diundang** yang bisa melihat denah dan list sebuah lantai; pengguna Plano lain tidak.

## `2026-10-12.8`
- **Baru: List Maker** (menu **List Maker**, WIP) — list pasien dan denah lantai dibuat otomatis dari pesan SOAP di grup WhatsApp, dan bisa dibagikan ke tim lantai.
  - **Tempel**: tempel pesan SOAP (boleh banyak sekaligus) atau buka file **Export chat** WhatsApp (.zip/.txt). Laporan terbaru tiap pasien yang dipakai; pesan List, obrolan, dan pasien lantai lain dilewati.
  - **Denah**: denah PJT Lantai 4 dengan semua bed, tabel per DPJP, dan pembagian residen (chief dan junior). **Ketuk pasien untuk melihat SOAP lengkapnya** di kotak mengambang — di tablet/laptop denah tetap terlihat di sampingnya.
  - **Merah = H-1, Hijau = pulang hari ini**, dibaca dari Plan (bukan dari diagnosis), dan dihitung dari tanggal laporannya: "H-1 hari ini" kemarin menjadi hijau hari ini.
  - **List**: pesan List Pasien siap disalin (format grup: jumlah pasien, per DPJP, Diagnosis/Terapi/Selesai/Plan dan blok TS, pasien KJS di bawah DPJP-nya), teks hitam. Junior, chief, merah/hijau bisa dikoreksi per pasien; pasien bisa dikeluarkan/dimasukkan.
  - Pasien yang sudah pulang (menurut Plan) atau **tidak ada laporan sejak kemarin** otomatis tidak masuk list, tetapi tetap ditampilkan untuk dimasukkan kembali.
  - **Anggota**: undang rekan dengan email akun Plano-nya, sebagai **Lihat saja** atau **Lihat dan edit**. Undangan diterima di halaman List Maker mereka. Semua anggota bisa melihat SOAP lengkap pasien lantai ini.
  - Junior diambil dari baris "Junior :" atau nama pengirim WhatsApp (bisa diganti di Anggota → Nama panggilan); chief dari baris "Chief :" atau **Chief hari ini**.
  - Ekspor Word (List 3 kolom dan Denah) menyusul.

## `2026-10-12.7`
- **Jadwal Pediatri dari teks WhatsApp: "dr. A - dr. B" kini ditulis sebagai dua nama**, "A / B", tanpa label BTKV. Sebelumnya A dianggap residen BTKV; anggapan itu belum pasti, jadi kini keduanya ditulis apa adanya. Bentuk dalam kurung dari PDF, "(A) - B", tetap dibaca A sebagai BTKV.
  - Jadwal yang sudah ditempel sebelum pembaruan ini masih memakai cara lama: **tempel ulang teks WhatsApp-nya** di Konfirmasi Jaga → Pediatri.

## `2026-10-12.6`
- **Buat Sensus kini tersimpan di akun.** List yang ditempel, hasil AI, pasien "Perlu dicek" yang dimasukkan, dan centang **Sudah saya cek** di Bandingkan kini Synced ke akun:
  - **tidak hilang lagi setelah Keluar**: masuk lagi, semuanya kembali;
  - **sama di HP dan laptop**: tempel di satu perangkat, lanjutkan di perangkat lain;
  - tetap per tanggal sensus, disimpan 7 hari lalu dihapus otomatis.
  - Bila list satu hari terlalu besar (sangat jarang), list itu tetap di perangkat saja dan ada pemberitahuannya.
- **API key AI dan sakelar fitur AI kini mengikuti akun.** Cukup tempel sekali di Pengaturan → AI; semua perangkat yang masuk dengan akun Anda langsung memakainya, juga setelah Keluar lalu masuk lagi. Key tidak ikut dalam ekspor data.

## `2026-10-12.5`
- **Formasi Jaga: tim malam hari Sabtu kini ikut memuat baris "_DPJP Onsite: …_".** Tim malam hari lain tetap tanpa baris onsite.
- **Jadwal DPJP Onsite IGD kini bisa diubah sendiri:** Helper → Konfirmasi Jaga → di bawah Formasi, buka **Jadwal DPJP Onsite IGD**.
  - pilih DPJP untuk tiap hari (atau "tidak ada");
  - centang **Tim malam juga** bila tim malam hari itu ikut diberi baris onsite (awalnya hanya Sabtu);
  - tersimpan di akun, jadi sama di semua perangkat; **Kembalikan jadwal awal** memulihkan jadwal Senin KS … Sabtu Prof. MZ.

## `2026-10-12.4`
- **Konfirmasi Jaga: Formasi kini memuat DPJP Onsite IGD (14.00–21.00)**, sesuai jadwal: Senin dr. KS, Selasa dr. ZD, Rabu dr. AHN, Kamis dr. MAA, Jumat dr. AHA, Sabtu Prof. MZ. Hari Minggu dan tim malam tidak diberi baris onsite.
- **Format Formasi mengikuti contoh terbaru:**
  - bila DPJP Utama dan Tindakan orang yang sama, ditulis satu baris: "_DPJP Utama dan Tindakan: …_";
  - "_DPJP Onsite: …_" tepat di bawahnya;
  - blok "DPJP Utama dan Tindakan setelah Pk. 00.00 WITA" kini **sebelum** "Mohon arahannya dokter".

## `2026-10-12.3`
- **Periksa lagi: "Tampilkan" berpindah dari satu tempat ke tempat berikutnya.** Untuk temuan yang muncul di beberapa tempat (judul ganda, baris ganda, terapi ganda), tombolnya bertuliskan **Tampilkan (2)**:
  - tekan pertama ke tempat pertama;
  - lalu **Berikutnya (2/2)** ke tempat berikutnya;
  - lalu **Ke atas** kembali ke awal catatan, dan putarannya mulai lagi.
  - Setiap judul ganda kini menjadi temuan tersendiri.
- **Terapi ganda direvisi:** obat yang diberikan lagi setelah pemberian sebelumnya selesai (mis. "KCl … (pemberian kedua)" di Terapi dan "KCl … (I)" di Selesai) **tidak lagi** ditandai. Yang ditandai hanya baris yang **sama persis** di Terapi dan di Selesai.

## `2026-10-12.2`
- **Buat Sensus: list CVCU/HCU/ICU kini terbaca lengkap.** List yang menulis bed tanpa nomor ("CVCU Bed 1", "HCU Bed 3", "ICU bed 4", "CVCU Super VIP", "CVCU Isolasi") sebelumnya hanya terbaca satu pasien (yang bernomor, "1. ICU 5"); pasien lain dianggap bagian plan pasien tersebut. Kini setiap bed terbaca. Pada list 12-10, 16 pasien terbaca (sebelumnya 1). Bed "Kosong", "pasien dr. NP" dan "Pediatri" tetap dilewati.
- **Pergantian DPJP di baris pasien** ("AHA->AHN") dibaca sebagai DPJP sesudah tanda panah (AHN). Barisnya tetap ditulis seperti aslinya.

## `2026-10-12.1`
- **Salin → Konsul "Echocardiography full study" diperbaiki:**
  - **DPJP Utama tidak lagi hilang** bila labelnya salah ketik ("_DJPJP Utama_"); terkirim sebagai "_DPJP Utama : …_".
  - **Tanpa BB/TB.** BB dan TB kini hanya ikut pada konsul 6MWT.
  - **Kalimat pembuka mengikuti list bangsal:** "mohon izin mengirimkan rencana pasien Echocardiography full study tanggal *12 Oktober 2026* dari *PJT Lantai 4* atas nama:".
  - **Kamar ikut di baris pasien:** "1. *Ny. … / RM … / Kamar 421 Bed 4*".
- **Periksa lagi (SOAP checker):**
  - **Tidak lagi salah menandai "Baris ganda"** untuk hasil EKG yang sama di dua tanggal berbeda (mis. pacing rhythm 11-10 dan 12-10). Baris ganda kini hanya dicari di dalam satu blok pemeriksaan.
  - **Baru: judul ganda.** Mis. "Analisis Gas Darah PJT (09-10-2026)" tertulis dua kali: gabungkan, atau tulis jamnya.
  - **Baru: obat di Terapi dan di Selesai sekaligus.** Mis. "KCl ada di Terapi dan juga di Selesai. Pastikan mana yang masih berjalan."
  - **Baru: EKG sudah dicentang, tapi belum ditulis.** Bila pengingat EKG di kartu pasien sudah dicentang untuk hari itu dan catatan belum punya EKG bertanggal hari itu, Plano mengingatkan.
  - Catatan yang ditempel dari Windows tidak lagi memicu peringatan palsu "TS … belum ada di daftar DPJP".

## `2026-10-11.7`
- **Hasil Verifikasi List kini dibaca per pasien**, mengikuti format laporan Residency Helper:
  - **Satu nomor per pasien**, dengan satu kalimat masalahnya, mis. "Tn. X · 420/2 · IM — **Hanya ada di denah kamar, tidak ada di bagian lain**". Sebelumnya satu pasien bisa muncul sebagai tiga kartu terpisah.
  - Tanda **✓/✗ per bagian** (denah kamar, tabel DPJP, holder list, LIST PASIEN), nilai yang berbeda ditandai merah (mis. kamar 405/3 vs 402/3), **baris aslinya** seperti tertulis, dan **artinya** ("Kemungkinan sudah pulang/pindah, tetapi LIST PASIEN belum diperbarui").
  - **Jumlah pasien dalam satu kotak:** denah kamar, header LIST, jumlah per DPJP, isi LIST berdampingan, plus DPJP yang tidak cocok dan pasien yang kemungkinan menjadi penyebabnya.
  - **"Cocok di semua bagian: n pasien"**, termasuk pasien baru yang cocok.
  - **Saran** di akhir: apa yang perlu ditanyakan ke siapa.
  - Semua dalam bahasa Indonesia; istilah aturan ("Orphaned", "room grid") tidak tampil lagi. Peringatan transkripsi juga dalam kalimat biasa.
- **Salin laporan** menyalin format yang sama, siap ditempel ke WhatsApp.

## `2026-10-11.6`
- **Verifikasi List kini lebih cepat:** DENAH dan LIST PASIEN dibaca **bersamaan**, bukan bergantian, sehingga waktu tunggu kira-kira separuhnya.
- **Kemajuan per dokumen:** di bawah tombol tampil baris untuk DENAH dan LIST, masing-masing dengan detik yang sudah berjalan, "percobaan 2/2" bila AI mengulang, dan "selesai · 48 dtk" saat selesai.
- Bila kuota API Anda menolak dua dokumen sekaligus, dokumen kedua otomatis dibaca setelah yang pertama selesai (tertulis "kuota penuh, menunggu yang lain selesai").

## `2026-10-11.5`
- **Verifikasi List (transkripsi PDF) kembali berfungsi.** Pesan "Gagal memanggil AI (400) — `temperature` is deprecated for this model" muncul karena Plano mengirim pengaturan yang tidak lagi diterima model terbaru. Pengaturan itu kini tidak dikirim sama sekali, di semua fitur AI.

## `2026-10-11.4`
- **Bandingkan → Teks lengkap: gulir ke gedung kini pas.** Mengklik IGD (atau gedung lain) sebelumnya menggulir terlalu sedikit, sehingga bagian IGD tertinggal di bawah kotak dan tidak terlihat. Kini judul gedung yang dipilih berada di atas kotak.
- **Warfarin RSWS: saran dari Tabel 15** ("Maintenance warfarin dosing for out-of-therapeutic-range INR"), hanya untuk target INR 2,0–3,0:
  - ≤1,5: naik 15% per minggu · 1,6–1,9: naik 10% · 2,0–2,9: tetap
  - 3,0–3,9: turun 10% · 4,0–4,9: **tunda 1 dosis**, lalu turun 10% · ≥5: **tunda sampai INR 2–3**, lalu turun 15%
  - Pilihan yang sesuai tabel ditandai ★; dokter tetap bisa memilih persentase lain. Bila memakai saran, instruksi tunda ikut ditulis di baris Terapi.
  - INR di antara dua baris tabel (mis. 1,55) menampilkan kedua baris; tidak ada ★ otomatis.
- **Heparin:** nomogram aPTT yang dipakai dikonfirmasi sama dengan ESC 2019 Emboli Paru, Web Table 2; rujukan itu kini tercantum di daftar Rujukan.
- **Pesan gagal AI kini menyebut alasannya** (mis. "Gagal memanggil AI (400) — invalid_request_error: …"), bukan hanya kode angka.

## `2026-10-11.3`
- **Hasil sensus kini berwarna per gedung**, seperti bagian SOAP: RSWS, RSUH, IGD, CVCU, PJT Lt. 4/5/6 masing-masing punya judul berwarna yang tetap terlihat saat digulir. Di atasnya ada deretan tombol (mis. "PJT Lt. 4 · 3") untuk langsung lompat ke gedung itu. Berlaku di Hari ini dan di Bandingkan → Teks lengkap.
- **Gulir otomatis di Teks lengkap:** saat memilih list (mis. List 5 · RSWS), hasil sensus di kanan langsung bergulir ke bagian RSWS.
- **Warfarin: tab baru "RSWS (tidak resmi)"**, di samping nomogram publikasi:
  - **Mulai:** 1 × 2 mg malam, cek INR 3 hari lagi (tanggalnya ditulis).
  - **Sesuaikan:** isi dosis minggu ini per hari (Sen–Min), dan INR dibandingkan dengan target. **Dokter memilih** perubahan total mingguan (−20% sampai +20%, atau total baru). Kartu menyusun jadwal baru, mis. **"Senin–Jumat 2 mg, Sabtu–Minggu 3 mg (16 mg/minggu)"**, beserta tanggal cek INR berikutnya, dan bisa disisipkan ke Terapi.
  - Langkah dosis 1 mg (½ tablet 2 mg) atau 0,5 mg. Bila hasil dibulatkan, persentase sebenarnya ditampilkan (mis. +10% → +7,1%).
  - Tab ini ditandai **tidak resmi**: dari praktik bangsal, belum ada dokumen protokolnya.

## `2026-10-11.2`
- **Buat Sensus: tampilan baru "Bandingkan"** (di samping Hari ini dan Riwayat). Setiap list yang ditempel ditampilkan pasien demi pasien, dengan baris aslinya (identitas dan diagnosis) di kiri dan baris sensusnya di kanan (mis. "✓ PJT Lt. 4 #1", lengkap dengan diagnosisnya). Di HP keduanya bertumpuk.
  - **Biru:** pasien DPJP ini, masuk sensus.
  - **Merah:** pasien DPJP ini, **tidak** masuk sensus.
  - **Oranye:** tanpa kode DPJP (lihat Perlu dicek).
  - **Pasien DPJP lain** diringkas jadi satu baris; bisa ditampilkan.
  - Di atas ada ringkasan jumlah yang cocok, yang di list tapi tidak di sensus, dan yang di sensus tapi tidak ditemukan di list (mis. hasil AI yang tidak ada di list).
  - Berlaku untuk mode Aturan maupun AI.
  - **Cek manual tetap di tangan Anda:** tiap pasien punya centang **"Sudah saya cek"**, dengan hitungan **Dicek manual 3/5** di atas. Centang tersimpan per tanggal dan per DPJP di perangkat ini.
  - **Teks lengkap:** list yang ditempel (pilih List 1, 2, …) dan hasil sensus berdampingan di laptop, atau bertumpuk di HP, persis seperti teksnya, untuk dibaca sendiri.

## `2026-10-11.1`
- **"Hitungan hari belum berubah" kini membandingkan baris yang sama dengan kemarin.** Sebelumnya, setelah "PPM Replacement H-1" dinaikkan menjadi H-2, tanda tetap muncul karena kemarin ada baris lain yang juga berbunyi H-2 (mis. "Ceftriaxone (H-2)"). Hanya angka yang belum dipakai di mana pun (H-3) yang menghilangkan tanda, sehingga Plano seolah meminta hari yang salah. Kini tiap hitungan hanya dibandingkan dengan baris yang sama di catatan kemarin, jadi H-2 langsung diterima.
- **DPJP yang salah ketik kini tetap terbaca.** "_DJPJP Utama : dr. Zaenab…_" sebelumnya tidak dikenali sebagai baris DPJP, sehingga DPJP Aritmia (Prof. Muzakkir) dianggap DPJP utama. Kini salah ketik umum (DJPJP, DPJ, DJPJ, DPPJ) dibaca sebagai DPJP.
- **Peringatan pembuka "padahal ini hari pertama" tidak muncul lagi pada pasien yang sudah punya catatan hari sebelumnya.** Hari rawat dihitung dari tanggal pasien ditambahkan ke Plano, yang belum tentu tanggal masuk RS. Kini hari rawat tidak bisa dimulai setelah hari pertama yang sudah ada catatannya. Untuk angka yang tepat, isi tanggal masuk di Identitas.

## `2026-10-10.11`
- **Kalkulator baru: Warfarin — mulai di rawat inap** (grup Antikoagulan dan kalkulator melayang).
  - **Target INR wajib dipilih**: 2,0–3,0, 2,5–3,5, katup mekanik aorta 2,5, atau mitral/dua katup 3,0.
  - **Dosis harian dari nomogram 5 mg** (Crowther, Harrison & Hirsh 1997), hari ke-1 sampai ke-6, berdasarkan INR pagi. Nomogram ini hanya untuk target 2,0–3,0; target lain tidak dihitung.
  - Bila tabel memberi rentang (mis. 5–7,5 mg), rentang itu yang ditampilkan.
  - Bila INR jatuh di antara dua baris tabel (mis. 1,95), kedua baris ditampilkan.
  - **Dosis tidak ditampilkan** bila dicentang: perdarahan aktif, INR awal memanjang, atau penyakit hati berat.
  - **Pengingat dosis awal lebih rendah** (lansia, nutrisi buruk, penyakit hati, gagal jantung, risiko perdarahan; 2–3 mg untuk penggantian katup).
  - **Daftar obat yang menguatkan efek warfarin**; obat yang tertulis di catatan ditandai.
  - Panduan **overlap heparin** (minimal 5 hari dan INR ≥ 2,0 selama 24 jam) dan **bridging katup mekanik**, beserta rujukannya.
- **Kartu Heparin kini meminta indikasi**: **VTE** (nomogram Raschke) atau **SKA** (ESC 2023: bolus 70–100 U/kg, lalu infus dititrasi ke aPTT 60–80 detik). ESC 2023 tidak mencantumkan batas bolus 5.000 U maupun laju awal infus, jadi kartu SKA tidak menghitungnya.

## `2026-10-10.10`
- **Kalkulator baru: Heparin (UFH) — aPTT**, di grup **Antikoagulan** pada halaman Kalkulator dan di tab Klinis kalkulator melayang.
  - **Mulai:** dari BB aktual menghitung bolus 80 U/kg dan laju 18 U/kgBB/jam (beserta total U/jam).
  - **Sesuaikan (aPTT):** dari aPTT, kontrol lab, dan laju sekarang. Kartu menunjukkan rasio × kontrol, baris nomogram yang cocok (stop/bolus/naik/turun), laju baru dalam U/kgBB/jam dan U/jam, serta kapan aPTT dicek ulang.
  - Nomogram dari **Raschke 1993 (Tabel 2)**, dalam **× kontrol**, sehingga berlaku untuk reagen lab mana pun. Kontrol lab dan target (**1,5–2,3** Raschke atau **1,5–2,5** CHEST) diatur di **Pengaturan → Heparin (aPTT)**.
  - **Dosis tidak ditampilkan** bila dicentang: perdarahan aktif, trombosit rendah/turun atau curiga HIT, INR awal memanjang, atau penyakit hati berat.
  - Di halaman pasien, aPTT, kontrol, dan BB diisi dari lab terbaru di catatan (tetap bisa diubah). **Sisipkan ke Terapi** menambahkan barisnya ke daftar Terapi kita, di atas "Selesai".
  - Ini saran hitungan, bukan instruksi. Protokol heparin RSWS belum dicocokkan.

## `2026-10-10.9`
- **Kotak DPJP di sisi kanan halaman pasien lebih ringkas.**
  - Nama DPJP kini satu baris di judul kotak.
  - Poli tinggal satu baris: poli berikutnya (mis. "Senin 12/10 · Poli Konsul & Echo IRJ"). **Ketuk baris itu** untuk melihat semua poli DPJP tersebut dalam 7 hari ke depan, lengkap dengan jamnya.
  - Baris "Lalu" dihapus karena sudah tercakup di daftar mingguan.

## `2026-10-10.8`
- **Pengingat furosemide dipisah menjadi dua, sesuai praktik bangsal.**
  - **Kateter:** bila S belum menulis cara BAK, muncul pengingat untuk menulis **"BAK per kateter"**, atau, bila pasien menolak kateter atau urin ditampung, menuliskannya. "BAK kesan normal/spontan", "ditampung", urinal, atau "menolak kateter" dianggap sudah menjawab.
  - **Urine output:** pasien dengan furosemide atau plan balance cairan **harus** punya urine output yang tercatat, dengan atau tanpa kateter. Bila tidak ada, muncul "urine output belum tercatat, urin harus diukur per hari".

## `2026-10-10.7`
- **Periksa lagi: dua temuan keliru diperbaiki.**
  - "Hitungan hari belum berubah: **H20**" muncul dari "JVP R+3 cm H20" (H2O ditulis dengan angka nol). Angka setelah **cm** atau **mm** kini tidak lagi dibaca sebagai hitungan hari.
  - "Diagnosis menyebut Na 123, lab terbaru 121" padahal lab terbaru memang 123. Nilai yang ditebalkan (mis. `Na/K/Cl *123*/3.8/*92*`) membuat baris lab terbaru terlewat, sehingga yang terbaca baris lama. Tanda tebal kini diabaikan saat membaca lab. Hb dengan koma (12,7) juga terbaca benar.
- **Pengingat kateter urin tidak muncul lagi bila BAK spontan sudah ditulis** (mis. "BAK kesan normal", "BAK spontan", urinal). Pasien yang berkemih normal tidak perlu disarankan pasang kateter hanya karena mendapat furosemide.
- **Pasien arsip dibuka di SOAP terakhirnya**, bukan halaman kosong hari ini. Hari lain tetap bisa dipilih seperti biasa.
- **Chief kini tampil jelas di kartu**, sebagai label tebal **Chief dr. …** di bawah lokasi. Sebelumnya hanya teks samar di dalam isi kartu.
- **Perubahan diagnosis kini dijelaskan.** "Sejak kemarin: + … · − …" diganti dengan kotak **Diagnosis berubah dari kemarin**, berisi satu baris per perubahan:
  - **Baru**: diagnosis yang baru muncul;
  - **Diubah**: diagnosis yang sama dengan nilai atau derajat berbeda (mis. NSTEMI TIMI 3/7 → 4/7), yang sebelumnya tampil sebagai satu dihapus dan satu baru;
  - **Dihapus**: diagnosis yang tidak ada lagi.

## `2026-10-10.6`
- **"Sejak kemarin" kini muncul hari ini juga.** Di 10.5 baris ini baru tampil besok, karena pembanding diambil saat kartu berganti hari. Kini, saat catatan hari ini dibuka, diagnosis kemarin diambil langsung dari catatan kemarin.
- **Baris "Sejak kemarin" dipindah ke atas daftar diagnosis.** Di kartu kanvas (Urutan sendiri) yang tingginya dibatasi, bagian bawah kartu terpotong, sehingga baris ini sebelumnya hilang.
- **Normal / Ringkas kini juga berlaku di kanvas (Urutan sendiri).** Sebelumnya tombolnya tampil di sana tetapi tidak berpengaruh.

## `2026-10-10.5`
- **Kartu menunjukkan perubahan diagnosis sejak kemarin.** Bila SOAP hari ini sudah ditulis, di bawah diagnosis ada baris mis. **Sejak kemarin: + AF · − AKI** (yang bertambah dan yang hilang dibanding catatan sebelumnya). Bila catatan sebelumnya bukan kemarin, tanggalnya yang ditulis.
- **Penanda ⚑ Periksa lagi di kartu.** Jumlah temuan "Periksa lagi" pada catatan hari ini (mis. **⚑ 2**) tampil di baris status. Angkanya diperbarui saat catatan dibuka, jadi papan tidak perlu memuat semua catatan.
- **Urutan baru: Status hari ini.** Pasien dikelompokkan berdasarkan apa yang belum dikerjakan: **Belum ada SOAP**, **SOAP belum diperbarui**, **SOAP hari ini · checklist belum selesai**, lalu **Selesai**. Tiap judul kelompok kini juga menampilkan jumlah pasiennya.
- **Kartu Normal / Ringkas.** Tampilan Ringkas menampilkan diagnosis dalam satu baris, tanpa Chief, label, dan baris perubahan. Di laptop pakai tombol di samping Format lab; di HP lewat menu **⋯ Aksi**. Pilihan ini diingat per perangkat.
- **Geser kartu di HP.**
  - **Geser ke kanan** mencentang langkah checklist berikutnya, dengan tombol **Urungkan** selama 5 detik.
  - **Geser ke kiri** membuka preview catatan.
  - Gerakan menggulir ke atas/bawah tidak ikut terhitung. Tidak aktif di Urutan sendiri dan saat memilih pasien.

## `2026-10-10.4`
- **Kartu pasien di papan lebih ringkas dan langsung menunjukkan status hari ini.** Di bawah nama kini ada satu baris status:
  - **● SOAP hari ini**, **○ SOAP kemarin** (catatan terakhir dari hari sebelumnya), atau **○ Belum ada SOAP**;
  - bilah checklist dengan hitungannya (mis. **3/8**), ditambah langkah berikutnya dalam bentuk singkat (mis. "Visite pasien").
- **Baris "Belum: Visite pasien + TTV + EKG sesuai kebutuhan" di bawah kartu dihapus.** Isinya sama di semua kartu tiap pagi; yang penting adalah sejauh mana tiap pasien.
- **Satu baris penanda** di bawah diagnosis: pengingat (mis. konsul ICU H-1), rencana pulang, EKG harian/hari ini, dan KJS. Sebelumnya tersebar di baris nama dan baris lokasi sehingga memakan tempat nama pasien. Pemantauan dan pulang H-1/hari ini tetap berupa strip di atas kartu.
- Di HP sekarang muat sekitar 5 kartu per layar (sebelumnya sekitar 4).

## `2026-10-10.3`
- **Buat Sensus kini mengikuti satu DPJP dari hari ke hari.** Di bagian atas ada judul **Sensus ARB** (DPJP yang dipilih) dengan dua tampilan: **Hari ini** dan **Riwayat**.
- **Riwayat sensus, tersinkron ke akun.** Sensus hari itu dicatat saat Anda menekan **Salin** atau **Simpan**. Yang dicatat hanya pasien DPJP tersebut, bukan seluruh list ruangan. Dua tampilan:
  - **Perubahan**: per hari, siapa yang **Baru**, **Keluar** (tidak ada lagi di list), **Pindah** (mis. CVCU Bed 5 → PJT Lt. 4 420 Bed 4), dan **Diagnosis** yang bertambah atau hilang. Pasien yang list tempatnya belum ditempel hari itu ditandai **Tidak dicek**, bukan Keluar.
  - **Tabel**: pasien × tanggal (● ada, ? belum dicek), dengan lama dirawat (H…) dan perjalanan tempatnya (mis. CVCU → Lt. 4).
- **Sebelum dikirim**, di bawah hasil sensus tampil perbedaannya dengan hari terakhir yang tercatat, jadi perubahan bisa dicek dulu.
- Pesan sensus yang dikirim tidak berubah.

## `2026-10-10.2`
- **Plan TS kembali ke tempatnya.** Setelah 10.1, isi "*Plan Diagnostik*" dan "*Plan Monitoring*" dari blok TS (mis. TS GEH, TS HOM) pindah ke salinan **Plan**, seolah-olah plan kita, dan hilang dari **Terapi + TS**. Kini satu balasan TS (A/, Th/, P/, Plan Diagnostik, Planning, dst.) selalu disalin utuh di **Terapi + TS**, dan **Plan** hanya berisi plan kita sendiri.
- **Ringkas mengingat Chief dan Junior.** Kolom Chief dan Junior kini ada di Salin → Ringkas (PDF).
  - **Chief** diisi dari dan disimpan ke kolom Chief pasien itu, yang juga tampil di kartu pasien.
  - **Junior** disimpan sekali untuk semua pasien, dan sama di semua perangkat.

## `2026-10-10.1`
- **Ringkas (PDF) tidak lagi memasukkan plan TS sebagai diagnosis.** Di catatan dengan blok TS (mis. TS GEH, TS HOM) berjudul "*Plan Diagnostik*", isi plan itu ikut masuk ke daftar Diagnosis Ringkas: "Aspirasi cairan asites", "ADT …", "BMP …". Kini Ringkas hanya mengambil diagnosis kardiologi, yaitu yang berjudul diagnosis/assess, dan berhenti di blok TS pertama.
- **Nama bagian bawaan yang baru kini sampai ke akun lama.** Nama seperti "Plan Diagnostik", "Plan Monitoring", dan "Plan Terapi" ditambahkan ke daftar bawaan setelah akun Anda dibuat, sehingga di akun Anda judul-judul itu terbaca sebagai bagian tersendiri. Daftar nama bagian kini diperbarui otomatis seperti template, tanpa menghapus nama yang Anda tambahkan sendiri.

## `2026-10-09.4`
- **Buat Sensus: kotak "Perlu dicek".** Pasien yang DPJP-nya tidak jelas dari list kini dikumpulkan di satu kotak: pasien tanpa kode DPJP di barisnya, dan pasien yang membuat AI ragu (beserta alasannya). Mereka tidak masuk sensus kecuali Anda menekan **Masukkan**. Pilihan itu diingat untuk tanggal dan DPJP tersebut, dan berlaku di mode Aturan maupun AI. **Keluarkan** membatalkannya.
- **AI tidak lagi diberi daftar larangan.** Pasien yang meragukan diminta dikembalikan sebagai "ragu" lengkap dengan alasannya, bukan dibuang dan bukan dimasukkan diam-diam. Yang memutuskan tetap Anda.

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
