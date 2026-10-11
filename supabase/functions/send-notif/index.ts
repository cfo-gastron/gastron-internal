// supabase/functions/send-notif/index.ts
// Kirim notifikasi ke user lewat Telegram.
// Body: { user_ids: string[], title: string, body?: string, url?: string }
// Pemanggil wajib user yang login (dari app) atau service role key (tes manual / job terjadwal).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { bearer, corsHeaders, json, sendTelegram } from '../_shared/telegram.ts'
import { deliverNotif } from '../_shared/notif.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

    // Siapa yang memanggil? Anon key saja tidak cukup (anon key ada di kode frontend, semua orang bisa lihat).
    const token = bearer(req)
    let actorId: string | null = null
    if (token !== serviceKey) {
      const { data, error } = await db.auth.getUser(token)
      if (error || !data.user) return json({ error: 'Harus login' }, 401)
      actorId = data.user.id
    }

    const { user_ids, title, body, url } = await req.json()
    if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
      return json({ error: 'user_ids (array) dan title wajib diisi' }, 400)
    }

    const result = await deliverNotif(db, { user_ids, title, body, url }, actorId, sendTelegram)
    return json(result)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
