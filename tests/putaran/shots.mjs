// Screenshot semua halaman di PAGES, desktop & HP (full page).
// Usage: node shots.mjs <baseUrl> <outDir>
import { launch, openApp, PAGES, out } from './lib.mjs'

const [,, base = 'http://localhost:4310', outDir = 'hasil/layar'] = process.argv
out(outDir)
const b = await launch()
const report = []
for (const vp of ['desktop', 'mobile']) {
  for (const [name, path, role] of PAGES) {
    const { page, ctx, errors } = await openApp(b, base, { role, path, viewport: vp })
    await page.screenshot({ path: `${outDir}/${vp}-${name}.png`, fullPage: true })
    // Scroll horizontal = layout bocor di HP
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    report.push({ vp, name, url: page.url().replace(base, ''), overflow, errors })
    await ctx.close()
  }
}
await b.close()
for (const r of report) console.log(`${r.vp.padEnd(7)} ${r.name.padEnd(24)} ${r.url.padEnd(22)} ${r.overflow > 1 ? 'GESER-HORIZONTAL ' + r.overflow + 'px ' : ''}${r.errors.length ? 'ERROR: ' + r.errors.join(' | ') : ''}`)
const bad = report.filter((r) => r.errors.length || r.overflow > 1)
console.log(`\nscreenshot: ${report.length}, bermasalah: ${bad.length}`)
process.exit(report.some((r) => r.errors.length) ? 1 : 0)
