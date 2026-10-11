// supabase/functions/_shared/telegram.ts
// Semua urusan Telegram ada di sini, dipakai bersama oleh telegram-bot dan send-notif.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function appUrl(path = '/dashboard') {
  const base = (Deno.env.get('APP_URL') || 'https://gastron-internal.vercel.app').replace(/\/+$/, '')
  return base + (path.startsWith('/') ? path : '/' + path)
}

// Teks dari user (judul pengajuan, nama) harus di-escape karena dikirim sebagai HTML
export function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type SendResult = { ok: boolean; status: number; description?: string }
export type Sender = (chatId: number | string, html: string, button?: { text: string; url: string }) => Promise<SendResult>

// Kirim pesan ke satu chat. Tombol opsional membuka halaman app.
export const sendTelegram: Sender = async (chatId, html, button) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN belum di-set di Supabase secrets')

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }
  if (button) body.reply_markup = { inline_keyboard: [[button]] }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.ok === true, status: res.status, description: data.description }
}

// Format satu notifikasi. Dipakai send-notif supaya semua notif bentuknya sama.
export function formatNotif(title: string, body: string) {
  return `<b>${esc(title)}</b>${body ? '\n' + esc(body) : ''}`
}

export function roleLabel(role: string | null | undefined) {
  if (!role) return '-'
  if (['ceo', 'cfo', 'coo', 'cao'].includes(role)) return role.toUpperCase()
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function bearer(req: Request) {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
}
