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
