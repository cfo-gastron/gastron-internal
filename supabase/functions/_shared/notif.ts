// supabase/functions/_shared/notif.ts
// Kirim satu notifikasi ke banyak user lewat Telegram. Logika dipisah dari Deno.serve supaya bisa dites.

import { appUrl, formatNotif, type Sender } from './telegram.ts'

// deno-lint-ignore no-explicit-any
type Db = any

export type NotifInput = { user_ids: string[]; title: string; body?: string; url?: string }

// actorId = user yang memicu notif (yang approve/submit). Dia tidak dikirimi notif atas aksinya sendiri.
export async function deliverNotif(db: Db, input: NotifInput, actorId: string | null, send: Sender) {
  const targets = [...new Set(input.user_ids)].filter((id) => id && id !== actorId)
  if (targets.length === 0) return { sent: 0, failed: 0, not_linked: 0 }

  const { data: users, error } = await db.from('users').select('id, telegram_chat_id').in('id', targets)
  if (error) throw error

  const linked = (users || []).filter((u: { telegram_chat_id: number | null }) => u.telegram_chat_id)
  const html = formatNotif(input.title, input.body || '')
  const button = { text: 'Buka di aplikasi', url: appUrl(input.url || '/dashboard') }

  let sent = 0
  let failed = 0
  const blockedChats: number[] = []

  for (const u of linked) {
    try {
      const r = await send(u.telegram_chat_id, html, button)
      if (r.ok) sent++
      else {
        failed++
        // 403 = user blokir bot / hapus chat. Putuskan supaya tidak dicoba terus.
        if (r.status === 403) blockedChats.push(u.telegram_chat_id)
        console.error('Telegram gagal', u.id, r.status, r.description)
      }
    } catch (e) {
      failed++
      console.error('Telegram error', u.id, e)
    }
  }

  if (blockedChats.length > 0) {
    await db.from('users').update({ telegram_chat_id: null, telegram_linked_at: null }).in('telegram_chat_id', blockedChats)
  }

  return { sent, failed, not_linked: targets.length - linked.length }
}
