// Klik Approve di halaman Detail -> cek notif yang dikirim ke send-notif (Supabase tiruan)
import { chromium } from 'playwright'

const APP = 'http://localhost:4310'
const REF = 'vybfhlpmtsdtegbrdsvo'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400
const ROLE_IDS = { coo: 'U-coo', cao: 'U-cao', cfo: 'U-cfo', ceo: 'U-ceo', finance: 'U-fin' }
const results = []
const t = (name, ok, detail = '') => results.push({ name, ok, detail })

async function run(browser, { role, pengajuan }) {
  const me = ROLE_IDS[role]
  const user = { id: me, aud: 'authenticated', email: `${role}@g`, user_metadata: { full_name: role.toUpperCase() + ' Gastron' }, app_metadata: {} }
  const session = { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: me, exp })}.s`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)])
  const notifs = []; const patches = []; const errors = []
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const q = url.searchParams
    const accept = req.headers()['accept'] || ''
    const json = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(d) })
    if (req.method() === 'OPTIONS') return json({})
    if (url.pathname === '/auth/v1/user') return json(user)
    if (url.pathname === '/functions/v1/send-notif') { notifs.push(req.postDataJSON()); return json({ sent: 1, failed: 0, not_linked: 0 }) }
    if (url.pathname === '/rest/v1/users') {
      const roleIn = q.get('role')
      if (roleIn) { const roles = roleIn.replace(/^in\.\(|\)$/g, '').split(','); return json(roles.filter((r) => ROLE_IDS[r]).map((r) => ({ id: ROLE_IDS[r] }))) }
      const id = (q.get('id') || '').replace('eq.', '')
      if (id === 'U-pengaju') return json(accept.includes('object') ? { full_name: 'Budi Santoso' } : [{ full_name: 'Budi Santoso' }])
      const profile = { id: me, full_name: role.toUpperCase() + ' Gastron', role, telegram_chat_id: 1 }
      return json(accept.includes('object') ? profile : [profile])
    }
    if (url.pathname === '/rest/v1/pengajuan') {
      if (req.method() === 'PATCH') { patches.push(req.postDataJSON()); return json([], 200) }
      return json(accept.includes('object') ? pengajuan : [pengajuan])
    }
    if (req.method() === 'POST') return json([], 201)
    return json(accept.includes('object') ? null : [])
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${APP}/pengajuan/${pengajuan.id}`)
  const btn = page.getByRole('button', { name: /Approve/ }).first()
  await btn.waitFor({ timeout: 10000 })
  await btn.click()
  await page.waitForTimeout(1500)
  await ctx.close()
  return { notifs, patches, errors }
}

const base = { id: 'P1', judul: 'Ganti ban truk', kode_surat: 'GTR-OPR-007-X-2026', total_pengajuan: 2500000, submitted_by: 'U-pengaju', tipe: 'kebutuhan', subkategori: 'Pemeliharaan Kendaraan', created_at: '2026-10-11T01:00:00Z', submitted_at: '2026-10-11T01:00:00Z' }
const browser = await chromium.launch()

// 1. COO approve pengajuan OPR -> CFO dapat "Perlu approval kamu"
{
  const r = await run(browser, { role: 'coo', pengajuan: { ...base, division: 'OPR', status: 'submitted' } })
  const action = r.notifs.find((n) => n.title === '🔔 Perlu approval kamu')
  const info = r.notifs.find((n) => n.title !== '🔔 Perlu approval kamu')
  t('1a COO approve: status jadi approved_step1', r.patches[0]?.status === 'approved_step1', JSON.stringify(r.patches))
  t('1b CFO dapat "Perlu approval kamu"', JSON.stringify(action?.user_ids) === '["U-cfo"]', JSON.stringify(r.notifs))
  t('1c Isi pesan CFO lengkap (judul, nominal, divisi, kode, pengaju, tahap)', action?.body === '"Ganti ban truk"\nRp 2.500.000 · OPR · GTR-OPR-007-X-2026\nDari: Budi Santoso\nTahap: Menunggu CFO', action?.body)
  t('1d Tombol notif menuju halaman pengajuan', action?.url === '/pengajuan/P1')
  t('1e Yang lain dapat info, CFO tidak dobel', info && !info.user_ids.includes('U-cfo') && ['U-ceo', 'U-fin', 'U-pengaju'].every((id) => info.user_ids.includes(id)), JSON.stringify(info))
  t('1f Tidak ada error JavaScript', r.errors.length === 0, r.errors.join(' | '))
}

// 2. CFO approve (approved_step1) -> CEO dapat "Perlu approval kamu"
{
  const r = await run(browser, { role: 'cfo', pengajuan: { ...base, division: 'OPR', status: 'approved_step1' } })
  const action = r.notifs.find((n) => n.title === '🔔 Perlu approval kamu')
  t('2a CFO approve: status jadi approved_cfo', r.patches[0]?.status === 'approved_cfo')
  t('2b CEO dapat "Perlu approval kamu" dengan tahap Menunggu CEO', JSON.stringify(action?.user_ids) === '["U-ceo"]' && action.body.endsWith('Tahap: Menunggu CEO'), JSON.stringify(r.notifs))
}

// 3. Pengajuan FIN baru diapprove CFO -> langsung ke CEO
{
  const r = await run(browser, { role: 'cfo', pengajuan: { ...base, division: 'FIN', kode_surat: 'GTR-FIN-002-X-2026', status: 'submitted' } })
  const action = r.notifs.find((n) => n.title === '🔔 Perlu approval kamu')
  t('3a CFO approve FIN: lompat ke approved_cfo', r.patches[0]?.status === 'approved_cfo')
  t('3b CEO dapat "Perlu approval kamu"', JSON.stringify(action?.user_ids) === '["U-ceo"]', JSON.stringify(r.notifs))
}

await browser.close()
results.forEach((r) => console.log((r.ok ? 'LULUS ' : 'GAGAL ') + r.name + (r.ok || !r.detail ? '' : '  [' + r.detail + ']')))
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} lulus`)
process.exit(fail ? 1 : 0)
