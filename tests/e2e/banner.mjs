// Tes klik banner Hubungkan Telegram dengan Supabase tiruan (semua request ke *.supabase.co dicegat)
import { chromium } from 'playwright'

const APP = 'http://localhost:4310'
const REF = 'vybfhlpmtsdtegbrdsvo'
const USER_ID = 'ad9df176-9821-4cce-b5ee-90244f2bd909'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const ACCESS = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, exp, role: 'authenticated', aud: 'authenticated' })}.sig`
const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'budi@gastron.co.id', user_metadata: { full_name: 'Budi Santoso' }, app_metadata: { provider: 'google' } }
const session = { access_token: ACCESS, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user }

const results = []
const t = (name, ok, detail = '') => results.push({ name, ok, detail })

async function setup(browser, { linked = false, fnStatus = 200, viewport = { width: 390, height: 844 } } = {}) {
  const state = { linked, fnCalls: [] }
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' })
  await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [`sb-${REF}-auth-token`, JSON.stringify(session)])
  const errors = []
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url())
    const body = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) })
    if (url.pathname === '/auth/v1/user') return body(user)
    if (url.pathname === '/rest/v1/users') {
      const profile = { id: USER_ID, full_name: 'Budi Santoso', role: 'cfo', telegram_chat_id: state.linked ? 111 : null }
      return body((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile])
    }
    if (url.pathname === '/functions/v1/telegram-bot') {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      state.fnCalls.push({ auth: req.headers()['authorization'], body: req.postDataJSON() })
      return fnStatus === 200 ? body({ url: 'https://t.me/GastronNotifBot?start=TOKEN123' }) : body({ error: 'TELEGRAM_BOT_USERNAME belum di-set di Supabase secrets' }, fnStatus)
    }
    return body([])
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(APP + '/dashboard')
  await page.waitForSelector('text=Hi, Budi', { timeout: 10000 })
  return { ctx, page, state, errors }
}

const browser = await chromium.launch()

// A. Belum terhubung -> Hubungkan -> Buka Telegram -> balik ke app -> banner hilang
{
  const { ctx, page, state, errors } = await setup(browser)
  const banner = page.getByTestId('telegram-banner')
  t('A1 Banner muncul untuk user yang belum terhubung', await banner.isVisible())
  await page.screenshot({ path: '/home/claude/out/shot-hp-banner.png' })
  await page.getByRole('button', { name: 'Hubungkan Telegram' }).click()
  const link = page.getByRole('link', { name: 'Buka Telegram' })
  await link.waitFor({ timeout: 5000 })
  t('A2 Link Buka Telegram menuju bot dengan token', (await link.getAttribute('href')) === 'https://t.me/GastronNotifBot?start=TOKEN123')
  t('A3 Link dibuka di tab/app baru', (await link.getAttribute('target')) === '_blank')
  t('A4 Edge Function dipanggil dengan login user & action link', state.fnCalls.length === 1 && state.fnCalls[0].auth === `Bearer ${ACCESS}` && state.fnCalls[0].body?.action === 'link', JSON.stringify(state.fnCalls))
  t('A5 Teks berubah ke langkah berikutnya', await page.getByText('Buka Telegram, tekan Start, lalu kembali ke sini.').isVisible())
  await page.screenshot({ path: '/home/claude/out/shot-hp-langkah2.png' })
  state.linked = true // user tekan Start di bot
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await banner.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  t('A6 Kembali ke app -> banner hilang (profil di-refresh)', !(await banner.isVisible()))
  t('A7 Tidak ada error JavaScript', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// B. Edge Function error -> pesan jelas, tombol bisa dicoba lagi
{
  const { ctx, page } = await setup(browser, { fnStatus: 500 })
  await page.getByRole('button', { name: 'Hubungkan Telegram' }).click()
  const alert = page.getByRole('alert')
  await alert.waitFor({ timeout: 5000 })
  const text = await alert.textContent()
  t('B1 Error menampilkan pesan asli dari server', text.includes('TELEGRAM_BOT_USERNAME belum di-set'), text)
  t('B2 Tombol Hubungkan Telegram bisa diklik lagi', await page.getByRole('button', { name: 'Hubungkan Telegram' }).isEnabled())
  await ctx.close()
}

// C. Nanti -> banner hilang dan tetap hilang setelah reload (sesi yang sama)
{
  const { ctx, page } = await setup(browser)
  await page.getByRole('button', { name: 'Nanti' }).click()
  t('C1 Nanti menyembunyikan banner', !(await page.getByTestId('telegram-banner').isVisible()))
  await page.reload(); await page.waitForTimeout(3000); console.log('URL setelah reload:', page.url(), (await page.textContent('body')).slice(0,120)); await page.screenshot({ path: '/tmp/c.png' }); await page.waitForSelector('text=Hi, Budi')
  t('C2 Setelah reload tetap tersembunyi', !(await page.getByTestId('telegram-banner').isVisible()))
  await ctx.close()
}

// D. Sudah terhubung -> tidak ada banner
{
  const { ctx, page } = await setup(browser, { linked: true })
  t('D1 User yang sudah terhubung tidak melihat banner', !(await page.getByTestId('telegram-banner').isVisible()))
  await ctx.close()
}

// E. Tampilan desktop
{
  const { ctx, page } = await setup(browser, { viewport: { width: 1280, height: 800 } })
  await page.screenshot({ path: '/home/claude/out/shot-desktop-banner.png' })
  const box = await page.getByTestId('telegram-banner').boundingBox()
  t('E1 Banner tampil di desktop tanpa melebihi lebar konten', box && box.width < 1280 - 240, JSON.stringify(box))
  await ctx.close()
}

await browser.close()
results.forEach((r) => console.log((r.ok ? 'LULUS ' : 'GAGAL ') + r.name + (r.ok || !r.detail ? '' : '  [' + r.detail + ']')))
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} lulus`)
process.exit(fail ? 1 : 0)
