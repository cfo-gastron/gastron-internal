// api/_auth.js — cek login Supabase untuk serverless function Vercel.
// File berawalan "_" tidak jadi endpoint. Dipakai api/claude.js dan api/klasifikasi.js.

// URL & anon key memang publik (ikut di bundle frontend); env Vercel dipakai kalau ada.
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vybfhlpmtsdtegbrdsvo.supabase.co'
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5YmZobHBtdHNkdGVnYnJkc3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzY0NTQsImV4cCI6MjA5NjY1MjQ1NH0.oAKeDWGHP9jII5_iGk5jgezt6NHkh3zJMB5g4Fex2vI'

export function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  return String(h).replace(/^Bearer\s+/i, '').trim()
}

// Kembalikan user Supabase kalau token login valid, selain itu null.
export async function getUser(req) {
  const token = bearer(req)
  if (!token || token === SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}

// Role user dari tabel users (dibaca dengan token user sendiri, jadi ikut RLS).
// Role hanya bisa diubah admin (trigger users_guard), jadi aman dipakai untuk izin di server.
export async function getRole(req, user) {
  if (!user?.id) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=role`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${bearer(req)}` },
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.role || null
  } catch {
    return null
  }
}
