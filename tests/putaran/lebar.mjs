// Cek "layar bisa digeser kanan-kiri" di HP: lebar halaman tidak boleh melebihi lebar layar.
// Usage: node lebar.mjs <baseUrl>   -> daftar halaman bermasalah + elemen penyebab. Exit 1 kalau ada.
import { launch, openApp, PAGES } from './lib.mjs'
const [,, base = 'http://localhost:4310'] = process.argv
const b = await launch()
let gagal = 0
for (const lebar of [320, 360, 390]) {
  for (const [nama, path, role] of PAGES) {
    const s = await openApp(b, base, { role, path, viewport: 'mobile' })
    // Pengaman CSS (overflow-x: clip) dimatikan supaya penyebab ASLI tetap ketahuan
    await s.page.addStyleTag({ content: 'html, body, #root { overflow-x: visible !important }' })
    await s.page.setViewportSize({ width: lebar, height: 800 })
    await s.page.waitForTimeout(700)
    const r = await s.page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      const pelaku = []
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect()
        const anakLebih = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)
        if (b.width && b.right > vw + 1 && !anakLebih && getComputedStyle(el).position !== 'fixed') {
          // ambil elemen paling dalam yang masih kelebihan (bukan anak dari pelaku lain)
          pelaku.push({ tag: el.tagName.toLowerCase(), teks: (el.innerText || el.value || el.getAttribute('placeholder') || '').trim().slice(0, 40), gaya: el.getAttribute('style')?.slice(0, 160), kanan: Math.round(b.right), lebar: Math.round(b.width) })
        }
      }
      return { vw, sw, pelaku: pelaku.slice(-4) }
    })
    if (r.sw > r.vw + 1) {
      gagal++
      console.log(`GESER  ${lebar}px  ${nama.padEnd(24)} lebar halaman ${r.sw} > layar ${r.vw}`)
      r.pelaku.forEach((p) => console.log(`         ${p.tag} kanan=${p.kanan} lebar=${p.lebar} "${p.teks}"  {${p.gaya || ''}}`))
    }
    await s.ctx.close()
  }
}
console.log(gagal ? `\n${gagal} halaman bisa digeser` : '\nSemua halaman pas di layar (320/360/390px)')
await b.close()
process.exit(gagal ? 1 : 0)
