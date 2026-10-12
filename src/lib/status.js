// Satu-satunya tempat label & kelompok status pengajuan.
// Dipakai Dashboard, Detail, Arsip, sehingga kartu angka dan filter selalu menghitung hal yang sama.

export const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Menunggu Review',
  approved_step1: 'Menunggu CFO',
  approved_cfo: 'Menunggu CEO',
  approved_ceo: 'Transferred',
  revision: 'Perlu Revisi',
  hold: 'Ditahan',
  rejected: 'Ditolak',
}

export const STATUS_CLASS = {
  draft: 'badge-pending',
  submitted: 'badge-pending',
  approved_step1: 'badge-step1',
  approved_cfo: 'badge-cfo',
  approved_ceo: 'badge-approved',
  revision: 'badge-revision',
  hold: 'badge-hold',
  rejected: 'badge-rejected',
}

// Kelompok untuk kartu angka Dashboard. Nilai filter kelompok diawali "grup:".
export const STATUS_GROUPS = {
  menunggu: ['submitted', 'approved_step1', 'approved_cfo'],
  transferred: ['approved_ceo'],
  ditolak: ['rejected', 'hold', 'revision'],
}

// filter: '' (semua) | 'grup:<nama>' | status tunggal
export function matchStatusFilter(status, filter) {
  if (!filter) return true
  if (filter.startsWith('grup:')) return (STATUS_GROUPS[filter.slice(5)] || []).includes(status)
  return status === filter
}
