# Gastron Internal (Sistem Pengajuan) · Log & Register Putaran

Satu-satunya daftar temuan & perbaikan app pengajuan. Tiap putaran: baca ini dulu, update di akhir.
Satu putaran = **Plan** (heuristic evaluation independen) → **Do** (perbaikan prioritas) → **Check** (regression baseline vs kandidat + design review) → **Act** (definition of done, standarisasi, backlog).
Suite tes: `tests/putaran/` (jalankan: `npm run putaran -- <baselineUrl> <kandidatUrl> <nama>`). Skor Nielsen: 4 katastrofik · 3 besar · 2 sedang · 1 kosmetik. Tipe: L logika · K kata/label · UI perlu mockup · S keamanan.

## Log putaran

| Putaran | Tanggal | Fokus | Hasil |
|---|---|---|---|
| 0 | 11 Okt 2026 | Notif Telegram (ganti web push iPhone), notif "Perlu approval kamu", fix mapping Pembelian Aset | Backend 10/10, matriks notif 23/23, klik UI 23/23 |
| 1 | 11 Okt 2026 | Regression suite permanen + heuristic evaluation independen (39 temuan) + Batch 1 | K 22/22 (baseline 4/22), klik 199 tombol 0 error, 34 layar, angka lama 0 berubah |
| 4 | 12 Okt 2026 | Alur Ditahan & Revisi: "Lanjutkan" oleh approver tahap itu, kembali ke tahap peminta, "Berikutnya:" di Detail, TTD surat sesuai status | K 41/41, unit 44/44 + 10/10 |
| 3 | 12 Okt 2026 | Batalkan approval, logo konsisten (evaluasi brand), rekening tujuan (urutan & nama baru), contoh judul konteks CNG, TTD surat dari kolom approver | K 35/35 (baseline 4/35), unit 40/40 + 10/10, klik 207 tombol 0 error, 34 layar, lint 17 error lama |
| 2 | 11-12 Okt 2026 | Subkategori otomatis dari judul (AI), kunci `/api/claude`, nama file surat, evaluasi surat, logo & TTD surat tidak gepeng | K 26/26, unit 35/35 + 10/10, klik 207 tombol 0 error, 34 layar, angka lama 0 berubah, lint 19 → 18 |

## Putaran #1 · 11 Okt 2026
Baseline: production (commit `e0ec3b8`, sebelum Telegram) · Kandidat: r1 (Telegram + Batch 1)

### Do: yang dikerjakan (prioritas, tanpa keputusan owner)
| ID | Perbaikan | Tes |
|---|---|---|
| H11 | Dashboard: daftar **"Perlu approval kamu"** (pengajuan + LPJ), urut terlama, aturan = penerima notif Telegram | K12 |
| H12 | Kartu angka = isi daftar setelah diklik (kelompok status di `lib/status.js`); kartu jadi tombol (keyboard & pembaca layar) | K13 |
| H6 | Approve/tolak hanya kalau status belum diubah orang lain; gagal = pesan, bukan diam. Cashflow tidak pernah dobel | K14, K15 |
| H7 | Mapping cashflow satu jalur (`lib/cashflow.js`): database (halaman Sinkronisasi) dulu, baru mapping lama | K16 |
| H4 | Halaman Ubah pengajuan hanya untuk pengaju saat Perlu Revisi/Ditahan; simpan bersyarat status | K17 |
| H5 | Form LPJ hanya untuk pengaju/Finance/CFO setelah transfer, bukan reimbursement/Trip | K18 |
| H9 | Sisa dana LPJ: "Sisa dikembalikan" (netral) / "Kurang bayar" (merah) / "Sisa dana Rp0" | K19 |
| H16 | Kode surat gagal dibuat = pengajuan tidak disimpan + pesan (dulu cadangan "001", bisa dobel) | K20 |
| H15 (sebagian) | Form: gagal simpan item/penerima/lampiran sekarang ketahuan | – |
| H35 (sebagian) | Tombol Kembali & Hapus ≥ 40px + label; tombol hapus satu komponen (`components/DeleteButton.jsx`) dengan konfirmasi di Buat, Ubah, LPJ (Ubah dulu tanpa konfirmasi) | K21 |
| H31 (sebagian) | Sinkronisasi tidak lagi geser ke samping di HP | layar |
| H32 | Saran AI di Sinkronisasi hanya diterima kalau ada di daftar kategori | K22 |
| H13 (sebagian) | `STATUS_LABEL`/`STATUS_CLASS` 3 salinan → `lib/status.js`; aturan akses LPJ & ubah → `lib/approval.js` | unit |

### Check
- Unit: aturan approval/notif/status 28/28, Edge Function 10/10
- Tes khusus: **22/22** di kandidat; baseline **4/22**, gagal persis di 18 hal yang dibetulkan (K7, K8, K10, K11 = aturan yang tidak boleh berubah, lulus di dua-duanya)
- Angka emas: 463 angka di 17 halaman. Berubah hanya di Dashboard = angka baru dari daftar "Perlu approval kamu" (disengaja). Tidak ada angka lama hilang/berubah.
- Klik: desktop 105, HP 94 tombol, 0 error, 0 gagal klik. "Tanpa efek" 8 = tombol yang sudah aktif (menu halaman ini, kartu Total tanpa filter, pilihan default) — wajar.
- Layar: 34 screenshot (17 halaman × desktop/HP), 0 error, 0 geser horizontal
- Lint: 19 error lama (tidak bertambah, file baru bersih)
- Design review: bingkai daftar "Perlu approval kamu" awalnya merah → netral (prinsip 9); label sisa dana LPJ dicek di HP

### Act
- Definition of done terpenuhi (lihat skill putaran).
- Standarisasi: tiap bug yang difix = tes K baru di `tests/putaran/khusus.mjs`; tes K dijalankan juga ke baseline untuk bukti tes menangkap bug.
- Pengecualian sadar: gagal unggah lampiran setelah pengajuan terkirim masih pakai `alert()` (halaman langsung pindah); diganti saat validasi per isian (H14).

## Putaran #4 · 12 Okt 2026
Pemicu: owner (CFO) menahan pengajuan dan tidak punya cara melanjutkannya — layar CFO hanya Download & Arsipkan.
Keputusan owner: (1) yang melanjutkan = **approver di tahap yang menahan**; pengaju hanya melihat status & tetap bisa mengubah isi. (2) setelah dilanjutkan / dikirim ulang setelah revisi, pengajuan **kembali ke tahap yang menahan / meminta revisi** (approval sebelumnya tetap berlaku).

### Evaluasi alur status (titik buntu & kebingungan)
| ID | Temuan | Sev | Status |
|---|---|---|---|
| A1 | Ditahan = buntu untuk yang menahan: hanya pengaju yang bisa "Release Hold", padahal alasan tahan ("tunggu cashflow minggu depan") keputusan approver | 4 | Selesai: tombol "Lanjutkan pengajuan" untuk approver tahap itu |
| A2 | Release Hold / Ajukan Ulang selalu mulai lagi dari tahap 1 — COO/CAO approve ulang walau ditahan di tahap CFO | 3 | Selesai: kembali ke tahap yang menahan / meminta revisi |
| A3 | Tidak ada keterangan siapa yang harus bertindak berikutnya di Detail (setelah Ditahan, approver & pengaju sama-sama menunggu) | 3 | Selesai: baris "Berikutnya: …" di semua status (`langkahBerikutnya`) |
| A4 | Kirim ulang tidak mengosongkan kolom approver → surat bisa menampilkan TTD lama walau status kembali ke awal | 3 | Selesai: TTD dari `persetujuanBerlaku` (status + kolom) |
| A5 | Timeline: aksi baru tampil "Ditolak" (fallback) | 2 | Selesai: label Dilanjutkan / Isi pengajuan diubah / Approval dibatalkan |
| A6 | Ditahan tanpa tanggal: tidak ada pengingat, tidak muncul di "Perlu approval kamu" → mudah terlupa | 2 | Usulan: "Tahan sampai tanggal" + pengingat Telegram (bareng B1 pengingat otomatis) |
| A7 | Modal "Tolak / Hold / Revisi": judul selalu "Tolak Pengajuan", tombol "Konfirmasi", tidak ada penjelasan beda ketiganya | 2 | Backlog (H22) |
| A8 | Ditolak = akhir tanpa jalan lanjut; pengaju harus membuat pengajuan baru dari nol | 1 | Usulan: tombol "Buat ulang dari pengajuan ini" (salin isi) |
| A9 | Panel aksi Detail di HP bisa 4-5 tombol (Approve, Tolak, Batalkan approval, Download, Arsipkan) | 2 | Backlog (H21) |

### Do
| ID | Perubahan | Tes |
|---|---|---|
| A1 | `canLanjutkanTahanan` + tombol "▶ Lanjutkan pengajuan"; log `dilanjutkan`; notif ke semua pihak | K36, K37 |
| A1b | Pengaju saat Ditahan: kotak info (alasan + "Menunggu CFO melanjutkan") + "Ubah pengajuan"; Release Hold dihapus | K37 |
| A1c | Ubah saat Ditahan: isi tersimpan, tetap Ditahan, tombol "Simpan perubahan", log `diubah` | K38 |
| A2 | `tahapTerakhir`: kirim ulang setelah revisi (langsung & lewat Ubah) kembali ke tahap peminta | K39 |
| A3 | "Berikutnya: …" di Detail | K40 |
| A4 | TTD surat dari `persetujuanBerlaku` | K41 |

### Check
- Unit 44/44, Edge Function 10/10; tes khusus 41/41 (K17 disesuaikan: tombol halaman Ubah saat Ditahan sekarang "Simpan perubahan")
- SQL `putaran-3.sql` diperbarui: daftar action memuat 'dilanjutkan' & 'diubah'

## Putaran #3 · 12 Okt 2026
Permintaan owner: (1) evaluasi detail logo/nama app di sidebar, (2) contoh & arahan judul jangan kandang lagi (market sudah bukan peternakan), (3) urutan rekening: atas nama, bank, nomor rekening, lalu nama penerima dengan istilah yang tidak menyesatkan, (4) CFO bisa membatalkan approval.

### Evaluasi logo & nama app (gambar 1 owner)
| ID | Temuan | Sev | Status |
|---|---|---|---|
| L1 | File logo 500x500 = ikon + tulisan "Pengajuan" + latar putih. Di 24-32 px tulisan jadi coretan & dobel dengan "Sistem Pengajuan" di sebelahnya; padding putih 14% bikin ikon mengecil | 2 | Selesai: `public/logo-mark.png` (ikon saja, transparan) |
| L2 | Nama app 3 gaya: "Gastron" merah semua (Dashboard, Arsip, header HP), "G" merah + "astron" hitam (sidebar Detail & LPJ), Login beda lagi | 2 | Selesai: satu komponen `BrandMark` |
| L3 | Ukuran tidak seragam (logo 32/28/24 px, teks 15/14 px, subjudul kadang hilang), 9 salinan kode | 1 | Selesai (K35) |
| L4 | Sidebar Detail/LPJ cuma 1 menu, Dashboard 4 menu; Detail punya "← Kembali" + menu Dashboard (dua jalan pulang) | 2 | Backlog (H30, navigasi bersama) |
| L5 | Label status "Transferred", satuan "Lainnya", Total merah | 2 | Backlog (kamus H25, prinsip 9) |
| L6 | Logo resmi (wordmark "Gastron" seperti di surat) lebih cocok untuk sidebar desktop daripada ikon + teks ketik | 1 | Usulan: owner kirim file logo resmi |

### Do
| ID | Perubahan | Tes |
|---|---|---|
| F5 | **Batalkan approval**: yang approve tahap terakhir bisa membatalkan selama tahap berikutnya belum bertindak (alasan wajib). CFO → kembali Menunggu CFO; COO/CAO → Menunggu Review; FIN (CFO 2 tahap sekaligus) → awal. Final approve CEO tidak bisa dibatalkan. Tercatat di timeline, semua pihak diberi notif. Aturan di `rencanaBatalApproval` (lib/approval.js) | K28-K31, unit |
| F6 | Timeline: aksi tak dikenal dulu tampil "Ditolak"; sekarang label sesuai, "Approval dibatalkan" abu-abu | K28 |
| S2 | Surat: TTD & nama dari kolom `step1_approved_by` / `cfo_approved_by` (bukan urutan log) — approval yang dibatalkan / siklus revisi lama tidak tampil | K32 |
| F7 | Rekening Tujuan: urutan **Atas Nama Rekening → Bank → Nomor Rekening → Pihak yang Dibayar** (dulu "Nama Penerima"). "Pihak yang Dibayar" kosong = atas nama. Dulu baris tanpa "Nama Penerima" ikut terbuang walau rekening terisi. Satu sumber `lib/rekening.js` + `components/RekeningTujuanFields` dipakai Form, Ubah, Detail, surat | K33, unit |
| F8 | Arahan judul konteks CNG (GTM, PRS, pelanggan); satu komponen `JudulField` untuk Buat & Ubah; penjelasan "Pemeliharaan Alat" untuk AI diperbarui; deskripsi role "Tim operasional & lapangan" | K34 |
| L1-L3 | Logo & nama app satu komponen | K35 |

### Check
- Unit 40/40, Edge Function 10/10; tes khusus 35/35 (baseline 4/35)
- Angka emas: baru "9123" di Form & Ubah (dari contoh judul "GTM B 9123 KZ") + daftar approval; tidak ada angka lama berubah
- Klik desktop 109, HP 98, 0 error, 0 gagal; layar 34 bersih; lint 17 error lama (turun dari 18)
- Design review: arahan judul 4 contoh = 5 baris di HP → dipangkas jadi 2; tombol "Ya, batalkan approval" 2 baris di HP → "Ya, batalkan"

### Menunggu keputusan (baru)
| ID | Pertanyaan |
|---|---|
| D13 | Subkategori "Operasional Kandang" & "Marketing/Mobilisasi Operasional (Pak Insan & Fajar ke kandang)" masih ada di master & cashflow. Ganti nama, mis. "Operasional Pelanggan"? (pengaju sempat membuat "Operasional Client" sendiri) |
| D14 | Final approve CEO perlu bisa dibatalkan? Butuh aturan: baris cashflow dihapus/dibalik, dan dana yang sudah ditransfer bagaimana |
| D15 | Kirim file logo resmi (wordmark) untuk sidebar desktop? |

## Putaran #2 · 11 Okt 2026
Permintaan owner: subkategori jangan dipilih pengaju (sering salah pilih & bikin subkategori baru), tentukan otomatis dari judul pakai API Claude yang sudah ada. Keputusan owner: koreksi oleh **CFO & Finance** sebelum transfer; pengaju **melihat** hasil deteksi di form tapi tidak bisa mengubah.

### Do
| ID | Perubahan | Tes |
|---|---|---|
| F1 | Form & Ubah: pilihan subkategori + "Lainnya" dihapus. `hooks/useSubkategoriOtomatis` menebak dari judul + nama item (jeda 0,7 dtk) lewat `api/klasifikasi.js`; tampil "Terdeteksi: …" (`components/SubkategoriOtomatis`) + tombol "?" | K23 |
| F2 | AI hanya boleh memilih dari tabel `subkategori_pengajuan`; jawaban di luar daftar / tidak yakin / AI mati → "Belum dikategorikan" (pengajuan tetap terkirim) | K24, unit |
| F3 | Detail: subkategori ditampilkan (dulu tidak ada) + "Ubah subkategori" untuk CFO/Finance sebelum Transferred (`canChangeSubkategori`) | K25 |
| F4 | Ubah pengajuan: kalau judul & item tidak diubah, subkategori tersimpan dipakai (koreksi CFO tidak tertimpa) | K26 |
| H33 | Pengaju tidak bisa lagi menambah subkategori ke master | K23 |
| B2 | `/api/claude` wajib login (dulu siapa pun bisa memakai API key); Sinkronisasi mengirim token | K22, unit |
| S0 | Nama file surat: `Surat_<kode>.pdf` (tanpa tanggal) | K27 |
| S14 | Logo & tanda tangan di surat gepeng (ukuran tetap tanpa memperhatikan bentuk asli: logo 3,59 → 2,46; TTD 1,12 → 2,33). Sekarang dimuat pas ke kotak dengan bentuk asli (`ukuranPas`/`gambarPas`) | K27 (baseline gagal persis 2,46 & 2,33) |

### Check
- Unit 35/35 (aturan + status + api), Edge Function 10/10
- Tes khusus 26/26 di kandidat. K22 dibuktikan gagal kalau Sinkronisasi tidak mengirim token.
- Angka emas: sama dengan putaran #1 (hanya angka baru daftar "Perlu approval kamu")
- Klik: desktop 109, HP 98, 0 error, 0 gagal klik; layar 34, 0 masalah
- Lint 18 error lama (turun 1: kode "Lainnya" terhapus)
- Suite diperketat: cek dua server hidup sebelum mulai; angka emas ikut dihitung lulus/gagal (sebelumnya crash tidak ketahuan)

### Evaluasi surat pengajuan (PDF), dari contoh GTR-FIN-103-X-2026
| ID | Temuan | Sev | Butuh keputusan? |
|---|---|---|---|
| S1 | (owner: semua S1-S13 = nice-to-have) Tidak ada kotak **CEO** di Persetujuan, padahal CEO approver akhir | 4 | tidak |
| S2 | Tanda tangan dipilih dari **urutan** log approve (log ke-1 = tahap 1, dst), bukan dari siapa/role yang approve. Setelah revisi & approve ulang, log lama ikut terhitung → nama/TTD bisa salah tempat | 4 | tidak |
| S3 | Watermark "BELUM FINAL" hanya kalau belum ada approve sama sekali. Surat yang baru di-approve CFO (masih menunggu CEO) tampak final | 4 | tidak |
| S4 | Tidak ada "Diajukan oleh" (nama & jabatan pengaju) | 3 | tidak |
| S5 | Pengaju = penyetuju: contoh FIN dibuat & di-approve CFO sendiri (sama dengan H3) | 4 | ya (H3) |
| S6 | Isi tidak konsisten: Perihal "Fee Jasa Pemasangan PRS" tapi item "Uang Makan"; subkategori "Operasional Client" buatan pengaju (kini dicegah F1) | 3 | – |
| S7 | No. rekening kosong ("-") padahal Transfer (sama dengan H14) | 3 | ya (H14) |
| S8 | Satuan tercetak "Lainnya" (pilihan satuan "Lainnya" tanpa isian) | 2 | tidak |
| S9 | Tidak ada nominal **terbilang** ("Empat ratus ribu rupiah") | 2 | tidak |
| S10 | Tidak ada status & tanggal tiap persetujuan / tanggal transfer | 2 | tidak |
| S11 | Catatan & jumlah lampiran tidak tercetak | 1 | tidak |
| S12 | "Digenerate" → "Dicetak"; header kanan mengulang footer; baris TOTAL merah (prinsip 9) | 1 | tidak |
| S13 | Tidak ada cara cek keaslian (QR ke halaman pengajuan) | 1 | nice |

## Menunggu keputusan owner
| ID | Pertanyaan | Sev |
|---|---|---|
| H2 | Siapa yang menetapkan role? Sekarang siapa pun yang login Google bisa pilih CFO/CEO sendiri. Usul: role eksekutif hanya diset CFO/admin, kolom `role` dikunci di database | 4 |
| H1 | Pengaju boleh melihat apa? Sekarang semua pengajuan semua divisi terlihat (kalau RLS tidak membatasi). Usul: pengaju = milik sendiri; COO/CAO = divisinya; CFO/CEO/Finance = semua | 4 |
| H3 | Approver mengajukan untuk dirinya sendiri (mis. CFO di divisi FIN): siapa yang approve menggantikan? | 4 |
| H8 | Selisih LPJ (sisa/kurang) dicatat ke cashflow sebagai transaksi koreksi terpisah, atau mengubah transaksi awal? | 4 |
| H19 | CFO/Finance memang boleh final approve menggantikan CEO? Pisahkan "Persetujuan CEO" dan "Tandai sudah ditransfer"? | 3 |
| H10 | LPJ perlu status "Perlu revisi" (sekarang Finance hanya bisa approve atau mengedit sendiri)? | 3 |
| H17 | Siapa yang boleh melepas Ditahan: approver atau pengaju? | 3 |
| H20 | Arsip hanya untuk status akhir (Ditolak, LPJ selesai)? | 3 |
| H14 | Rekening penerima wajib kalau metode Transfer? Foto nota wajib di LPJ? | 3 |
| H9b | Kelebihan realisasi LPJ boleh atau tidak? | 3 |
| H18 | Revisi wajib lewat Ubah (tidak boleh kirim ulang tanpa perubahan)? Kembali ke tahap peminta revisi? | 2 |
| H25 | Kamus istilah (bawah) disetujui? Termasuk "Menunggu Review" → "Menunggu COO/CAO/CFO" | 2 |

## Backlog (prioritas, tanpa keputusan) — kandidat Putaran #2
| ID | Temuan | Sev | Tipe |
|---|---|---|---|
| H15 | Simpan Ubah pengajuan & LPJ tidak atomik (hapus dulu baru insert); pindah ke satu RPC transaksi | 3 | L |
| H14 | Validasi per isian (merah + fokus), qty/harga > 0, bukan banner di atas | 3 | UI |
| H13 | `formatRp` 9 salinan → `lib/format.js`; Form & Ubah jadi satu komponen (H34) | 3 | L |
| H21 | Panel aksi HP 4 tombol → 2 (Setujui/Tindak lanjut), Unduh & Arsip ke menu "⋯" | 2 | UI |
| H22-24 | Judul modal Tolak dinamis; satu label "Kirim ulang"; satu peta label status LPJ | 2 | K |
| H26 | Timeline: catatan "Approved oleh" dobel, tambah "Berikutnya: …" | 2 | K/UI |
| H27-29 | Status warna-warni → netral + 1 aksen; merah untuk nominal biasa; kontras badge kuning/oranye | 2 | UI |
| H30 | Navigasi HP: Arsip & Sinkronisasi tidak bisa dicapai | 2 | UI |
| H31 | Sinkronisasi: alert()/confirm() → pesan inline | 2 | UI |
| H35 | Sisa target sentuh < 32px: "+ Tambah Item", "Lihat Nota", "Kembalikan", tombol Sinkronisasi | 2 | UI |
| H36 | Tombol "?" untuk istilah; format Rp saat mengetik; sisa dana LPJ baru tampil setelah ada realisasi | 2 | UI |
| H37 | Dashboard gagal muat ditampilkan sebagai "Belum ada pengajuan" | 2 | L |
| H38-39 | Status/total dobel di LPJ & Detail; opsi terpilih hanya dibedakan warna | 1 | UI |
| B1 | Pengingat otomatis pengajuan yang menunggu > X hari (brief pending #4) | – | fitur |
| B2 | Halaman Arsip belum ada cari/filter (brief pending #3) | – | fitur |

## Kamus istilah (usulan reviewer, menunggu keputusan)
Sudah ditransfer (bukan Transferred) · Setujui/Disetujui (Approve, ACC, di-acc) · Persetujuan akhir CEO (Final Approve as CEO) · Kirim/Kirim ulang (Submit, Resubmit) · Ditahan/Lepas tahanan (Hold, Release Hold) · Selesai/Tutup LPJ (Closed, Close LPJ) · Penggantian biaya (Reimbursement) · Unggah/Unduh (Upload/Download) · Keluar (Logout) · Jumlah (Qty) · Tunai (Cash) · Divisi (bukan Tim) · Halo (Hi)

## Keputusan desain (biar tidak diulang)
- 11 Okt: notifikasi lewat Telegram (bot BotFather), bukan web push. Pemicu notif tidak memberi tahu dirinya sendiri.
- 11 Okt: "Perlu approval kamu" = role **utama** tahap itu saja; cadangan (CFO/Finance di tahap CEO, CFO di LPJ baru) dapat info, bukan tugas.
- 11 Okt: aturan siapa approve/ubah/akses LPJ hanya di `src/lib/approval.js`; label & kelompok status hanya di `src/lib/status.js`; jalur ke cashflow hanya `src/lib/cashflow.js`.

## Putaran 5 — Item hilang setelah Ubah / Submit Ulang (12 Okt 2026)

- **Temuan (severity 4, dilaporkan CFO dari live):** pengajuan yang direvisi lalu disubmit ulang jadi tanpa item; total tetap. Penyebab: halaman Ubah hapus item dulu, lalu insert dengan kolom `jumlah` (GENERATED di DB) tanpa cek error. Insert selalu gagal.
- **Do:** tanpa `jumlah`; insert baru dulu → update status → hapus lama; error ditampilkan, gagal = tidak ada yang berubah. Mock DB meniru kolom generated + `__gagalInsert`.
- **Check:** K42 kandidat lulus, live gagal (item 2→0). Khusus 42/42, unit 44/44, deno 10/10.
- **Act:** owner jalankan `supabase/sql/putaran-5.sql` untuk daftar pengajuan yang itemnya sudah hilang; item diisi ulang oleh pengaju.
- **Pelajaran:** mock harus meniru aturan DB (kolom generated, constraint), bukan menerima apa saja.
