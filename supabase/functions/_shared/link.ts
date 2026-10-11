// supabase/functions/_shared/link.ts
// Menghubungkan akun app dengan chat Telegram. Logika dipisah dari Deno.serve supaya bisa dites.

import { appUrl, esc, roleLabel, type Sender } from './telegram.ts'

export const TOKEN_TTL_MS = 30 * 60 * 1000

// deno-lint-ignore no-explicit-any
type Db = any

function randomToken() {
  // 18 byte acak -> 24 karakter base64url (Telegram start param: A-Z a-z 0-9 _ -, maks 64)
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Dipanggil dari app (tombol "Hubungkan Telegram"). Mengembalikan link t.me untuk dibuka user.
export async function createLinkUrl(db: Db, userId: string, botUsername: string) {
  const { data: profile, error: profileError } = await db.from('users').select('id').eq('id', userId).maybeSingle()
  if (profileError) throw profileError
  if (!profile) return { error: 'Profil belum ada. Pilih role dulu.' }

  // Satu user cuma punya satu token aktif
  await db.from('telegram_link_tokens').delete().eq('user_id', userId)
  const token = randomToken()
  const { error } = await db.from('telegram_link_tokens').insert({ token, user_id: userId })
  if (error) throw error

  return { url: `https://t.me/${botUsername.replace(/^@/, '')}?start=${token}` }
}

const MSG_HELP =
  'Bot ini khusus notifikasi Sistem Pengajuan Gastron.\n\n' +
  'Untuk menghubungkan akun: buka app Gastron Internal, lalu tekan <b>Hubungkan Telegram</b> di Dashboard.'

// Dipanggil oleh webhook Telegram untuk setiap pesan yang masuk ke bot.
export async function handleUpdate(db: Db, update: unknown, send: Sender, now = Date.now()) {
  // deno-lint-ignore no-explicit-any
  const msg = (update as any)?.message
  if (!msg || msg.chat?.type !== 'private' || typeof msg.text !== 'string') return 'ignored'

  const chatId = msg.chat.id
  const [rawCmd, arg] = msg.text.trim().split(/\s+/, 2)
  const cmd = rawCmd.split('@')[0].toLowerCase()

  if (cmd === '/start' && arg) {
    const { data: row } = await db.from('telegram_link_tokens').select('user_id, created_at').eq('token', arg).maybeSingle()

    if (!row || now - new Date(row.created_at).getTime() > TOKEN_TTL_MS) {
      if (row) await db.from('telegram_link_tokens').delete().eq('token', arg)
      await send(chatId, 'Link ini sudah kedaluwarsa atau sudah dipakai.\n\nBuka app Gastron Internal, lalu tekan <b>Hubungkan Telegram</b> lagi.')
      return 'expired'
    }

    const { data: user, error } = await db
      .from('users')
      .update({
        telegram_chat_id: chatId,
        telegram_username: msg.from?.username ?? null,
        telegram_linked_at: new Date(now).toISOString(),
      })
      .eq('id', row.user_id)
      .select('full_name, role')
      .single()
    if (error) throw error

    await db.from('telegram_link_tokens').delete().eq('token', arg)

    const firstName = String(user?.full_name || '').split(' ')[0] || 'kamu'
    await send(
      chatId,
      `✅ Halo ${esc(firstName)}, Telegram kamu sudah terhubung ke Sistem Pengajuan Gastron sebagai <b>${esc(roleLabel(user?.role))}</b>.\n\n` +
        'Notifikasi pengajuan dan LPJ akan masuk ke sini. Ketik /stop kalau mau berhenti.',
      { text: 'Buka aplikasi', url: appUrl('/dashboard') },
    )
    return 'linked'
  }

  if (cmd === '/stop') {
    await db.from('users').update({ telegram_chat_id: null, telegram_linked_at: null }).eq('telegram_chat_id', chatId)
    await send(chatId, 'Notifikasi dimatikan.\n\nUntuk menyalakan lagi, tekan <b>Hubungkan Telegram</b> di Dashboard app.')
    return 'stopped'
  }

  await send(chatId, MSG_HELP)
  return 'help'
}
