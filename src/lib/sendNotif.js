import { supabase } from './supabase'
import { buildNotifs, lpjApprovers, pengajuanApprovers } from './approval'

// Kirim notif ke daftar user_id tertentu (lewat Telegram, lihat supabase/functions/send-notif).
// User yang belum menghubungkan Telegram dilewati. User yang memicu notif tidak dikirimi.
export async function sendNotif({ userIds, title, body, url }) {
  if (!userIds || userIds.length === 0) return

  try {
    const { data, error } = await supabase.functions.invoke('send-notif', {
      body: { user_ids: userIds, title, body, url },
    })
    if (error) console.error('Gagal kirim notif:', error)
    return data
  } catch (err) {
    console.error('Gagal kirim notif:', err)
  }
}

// Helper: ambil user_id berdasarkan role tertentu
export async function getUserIdsByRole(roles) {
  if (!roles || roles.length === 0) return []
  const { data, error } = await supabase.from('users').select('id').in('role', roles)
  if (error) { console.error(error); return [] }
  return data.map(u => u.id)
}

async function getFullName(userId) {
  if (!userId) return null
  const { data } = await supabase.from('users').select('full_name').eq('id', userId).maybeSingle()
  return data?.full_name || null
}

// Ambil semua user_id yang relevan untuk sebuah pengajuan (dapat notif info):
// - CFO, Finance, CEO selalu dapat notif (semua divisi)
// - COO hanya dapat notif kalau divisinya OPR
// - CAO hanya dapat notif kalau divisinya ADM atau PRC
// - pengaju (submitted_by) selalu termasuk
export async function getRelevantUserIds(division, submittedBy) {
  const alwaysRoles = ['cfo', 'finance', 'ceo']
  const conditionalRoles = []
  if (division === 'OPR') conditionalRoles.push('coo')
  if (['ADM', 'PRC'].includes(division)) conditionalRoles.push('cao')

  const roles = [...alwaysRoles, ...conditionalRoles]
  const ids = await getUserIdsByRole(roles)

  const allIds = new Set(ids)
  if (submittedBy) allIds.add(submittedBy)

  return Array.from(allIds)
}

async function sendAll(notifs) {
  return Promise.all(notifs.map(sendNotif))
}

// Notif untuk perubahan status pengajuan.
// newStatus = status SETELAH aksi. Yang harus approve di status itu dapat "🔔 Perlu approval kamu".
export async function notifyPengajuanUpdate(pengajuan, newStatus, info) {
  const [relevantIds, approverIds, pengajuName] = await Promise.all([
    getRelevantUserIds(pengajuan.division, pengajuan.submitted_by),
    getUserIdsByRole(pengajuanApprovers(newStatus, pengajuan.division).utama),
    getFullName(pengajuan.submitted_by),
  ])
  return sendAll(buildNotifs({ kind: 'pengajuan', item: pengajuan, newStatus, info, relevantIds, approverIds, pengajuName }))
}

// Notif untuk perubahan status LPJ — pakai pengajuan terkait untuk tentuin divisi & pengaju.
export async function notifyLpjUpdate(pengajuan, lpjSubmittedBy, newStatus, info, totalRealisasi) {
  const [relevantIds, approverIds, pengajuName] = await Promise.all([
    getRelevantUserIds(pengajuan.division, lpjSubmittedBy),
    getUserIdsByRole(lpjApprovers(newStatus).utama),
    getFullName(lpjSubmittedBy),
  ])
  const item = { ...pengajuan, total_realisasi: totalRealisasi }
  return sendAll(buildNotifs({ kind: 'lpj', item, newStatus, info, relevantIds, approverIds, pengajuName }))
}
