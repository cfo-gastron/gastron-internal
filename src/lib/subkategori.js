// Subkategori pengajuan: penjelasan + penentuan otomatis dari judul & item (AI di server).
// Dipakai Form, Ubah pengajuan, Detail, dan api/klasifikasi.js (server) — satu sumber.

export const BELUM_DIKATEGORIKAN = 'Belum dikategorikan'

// Arahan isian judul (Form & Ubah pengajuan). Judul yang jelas = subkategori otomatis tepat.
export const JUDUL_PLACEHOLDER = 'Contoh: Servis kompresor GTM 03'
export const JUDUL_BANTUAN = 'Tulis untuk apa, unit/aset mana, dan lokasi atau pelanggan mana.'
export const JUDUL_CONTOH = [
  'Pemasangan PRS di PT ABC, Cikande',
  'Ganti ban truk GTM B 9123 KZ',
]

// Penjelasan per subkategori. Juga dikirim ke AI supaya tebakannya tepat.
export const SUBKATEGORI_INFO = {
  'Upah, Bensin, Parkir, Tol Kendaraan': 'Biaya perjalanan harian driver atau teknisi — bensin, tol, parkir, dan upah harian',
  'Operasional Kandang': 'Kebutuhan tim teknisi yang harus berangkat ke kandang — termasuk mob to mob dan recall PRS',
  'Pemeliharaan Alat': 'Servis atau perbaikan alat operasional — kompresor, PRS, GTM, regulator, genset',
  'Pemeliharaan Kendaraan': 'Servis, ganti oli, ban, atau perbaikan kendaraan operasional',
  'Marketing/Mobilisasi Operasional': 'Khusus untuk keperluan Pak Insan & Fajar ke kandang',
  'Pembelian Alat': 'Beli alat baru untuk operasional — tools, perlengkapan teknis, dll',
  'Pembelian Aset': 'Untuk pembelian aset yang jumlahnya besar — kayak DP truk atau pembuatan GTM',
  'Perjalanan Dinas': 'Perjalanan resmi ke luar kota untuk keperluan bisnis',
  'Perlengkapan Kantor': 'Kebutuhan kantor — ATK, peralatan, listrik, wifi, dll',
}

// Panggil server untuk menebak subkategori. Hasil: { subkategori: string|null, alasan?: string }
// accessToken = token login Supabase user (server menolak tanpa login).
export async function tebakSubkategori({ judul, items = [] }, accessToken, { signal } = {}) {
  const res = await fetch('/api/klasifikasi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ judul, items }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Gagal menentukan subkategori (${res.status})`)
  return { subkategori: data.subkategori || null, alasan: data.alasan || '' }
}
