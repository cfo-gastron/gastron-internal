import { supabase } from './supabase'

// Minta link t.me sekali pakai untuk menghubungkan akun ini ke Telegram.
// Edge Function telegram-bot yang membuat token & link-nya.
export async function requestTelegramLink() {
  const { data, error } = await supabase.functions.invoke('telegram-bot', { body: { action: 'link' } })
  if (error) {
    // Ambil pesan asli dari Edge Function kalau ada (bukan cuma "non-2xx status code")
    let message = error.message
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch { /* body bukan JSON */ }
    throw new Error(message)
  }
  if (!data?.url) throw new Error('Link Telegram tidak ditemukan')
  return data.url
}
