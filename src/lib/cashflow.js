// Satu-satunya jalur pengajuan -> cashflow_transactions.
// Dipakai final approve (DetailPengajuanPage) dan susulan di halaman Sinkronisasi (MappingKategoriPage).
import { supabase } from './supabase'

export const FALLBACK_CATEGORY = { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex3', subcat_name: 'Operasional Tak Terduga' }

// Mapping lama yang dulu hardcode di DetailPengajuanPage. Dipakai HANYA kalau subkategori belum
// di-mapping di tabel subkategori_pengajuan. Setelah semua subkategori ter-mapping di database,
// daftar ini boleh dihapus (lihat SQL putaran 1).
const LEGACY_MAPPING = {
  'Upah, Bensin, Parkir, Tol Kendaraan': { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex1', subcat_name: 'Upah, Bensin, Parkir, Tol Kendaraan' },
  'Operasional Kandang': { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex2', subcat_name: 'Operasional Kandang' },
  'Pemeliharaan Alat': { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex6', subcat_name: 'Pemeliharaan Alat' },
  'Pemeliharaan Kendaraan': { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex5', subcat_name: 'Pemeliharaan Kendaraan' },
  'Marketing/Mobilisasi Operasional': { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex4', subcat_name: 'Marketing/Mobilisasi Operasional' },
  'Pembelian Alat': { cat_id: 'd_capex', cat_name: 'CapEx', subcat_id: 'd_capex2', subcat_name: 'Pembelian Alat' },
  'Pembelian Aset': { cat_id: 'd_capex', cat_name: 'CapEx', subcat_id: 'd_capex1', subcat_name: 'Pembelian Aset' },
  'Perjalanan Dinas': { cat_id: 'd_corp', cat_name: 'Corporate Support', subcat_id: 'd_corp4', subcat_name: 'Perjalanan Dinas' },
  'Perlengkapan Kantor': { cat_id: 'd_off', cat_name: 'Office', subcat_id: 'd_off2', subcat_name: 'Perlengkapan Kantor' },
}

// Kategori cashflow untuk satu subkategori: database dulu (diatur di halaman Sinkronisasi),
// lalu mapping lama, lalu "Operasional Tak Terduga".
export async function getCashflowCategory(subkategori) {
  if (!subkategori) return FALLBACK_CATEGORY
  const { data } = await supabase
    .from('subkategori_pengajuan')
    .select('cashflow_cat_id, cashflow_cat_name, cashflow_subcat_id, cashflow_subcat_name')
    .eq('nama', subkategori)
    .maybeSingle()
  if (data?.cashflow_cat_id) {
    return { cat_id: data.cashflow_cat_id, cat_name: data.cashflow_cat_name, subcat_id: data.cashflow_subcat_id, subcat_name: data.cashflow_subcat_name }
  }
  return LEGACY_MAPPING[subkategori] || FALLBACK_CATEGORY
}

// Masukkan satu pengajuan ke cashflow. Tidak pernah membuat baris kedua untuk pengajuan yang sama.
// Hasil: { inserted: true } | { inserted: false, reason: 'sudah_ada' } | { error }
export async function insertPengajuanToCashflow(pengajuan, { createdBy, date, notes }) {
  const { data: existing, error: checkError } = await supabase
    .from('cashflow_transactions').select('id').eq('linked_id', pengajuan.id).limit(1)
  if (checkError) return { error: checkError }
  if (existing && existing.length > 0) return { inserted: false, reason: 'sudah_ada' }

  const mapping = await getCashflowCategory(pengajuan.subkategori)
  const { error } = await supabase.from('cashflow_transactions').insert({
    name: pengajuan.judul,
    amount: Math.round(Number(pengajuan.total_pengajuan)),
    date: date || new Date().toISOString().split('T')[0],
    type: 'out',
    account: 'utama',
    ...mapping,
    is_est: false,
    is_kemb: false,
    linked_id: pengajuan.id,
    notes,
    created_by: createdBy,
  })
  return error ? { error } : { inserted: true }
}
