// Satu-satunya tempat urutan & nama isian rekening tujuan.
// Dipakai form Buat & Ubah (components/RekeningTujuanFields), Detail, dan surat PDF.
// Kolom database tidak berubah: atas_nama, bank, no_rekening, nama_penerima.

export const REKENING_JUDUL = 'Rekening Tujuan'
export const REKENING_SUBJUDUL = 'Ke rekening mana dana ditransfer'

// Urutan sesuai cara orang membaca buku tabungan: atas nama, bank, nomor, lalu siapa yang dibayar
export const REKENING_FIELDS = [
  { key: 'atas_nama', label: 'Atas Nama Rekening', placeholder: 'Nama sesuai buku tabungan' },
  { key: 'bank', label: 'Bank', placeholder: 'BCA / Mandiri / BRI' },
  { key: 'no_rekening', label: 'Nomor Rekening', placeholder: 'Contoh: 1234567890', inputMode: 'numeric' },
  { key: 'nama_penerima', label: 'Pihak yang Dibayar', placeholder: 'Vendor, toko, atau orang', bantuan: 'Kosongkan kalau sama dengan atas nama rekening' },
]

export const REKENING_KOSONG = { atas_nama: '', bank: '', no_rekening: '', nama_penerima: '' }

// Sebelum disimpan: buang baris yang kosong semua; "Pihak yang Dibayar" kosong = atas nama rekening.
// (Dulu baris tanpa "Nama Penerima" ikut terbuang walau rekeningnya terisi.)
export function rapikanRekening(list) {
  return (list || [])
    .filter((p) => ['atas_nama', 'bank', 'no_rekening', 'nama_penerima'].some((k) => String(p[k] || '').trim()))
    .map((p) => ({
      ...p,
      atas_nama: String(p.atas_nama || '').trim(),
      bank: String(p.bank || '').trim(),
      no_rekening: String(p.no_rekening || '').trim(),
      nama_penerima: String(p.nama_penerima || '').trim() || String(p.atas_nama || '').trim(),
    }))
}

// Ringkas untuk kalimat, mis. konfirmasi transfer: "Yusronudin (BCA 1234567890)"
export function labelRekening(p) {
  if (!p) return '-'
  const nama = p.atas_nama || p.nama_penerima || '-'
  const bank = [p.bank, p.no_rekening].filter(Boolean).join(' ')
  return bank ? `${nama} (${bank})` : nama
}
