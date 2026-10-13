// Unit test serverless function Vercel (api/). fetch ke Supabase & Anthropic ditiru.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import klasifikasi, { bacaJawaban, buatPrompt } from '../api/klasifikasi.js'
import claude from '../api/claude.js'
import { cocokkanNama } from '../api/klasifikasi.js'

const DAFTAR = ['Pemeliharaan Kendaraan', 'Pemeliharaan Alat', 'Perlengkapan Kantor', 'Trip Operasional']
let calls
let aiText

function fakeRes() {
  const r = { statusCode: 0, body: null }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.body = b; return r }
  return r
}
let roleUji = 'cfo'
const req = (body, token = 'USERTOKEN') => ({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body })

beforeEach(() => {
  calls = []
  roleUji = 'cfo'
  aiText = '{"subkategori":"Pemeliharaan Kendaraan","alasan":"ganti ban"}'
  process.env.ANTHROPIC_API_KEY = 'sk-test'
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts })
    const ok = (data) => ({ ok: true, status: 200, json: async () => data })
    if (String(url).endsWith('/auth/v1/user')) {
      return opts.headers.Authorization === 'Bearer USERTOKEN' ? ok({ id: 'U1' }) : { ok: false, status: 401, json: async () => ({}) }
    }
    if (String(url).includes('/rest/v1/users')) return ok([{ role: roleUji }])
    if (String(url).includes('/rest/v1/subkategori_pengajuan')) return ok(DAFTAR.map((nama) => ({ nama })))
    if (String(url).includes('api.anthropic.com')) return ok({ content: [{ text: aiText }] })
    throw new Error('fetch tak terduga ' + url)
  }
})

test('klasifikasi: tanpa login -> 401, AI tidak dipanggil', async () => {
  for (const token of [null, 'TOKEN-PALSU']) {
    const res = fakeRes()
    await klasifikasi(req({ judul: 'Ganti ban truk' }, token), res)
    assert.equal(res.statusCode, 401)
  }
  assert.ok(!calls.some((c) => c.url.includes('anthropic')))
})

test('klasifikasi: login -> subkategori dari daftar database', async () => {
  const res = fakeRes()
  await klasifikasi(req({ judul: 'Ganti ban truk B 9123', items: ['Ban depan'] }), res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.subkategori, 'Pemeliharaan Kendaraan')
  const ai = calls.find((c) => c.url.includes('anthropic'))
  const body = JSON.parse(ai.opts.body)
  assert.match(body.messages[0].content, /Ganti ban truk B 9123/)
  assert.match(body.messages[0].content, /- Trip Operasional/) // daftar dari database ikut terkirim
  assert.equal(ai.opts.headers['x-api-key'], 'sk-test')
})

test('klasifikasi: jawaban AI di luar daftar / bukan JSON -> null', async () => {
  for (const t of ['{"subkategori":"Konsumsi Rapat"}', 'maaf saya tidak tahu', '{"subkategori":null}']) {
    aiText = t
    const res = fakeRes()
    await klasifikasi(req({ judul: 'Makan siang tamu' }), res)
    assert.equal(res.body.subkategori, null, t)
  }
})

test('klasifikasi: judul < 4 huruf tidak memanggil AI', async () => {
  const res = fakeRes()
  await klasifikasi(req({ judul: 'ab' }), res)
  assert.equal(res.body.subkategori, null)
  assert.ok(!calls.some((c) => c.url.includes('anthropic')))
})

test('bacaJawaban: cocokkan tanpa beda huruf besar, bersihkan ```json', () => {
  assert.equal(bacaJawaban('```json\n{"subkategori":"pemeliharaan alat"}\n```', DAFTAR).subkategori, 'Pemeliharaan Alat')
})

test('buatPrompt: penjelasan subkategori ikut, judul dibatasi', () => {
  const p = buatPrompt('Ganti oli', ['Oli'], DAFTAR)
  assert.match(p.user, /Pemeliharaan Kendaraan: Servis, ganti oli/)
  assert.match(p.system, /HANYA dari daftar/)
})

test('api/claude: tanpa login -> 401 (dulu terbuka untuk siapa saja)', async () => {
  const res = fakeRes()
  await claude(req({ model: 'x', messages: [] }, null), res)
  assert.equal(res.statusCode, 401)
  const res2 = fakeRes()
  await claude(req({ model: 'x', messages: [] }), res2)
  assert.equal(res2.statusCode, 200)
})

test('api/claude: hanya role CFO / Finance (role dari database), lainnya 403 tanpa memanggil AI', async () => {
  for (const [role, kode] of [['cfo', 200], ['finance', 200], ['ceo', 403], ['operational', 403], [null, 403]]) {
    roleUji = role; calls = []
    const res = fakeRes()
    await claude(req({ model: 'x', messages: [] }), res)
    assert.equal(res.statusCode, kode, String(role))
    if (kode === 403) assert.ok(!calls.some((c) => c.url.includes('anthropic')))
  }
})

test('cocokkanNama: jawaban AI yang ikut keterangan / beda ejaan tetap cocok ke daftar (bug 13 Okt)', () => {
  const daftar = ['Pemeliharaan Kendaraan', 'Pemeliharaan Alat', 'Mobilisai Operasional, Jasa Service Truck, dan Koordinasi Ga-Ling', 'Office', 'Top Up Gas']
  assert.equal(cocokkanNama('Pemeliharaan Kendaraan: Servis, ganti oli, ban, atau perbaikan kendaraan operasional', daftar), 'Pemeliharaan Kendaraan')
  assert.equal(cocokkanNama('Pemeliharaan Kendaraan — Servis, ganti oli', daftar), 'Pemeliharaan Kendaraan')
  assert.equal(cocokkanNama('Mobilisasi Operasional, Jasa Service Truck, dan Koordinasi Ga-Ling', daftar), 'Mobilisai Operasional, Jasa Service Truck, dan Koordinasi Ga-Ling')
  assert.equal(cocokkanNama('top up  gas', daftar), 'Top Up Gas')
  assert.equal(cocokkanNama('Pemeliharaan Mesin', daftar), null) // beda jauh: jangan ditebak
  assert.equal(cocokkanNama('Ofice', daftar), null) // nama pendek: tidak pakai toleransi ejaan
  assert.equal(cocokkanNama(null, daftar), null)
})
