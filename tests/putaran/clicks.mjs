// Klik semua tombol/link di semua halaman PAGES, tiap klik di halaman yang baru dibuka (data bersih).
// Lapor: error JS, gagal klik, tombol tanpa efek. Usage: node clicks.mjs <baseUrl> <desktop|mobile> [outJson]
import { writeFileSync } from 'node:fs'
import { launch, openApp, PAGES, waitIdle } from './lib.mjs'

const [,, base = 'http://localhost:4310', vp = 'desktop', outJson] = process.argv
const SEL = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], summary'

async function listTargets(page) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el, i) => {
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el)
    const visible = r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
    const label = (el.getAttribute('aria-label') || el.title || el.textContent || el.value || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    return { i, visible, disabled: el.disabled === true, tag: el.tagName.toLowerCase(), label, w: Math.round(r.width), h: Math.round(r.height) }
  }).filter((t) => t.visible), SEL)
}

async function snapshot(page, ctx) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    text: (() => { const h = document.body.innerHTML; let x = 0; for (let k = 0; k < h.length; k++) x = (x * 31 + h.charCodeAt(k)) | 0; return h.length + ':' + x })(),
    dom: document.querySelectorAll('*').length,
    inputs: [...document.querySelectorAll('input,select,textarea')].map((e) => e.type === 'checkbox' ? e.checked : e.value).join('|'),
  }))
}

async function worker(b, jobs, results) {
  for (const [name, path, role] of jobs) {
    const first = await openApp(b, base, { role, path, viewport: vp })
    const targets = await listTargets(first.page)
    await first.ctx.close()
    const pageRes = { name, path, role, total: targets.length, errors: [], gagalKlik: [], tanpaEfek: [], kecil: [] }
    for (const t of targets) {
      if (t.disabled) continue
      if (vp === 'mobile' && (t.w < 32 || t.h < 32) && t.tag !== 'input') pageRes.kecil.push(`${t.label || t.tag} (${t.w}x${t.h})`)
      const { page, ctx, mock, errors, dialogs } = await openApp(b, base, { role, path, viewport: vp })
      let popups = 0; let files = 0; let downloads = 0
      ctx.on('page', () => popups++)
      page.on('filechooser', () => files++)
      page.on('download', () => downloads++)
      const before = await snapshot(page)
      const w0 = mock.log.writes.length; const n0 = mock.log.notifs.length; const t0 = mock.log.tgLinks; const d0 = dialogs.length
      try {
        const el = page.locator(SEL).nth(t.i)
        await el.scrollIntoViewIfNeeded({ timeout: 2000 })
        await el.click({ timeout: 3000 })
        await page.waitForTimeout(500)
        await waitIdle(page)
        const after = await snapshot(page).catch(() => ({ url: 'navigasi', text: '', dom: 0, inputs: '' }))
        const effect = after.url !== before.url || after.text !== before.text || after.dom !== before.dom || after.inputs !== before.inputs ||
          mock.log.writes.length > w0 || mock.log.notifs.length > n0 || mock.log.tgLinks > t0 || dialogs.length > d0 || popups || files || downloads
        if (!effect) pageRes.tanpaEfek.push(t.label || t.tag)
      } catch (e) {
        pageRes.gagalKlik.push(`${t.label || t.tag}: ${e.message.split('\n')[0].slice(0, 90)}`)
      }
      if (errors.length) pageRes.errors.push(`${t.label}: ${errors.join(' | ').slice(0, 200)}`)
      await ctx.close()
    }
    results.push(pageRes)
  }
}

const b = await launch()
const results = []
const N = 4
const chunks = Array.from({ length: N }, (_, k) => PAGES.filter((_, i) => i % N === k))
await Promise.all(chunks.map((c) => worker(b, c, results)))
await b.close()

results.sort((a, b2) => PAGES.findIndex((p) => p[0] === a.name) - PAGES.findIndex((p) => p[0] === b2.name))
let totalClicks = 0
for (const r of results) {
  totalClicks += r.total
  const flags = [r.errors.length && `ERROR ${r.errors.length}`, r.gagalKlik.length && `GAGAL ${r.gagalKlik.length}`, r.tanpaEfek.length && `TANPA-EFEK ${r.tanpaEfek.length}`].filter(Boolean).join(' ')
  console.log(`${r.name.padEnd(24)} ${String(r.total).padStart(3)} tombol  ${flags || 'ok'}`)
  for (const x of r.errors) console.log('   error:', x)
  for (const x of r.gagalKlik) console.log('   gagal:', x)
  for (const x of r.tanpaEfek) console.log('   tanpa efek:', x)
  if (r.kecil.length) console.log('   target sentuh < 32px:', r.kecil.join(', '))
}
const errorCount = results.reduce((s, r) => s + r.errors.length, 0)
const gagal = results.reduce((s, r) => s + r.gagalKlik.length, 0)
const tanpa = results.reduce((s, r) => s + r.tanpaEfek.length, 0)
console.log(`\n${vp}: ${totalClicks} tombol diklik, ${errorCount} error, ${gagal} gagal klik, ${tanpa} tanpa efek`)
if (outJson) writeFileSync(outJson, JSON.stringify({ vp, totalClicks, errorCount, gagal, tanpa, results }, null, 1))
process.exit(errorCount || gagal ? 1 : 0)
