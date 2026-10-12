// Angka emas: semua angka di layar tiap halaman, baseline vs kandidat. Angka berubah wajib dijelaskan di log putaran.
// Usage: node numbers.mjs <baselineUrl> <kandidatUrl>
import { launch, openApp, PAGES } from './lib.mjs'

const [,, baseA, baseB] = process.argv
const b = await launch()

async function grab(base, path, role) {
  const s = await openApp(b, base, { role, path, viewport: 'desktop' })
  const nums = await s.page.evaluate(() => (document.body.innerText.match(/Rp\s?[\d.]+|\b\d[\d.]*\b/g) || []).map((x) => x.replace(/\s/g, '')))
  await s.ctx.close()
  return nums
}

let totalAngka = 0; const beda = []
for (const [name, path, role] of PAGES) {
  const [a, c] = await Promise.all([grab(baseA, path, role), grab(baseB, path, role)])
  totalAngka += c.length
  const count = (arr) => arr.reduce((m, x) => (m.set(x, (m.get(x) || 0) + 1), m), new Map())
  const ma = count(a); const mc = count(c)
  const hilang = [...ma].filter(([k, v]) => (mc.get(k) || 0) < v).map(([k]) => k)
  const baru = [...mc].filter(([k, v]) => (ma.get(k) || 0) < v).map(([k]) => k)
  if (hilang.length || baru.length) beda.push({ name, hilang, baru })
}
await b.close()
console.log(`angka di layar (kandidat): ${totalAngka} di ${PAGES.length} halaman`)
if (!beda.length) console.log('angka berubah: tidak ada')
for (const d of beda) console.log(`BERUBAH ${d.name}: hilang [${d.hilang.join(', ')}] baru [${d.baru.join(', ')}]`)
process.exit(0)
