// Satu-satunya tempat aturan "siapa approve di tahap mana".
// Dipakai tombol Approve (DetailPengajuanPage, LpjPage) DAN notifikasi (sendNotif.js),
// jadi notif "Perlu approval kamu" selalu sama dengan siapa yang melihat tombol Approve.
//
// utama    = yang ditunggu di tahap ini -> dapat notif "🔔 Perlu approval kamu"
// cadangan = boleh approve juga (menggantikan), tapi cuma dapat notif info

const STEP1_BY_DIVISION = { OPR: 'coo', ADM: 'cao', PRC: 'cao', FIN: 'cfo' }
const NONE = { utama: [], cadangan: [] }

export function pengajuanApprovers(status, division) {
  if (status === 'submitted') {
    const role = STEP1_BY_DIVISION[division]
    return role ? { utama: [role], cadangan: [] } : NONE
  }
  if (status === 'approved_step1') return { utama: ['cfo'], cadangan: [] }
  if (status === 'approved_cfo') return { utama: ['ceo'], cadangan: ['cfo', 'finance'] }
  return NONE
}

export function lpjApprovers(status) {
  if (status === 'submitted') return { utama: ['finance'], cadangan: ['cfo'] }
  if (status === 'approved_finance') return { utama: ['cfo'], cadangan: [] }
  return NONE
}

function allowed({ utama, cadangan }, role) {
  return !!role && (utama.includes(role) || cadangan.includes(role))
}

export function canApprovePengajuan(role, status, division) {
  return allowed(pengajuanApprovers(status, division), role)
}

export function canApproveLpj(role, status) {
  return allowed(lpjApprovers(status), role)
}

// Label tahap, sama dengan label status di Dashboard
export const PENGAJUAN_TAHAP = {
  submitted: 'Menunggu Review',
  approved_step1: 'Menunggu CFO',
  approved_cfo: 'Menunggu CEO',
}
export const LPJ_TAHAP = {
  submitted: 'Menunggu Finance',
  approved_finance: 'Menunggu CFO',
}

export function formatRp(n) {
  return 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID')
}

// Susun notifikasi untuk satu perubahan status (fungsi murni, tanpa database -> bisa dites).
// relevantIds   : semua yang biasa dapat info (getRelevantUserIds)
// approverIds   : user dengan role "utama" di status baru
// Hasil: daftar kiriman. Yang harus approve dapat pesan khusus, sisanya dapat info biasa.
// Satu orang tidak pernah dapat dua pesan untuk satu kejadian.
export function buildNotifs({ kind, item, newStatus, info, relevantIds, approverIds, pengajuName }) {
  const isLpj = kind === 'lpj'
  const url = isLpj ? `/lpj/${item.id}` : `/pengajuan/${item.id}`
  const approvers = [...new Set(approverIds)]
  const others = [...new Set(relevantIds)].filter((id) => !approvers.includes(id))
  const out = []

  if (approvers.length > 0) {
    const tahap = (isLpj ? LPJ_TAHAP : PENGAJUAN_TAHAP)[newStatus]
    const nominal = isLpj ? item.total_realisasi ?? item.total_pengajuan : item.total_pengajuan
    const lines = [
      `${isLpj ? 'LPJ ' : ''}"${item.judul}"`,
      [formatRp(nominal), item.division, item.kode_surat].filter(Boolean).join(' · '),
      pengajuName ? `Dari: ${pengajuName}` : null,
      tahap ? `Tahap: ${tahap}` : null,
    ].filter(Boolean)
    out.push({ userIds: approvers, title: '🔔 Perlu approval kamu', body: lines.join('\n'), url })
  }

  if (others.length > 0 && info) {
    out.push({ userIds: others, title: info.title, body: info.body, url })
  }

  return out
}

// Pengajuan boleh diubah hanya oleh pengajunya, dan hanya saat Perlu Revisi / Ditahan.
export function canEditPengajuan(userId, pengajuan) {
  return !!pengajuan && !!userId && pengajuan.submitted_by === userId && ['revision', 'hold'].includes(pengajuan.status)
}

// Jenis pengajuan yang tidak butuh LPJ
export function needsLpj(pengajuan) {
  return !!pengajuan && pengajuan.tipe !== 'reimbursement' && pengajuan.subkategori !== 'Trip Operasional'
}

// LPJ boleh dibuat/dibuka oleh pengaju, Finance, atau CFO, setelah dana ditransfer.
export function canAccessLpj(userId, role, pengajuan) {
  if (!pengajuan || pengajuan.status !== 'approved_ceo' || !needsLpj(pengajuan)) return false
  return role === 'cfo' || role === 'finance' || pengajuan.submitted_by === userId
}

// "Giliran saya": role ini yang ditunggu (utama) di tahap ini. Sama persis dengan penerima notif
// "Perlu approval kamu", dipakai daftar di Dashboard.
export function isMyTurnPengajuan(role, status, division) {
  return !!role && pengajuanApprovers(status, division).utama.includes(role)
}
export function isMyTurnLpj(role, lpjStatus) {
  return !!role && lpjApprovers(lpjStatus).utama.includes(role)
}

// Sejak kapan pengajuan menunggu di tahap sekarang
export function waitingSince(p) {
  if (p.status === 'approved_cfo') return p.approved_cfo_at || p.submitted_at
  if (p.status === 'approved_step1') return p.approved_step1_at || p.submitted_at
  return p.submitted_at || p.created_at
}

// Subkategori (ditebak otomatis) boleh dibetulkan CFO/Finance selama dana belum ditransfer.
export function canChangeSubkategori(role, status) {
  return ['cfo', 'finance'].includes(role) && status !== 'approved_ceo'
}

// Batalkan approval: hanya orang yang approve tahap itu, dan hanya selama tahap berikutnya belum bertindak.
// Final approve CEO (sudah ditransfer & masuk cashflow) tidak bisa dibatalkan di sini.
// Hasil: null (tidak bisa) | { dari, ke, kosongkan } untuk update pengajuan.
export function rencanaBatalApproval(userId, p) {
  if (!p || !userId) return null
  if (p.status === 'approved_step1' && p.step1_approved_by === userId) {
    return { dari: 'approved_step1', ke: 'submitted', kosongkan: { approved_step1_at: null, step1_approved_by: null } }
  }
  if (p.status === 'approved_cfo' && p.cfo_approved_by === userId) {
    // Divisi FIN: CFO approve tahap 1 sekaligus tahap CFO -> batal = kembali ke awal
    if (p.step1_approved_by === userId && p.division === 'FIN') {
      return { dari: 'approved_cfo', ke: 'submitted', kosongkan: { approved_step1_at: null, step1_approved_by: null, approved_cfo_at: null, cfo_approved_by: null } }
    }
    return { dari: 'approved_cfo', ke: 'approved_step1', kosongkan: { approved_cfo_at: null, cfo_approved_by: null } }
  }
  return null
}

// ---- Ditahan / Revisi: kembali ke tahap yang menahan atau meminta revisi (keputusan owner 12 Okt) ----
const URUTAN_TAHAP = ['submitted', 'approved_step1', 'approved_cfo', 'approved_ceo']
const NAMA_ROLE = { coo: 'COO', cao: 'CAO', cfo: 'CFO', ceo: 'CEO', finance: 'Finance' }

// Tahap terakhir pengajuan. Untuk Ditahan / Perlu Revisi / Ditolak dibaca dari siapa yang sudah approve:
// CFO sudah approve -> tahap CEO; tahap 1 sudah approve -> tahap CFO; belum ada -> tahap 1.
export function tahapTerakhir(p) {
  if (!p) return 'submitted'
  if (URUTAN_TAHAP.includes(p.status)) return p.status
  if (p.cfo_approved_by) return 'approved_cfo'
  if (p.step1_approved_by) return 'approved_step1'
  return 'submitted'
}

// Yang boleh melanjutkan pengajuan Ditahan = yang berhak approve di tahap tempat ia ditahan
export function canLanjutkanTahanan(role, p) {
  return !!p && p.status === 'hold' && canApprovePengajuan(role, tahapTerakhir(p), p.division)
}

// Persetujuan yang masih berlaku (dipakai tanda tangan surat). Kolom approver yang tertinggal dari
// siklus lama tidak dihitung kalau statusnya sudah kembali ke tahap sebelumnya.
export function persetujuanBerlaku(p) {
  const i = URUTAN_TAHAP.indexOf(tahapTerakhir(p))
  return { step1: i >= 1 && !!p?.step1_approved_by, cfo: i >= 2 && !!p?.cfo_approved_by }
}

// Satu kalimat "Berikutnya: …" untuk halaman Detail
export function langkahBerikutnya(p, { hasLpj = false } = {}) {
  if (!p) return ''
  const siapa = (st) => pengajuanApprovers(st, p.division).utama.map((r) => NAMA_ROLE[r] || r).join('/')
  switch (p.status) {
    case 'submitted': return `Menunggu ${siapa('submitted')} menyetujui`
    case 'approved_step1': return `Menunggu ${siapa('approved_step1')} menyetujui`
    case 'approved_cfo': return `Menunggu ${siapa('approved_cfo')} final approve & transfer`
    case 'hold': return `Ditahan. Menunggu ${siapa(tahapTerakhir(p))} melanjutkan`
    case 'revision': return 'Menunggu pengaju mengubah lalu mengirim ulang'
    case 'rejected': return 'Selesai: ditolak'
    case 'approved_ceo':
      if (!needsLpj(p)) return 'Selesai: dana sudah ditransfer'
      return hasLpj ? 'Dana sudah ditransfer, LPJ sedang diproses' : 'Dana sudah ditransfer. Berikutnya: pengaju membuat LPJ'
    default: return ''
  }
}

// Isi pengajuan wajib utuh sebelum di-approve: ada item, dan jumlah item = total pengajuan.
// Hasil: null (aman) | teks masalah. Dipakai Detail (blok tombol approve + peringatan).
export function masalahIsiPengajuan(items, total) {
  const list = items || []
  if (list.length === 0) return 'Pengajuan ini tidak punya item. Minta pengaju mengisi ulang item lewat Perlu Revisi sebelum di-approve.'
  const jumlah = list.reduce((s, i) => s + Number(i.jumlah ?? Number(i.qty) * Number(i.harga_satuan)), 0)
  if (Math.round(jumlah) !== Math.round(Number(total))) return `Jumlah item (${formatRp(jumlah)}) tidak sama dengan total pengajuan (${formatRp(total)}). Minta revisi supaya angkanya cocok.`
  return null
}
