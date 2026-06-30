import { supabase } from './supabase'

// Kirim notif ke daftar user_id tertentu
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
  const { data, error } = await supabase.from('users').select('id').in('role', roles)
  if (error) { console.error(error); return [] }
  return data.map(u => u.id)
}

// Ambil semua user_id yang relevan untuk sebuah pengajuan:
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

// Notif untuk perubahan status pengajuan
export async function notifyPengajuanUpdate(pengajuan, { title, body }) {
  const userIds = await getRelevantUserIds(pengajuan.division, pengajuan.submitted_by)
  return sendNotif({
    userIds,
    title,
    body,
    url: `/pengajuan/${pengajuan.id}`,
  })
}

// Notif untuk perubahan status LPJ — pakai pengajuan terkait untuk tentuin divisi & pengaju
export async function notifyLpjUpdate(pengajuan, lpjSubmittedBy, { title, body }) {
  const userIds = await getRelevantUserIds(pengajuan.division, lpjSubmittedBy)
  return sendNotif({
    userIds,
    title,
    body,
    url: `/lpj/${pengajuan.id}`,
  })
}
