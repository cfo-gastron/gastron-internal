// supabase/functions/telegram-bot/index.ts
// Dua pintu:
// 1) Webhook dari Telegram (header x-telegram-bot-api-secret-token) -> proses /start, /stop
// 2) Dari app (user login): { action: 'link' } -> kembalikan link t.me untuk menghubungkan akun
import { createClient } from 'npm:@supabase/supabase-js@2'
import { bearer, corsHeaders, json, sendTelegram } from '../_shared/telegram.ts'
import { createLinkUrl, handleUpdate } from '../_shared/link.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1) Webhook Telegram
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== null) {
    if (secret !== Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 })
    try {
      await handleUpdate(db, await req.json(), sendTelegram)
    } catch (e) {
      console.error('handleUpdate error', e)
    }
    // Selalu 200 supaya Telegram tidak mengirim ulang pesan yang sama terus-menerus
    return new Response('ok')
  }

  // 2) Permintaan dari app
  try {
    const { data, error } = await db.auth.getUser(bearer(req))
    if (error || !data.user) return json({ error: 'Harus login' }, 401)

    const { action } = await req.json().catch(() => ({}))
    if (action !== 'link') return json({ error: 'action tidak dikenal' }, 400)

    const botUsername = Deno.env.get('TELEGRAM_BOT_USERNAME')
    if (!botUsername) return json({ error: 'TELEGRAM_BOT_USERNAME belum di-set di Supabase secrets' }, 500)

    const result = await createLinkUrl(db, data.user.id, botUsername)
    return json(result, result.error ? 400 : 200)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
