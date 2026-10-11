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
