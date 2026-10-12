// Jalankan: node --test tests/
// Matriks alur notif approval: siapa dapat "Perlu approval kamu", siapa dapat info, di tiap perpindahan status.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildNotifs, canApproveLpj, canApprovePengajuan, lpjApprovers, pengajuanApprovers } from '../src/lib/approval.js'

const ROLES = ['coo', 'cao', 'cfo', 'ceo', 'finance', 'operational', 'procurement']
const DIVISIONS = ['OPR', 'ADM', 'PRC', 'FIN']
const STATUSES = ['draft', 'submitted', 'approved_step1', 'approved_cfo', 'approved_ceo', 'revision', 'hold', 'rejected']

// ---- aturan LAMA (disalin dari kode sebelum diubah) untuk memastikan tombol Approve tidak berubah ----
function oldCanApprove(role, status, division) {
  if (status === 'submitted') {
    if (division === 'OPR' && role === 'coo') return true
    if (['ADM', 'PRC'].includes(division) && role === 'cao') return true
    if (division === 'FIN' && role === 'cfo') return true
  }
  if (status === 'approved_step1' && role === 'cfo') return true
  if (status === 'approved_cfo' && (role === 'ceo' || role === 'cfo' || role === 'finance')) return true
  return false
}
function oldCanApproveLpj(role, status) {
  if (status === 'submitted' && (role === 'finance' || role === 'cfo')) return true
  if (status === 'approved_finance' && role === 'cfo') return true
  return false
}

test('Tombol Approve pengajuan: aturan baru = aturan lama di semua role × status × divisi', () => {
  for (const r of ROLES) for (const s of STATUSES) for (const d of DIVISIONS)
    assert.equal(canApprovePengajuan(r, s, d), oldCanApprove(r, s, d), `${r} ${s} ${d}`)
})

test('Tombol Approve LPJ: aturan baru = aturan lama', () => {
  for (const r of ROLES) for (const s of ['submitted', 'approved_finance', 'closed'])
    assert.equal(canApproveLpj(r, s), oldCanApproveLpj(r, s), `${r} ${s}`)
})

test('Setiap "utama" pasti juga bisa melihat tombol Approve (notif tidak menyuruh orang yang tidak bisa approve)', () => {
  for (const s of STATUSES) for (const d of DIVISIONS)
    for (const r of pengajuanApprovers(s, d).utama) assert.ok(canApprovePengajuan(r, s, d), `${r} ${s} ${d}`)
  for (const s of ['submitted', 'approved_finance'])
    for (const r of lpjApprovers(s).utama) assert.ok(canApproveLpj(r, s))
})

test('Setiap tahap yang butuh approval punya tepat satu role "utama"', () => {
  for (const d of DIVISIONS) for (const s of ['submitted', 'approved_step1', 'approved_cfo'])
    assert.equal(pengajuanApprovers(s, d).utama.length, 1, `${s} ${d}`)
  for (const s of ['approved_ceo', 'revision', 'hold', 'rejected', 'draft'])
    assert.deepEqual(pengajuanApprovers(s, 'OPR').utama, [], s)
})

// ---- simulasi notif end-to-end dengan user per role ----
const USERS = { coo: 'U-coo', cao: 'U-cao', cfo: 'U-cfo', ceo: 'U-ceo', finance: 'U-fin', pengaju: 'U-pengaju' }
const idsFor = (roles) => roles.map((r) => USERS[r])
function relevant(division) { // sama dengan getRelevantUserIds
  const roles = ['cfo', 'finance', 'ceo']
  if (division === 'OPR') roles.push('coo')
  if (['ADM', 'PRC'].includes(division)) roles.push('cao')
  return [...idsFor(roles), USERS.pengaju]
}
// actor dikeluarkan di server (deliverNotif) — ikut disimulasikan
function simulate({ division, newStatus, actorRole, kind = 'pengajuan' }) {
  const approverRoles = kind === 'lpj' ? lpjApprovers(newStatus).utama : pengajuanApprovers(newStatus, division).utama
  const notifs = buildNotifs({
    kind, newStatus,
    item: { id: 'P1', judul: 'Ganti ban truk', division, kode_surat: 'GTR-OPR-007-X-2026', total_pengajuan: 2500000, total_realisasi: 2350000 },
    info: { title: 'Info', body: 'x' },
    relevantIds: relevant(division), approverIds: idsFor(approverRoles), pengajuName: 'Budi Santoso',
  })
  const actor = USERS[actorRole]
  const who = (n) => n.userIds.filter((id) => id !== actor).sort()
  const action = notifs.find((n) => n.title === '🔔 Perlu approval kamu')
  const info = notifs.find((n) => n.title === 'Info')
  return { action: action ? who(action) : [], info: info ? who(info) : [], actionMsg: action }
}

const MATRIX = [
  // [kejadian, divisi, status baru, pemicu, dapat "Perlu approval", dapat info]
  ['Pengajuan baru OPR', 'OPR', 'submitted', 'pengaju', ['coo'], ['cfo', 'ceo', 'finance']],
  ['Pengajuan baru ADM', 'ADM', 'submitted', 'pengaju', ['cao'], ['cfo', 'ceo', 'finance']],
  ['Pengajuan baru PRC', 'PRC', 'submitted', 'pengaju', ['cao'], ['cfo', 'ceo', 'finance']],
  ['Pengajuan baru FIN', 'FIN', 'submitted', 'pengaju', ['cfo'], ['ceo', 'finance']],
  ['COO approve OPR -> giliran CFO', 'OPR', 'approved_step1', 'coo', ['cfo'], ['ceo', 'finance', 'pengaju']],
  ['CAO approve ADM -> giliran CFO', 'ADM', 'approved_step1', 'cao', ['cfo'], ['ceo', 'finance', 'pengaju']],
  ['CFO approve -> giliran CEO', 'OPR', 'approved_cfo', 'cfo', ['ceo'], ['coo', 'finance', 'pengaju']],
  ['CFO approve FIN (langsung lewati tahap 1) -> CEO', 'FIN', 'approved_cfo', 'cfo', ['ceo'], ['finance', 'pengaju']],
  ['CEO final approve -> selesai', 'OPR', 'approved_ceo', 'ceo', [], ['cfo', 'coo', 'finance', 'pengaju']],
  ['CFO minta revisi', 'OPR', 'revision', 'cfo', [], ['ceo', 'coo', 'finance', 'pengaju']],
  ['CFO hold', 'ADM', 'hold', 'cfo', [], ['cao', 'ceo', 'finance', 'pengaju']],
  ['CEO tolak', 'PRC', 'rejected', 'ceo', [], ['cao', 'cfo', 'finance', 'pengaju']],
  ['Pengaju ajukan ulang OPR -> COO lagi', 'OPR', 'submitted', 'pengaju', ['coo'], ['cfo', 'ceo', 'finance']],
]

for (const [nama, division, newStatus, actorRole, expAction, expInfo] of MATRIX) {
  test(`Matriks: ${nama}`, () => {
    const r = simulate({ division, newStatus, actorRole })
    assert.deepEqual(r.action, idsFor(expAction).sort(), 'Perlu approval')
    assert.deepEqual(r.info, idsFor(expInfo).sort(), 'info')
    assert.ok(!r.action.some((id) => r.info.includes(id)), 'tidak ada yang dapat dua pesan')
  })
}

const LPJ_MATRIX = [
  ['LPJ baru -> giliran Finance', 'OPR', 'submitted', 'pengaju', ['finance'], ['ceo', 'cfo', 'coo']],
  ['Finance approve LPJ -> giliran CFO', 'OPR', 'approved_finance', 'finance', ['cfo'], ['ceo', 'coo', 'pengaju']],
  ['CFO close LPJ -> selesai', 'ADM', 'closed', 'cfo', [], ['cao', 'ceo', 'finance', 'pengaju']],
]
for (const [nama, division, newStatus, actorRole, expAction, expInfo] of LPJ_MATRIX) {
  test(`Matriks LPJ: ${nama}`, () => {
    const r = simulate({ division, newStatus, actorRole, kind: 'lpj' })
    assert.deepEqual(r.action, idsFor(expAction).sort())
    assert.deepEqual(r.info, idsFor(expInfo).sort())
  })
}

test('Isi pesan "Perlu approval kamu" untuk CFO lengkap', () => {
  const { actionMsg } = simulate({ division: 'OPR', newStatus: 'approved_step1', actorRole: 'coo' })
  assert.equal(actionMsg.body, '"Ganti ban truk"\nRp 2.500.000 · OPR · GTR-OPR-007-X-2026\nDari: Budi Santoso\nTahap: Menunggu CFO')
  assert.equal(actionMsg.url, '/pengajuan/P1')
})

test('Isi pesan LPJ pakai nominal realisasi & link LPJ', () => {
  const { actionMsg } = simulate({ division: 'OPR', newStatus: 'approved_finance', actorRole: 'finance', kind: 'lpj' })
  assert.match(actionMsg.body, /^LPJ "Ganti ban truk"\nRp 2\.350\.000 · OPR/)
  assert.match(actionMsg.body, /Tahap: Menunggu CFO$/)
  assert.equal(actionMsg.url, '/lpj/P1')
})

test('Tidak ada notif info kosong kalau semua penerima adalah approver', () => {
  const n = buildNotifs({ kind: 'pengajuan', item: { id: 'x', judul: 'a' }, newStatus: 'approved_step1', info: { title: 'i', body: 'b' }, relevantIds: ['U-cfo'], approverIds: ['U-cfo'] })
  assert.equal(n.length, 1)
})

// ---- Putaran 1: aturan ubah pengajuan, akses LPJ, giliran saya ----
import { canEditPengajuan, canAccessLpj, isMyTurnPengajuan, isMyTurnLpj, needsLpj } from '../src/lib/approval.js'

test('Ubah pengajuan: hanya pengaju, hanya saat revisi/ditahan', () => {
  for (const s of STATUSES) {
    assert.equal(canEditPengajuan('U1', { submitted_by: 'U1', status: s }), ['revision', 'hold'].includes(s), s)
    assert.equal(canEditPengajuan('U2', { submitted_by: 'U1', status: s }), false, s)
  }
  assert.equal(canEditPengajuan(undefined, { submitted_by: undefined, status: 'revision' }), false)
})

test('Akses LPJ: setelah transfer, bukan reimbursement/Trip, oleh pengaju/Finance/CFO', () => {
  const p = { submitted_by: 'U1', status: 'approved_ceo', tipe: 'kebutuhan', subkategori: 'Pemeliharaan Alat' }
  assert.ok(canAccessLpj('U1', 'operational', p))
  assert.ok(canAccessLpj('X', 'cfo', p))
  assert.ok(canAccessLpj('X', 'finance', p))
  for (const r of ['coo', 'cao', 'ceo', 'procurement']) assert.equal(canAccessLpj('X', r, p), false, r)
  assert.equal(canAccessLpj('U1', 'operational', { ...p, status: 'approved_cfo' }), false)
  assert.equal(canAccessLpj('U1', 'operational', { ...p, tipe: 'reimbursement' }), false)
  assert.equal(canAccessLpj('U1', 'operational', { ...p, subkategori: 'Trip Operasional' }), false)
  assert.equal(needsLpj({ tipe: 'reimbursement' }), false)
})

test('Giliran saya = role utama (sama dengan penerima notif), cadangan tidak termasuk', () => {
  for (const s of STATUSES) for (const d of DIVISIONS) for (const r of ROLES)
    assert.equal(isMyTurnPengajuan(r, s, d), pengajuanApprovers(s, d).utama.includes(r), `${r} ${s} ${d}`)
  assert.equal(isMyTurnPengajuan('cfo', 'approved_cfo', 'OPR'), false)
  assert.equal(isMyTurnLpj('cfo', 'submitted'), false)
  assert.equal(isMyTurnLpj('cfo', 'approved_finance'), true)
  assert.equal(isMyTurnLpj('finance', 'submitted'), true)
})

// ---- Putaran 3: batalkan approval ----
import { rencanaBatalApproval } from '../src/lib/approval.js'

test('Batal approval: hanya yang approve tahap terakhir, final CEO tidak bisa', () => {
  const p = (x) => ({ division: 'OPR', step1_approved_by: 'COO', cfo_approved_by: 'CFO', ...x })
  assert.deepEqual(rencanaBatalApproval('COO', p({ status: 'approved_step1', cfo_approved_by: null }))?.ke, 'submitted')
  assert.equal(rencanaBatalApproval('CFO', p({ status: 'approved_step1', cfo_approved_by: null })), null)
  assert.equal(rencanaBatalApproval('CFO', p({ status: 'approved_cfo' }))?.ke, 'approved_step1')
  assert.equal(rencanaBatalApproval('COO', p({ status: 'approved_cfo' })), null)
  assert.equal(rencanaBatalApproval('CFO', p({ status: 'approved_ceo' })), null)
  assert.equal(rencanaBatalApproval('CFO', p({ status: 'submitted' })), null)
  const fin = rencanaBatalApproval('CFO', { division: 'FIN', status: 'approved_cfo', step1_approved_by: 'CFO', cfo_approved_by: 'CFO' })
  assert.equal(fin.ke, 'submitted')
  assert.deepEqual(Object.keys(fin.kosongkan).sort(), ['approved_cfo_at', 'approved_step1_at', 'cfo_approved_by', 'step1_approved_by'])
  assert.equal(rencanaBatalApproval(undefined, p({ status: 'approved_cfo', cfo_approved_by: undefined })), null)
})

test('Setiap batal approval mengembalikan ke status yang punya approver utama (tidak ada pengajuan "yatim")', () => {
  for (const d of DIVISIONS) for (const st of ['approved_step1', 'approved_cfo']) {
    const r = rencanaBatalApproval('U', { division: d, status: st, step1_approved_by: 'U', cfo_approved_by: 'U' })
    if (r) assert.equal(pengajuanApprovers(r.ke, d).utama.length, 1, `${d} ${st} -> ${r.ke}`)
  }
})

// ---- Putaran 4: Ditahan & Revisi kembali ke tahap peminta ----
import { tahapTerakhir, canLanjutkanTahanan, persetujuanBerlaku, langkahBerikutnya } from '../src/lib/approval.js'

test('tahapTerakhir: status tahap apa adanya; hold/revisi/tolak dibaca dari kolom approver', () => {
  assert.equal(tahapTerakhir({ status: 'approved_step1' }), 'approved_step1')
  assert.equal(tahapTerakhir({ status: 'hold' }), 'submitted')
  assert.equal(tahapTerakhir({ status: 'hold', step1_approved_by: 'X' }), 'approved_step1')
  assert.equal(tahapTerakhir({ status: 'revision', step1_approved_by: 'X', cfo_approved_by: 'Y' }), 'approved_cfo')
})

test('Lanjutkan tahanan = yang berhak approve di tahap itu (semua divisi x tahap x role)', () => {
  for (const d of DIVISIONS) for (const cols of [{}, { step1_approved_by: 'X' }, { step1_approved_by: 'X', cfo_approved_by: 'Y' }]) {
    const p = { division: d, status: 'hold', ...cols }
    for (const r of ROLES) assert.equal(canLanjutkanTahanan(r, p), canApprovePengajuan(r, tahapTerakhir(p), d), `${d} ${JSON.stringify(cols)} ${r}`)
    assert.equal(canLanjutkanTahanan('cfo', { ...p, status: 'revision' }), false)
  }
})

test('persetujuanBerlaku: kolom sisa diabaikan kalau status sudah kembali', () => {
  assert.deepEqual(persetujuanBerlaku({ status: 'submitted', step1_approved_by: 'X', cfo_approved_by: 'Y' }), { step1: false, cfo: false })
  assert.deepEqual(persetujuanBerlaku({ status: 'approved_step1', step1_approved_by: 'X', cfo_approved_by: 'Y' }), { step1: true, cfo: false })
  assert.deepEqual(persetujuanBerlaku({ status: 'approved_ceo', step1_approved_by: 'X', cfo_approved_by: 'Y' }), { step1: true, cfo: true })
  assert.deepEqual(persetujuanBerlaku({ status: 'hold', step1_approved_by: 'X' }), { step1: true, cfo: false })
})

test('langkahBerikutnya tidak pernah kosong untuk status yang dikenal', () => {
  for (const st of ['submitted', 'approved_step1', 'approved_cfo', 'approved_ceo', 'revision', 'hold', 'rejected'])
    for (const d of DIVISIONS) assert.ok(langkahBerikutnya({ status: st, division: d, tipe: 'kebutuhan' }).length > 5, `${st} ${d}`)
})

test('masalahIsiPengajuan: item kosong / jumlah beda total ditolak, cocok lolos', async () => {
  const { masalahIsiPengajuan } = await import('../src/lib/approval.js')
  assert.match(masalahIsiPengajuan([], 165000), /tidak punya item/)
  assert.match(masalahIsiPengajuan([{ qty: 1, harga_satuan: 125000, jumlah: 125000 }], 165000), /tidak sama/)
  assert.equal(masalahIsiPengajuan([{ qty: 2, harga_satuan: 50000, jumlah: 100000 }, { qty: 1, harga_satuan: 65000 }], '165000.00'), null)
})
