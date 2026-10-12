// api/klasifikasi.js — tebak subkategori pengajuan dari judul & item, pakai Claude.
// POST { judul, items: string[] } + header Authorization: Bearer <token login Supabase>
// Balas { subkategori: string|null, alasan } — subkategori PASTI salah satu dari tabel subkategori_pengajuan.
import { getUser, bearer, SUPABASE_URL, SUPABASE_ANON_KEY } from './_auth.js'
import { SUBKATEGORI_INFO } from '../src/lib/subkategori.js'

const MODEL = 'claude-haiku-4-5-20251001'

// Bentuk prompt & baca jawaban dipisah supaya bisa dites tanpa memanggil AI
export function buatPrompt(judul, items, daftar) {
  const pilihan = daftar.map((n) => `- ${n}${SUBKATEGORI_INFO[n] ? `: ${SUBKATEGORI_INFO[n]}` : ''}`).join('\n')
  return {
    system:
      'Kamu mengelompokkan pengajuan dana internal perusahaan CNG ke SATU subkategori. ' +
      'Pilih HANYA dari daftar yang diberikan, tulis namanya persis. ' +
      'Kalau judul terlalu umum sehingga tidak bisa ditentukan, jawab subkategori null. ' +
      'Balas HANYA JSON: {"subkategori": "<nama persis dari daftar atau null>", "alasan": "<maks 12 kata>"}',
    user: `Judul pengajuan: "${judul}"\nItem: ${items.length ? items.map((i) => `"${i}"`).join(', ') : '(belum diisi)'}\n\nDaftar subkategori:\n${pilihan}`,
  }
}

export function bacaJawaban(text, daftar) {
  try {
    const parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim())
    const nama = typeof parsed.subkategori === 'string' ? parsed.subkategori.trim() : null
    const cocok = nama ? daftar.find((d) => d.toLowerCase() === nama.toLowerCase()) : null
    return { subkategori: cocok || null, alasan: String(parsed.alasan || '').slice(0, 120) }
  } catch {
    return { subkategori: null, alasan: '' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Harus login' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel' })

  const judul = String(req.body?.judul || '').trim().slice(0, 200)
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).map((i) => String(i || '').trim()).filter(Boolean).slice(0, 10).map((i) => i.slice(0, 100))
  if (judul.length < 4) return res.status(200).json({ subkategori: null, alasan: 'Judul terlalu pendek' })

  try {
    // Daftar resmi dari database (dibaca dengan login user)
    const subRes = await fetch(`${SUPABASE_URL}/rest/v1/subkategori_pengajuan?select=nama&order=nama`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${bearer(req)}` },
    })
    const daftar = subRes.ok ? (await subRes.json()).map((r) => r.nama).filter(Boolean) : []
    if (daftar.length === 0) return res.status(500).json({ error: 'Daftar subkategori kosong / tidak terbaca' })

    const prompt = buatPrompt(judul, items, daftar)
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 150, system: prompt.system, messages: [{ role: 'user', content: prompt.user }] }),
    })
    const data = await aiRes.json()
    if (!aiRes.ok) return res.status(502).json({ error: data?.error?.message || 'AI gagal menjawab' })
    return res.status(200).json(bacaJawaban(data.content?.[0]?.text || '', daftar))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
