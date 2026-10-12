// Data uji putaran: semua role, semua status, semua divisi, LPJ di tiap tahap.
// Tanggal relatif ke JAM_UJI supaya tampilan stabil.
export const JAM_UJI = '2026-10-11T09:00:00+07:00'

const d = (daysAgo, h = 9) => new Date(new Date(JAM_UJI).getTime() - daysAgo * 864e5 + (h - 9) * 36e5).toISOString()

const users = [
  { id: 'U-cfo', email: 'cfo@gastronenergy.com', full_name: 'Rina Wijaya', role: 'cfo', telegram_chat_id: 111, is_admin: true },
  { id: 'U-ceo', email: 'ceo@gastronenergy.com', full_name: 'Hendra Gunawan', role: 'ceo', telegram_chat_id: 222 },
  { id: 'U-coo', email: 'coo@gastronenergy.com', full_name: 'Insan Pratama', role: 'coo', telegram_chat_id: null },
  { id: 'U-cao', email: 'cao@gastronenergy.com', full_name: 'Dewi Lestari', role: 'cao', telegram_chat_id: null },
  { id: 'U-fin', email: 'finance@gastronenergy.com', full_name: 'Maya Sari', role: 'finance', telegram_chat_id: null },
  { id: 'U-opr', email: 'opr@gastronenergy.com', full_name: 'Budi Santoso', role: 'operational', telegram_chat_id: null },
  { id: 'U-prc', email: 'prc@gastronenergy.com', full_name: 'Fajar Nugroho', role: 'procurement', telegram_chat_id: null },
  // Akun baru login Google, belum diberi role oleh admin
  { id: 'U-baru', email: 'baru@gastronenergy.com', full_name: 'Sinta Anggraini', role: null, telegram_chat_id: null },
]
users.forEach((u) => { u.is_admin ??= false })

// [id, kode, judul, divisi, status, pengaju, hariLalu, total, subkategori, tipe, extra]
const P = [
  ['P01', 'GTR-OPR-021-X-2026', 'Bensin & tol trip Subang', 'OPR', 'submitted', 'U-opr', 0.2, 850000, 'Upah, Bensin, Parkir, Tol Kendaraan', 'kebutuhan'],
  ['P02', 'GTR-PRC-008-X-2026', 'Servis kompresor GTM 2', 'PRC', 'submitted', 'U-prc', 4, 4750000, 'Pemeliharaan Alat', 'kebutuhan'],
  ['P03', 'GTR-OPR-019-X-2026', 'Ganti ban truk B 9123 KZ', 'OPR', 'approved_step1', 'U-opr', 2, 6200000, 'Pemeliharaan Kendaraan', 'kebutuhan'],
  ['P04', 'GTR-ADM-005-X-2026', 'Perpanjangan izin niaga', 'ADM', 'approved_step1', 'U-cao', 6, 12500000, 'Perjalanan Dinas', 'kebutuhan'],
  ['P05', 'GTR-FIN-003-X-2026', 'Langganan software akuntansi', 'FIN', 'submitted', 'U-fin', 1, 3300000, 'Perlengkapan Kantor', 'kebutuhan'],
  ['P06', 'GTR-OPR-017-X-2026', 'DP truk CNG unit 3', 'OPR', 'approved_cfo', 'U-opr', 3, 185000000, 'Pembelian Aset', 'kebutuhan'],
  ['P07', 'GTR-OPR-015-IX-2026', 'Operasional kandang Majalengka', 'OPR', 'approved_ceo', 'U-opr', 12, 2400000, 'Operasional Kandang', 'kebutuhan'],
  ['P08', 'GTR-PRC-006-IX-2026', 'Beli regulator tekanan', 'PRC', 'approved_ceo', 'U-prc', 15, 9800000, 'Pembelian Alat', 'kebutuhan'],
  ['P09', 'GTR-OPR-014-IX-2026', 'Reimburse parkir & tol Sept', 'OPR', 'approved_ceo', 'U-opr', 18, 640000, 'Upah, Bensin, Parkir, Tol Kendaraan', 'reimbursement'],
  ['P10', 'GTR-OPR-013-IX-2026', 'Trip operasional Cirebon', 'OPR', 'approved_ceo', 'U-opr', 20, 1750000, 'Trip Operasional', 'kebutuhan'],
  ['P11', 'GTR-OPR-020-X-2026', 'Konsumsi rapat vendor', 'OPR', 'revision', 'U-opr', 2, 1200000, 'Konsumsi Rapat', 'kebutuhan', { rejection_type: 'revision', rejection_reason: 'Lampirkan penawaran harga minimal 2 vendor' }],
  ['P12', 'GTR-PRC-007-X-2026', 'Sewa forklift', 'PRC', 'hold', 'U-prc', 5, 7500000, 'Pemeliharaan Alat', 'kebutuhan', { rejection_type: 'hold', rejection_reason: 'Tunggu cashflow minggu depan' }],
  ['P13', 'GTR-ADM-004-IX-2026', 'Seminar luar negeri', 'ADM', 'rejected', 'U-cao', 9, 28000000, 'Perjalanan Dinas', 'kebutuhan', { rejection_type: 'rejected', rejection_reason: 'Belum prioritas tahun ini' }],
  ['P14', 'GTR-OPR-009-VIII-2026', 'Pemeliharaan genset (arsip)', 'OPR', 'approved_ceo', 'U-opr', 60, 3100000, 'Pemeliharaan Alat', 'kebutuhan', { is_archived: true }],
  ['P15', 'GTR-PRC-009-X-2026', 'Ban serep & dongkrak', 'PRC', 'approved_ceo', 'U-prc', 10, 2650000, 'Pemeliharaan Kendaraan', 'kebutuhan'],
]

const STEP1 = { OPR: 'U-coo', ADM: 'U-cao', PRC: 'U-cao', FIN: 'U-cfo' }

const pengajuan = []
const pengajuan_items = []
const pengajuan_penerima = []
const pengajuan_attachments = []
const approval_logs = []

for (const [id, kode, judul, division, status, by, ago, total, subkategori, tipe, extra = {}] of P) {
  const created = d(ago)
  const row = {
    id, kode_surat: kode, judul, division, status, submitted_by: by, total_pengajuan: total, subkategori, tipe,
    metode_pembayaran: 'Transfer', catatan: id === 'P03' ? 'Ban depan kiri sobek, truk tidak bisa jalan' : '',
    created_at: created, submitted_at: created, is_archived: false,
    rejection_type: null, rejection_reason: null, ...extra,
  }
  const reached = ['approved_step1', 'approved_cfo', 'approved_ceo'].indexOf(status)
  if (reached >= 0 || division === 'FIN' && status === 'approved_cfo') { row.approved_step1_at = d(ago - 0.1); row.step1_approved_by = STEP1[division] }
  if (reached >= 1) { row.approved_cfo_at = d(ago - 0.2); row.cfo_approved_by = 'U-cfo' }
  if (reached >= 2) { row.approved_ceo_at = d(ago - 0.3); row.ceo_approved_by = 'U-ceo' }
  pengajuan.push(row)

  const n = total > 5e6 ? 3 : total > 1e6 ? 2 : 1
  let left = total
  for (let i = 1; i <= n; i++) {
    const jumlah = i === n ? left : Math.round(total / n / 1000) * 1000
    left -= jumlah
    pengajuan_items.push({ id: `${id}-I${i}`, pengajuan_id: id, urutan: i, uraian: `${judul} — item ${i}`, qty: 1, satuan: 'Unit', harga_satuan: jumlah, jumlah })
  }
  pengajuan_penerima.push({ id: `${id}-R`, pengajuan_id: id, nama_penerima: id === 'P06' ? 'PT Karoseri Maju' : 'Toko Sumber Teknik', bank: 'BCA', no_rekening: '1234567890', atas_nama: id === 'P06' ? 'PT Karoseri Maju' : 'Hartono' })
  if (['P03', 'P06'].includes(id)) pengajuan_attachments.push({ id: `${id}-A`, pengajuan_id: id, file_name: 'penawaran.png', file_url: '/logo-gastron.png', file_type: 'image/png', file_size: 20480 })

  approval_logs.push({ id: `${id}-L0`, pengajuan_id: id, action: 'submitted', action_by: by, role_at_time: users.find((u) => u.id === by).role, created_at: created, catatan: null })
  if (row.approved_step1_at) approval_logs.push({ id: `${id}-L1`, pengajuan_id: id, action: 'approved', action_by: STEP1[division], role_at_time: '', created_at: row.approved_step1_at, catatan: 'Approved oleh ' + users.find((u) => u.id === STEP1[division]).full_name })
  if (row.approved_cfo_at) approval_logs.push({ id: `${id}-L2`, pengajuan_id: id, action: 'approved', action_by: 'U-cfo', role_at_time: 'cfo', created_at: row.approved_cfo_at, catatan: 'Approved (CFO) oleh Rina Wijaya' })
  if (row.approved_ceo_at) approval_logs.push({ id: `${id}-L3`, pengajuan_id: id, action: 'approved', action_by: 'U-ceo', role_at_time: 'ceo', created_at: row.approved_ceo_at, catatan: 'Final approval (CEO) oleh Hendra Gunawan' })
  if (extra.rejection_type) approval_logs.push({ id: `${id}-L9`, pengajuan_id: id, action: extra.rejection_type, action_by: 'U-cfo', role_at_time: 'cfo', rejection_type: extra.rejection_type, created_at: d(ago - 0.5), catatan: extra.rejection_reason })
}

// P12 ditahan CFO di tahap CFO (CAO sudah approve tahap 1) — kasus nyata 12 Okt
Object.assign(pengajuan.find((x) => x.id === 'P12'), { step1_approved_by: 'U-cao', approved_step1_at: d(4.8) })
approval_logs.push({ id: 'P12-L1', pengajuan_id: 'P12', action: 'approved', action_by: 'U-cao', role_at_time: 'cao', created_at: d(4.8), catatan: 'Approved oleh Dewi Lestari' })

// LPJ: P07 belum ada, P08 submitted, P15 approved_finance, P14 closed
const lpj = [
  { id: 'LPJ-08', pengajuan_id: 'P08', submitted_by: 'U-prc', status: 'submitted', total_pengajuan: 9800000, total_realisasi: 9450000, metode_pengembalian: 'Transfer balik', submitted_at: d(3) },
  { id: 'LPJ-15', pengajuan_id: 'P15', submitted_by: 'U-prc', status: 'approved_finance', total_pengajuan: 2650000, total_realisasi: 2650000, metode_pengembalian: null, submitted_at: d(4), approved_finance_at: d(2), approved_finance_by: 'U-fin' },
  { id: 'LPJ-14', pengajuan_id: 'P14', submitted_by: 'U-opr', status: 'closed', total_pengajuan: 3100000, total_realisasi: 3000000, metode_pengembalian: 'Cash', submitted_at: d(50), approved_finance_at: d(48), approved_cfo_at: d(47) },
]
const lpj_nota = []
const lpj_nota_items = []
for (const l of lpj) {
  const items = pengajuan_items.filter((i) => i.pengajuan_id === l.pengajuan_id)
  lpj_nota.push({ id: `${l.id}-N1`, lpj_id: l.id, nama_nota: 'Nota toko', total_nota: l.total_realisasi, file_url: '/logo-gastron.png', file_name: 'nota.png' })
  const ratio = l.total_realisasi / l.total_pengajuan
  items.forEach((it, k) => lpj_nota_items.push({ id: `${l.id}-NI${k}`, nota_id: `${l.id}-N1`, pengajuan_item_id: it.id, uraian: it.uraian, satuan: it.satuan, qty_pengajuan: it.qty, harga_pengajuan: it.harga_satuan, realisasi_qty: 1, realisasi_harga: Math.round(it.harga_satuan * ratio) }))
}

const MAP = {
  'Upah, Bensin, Parkir, Tol Kendaraan': ['d_opex', 'Operational Expenditure', 'd_opex1'],
  'Operasional Kandang': ['d_opex', 'Operational Expenditure', 'd_opex2'],
  'Pemeliharaan Alat': ['d_opex', 'Operational Expenditure', 'd_opex6'],
  'Pemeliharaan Kendaraan': ['d_opex', 'Operational Expenditure', 'd_opex5'],
  'Marketing/Mobilisasi Operasional': ['d_opex', 'Operational Expenditure', 'd_opex4'],
  'Pembelian Alat': ['d_capex', 'CapEx', 'd_capex2'],
  'Pembelian Aset': ['d_capex', 'CapEx', 'd_capex1'],
  'Perjalanan Dinas': ['d_corp', 'Corporate Support', 'd_corp4'],
  'Perlengkapan Kantor': ['d_off', 'Office', 'd_off2'],
  'Trip Operasional': [null], 'Konsumsi Rapat': [null],
}
const SUBNAMES = { d_opex1: 'Upah, Bensin, Parkir, Tol Kendaraan', d_opex2: 'Operasional Kandang', d_opex3: 'Operasional Tak Terduga', d_opex4: 'Marketing/Mobilisasi Operasional', d_opex5: 'Pemeliharaan Kendaraan', d_opex6: 'Pemeliharaan Alat', d_capex1: 'Pembelian Aset', d_capex2: 'Pembelian Alat', d_corp4: 'Perjalanan Dinas', d_off2: 'Perlengkapan Kantor' }
const subkategori_pengajuan = Object.entries(MAP).map(([nama, [cat, catName, sub]], i) => ({
  id: i + 1, nama, cashflow_cat_id: cat, cashflow_cat_name: cat ? catName : null, cashflow_subcat_id: sub || null, cashflow_subcat_name: sub ? SUBNAMES[sub] : null,
}))
const cashflow_categories = [
  { id: 'd_opex', name: 'Operational Expenditure', subcats: ['d_opex1', 'd_opex2', 'd_opex3', 'd_opex4', 'd_opex5', 'd_opex6'].map((id) => ({ id, name: SUBNAMES[id] })) },
  { id: 'd_capex', name: 'CapEx', subcats: ['d_capex1', 'd_capex2'].map((id) => ({ id, name: SUBNAMES[id] })) },
  { id: 'd_corp', name: 'Corporate Support', subcats: [{ id: 'd_corp4', name: SUBNAMES.d_corp4 }] },
  { id: 'd_off', name: 'Office', subcats: [{ id: 'd_off2', name: SUBNAMES.d_off2 }] },
]
// P07, P08, P09, P14 sudah masuk cashflow; P10 & P15 belum (muncul di "belum masuk")
const cashflow_transactions = ['P07', 'P08', 'P09', 'P14'].map((pid) => {
  const p = pengajuan.find((x) => x.id === pid)
  const [cat, catName, sub] = MAP[p.subkategori]
  return { id: `CF-${pid}`, name: p.judul, amount: p.total_pengajuan, date: p.approved_ceo_at.slice(0, 10), type: 'out', account: 'utama', cat_id: cat, cat_name: catName, subcat_id: sub, subcat_name: SUBNAMES[sub], linked_id: pid }
})

const __authUsers = Object.fromEntries(users.map((u) => [u.id, { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: { full_name: u.full_name, avatar_url: null }, app_metadata: { provider: 'google' } }]))

export const FIXTURE = {
  users, pengajuan, pengajuan_items, pengajuan_penerima, pengajuan_attachments, approval_logs,
  lpj, lpj_nota, lpj_nota_items, subkategori_pengajuan, cashflow_categories, cashflow_transactions,
  cashflow_activity_log: [], role_change_log: [], telegram_link_tokens: [], push_subscriptions: [], __authUsers,
}
