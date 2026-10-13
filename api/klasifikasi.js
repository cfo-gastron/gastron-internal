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
      'Pilih HANYA dari daftar yang diberikan. Tulis NAMA-nya saja persis seperti di daftar, tanpa keterangan setelah titik dua. ' +
      'Pilih yang PALING COCOK walaupun tidak sempurna. Jawab null HANYA kalau judul sama sekali tidak menjelaskan untuk apa dananya (mis. "Pengajuan", "Reimburse"). ' +
      'Balas HANYA JSON: {"subkategori": "<nama persis dari daftar atau null>", "alasan": "<maks 12 kata>"}',
    user: `Judul pengajuan: "${judul}"\nItem: ${items.length ? items.map((i) => `"${i}"`).join(', ') : '(belum diisi)'}\n\nDaftar subkategori:\n${pilihan}`,
  }
}

// Cocokkan jawaban AI ke daftar resmi. AI kadang ikut menyalin keterangan ("Nama: keterangan"),
// atau menulis ejaan benar padahal nama di database salah ketik ("Mobilisai"). Urutan:
// persis -> buang keterangan -> abaikan tanda baca/spasi -> beda maks 2 huruf (nama panjang).
const rapi = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
function jarak(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
export function cocokkanNama(nama, daftar) {
  if (!nama) return null
  const calon = [String(nama).trim(), String(nama).split(/\s[:—–-]\s|:\s/)[0].trim()]
  for (const c of calon) {
    const persis = daftar.find((d) => d.toLowerCase() === c.toLowerCase())
    if (persis) return persis
  }
  for (const c of calon) {
    const sama = daftar.find((d) => rapi(d) === rapi(c))
    if (sama) return sama
  }
  for (const c of calon) {
    const r = rapi(c)
    if (r.length < 8) continue
    const dekat = daftar.map((d) => ({ d, j: jarak(rapi(d), r) })).filter((x) => x.j <= 2).sort((a, b) => a.j - b.j)
    if (dekat.length === 1 || (dekat.length > 1 && dekat[0].j < dekat[1].j)) return dekat[0].d
  }
  return null
}

export function bacaJawaban(text, daftar) {
  try {
    const parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim())
    const nama = typeof parsed.subkategori === 'string' ? parsed.subkategori.trim() : null
    return { subkategori: cocokkanNama(nama, daftar), alasan: String(parsed.alasan || '').slice(0, 120) }
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
