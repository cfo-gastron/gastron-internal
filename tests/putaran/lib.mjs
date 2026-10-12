// Buka app gastron-internal di Chromium dengan Supabase tiruan, login sebagai user tertentu.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { FIXTURE, JAM_UJI } from './fixture.mjs'
import { createMock } from './mockdb.mjs'

export const REF = 'vybfhlpmtsdtegbrdsvo'
export const VIEWPORTS = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 844 } }
export const ROLE_USER = { cfo: 'U-cfo', ceo: 'U-ceo', coo: 'U-coo', cao: 'U-cao', finance: 'U-fin', operational: 'U-opr', procurement: 'U-prc' }

// Halaman yang dicek: [nama, path, role yang membuka]
export const PAGES = [
  ['dashboard', '/dashboard', 'cfo'],
  ['dashboard-pengaju', '/dashboard', 'operational'],
  ['form-baru', '/pengajuan/baru', 'operational'],
  ['detail-menunggu-cfo', '/pengajuan/P03', 'cfo'],
  ['detail-menunggu-review', '/pengajuan/P01', 'coo'],
  ['detail-menunggu-ceo', '/pengajuan/P06', 'ceo'],
  ['detail-transferred', '/pengajuan/P07', 'operational'],
  ['detail-revisi-pemilik', '/pengajuan/P11', 'operational'],
  ['detail-hold-pemilik', '/pengajuan/P12', 'procurement'],
  ['detail-ditolak', '/pengajuan/P13', 'cfo'],
  ['edit-revisi', '/pengajuan/P11/edit', 'operational'],
  ['lpj-baru', '/lpj/P07', 'operational'],
  ['lpj-menunggu-finance', '/lpj/P08', 'finance'],
  ['lpj-menunggu-cfo', '/lpj/P15', 'cfo'],
  ['lpj-closed', '/lpj/P14', 'cfo'],
  ['arsip', '/arsip', 'cfo'],
  ['mapping-kategori', '/mapping-kategori', 'cfo'],
]

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const out = (dir) => mkdirSync(dir, { recursive: true })

export async function launch() {
  return chromium.launch()
}

export async function openApp(browser, base, { role = 'cfo', path = '/dashboard', viewport = 'desktop', fixture = FIXTURE, theme = 'light' } = {}) {
  const me = ROLE_USER[role]
  const authUser = fixture.__authUsers[me]
  const exp = Math.floor(new Date(JAM_UJI).getTime() / 1000) + 86400 * 365
  const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: me, exp, role: 'authenticated' })}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: authUser }

  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport], serviceWorkers: 'block', colorScheme: theme, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  await ctx.clock.setFixedTime(new Date(JAM_UJI))
  await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v) } catch { /* */ } }, [`sb-${REF}-auth-token`, JSON.stringify(session)])
  const mock = createMock(fixture, { me })
  await ctx.route(`https://${REF}.supabase.co/**`, mock.handle)
  // /api/claude (saran AI) di-stub: jawaban dari fixture.__aiResponse
  await ctx.route('**/api/claude', (r) => !/^Bearer ey/.test(r.request().headers()['authorization'] || '')
    ? r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Harus login' }) })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: JSON.stringify(fixture.__aiResponse || { cat_id: 'd_off', cat_name: 'Office', subcat_id: 'd_off2', subcat_name: 'Perlengkapan Kantor' }) }] }) }))
  // /api/klasifikasi (tebak subkategori) di-stub dengan kata kunci; fixture.__klasifikasiGagal = server error
  mock.log.klasifikasi = []
  await ctx.route('**/api/klasifikasi', (r) => {
    const body = r.request().postDataJSON() || {}
    mock.log.klasifikasi.push({ ...body, auth: r.request().headers()['authorization'] || '' })
    if (fixture.__klasifikasiGagal) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'AI gagal (tes)' }) })
    const teks = `${body.judul} ${(body.items || []).join(' ')}`.toLowerCase()
    const sub = /ban|oli|truk/.test(teks) ? 'Pemeliharaan Kendaraan' : /kompresor|genset/.test(teks) ? 'Pemeliharaan Alat' : /atk|kertas/.test(teks) ? 'Perlengkapan Kantor' : null
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subkategori: sub, alasan: 'stub' }) })
  })
  // Semua host luar lain (font, CDN) diblokir supaya tes tidak bergantung internet
  await ctx.route((url) => !url.hostname.endsWith('localhost') && url.hostname !== '127.0.0.1' && !url.hostname.endsWith('supabase.co'), (r) => r.abort())

  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)) })
  const dialogs = []
  page.on('dialog', (dlg) => { dialogs.push(`${dlg.type()}: ${dlg.message().slice(0, 120)}`); dlg.accept().catch(() => {}) })

  await page.goto(base + path)
  await waitIdle(page)
  return { ctx, page, mock, errors, dialogs }
}

export async function waitIdle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('.loading-screen'), null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(250)
}
