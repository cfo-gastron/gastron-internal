// Tes khusus K1..Kn: satu tes per bug yang pernah difix / aturan kritis.
// ATURAN: tiap bug yang difix wajib jadi tes K baru di sini. Usage: node khusus.mjs <baseUrl>
import { launch, openApp, waitIdle } from './lib.mjs'
import { FIXTURE } from './fixture.mjs'

const [,, base = 'http://localhost:4310'] = process.argv
const hasil = []
const t = (nama, lulus, detail = '') => hasil.push({ nama, lulus: !!lulus, detail })
const b = await launch()
const ACTION = '🔔 Perlu approval kamu'

async function approve(role, path, { confirm = false } = {}) {
  const s = await openApp(b, base, { role, path })
  await s.page.getByRole('button', { name: /Approve/ }).first().click()
  if (confirm) await s.page.getByRole('button', { name: 'Sudah Ditransfer' }).click()
  await s.page.waitForTimeout(800); await waitIdle(s.page)
  return s
}
const patchesTo = (mock, table) => mock.log.writes.filter((w) => w.table === table && w.method === 'PATCH').map((w) => w.body)
const insertsTo = (mock, table) => mock.log.writes.filter((w) => w.table === table && w.method === 'POST').flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body]))

// K1. Final approve "Pembelian Aset" masuk cashflow sebagai CapEx > Pembelian Aset (dulu nyasar ke Opex Tak Terduga)
{
  const s = await approve('ceo', '/pengajuan/P06', { confirm: true })
  const cf = insertsTo(s.mock, 'cashflow_transactions')
  t('K1 Final approve Pembelian Aset -> cashflow d_capex1', cf.length === 1 && cf[0].subcat_id === 'd_capex1' && cf[0].amount === 185000000, JSON.stringify(cf))
  await s.ctx.close()
}

// K2. User yang belum terhubung melihat banner Hubungkan Telegram dan bisa minta link
{
  const s = await openApp(b, base, { role: 'operational', path: '/dashboard' })
  const btn = s.page.getByRole('button', { name: 'Hubungkan Telegram' })
  const ada = await btn.isVisible().catch(() => false)
  let link = null
  if (ada) { await btn.click(); link = await s.page.getByRole('link', { name: 'Buka Telegram' }).getAttribute('href', { timeout: 4000 }).catch(() => null) }
  t('K2 Banner Hubungkan Telegram -> link bot', ada && link === 'https://t.me/GastronInternalBot?start=TESTTOKEN', `banner=${ada} link=${link}`)
  await s.ctx.close()
}

// K3. COO approve pengajuan OPR -> CFO dapat "Perlu approval kamu" lengkap
{
  const s = await approve('coo', '/pengajuan/P01')
  const a = s.mock.log.notifs.find((n) => n.title === ACTION)
  t('K3 COO approve -> CFO dapat "Perlu approval kamu"', patchesTo(s.mock, 'pengajuan')[0]?.status === 'approved_step1' && JSON.stringify(a?.user_ids) === '["U-cfo"]' && a.body === '"Bensin & tol trip Subang"\nRp 850.000 · OPR · GTR-OPR-021-X-2026\nDari: Budi Santoso\nTahap: Menunggu CFO', JSON.stringify(s.mock.log.notifs))
  await s.ctx.close()
}

// K4. CFO approve -> CEO dapat "Perlu approval kamu"
{
  const s = await approve('cfo', '/pengajuan/P03')
  const a = s.mock.log.notifs.find((n) => n.title === ACTION)
  t('K4 CFO approve -> CEO dapat "Perlu approval kamu"', patchesTo(s.mock, 'pengajuan')[0]?.status === 'approved_cfo' && JSON.stringify(a?.user_ids) === '["U-ceo"]', JSON.stringify(s.mock.log.notifs))
  await s.ctx.close()
}

// K5. Pengajuan FIN: CFO approve tahap 1 langsung ke CEO
{
  const s = await approve('cfo', '/pengajuan/P05')
  const a = s.mock.log.notifs.find((n) => n.title === ACTION)
  t('K5 FIN: CFO approve -> approved_cfo + CEO dapat notif', patchesTo(s.mock, 'pengajuan')[0]?.status === 'approved_cfo' && JSON.stringify(a?.user_ids) === '["U-ceo"]', JSON.stringify(s.mock.log.notifs))
  await s.ctx.close()
}

// K6. Edit + Submit Ulang setelah revisi -> status submitted + COO dapat "Perlu approval kamu" (dulu tanpa notif)
{
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11/edit' })
  await s.page.getByRole('button', { name: 'Submit Ulang' }).click()
  await s.page.waitForTimeout(1000); await waitIdle(s.page)
  const a = s.mock.log.notifs.find((n) => n.title === ACTION)
  t('K6 Submit Ulang setelah revisi -> COO dapat notif', patchesTo(s.mock, 'pengajuan')[0]?.status === 'submitted' && JSON.stringify(a?.user_ids) === '["U-coo"]', JSON.stringify(s.mock.log.notifs))
  await s.ctx.close()
}

// K7. Tombol Approve hanya muncul untuk role yang berhak
{
  const cases = [['coo', '/pengajuan/P03', false], ['cfo', '/pengajuan/P03', true], ['operational', '/pengajuan/P03', false], ['cfo', '/pengajuan/P01', false], ['coo', '/pengajuan/P01', true], ['cao', '/pengajuan/P02', true], ['ceo', '/pengajuan/P06', true], ['cfo', '/pengajuan/P06', true], ['coo', '/pengajuan/P06', false], ['cfo', '/pengajuan/P07', false]]
  const salah = []
  for (const [role, path, harus] of cases) {
    const s = await openApp(b, base, { role, path })
    const ada = await s.page.getByRole('button', { name: /Approve/ }).first().isVisible().catch(() => false)
    if (ada !== harus) salah.push(`${role} ${path} ada=${ada}`)
    await s.ctx.close()
  }
  t('K7 Tombol Approve sesuai role & tahap (10 kasus)', salah.length === 0, salah.join(', '))
}

// K8. Final approve: konfirmasi "Belum" tidak mengubah apa pun
{
  const s = await openApp(b, base, { role: 'ceo', path: '/pengajuan/P06' })
  await s.page.getByRole('button', { name: /Approve/ }).first().click()
  await s.page.getByRole('button', { name: 'Belum' }).click()
  await s.page.waitForTimeout(500)
  t('K8 Final approve dibatalkan ("Belum") -> tidak ada perubahan', s.mock.log.writes.length === 0 && s.mock.log.notifs.length === 0, JSON.stringify(s.mock.log.writes))
  await s.ctx.close()
}

// K9. Finance approve LPJ -> CFO dapat "Perlu approval kamu" untuk LPJ
{
  const s = await approve('finance', '/lpj/P08')
  const a = s.mock.log.notifs.find((n) => n.title === ACTION)
  t('K9 Finance approve LPJ -> CFO dapat notif LPJ', patchesTo(s.mock, 'lpj')[0]?.status === 'approved_finance' && JSON.stringify(a?.user_ids) === '["U-cfo"]' && /^LPJ "Beli regulator tekanan"/.test(a.body), JSON.stringify(s.mock.log.notifs))
  await s.ctx.close()
}

// K10. CFO close LPJ -> status closed
{
  const s = await openApp(b, base, { role: 'cfo', path: '/lpj/P15' })
  await s.page.getByRole('button', { name: /Close LPJ/ }).click()
  const confirm = s.page.getByRole('button', { name: /Ya|Close|Konfirmasi/ }).last()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await s.page.waitForTimeout(800)
  t('K10 CFO close LPJ -> closed', patchesTo(s.mock, 'lpj')[0]?.status === 'closed', JSON.stringify(s.mock.log.writes))
  await s.ctx.close()
}

// K11. Dashboard: jumlah di kartu = jumlah baris di daftar (satu sumber angka)
{
  const s = await openApp(b, base, { role: 'cfo', path: '/dashboard' })
  const kartu = await s.page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => /^TOTAL$/i.test(d.textContent.trim())).map((d) => d.nextElementSibling?.textContent.trim())[0])
  const aktif = FIXTURE.pengajuan.filter((p) => !p.is_archived).length
  t('K11 Kartu Total Dashboard = pengajuan aktif (bukan arsip)', Number(kartu) === aktif, `kartu=${kartu} data=${aktif}`)
  await s.ctx.close()
}

const clone = (x) => JSON.parse(JSON.stringify(x))
// Isian judul: versi baru punya id, versi lama dikenali dari placeholder (supaya tes jalan di baseline)
const JUDUL = '#judul-pengajuan, input[placeholder^="Tulis konteks"], input[placeholder^="Contoh: Kebutuhan"]'

// ---------------- Putaran 1 ----------------
// K12. (Diubah 13 Okt, keputusan CFO) Dashboard TIDAK punya daftar "Perlu approval kamu";
//      yang menunggu dilihat lewat kartu "Menunggu ACC". Notif Telegram tetap.
{
  const salah = []
  for (const role of ['cfo', 'ceo', 'coo', 'finance', 'operational']) {
    const s = await openApp(b, base, { role, path: '/dashboard' })
    await s.page.waitForTimeout(600)
    const ada = await s.page.getByText('Perlu approval kamu').count().catch(() => 0)
    if (ada) salah.push(role)
    await s.ctx.close()
  }
  t('K12 Dashboard tanpa daftar "Perlu approval kamu"', salah.length === 0, salah.join(', '))
}

// K13. Klik kartu angka -> jumlah baris di daftar = angka di kartu (dulu "Menunggu ACC" 6 tapi daftar 3)
{
  const s = await openApp(b, base, { role: 'cfo', path: '/dashboard' })
  const salah = []
  for (const label of ['Menunggu ACC', 'Transferred', 'Ditolak / Hold']) {
    const kartu = s.page.getByText(label, { exact: true }).first().locator('..')
    const angka = Number((await kartu.innerText()).replace(/\D/g, ''))
    await kartu.click(); await s.page.waitForTimeout(200)
    const baris = await s.page.locator('tbody tr').count()
    if (angka !== baris) salah.push(`${label}: kartu ${angka}, daftar ${baris}`)
  }
  t('K13 Kartu angka = jumlah baris setelah diklik (3 kartu)', salah.length === 0, salah.join(' | '))
  await s.ctx.close()
}

// K14. Final approve saat pengajuan sudah diproses orang lain -> tidak ada cashflow, ada pesan
{
  const s = await openApp(b, base, { role: 'ceo', path: '/pengajuan/P06' })
  s.mock.db.pengajuan.find((p) => p.id === 'P06').status = 'approved_ceo' // CFO cadangan sudah approve duluan
  await s.page.getByRole('button', { name: /Approve/ }).first().click()
  await s.page.getByRole('button', { name: 'Sudah Ditransfer' }).click()
  await s.page.waitForTimeout(800)
  const pesan = await s.page.getByRole('alert').innerText().catch(() => '')
  t('K14 Approve bentrok -> tidak ada cashflow/notif, muncul pesan', insertsTo(s.mock, 'cashflow_transactions').length === 0 && s.mock.log.notifs.length === 0 && /sudah diproses/.test(pesan), `pesan="${pesan}" writes=${JSON.stringify(s.mock.log.writes.map((w) => w.method + ' ' + w.table))}`)
  await s.ctx.close()
}

// K15. Cashflow tidak pernah dobel untuk pengajuan yang sudah punya baris cashflow
{
  const fx = clone(FIXTURE)
  fx.cashflow_transactions.push({ id: 'CF-P06-lama', name: 'DP truk CNG unit 3', amount: 185000000, linked_id: 'P06', subcat_id: 'd_capex1' })
  const s = await openApp(b, base, { role: 'ceo', path: '/pengajuan/P06', fixture: fx })
  await s.page.getByRole('button', { name: /Approve/ }).first().click()
  await s.page.getByRole('button', { name: 'Sudah Ditransfer' }).click()
  await s.page.waitForTimeout(800)
  t('K15 Final approve dengan cashflow lama -> tidak insert baris kedua', insertsTo(s.mock, 'cashflow_transactions').length === 0 && patchesTo(s.mock, 'pengajuan')[0]?.status === 'approved_ceo', JSON.stringify(s.mock.log.writes))
  await s.ctx.close()
}

// K16. Final approve memakai mapping dari database (halaman Sinkronisasi), bukan hardcode
{
  const fx = clone(FIXTURE)
  Object.assign(fx.subkategori_pengajuan.find((x) => x.nama === 'Pembelian Aset'), { cashflow_cat_id: 'd_capex', cashflow_cat_name: 'CapEx', cashflow_subcat_id: 'd_capex9', cashflow_subcat_name: 'Kendaraan (uji DB)' })
  const s = await openApp(b, base, { role: 'ceo', path: '/pengajuan/P06', fixture: fx })
  await s.page.getByRole('button', { name: /Approve/ }).first().click()
  await s.page.getByRole('button', { name: 'Sudah Ditransfer' }).click()
  await s.page.waitForTimeout(800)
  const cf = insertsTo(s.mock, 'cashflow_transactions')
  t('K16 Final approve pakai mapping database', cf[0]?.subcat_id === 'd_capex9', JSON.stringify(cf))
  await s.ctx.close()
}

// K17. Halaman Ubah pengajuan hanya untuk pengaju & status Perlu Revisi/Ditahan
{
  const cases = [['operational', '/pengajuan/P11/edit', true], ['operational', '/pengajuan/P07/edit', false], ['procurement', '/pengajuan/P11/edit', false], ['cfo', '/pengajuan/P03/edit', false], ['procurement', '/pengajuan/P12/edit', true]]
  const salah = []
  for (const [role, path, harus] of cases) {
    const s = await openApp(b, base, { role, path })
    const ada = await s.page.getByRole('button', { name: /^(Submit Ulang|Simpan perubahan)$/ }).isVisible().catch(() => false)
    if (ada !== harus) salah.push(`${role} ${path} form=${ada}`)
    await s.ctx.close()
  }
  t('K17 Ubah pengajuan dijaga (5 kasus)', salah.length === 0, salah.join(', '))
}

// K18. Form LPJ hanya untuk pengaju/Finance/CFO, setelah transfer, dan bukan reimbursement/Trip
{
  const cases = [['operational', '/lpj/P07', true], ['cfo', '/lpj/P07', true], ['coo', '/lpj/P07', false], ['procurement', '/lpj/P07', false], ['operational', '/lpj/P09', false], ['operational', '/lpj/P10', false], ['cfo', '/lpj/P03', false]]
  const salah = []
  for (const [role, path, harus] of cases) {
    const s = await openApp(b, base, { role, path })
    const ada = await s.page.getByText('LPJ belum bisa dibuat').isVisible().catch(() => false)
    if (ada === harus) salah.push(`${role} ${path} formTampil=${!ada}`)
    await s.ctx.close()
  }
  t('K18 Form LPJ dijaga (7 kasus)', salah.length === 0, salah.join(', '))
}

// K19. Sisa dana LPJ: lebih bayar tampil "Kurang bayar", bukan "Sisa Dana" hijau
{
  const fx = clone(FIXTURE)
  fx.lpj.find((l) => l.id === 'LPJ-08').total_realisasi = 10300000
  const s1 = await openApp(b, base, { role: 'finance', path: '/lpj/P08', fixture: fx })
  const t1 = await s1.page.innerText('body'); await s1.ctx.close()
  const s2 = await openApp(b, base, { role: 'finance', path: '/lpj/P08' })
  const t2 = await s2.page.innerText('body'); await s2.ctx.close()
  t('K19 LPJ kurang bayar & sisa dikembalikan berlabel benar', /kurang bayar\s*rp 500\.000/i.test(t1) && /sisa dikembalikan\s*rp 350\.000/i.test(t2), `${t1.match(/(kurang bayar|sisa)[^\n]*\n[^\n]*/i)?.[0]} | ${t2.match(/sisa[^\n]*\n[^\n]*/i)?.[0]}`)
}

// K20. Kode surat gagal dibuat -> pengajuan tidak disimpan, pesan tampil (dulu pakai "001" cadangan, bisa dobel)
{
  const fx = clone(FIXTURE); fx.__failRpc = true
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/baru', fixture: fx })
  await s.page.locator(JUDUL).fill('Uji kode surat')
  await s.page.locator('input[placeholder="Nama item / uraian"]').fill('Oli kompresor')
  await s.page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await s.page.waitForTimeout(800)
  const teks = await s.page.innerText('body')
  t('K20 Kode surat gagal -> tidak tersimpan + pesan', insertsTo(s.mock, 'pengajuan').length === 0 && /Gagal membuat kode surat/.test(teks), JSON.stringify(insertsTo(s.mock, 'pengajuan')))
  await s.ctx.close()
}

// K21. Target sentuh tombol Kembali & hapus di HP >= 40px
{
  const salah = []
  for (const [role, path] of [['operational', '/pengajuan/baru'], ['cfo', '/pengajuan/P03'], ['operational', '/pengajuan/P11/edit'], ['cfo', '/lpj/P15'], ['cfo', '/arsip']]) {
    const s = await openApp(b, base, { role, path, viewport: 'mobile' })
    const boxes = await s.page.locator('button[aria-label="Kembali"], button[aria-label^="Hapus"]').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]))
    if (boxes.length === 0) salah.push(`${path}: tidak ada tombol Kembali berlabel`)
    for (const [l, w, h] of boxes) if (w < 40 || h < 40) salah.push(`${path} ${l} ${w}x${h}`)
    await s.ctx.close()
  }
  t('K21 Tombol Kembali/Hapus di HP >= 40px & berlabel', salah.length === 0, salah.join(', '))
}

// K22. Saran AI di Sinkronisasi hanya diterima kalau ada di daftar kategori (AI bisa mengarang id)
{
  const salah = []
  for (const [resp, harusDiterima] of [[{ cat_id: 'd_off', cat_name: 'Office', subcat_id: 'd_off2', subcat_name: 'Perlengkapan Kantor' }, true], [{ cat_id: 'd_konsumsi', cat_name: 'Konsumsi', subcat_id: 'd_konsumsi1', subcat_name: 'Makan rapat' }, false]]) {
    const fx = clone(FIXTURE); fx.__aiResponse = resp
    const s = await openApp(b, base, { role: 'cfo', path: '/mapping-kategori', fixture: fx })
    await s.page.getByRole('button', { name: /Saran AI/ }).first().click()
    await s.page.waitForTimeout(600)
    const tampil = await s.page.getByText(`Saran: ${resp.cat_name}`).isVisible().catch(() => false)
    const ditolak = s.dialogs.some((d) => /tidak ada di daftar/.test(d))
    if (tampil !== harusDiterima || ditolak === harusDiterima) salah.push(`${resp.subcat_id}: tampil=${tampil} ditolak=${ditolak}`)
    await s.ctx.close()
  }
  t('K22 Saran AI hanya diterima kalau ada di daftar kategori', salah.length === 0, salah.join(', '))
}

// ---------------- Subkategori otomatis (11 Okt) ----------------
async function isiForm(page, judul, item) {
  await page.locator(JUDUL).fill(judul)
  await page.locator('input[placeholder="Nama item / uraian"]').fill(item)
}

// K23. Form tanpa pilihan subkategori; terdeteksi otomatis dari judul & item; tersimpan; master tidak bertambah
{
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/baru' })
  const adaPilihan = await s.page.locator('select option', { hasText: 'Pilih subkategori' }).count()
  await isiForm(s.page, 'Ganti ban truk B 9123 KZ', 'Ban depan kiri')
  const box = s.page.getByTestId('subkategori-otomatis')
  await box.getByText('Pemeliharaan Kendaraan').waitFor({ timeout: 5000 }).catch(() => {})
  const tampil = await box.innerText({ timeout: 3000 }).catch(() => '')
  await s.page.getByRole('button', { name: 'Submit Pengajuan' }).click()
  await s.page.waitForTimeout(1200)
  const ins = insertsTo(s.mock, 'pengajuan')
  const master = s.mock.log.writes.filter((w) => w.table === 'subkategori_pengajuan')
  const authOk = s.mock.log.klasifikasi.every((k) => k.auth.startsWith('Bearer ey'))
  t('K23 Subkategori otomatis: tanpa pilihan, terdeteksi, tersimpan, master tetap', adaPilihan === 0 && /Terdeteksi: Pemeliharaan Kendaraan/.test(tampil) && ins[0]?.subkategori === 'Pemeliharaan Kendaraan' && master.length === 0 && authOk,
    `pilihan=${adaPilihan} tampil="${tampil.replace(/\n/g, ' ')}" simpan=${ins[0]?.subkategori} master=${master.length} auth=${authOk}`)
  await s.ctx.close()
}

// K24. Judul tidak jelas / AI gagal -> tetap bisa kirim, tersimpan "Belum dikategorikan"
{
  const salah = []
  for (const [nama, fx, judul] of [['tidak yakin', clone(FIXTURE), 'Keperluan bulan ini'], ['AI gagal', Object.assign(clone(FIXTURE), { __klasifikasiGagal: true }), 'Ganti ban truk']]) {
    const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/baru', fixture: fx })
    await isiForm(s.page, judul, 'Barang')
    await s.page.waitForTimeout(1200)
    const tampil = await s.page.getByTestId('subkategori-otomatis').innerText({ timeout: 3000 }).catch(() => '')
    await s.page.getByRole('button', { name: 'Submit Pengajuan' }).click()
    await s.page.waitForTimeout(1200)
    const sub = insertsTo(s.mock, 'pengajuan')[0]?.subkategori
    if (sub !== 'Belum dikategorikan' || !/Belum (terdeteksi|bisa dideteksi)/.test(tampil)) salah.push(`${nama}: tampil="${tampil.replace(/\n/g, ' ')}" simpan=${sub}`)
    await s.ctx.close()
  }
  t('K24 Tidak yakin / AI gagal -> tetap terkirim sebagai "Belum dikategorikan"', salah.length === 0, salah.join(' | '))
}

// K25. "Ubah subkategori" hanya untuk CFO/Finance sebelum ditransfer; simpan mengubah pengajuan
{
  const cases = [['cfo', '/pengajuan/P03', true], ['finance', '/pengajuan/P01', true], ['coo', '/pengajuan/P01', false], ['operational', '/pengajuan/P11', false], ['cfo', '/pengajuan/P07', false], ['ceo', '/pengajuan/P06', false]]
  const salah = []
  for (const [role, path, harus] of cases) {
    const s = await openApp(b, base, { role, path })
    const ada = await s.page.getByRole('button', { name: 'Ubah subkategori' }).isVisible().catch(() => false)
    if (ada !== harus) salah.push(`${role} ${path} tombol=${ada}`)
    await s.ctx.close()
  }
  const s = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P03' })
  await s.page.getByRole('button', { name: 'Ubah subkategori' }).click({ timeout: 3000 }).catch(() => {})
  await s.page.getByLabel('Pilih subkategori').selectOption('Pembelian Alat', { timeout: 3000 }).catch(() => {})
  await s.page.getByRole('button', { name: 'Simpan subkategori' }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(600)
  const p = patchesTo(s.mock, 'pengajuan')[0]
  const tampil = await s.page.getByTestId('subkategori-detail').innerText({ timeout: 3000 }).catch(() => '')
  await s.ctx.close()
  t('K25 Ubah subkategori: hak akses (6 kasus) + tersimpan & tampil', salah.length === 0 && p?.subkategori === 'Pembelian Alat' && /Pembelian Alat/.test(tampil), salah.join(', ') + ` patch=${JSON.stringify(p)}`)
}

// K26. Ubah pengajuan: judul & item tidak diubah -> subkategori lama dipertahankan (koreksi CFO tidak tertimpa);
//      judul diubah -> ditebak ulang
{
  const fx = clone(FIXTURE)
  fx.pengajuan.find((p) => p.id === 'P11').subkategori = 'Perlengkapan Kantor' // anggap sudah dikoreksi CFO
  const s1 = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11/edit', fixture: fx })
  await s1.page.waitForTimeout(1200)
  await s1.page.getByRole('button', { name: 'Submit Ulang' }).click()
  await s1.page.waitForTimeout(1000)
  const tetap = patchesTo(s1.mock, 'pengajuan')[0]?.subkategori
  const panggil1 = s1.mock.log.klasifikasi.length
  await s1.ctx.close()
  const s2 = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11/edit', fixture: fx })
  await s2.page.locator(JUDUL).fill('Ganti oli truk')
  await s2.page.waitForTimeout(1300)
  await s2.page.getByRole('button', { name: 'Submit Ulang' }).click()
  await s2.page.waitForTimeout(1000)
  const baru = patchesTo(s2.mock, 'pengajuan')[0]?.subkategori
  await s2.ctx.close()
  t('K26 Ubah pengajuan: subkategori lama dipertahankan, ditebak ulang kalau judul berubah', tetap === 'Perlengkapan Kantor' && panggil1 === 0 && baru === 'Pemeliharaan Kendaraan', `tetap=${tetap} panggil=${panggil1} baru=${baru}`)
}

// K27. Surat PDF: logo & tanda tangan tidak gepeng (bentuk di PDF = bentuk asli gambar); nama file tanpa tanggal
{
  const s = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P06' })
  const [dl] = await Promise.all([s.page.waitForEvent('download', { timeout: 15000 }), s.page.getByRole('button', { name: /Download Surat/ }).click()])
  const file = await dl.path()
  const pdf = (await import('node:fs')).readFileSync(file, 'latin1')
  const nama = dl.suggestedFilename()
  // ukuran asli tiap gambar (/Width /Height) dan ukuran digambar (w 0 0 h x y cm /Ix Do)
  const asli = {}
  for (const m of pdf.matchAll(/\/Width (\d+)[\s\S]{0,200}?\/Height (\d+)/g)) asli[Object.keys(asli).length] = Number(m[1]) / Number(m[2])
  const rasioAsli = Object.values(asli)
  const digambar = [...pdf.matchAll(/([\d.]+) 0 0 ([\d.]+) [\d.-]+ [\d.-]+ cm\s*\/I(\d+) Do/g)].map((m) => ({ r: Number(m[1]) / Number(m[2]), i: Number(m[3]) }))
  const salah = digambar.filter((g) => !rasioAsli.some((r) => Math.abs(r - g.r) / r < 0.02))
  t('K27 Surat PDF: logo & TTD sesuai bentuk asli, nama file tanpa tanggal', digambar.length >= 2 && salah.length === 0 && nama === 'Surat_GTR-OPR-017-X-2026.pdf',
    `nama=${nama} asli=${rasioAsli.map((r) => r.toFixed(2))} digambar=${digambar.map((g) => g.r.toFixed(2))}`)
  ;(await import('node:fs')).copyFileSync(file, '/tmp/surat-uji.pdf')
  await s.ctx.close()
}

// ---------------- Putaran 3 (12 Okt) ----------------
const BATAL = /Batalkan approval saya/
async function bukaBatal(s) { await s.page.getByRole('button', { name: BATAL }).click({ timeout: 3000 }).catch(() => {}) }

// K28. CFO batalkan approval-nya: alasan wajib; status kembali ke Menunggu CFO; tercatat; CEO diberi tahu
{
  const s = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P06' })
  await bukaBatal(s)
  await s.page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(300)
  const tanpaAlasan = s.mock.log.writes.length === 0 && await s.page.getByText('Tulis alasannya dulu').isVisible().catch(() => false)
  await s.page.locator('#alasan-batal').fill('Nominal perlu dicek ulang dengan vendor', { timeout: 3000 }).catch(() => {})
  await s.page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(900)
  const p = patchesTo(s.mock, 'pengajuan')[0]
  const log = insertsTo(s.mock, 'approval_logs')[0]
  const info = s.mock.log.notifs.find((n) => /dibatalkan/.test(n.title))
  const timeline = await s.page.innerText('body')
  t('K28 CFO batalkan approval: alasan wajib, kembali Menunggu CFO, tercatat, CEO diberi tahu',
    tanpaAlasan && p?.status === 'approved_step1' && p.cfo_approved_by === null && p.approved_cfo_at === null && log?.action === 'approval_dibatalkan' && info?.user_ids.includes('U-ceo') && /Approval dibatalkan/.test(timeline),
    `tanpaAlasan=${tanpaAlasan} patch=${JSON.stringify(p)} log=${log?.action} notif=${JSON.stringify(s.mock.log.notifs.map((n) => n.title + ':' + n.user_ids))}`)
  await s.ctx.close()
}

// K29. Tombol batal hanya untuk yang approve tahap terakhir, selama tahap berikutnya belum bertindak
{
  const cases = [['cfo', '/pengajuan/P06', true], ['coo', '/pengajuan/P03', true], ['cao', '/pengajuan/P04', true], ['ceo', '/pengajuan/P06', false], ['coo', '/pengajuan/P06', false], ['cfo', '/pengajuan/P03', false], ['cfo', '/pengajuan/P07', false], ['ceo', '/pengajuan/P07', false], ['operational', '/pengajuan/P03', false]]
  const salah = []
  for (const [role, path, harus] of cases) {
    const s = await openApp(b, base, { role, path })
    const ada = await s.page.getByRole('button', { name: BATAL }).isVisible().catch(() => false)
    if (ada !== harus) salah.push(`${role} ${path} tombol=${ada}`)
    await s.ctx.close()
  }
  t('K29 Tombol batal approval sesuai hak (9 kasus)', salah.length === 0, salah.join(', '))
}

// K30. COO batal -> kembali Menunggu Review; FIN (CFO approve sekaligus 2 tahap) batal -> kembali ke awal
{
  const s1 = await openApp(b, base, { role: 'coo', path: '/pengajuan/P03' })
  await bukaBatal(s1); await s1.page.locator('#alasan-batal').fill('Salah klik', { timeout: 3000 }).catch(() => {}); await s1.page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click({ timeout: 3000 }).catch(() => {}); await s1.page.waitForTimeout(800)
  const p1 = patchesTo(s1.mock, 'pengajuan')[0]; await s1.ctx.close()
  const fx = clone(FIXTURE)
  Object.assign(fx.pengajuan.find((p) => p.id === 'P05'), { status: 'approved_cfo', step1_approved_by: 'U-cfo', cfo_approved_by: 'U-cfo', approved_step1_at: '2026-10-11T02:00:00Z', approved_cfo_at: '2026-10-11T02:00:00Z' })
  const s2 = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P05', fixture: fx })
  await bukaBatal(s2); await s2.page.locator('#alasan-batal').fill('Perlu cek ulang', { timeout: 3000 }).catch(() => {}); await s2.page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click({ timeout: 3000 }).catch(() => {}); await s2.page.waitForTimeout(800)
  const p2 = patchesTo(s2.mock, 'pengajuan')[0]; await s2.ctx.close()
  t('K30 Batal COO -> Menunggu Review; batal FIN -> kembali ke awal', p1?.status === 'submitted' && p1.step1_approved_by === null && p2?.status === 'submitted' && p2.step1_approved_by === null && p2.cfo_approved_by === null, `${JSON.stringify(p1)} | ${JSON.stringify(p2)}`)
}

// K31. Batal bentrok: CEO sudah final approve duluan -> tidak ada perubahan, ada pesan
{
  const s = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P06' })
  await bukaBatal(s)
  s.mock.db.pengajuan.find((p) => p.id === 'P06').status = 'approved_ceo'
  await s.page.locator('#alasan-batal').fill('Cek ulang', { timeout: 3000 }).catch(() => {}); await s.page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click({ timeout: 3000 }).catch(() => {}); await s.page.waitForTimeout(800)
  const pesan = await s.page.getByRole('alert').first().innerText().catch(() => '')
  t('K31 Batal bentrok dengan final approve -> tidak ada log/notif, ada pesan', insertsTo(s.mock, 'approval_logs').length === 0 && s.mock.log.notifs.length === 0 && /tahap berikutnya sudah memproses/.test(pesan), `pesan="${pesan}"`)
  await s.ctx.close()
}

// K32. Surat setelah approval dibatalkan: TTD CFO tidak tampil walau log approve lamanya masih ada
{
  const fx = clone(FIXTURE)
  Object.assign(fx.pengajuan.find((p) => p.id === 'P06'), { status: 'approved_step1', cfo_approved_by: null, approved_cfo_at: null })
  const s = await openApp(b, base, { role: 'coo', path: '/pengajuan/P06', fixture: fx })
  const dl = await Promise.all([s.page.waitForEvent('download', { timeout: 15000 }), s.page.getByRole('button', { name: /Download Surat/ }).click()]).then(([d]) => d).catch(() => null)
  const pdf = dl ? (await import('node:fs')).readFileSync(await dl.path(), 'latin1') : ''
  const gambar = dl ? [...pdf.matchAll(/cm\s*\/I(\d+) Do/g)].length : -1
  t('K32 Surat setelah batal: hanya logo + TTD COO (TTD CFO hilang)', gambar === 2, `jumlah gambar digambar=${gambar}`)
  await s.ctx.close()
}

// K33. Rekening tujuan: urutan Atas Nama Rekening, Bank, Nomor Rekening, Pihak yang Dibayar; pihak kosong = atas nama
{
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/baru' })
  const labels = await s.page.getByTestId('rekening-tujuan').locator('label').allInnerTexts().catch(() => [])
  await s.page.locator(JUDUL).fill('Ganti ban truk GTM')
  await s.page.locator('input[placeholder="Nama item / uraian"]').fill('Ban')
  await s.page.locator('#rek-0-atas_nama').fill('Yusronudin', { timeout: 3000 }).catch(() => {})
  await s.page.locator('#rek-0-bank').fill('BCA', { timeout: 3000 }).catch(() => {})
  await s.page.locator('#rek-0-no_rekening').fill('1234567890', { timeout: 3000 }).catch(() => {})
  await s.page.getByRole('button', { name: 'Submit Pengajuan' }).click(); await s.page.waitForTimeout(1200)
  const rek = insertsTo(s.mock, 'pengajuan_penerima')[0]
  await s.ctx.close()
  const d = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P03' })
  const detail = await d.page.innerText('body'); await d.ctx.close()
  const urut = ['ATAS NAMA REKENING', 'BANK', 'NOMOR REKENING', 'PIHAK YANG DIBAYAR']
  const posDetail = urut.map((u) => detail.toUpperCase().indexOf(u))
  t('K33 Rekening: urutan & label baru, pihak kosong = atas nama, baris tidak terbuang', JSON.stringify(labels.map((l) => l.toUpperCase())) === JSON.stringify(urut) && rek?.nama_penerima === 'Yusronudin' && rek?.no_rekening === '1234567890' && posDetail.every((x, i) => x > 0 && (i === 0 || x > posDetail[i - 1])),
    `labels=${labels} rek=${JSON.stringify(rek)} detail=${posDetail}`)
}

// K34. Arahan judul tanpa kandang/peternakan, sama di Buat & Ubah
{
  const teks = []
  for (const [role, path] of [['operational', '/pengajuan/baru'], ['operational', '/pengajuan/P11/edit']]) {
    const s = await openApp(b, base, { role, path })
    teks.push((await s.page.innerText('body')) + ' ' + (await s.page.locator(JUDUL).first().getAttribute('placeholder', { timeout: 3000 }).catch(() => '')))
    await s.ctx.close()
  }
  const ada = teks.map((x) => /kandang|ternak/i.test(x))
  t('K34 Form Buat & Ubah tanpa contoh kandang, arahan judul sama', !ada[0] && !ada[1] && teks.every((x) => x.includes('Contoh: Servis kompresor GTM 03') && x.includes('Pemasangan PRS di PT ABC')), `kandang=${ada}`)
}

// K35. Logo & nama app sama di semua halaman (ikon tanpa tulisan, satu warna), desktop & HP
{
  const salah = []
  for (const vp of ['desktop', 'mobile']) for (const [name, path, role] of [['dashboard', '/dashboard', 'cfo'], ['detail', '/pengajuan/P03', 'cfo'], ['lpj', '/lpj/P15', 'cfo'], ['arsip', '/arsip', 'cfo']]) {
    const s = await openApp(b, base, { role, path, viewport: vp })
    const r = await s.page.evaluate(() => ({
      lama: document.querySelectorAll('img[src="/logo-gastron.png"]').length,
      baru: document.querySelectorAll('img[src="/logo-mark.png"]').length,
      warna: [...document.querySelectorAll('div,span')].filter((e) => e.childElementCount === 0 && e.textContent.trim() === 'Gastron').map((e) => getComputedStyle(e).color),
      pecah: document.body.innerHTML.includes('>G</span>astron'),
    }))
    if (r.lama || r.baru !== 1 || r.pecah || !r.warna.length || r.warna.some((w) => w !== 'rgb(192, 39, 45)')) salah.push(`${vp} ${name}: ${JSON.stringify(r)}`)
    await s.ctx.close()
  }
  t('K35 Logo & nama app konsisten di 4 halaman x desktop/HP', salah.length === 0, salah.join(' | '))
}

// ---------------- Putaran 4 (12 Okt): Ditahan & Revisi kembali ke tahap peminta ----------------
// K36. CFO melanjutkan pengajuan yang ia tahan -> kembali ke Menunggu CFO; tercatat; pengaju diberi tahu
{
  const s = await openApp(b, base, { role: 'cfo', path: '/pengajuan/P12' })
  const berikut = await s.page.getByTestId('langkah-berikutnya').innerText().catch(() => '')
  await s.page.getByRole('button', { name: /Lanjutkan pengajuan/ }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(900)
  const p = patchesTo(s.mock, 'pengajuan')[0]
  const log = insertsTo(s.mock, 'approval_logs')[0]
  const info = s.mock.log.notifs.find((n) => /dilanjutkan/.test(n.title))
  t('K36 CFO lanjutkan tahanan -> Menunggu CFO, tercatat, pengaju diberi tahu',
    /Menunggu CFO melanjutkan/.test(berikut) && p?.status === 'approved_step1' && p.rejection_type === null && log?.action === 'dilanjutkan' && info?.user_ids.includes('U-prc'),
    `berikut="${berikut}" patch=${JSON.stringify(p)} log=${log?.action} notif=${JSON.stringify(s.mock.log.notifs.map((n) => n.title))}`)
  await s.ctx.close()
}

// K37. Hak "Lanjutkan": hanya approver tahap tempat ditahan; pengaju lihat info + Ubah pengajuan, tanpa Release Hold
{
  const cases = [['cfo', true], ['cao', false], ['ceo', false], ['coo', false], ['procurement', false], ['finance', false]]
  const salah = []
  for (const [role, harus] of cases) {
    const s = await openApp(b, base, { role, path: '/pengajuan/P12' })
    const ada = await s.page.getByRole('button', { name: /Lanjutkan pengajuan/ }).isVisible().catch(() => false)
    if (ada !== harus) salah.push(`${role} lanjutkan=${ada}`)
    if (role === 'procurement') {
      const info = await s.page.getByTestId('info-ditahan').innerText().catch(() => '')
      const halaman = await s.page.innerText('body')
      const berikut = await s.page.getByTestId('langkah-berikutnya').innerText().catch(() => '')
      const release = await s.page.getByText(/Release Hold/).count()
      if (!/masih bisa mengubah/.test(info) || !/Tunggu cashflow minggu depan/.test(halaman) || !/Menunggu CFO melanjutkan/.test(berikut) || release) salah.push(`pengaju info="${info.replace(/\n/g, ' ')}" berikut="${berikut}" release=${release}`)
      if (!(await s.page.getByRole('button', { name: /Ubah pengajuan/ }).isVisible().catch(() => false))) salah.push('pengaju tanpa tombol Ubah')
    }
    await s.ctx.close()
  }
  t('K37 Lanjutkan hanya untuk approver tahap yang menahan; pengaju lihat info & Ubah (6 role)', salah.length === 0, salah.join(' | '))
}

// K38. Pengaju mengubah pengajuan yang ditahan -> isi tersimpan, status tetap Ditahan, alasan tahan tetap
{
  const s = await openApp(b, base, { role: 'procurement', path: '/pengajuan/P12/edit' })
  await s.page.locator(JUDUL).first().fill('Sewa forklift 3 hari', { timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(900)
  await s.page.getByRole('button', { name: /Simpan perubahan/ }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(1000)
  const p = patchesTo(s.mock, 'pengajuan')[0]
  t('K38 Ubah saat ditahan -> tetap Ditahan, alasan tidak hilang', p?.status === 'hold' && p.judul === 'Sewa forklift 3 hari' && !('rejection_reason' in p), JSON.stringify(p))
  await s.ctx.close()
}

// K39. Revisi diminta di tahap CFO -> dikirim ulang (langsung / lewat Ubah) kembali ke Menunggu CFO, CFO dapat "Perlu approval"
{
  const fx = clone(FIXTURE)
  Object.assign(fx.pengajuan.find((p) => p.id === 'P11'), { step1_approved_by: 'U-coo', approved_step1_at: '2026-10-10T03:00:00Z' })
  const salah = []
  const s1 = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11', fixture: fx })
  await s1.page.getByRole('button', { name: /Ajukan Ulang/ }).click({ timeout: 3000 }).catch(() => {})
  await s1.page.waitForTimeout(900)
  const p1 = patchesTo(s1.mock, 'pengajuan')[0]; const a1 = s1.mock.log.notifs.find((n) => n.title === ACTION)
  if (p1?.status !== 'approved_step1' || JSON.stringify(a1?.user_ids) !== '["U-cfo"]') salah.push(`langsung: ${JSON.stringify(p1)} notif=${JSON.stringify(a1?.user_ids)}`)
  await s1.ctx.close()
  const s2 = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11/edit', fixture: fx })
  await s2.page.waitForTimeout(900)
  await s2.page.getByRole('button', { name: 'Submit Ulang' }).click({ timeout: 3000 }).catch(() => {})
  await s2.page.waitForTimeout(1000)
  const p2 = patchesTo(s2.mock, 'pengajuan')[0]
  if (p2?.status !== 'approved_step1' || p2.rejection_type !== null) salah.push(`lewat Ubah: ${JSON.stringify(p2)}`)
  await s2.ctx.close()
  t('K39 Kirim ulang setelah revisi kembali ke tahap peminta (langsung & lewat Ubah)', salah.length === 0, salah.join(' | '))
}

// K40. "Berikutnya:" di Detail menjelaskan siapa yang harus bertindak, di semua status
{
  const harap = [['P01', 'Menunggu COO menyetujui'], ['P02', 'Menunggu CAO menyetujui'], ['P05', 'Menunggu CFO menyetujui'], ['P03', 'Menunggu CFO menyetujui'], ['P06', 'Menunggu CEO final approve'], ['P12', 'Menunggu CFO melanjutkan'], ['P11', 'Menunggu pengaju mengubah'], ['P13', 'Selesai: ditolak'], ['P07', 'pengaju membuat LPJ'], ['P09', 'Selesai: dana sudah ditransfer']]
  const salah = []
  for (const [id, teks] of harap) {
    const s = await openApp(b, base, { role: 'cfo', path: `/pengajuan/${id}` })
    const isi = await s.page.getByTestId('langkah-berikutnya').innerText().catch(() => '')
    if (!isi.includes(teks)) salah.push(`${id}: "${isi}"`)
    await s.ctx.close()
  }
  t('K40 "Berikutnya:" benar di 10 status/divisi', salah.length === 0, salah.join(' | '))
}

// K41. Surat: kolom approver sisa siklus lama tidak memunculkan TTD (status kembali Menunggu Review)
{
  const fx = clone(FIXTURE)
  Object.assign(fx.pengajuan.find((p) => p.id === 'P01'), { step1_approved_by: 'U-coo', approved_step1_at: '2026-10-09T03:00:00Z' })
  const s = await openApp(b, base, { role: 'coo', path: '/pengajuan/P01', fixture: fx })
  const dl = await Promise.all([s.page.waitForEvent('download', { timeout: 15000 }), s.page.getByRole('button', { name: /Download Surat/ }).click()]).then(([d]) => d).catch(() => null)
  const pdf = dl ? (await import('node:fs')).readFileSync(await dl.path(), 'latin1') : ''
  const gambar = dl ? [...pdf.matchAll(/cm\s*\/I(\d+) Do/g)].length : -1
  t('K41 Surat Menunggu Review dengan kolom approver sisa -> hanya logo (tanpa TTD)', gambar === 1, `gambar=${gambar}`)
  await s.ctx.close()
}

// K42. Ubah/kirim ulang pengajuan tidak menghilangkan item & rekening (bug: item hilang setiap revisi)
{
  const salah = []
  for (const [role, id, tombol] of [['operational', 'P11', 'Submit Ulang'], ['procurement', 'P12', /Simpan perubahan/]]) {
    const fx = clone(FIXTURE)
    const awalItem = fx.pengajuan_items.filter((r) => r.pengajuan_id === id).length
    const awalRek = fx.pengajuan_penerima.filter((r) => r.pengajuan_id === id).length
    const s = await openApp(b, base, { role, path: `/pengajuan/${id}/edit`, fixture: fx })
    await s.page.waitForTimeout(900)
    await s.page.getByRole('button', { name: tombol }).click({ timeout: 3000 }).catch(() => {})
    await s.page.waitForTimeout(1200)
    const item = s.mock.db.pengajuan_items.filter((r) => r.pengajuan_id === id)
    const rek = s.mock.db.pengajuan_penerima.filter((r) => r.pengajuan_id === id).length
    const total = s.mock.db.pengajuan.find((p) => p.id === id).total_pengajuan
    const jml = item.reduce((a, r) => a + Number(r.jumlah), 0)
    if (item.length !== awalItem || rek !== awalRek || jml !== total) salah.push(`${id}: item ${awalItem}->${item.length}, rekening ${awalRek}->${rek}, jumlah ${jml} vs total ${total}`)
    await s.ctx.close()
  }
  // Kalau simpan item gagal: data lama utuh, status tidak berubah, pesan error muncul
  const fx = clone(FIXTURE); fx.__gagalInsert = 'pengajuan_items'
  const awal = fx.pengajuan_items.filter((r) => r.pengajuan_id === 'P11').length
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/P11/edit', fixture: fx })
  await s.page.waitForTimeout(900)
  await s.page.getByRole('button', { name: 'Submit Ulang' }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(1200)
  const sisa = s.mock.db.pengajuan_items.filter((r) => r.pengajuan_id === 'P11').length
  const st = s.mock.db.pengajuan.find((p) => p.id === 'P11').status
  const pesan = await s.page.getByText(/Item gagal disimpan/).count().catch(() => 0)
  if (sisa !== awal || st !== 'revision' || !pesan) salah.push(`gagal simpan: item ${awal}->${sisa}, status ${st}, pesan=${pesan}`)
  await s.ctx.close()
  t('K42 Ubah & kirim ulang: item/rekening utuh, gagal simpan tidak menghapus data', salah.length === 0, salah.join(' | '))
}

// K43. Approve diblok kalau item kosong / jumlah item tidak sama dengan total (peringatan tampil)
{
  const salah = []
  for (const [nama, ubah] of [['kosong', (fx) => { fx.pengajuan_items = fx.pengajuan_items.filter((r) => r.pengajuan_id !== 'P01') }],
                              ['beda', (fx) => { const r = fx.pengajuan_items.find((x) => x.pengajuan_id === 'P01'); r.harga_satuan += 5000; r.jumlah += 5000 }]]) {
    const fx = clone(FIXTURE); ubah(fx)
    const s = await openApp(b, base, { role: 'coo', path: '/pengajuan/P01', fixture: fx })
    await s.page.waitForTimeout(700)
    const peringatan = await s.page.getByTestId('masalah-item').count().catch(() => 0)
    await s.page.getByRole('button', { name: /^✓ Approve/ }).click({ timeout: 3000 }).catch(() => {})
    await s.page.waitForTimeout(700)
    const patch = patchesTo(s.mock, 'pengajuan').length
    if (!peringatan || patch !== 0) salah.push(`${nama}: peringatan=${peringatan} patch=${patch}`)
    await s.ctx.close()
  }
  const s = await openApp(b, base, { role: 'coo', path: '/pengajuan/P01' })
  await s.page.waitForTimeout(700)
  const palsu = await s.page.getByTestId('masalah-item').count().catch(() => 0)
  if (palsu) salah.push('pengajuan normal ikut diberi peringatan')
  await s.ctx.close()
  t('K43 Approve diblok kalau item kosong / jumlah beda total', salah.length === 0, salah.join(' | '))
}

// K44. Form: item gagal disimpan -> pengajuan dibatalkan utuh (tidak ada pengajuan tanpa item, tanpa notif)
{
  const fx = clone(FIXTURE); fx.__gagalInsert = 'pengajuan_items'
  const awal = fx.pengajuan.length
  const s = await openApp(b, base, { role: 'operational', path: '/pengajuan/baru', fixture: fx })
  await isiForm(s.page, 'Ganti ban truk B 9123 KZ', 'Ban depan kiri')
  await s.page.locator('input[type="number"]').nth(1).fill('100000').catch(() => {})
  await s.page.waitForTimeout(1200)
  await s.page.getByRole('button', { name: 'Submit Pengajuan' }).click().catch(() => {})
  await s.page.waitForTimeout(1500)
  const sisa = s.mock.db.pengajuan.length
  const pesan = await s.page.getByText(/belum terkirim/).count().catch(() => 0)
  const notif = s.mock.log.notifs.length
  t('K44 Form gagal simpan item -> pengajuan tidak tersimpan, pesan jelas, tanpa notif', sisa === awal && pesan > 0 && notif === 0, `pengajuan ${awal}->${sisa} pesan=${pesan} notif=${notif}`)
  await s.ctx.close()
}

// K45. LPJ: approve dobel dicegah (status berubah di tempat lain) & Edit LPJ gagal tidak menghapus nota lama
{
  const salah = []
  const s = await openApp(b, base, { role: 'finance', path: '/lpj/P08' })
  await s.page.waitForTimeout(700)
  s.mock.db.lpj.find((l) => l.id === 'LPJ-08').status = 'approved_finance' // CFO sudah memproses duluan
  await s.page.getByRole('button', { name: /Approve LPJ \(Finance\)/ }).click({ timeout: 3000 }).catch(() => {})
  await s.page.waitForTimeout(900)
  const ditimpa = s.mock.db.lpj.find((l) => l.id === 'LPJ-08').approved_finance_by
  if (ditimpa) salah.push('approve dobel menimpa data')
  await s.ctx.close()
  const fx = clone(FIXTURE); fx.__gagalInsert = 'lpj_nota_items'
  const awal = fx.lpj_nota_items.filter((r) => r.nota_id === 'LPJ-08-N1').length
  const s2 = await openApp(b, base, { role: 'procurement', path: '/lpj/P08', fixture: fx })
  await s2.page.getByRole('button', { name: /Edit LPJ/ }).click({ timeout: 3000 }).catch(() => {})
  await s2.page.waitForTimeout(700)
  await s2.page.getByRole('button', { name: 'Simpan Perubahan' }).first().click({ timeout: 3000 }).catch(() => {})
  await s2.page.waitForTimeout(1500)
  const notaLama = s2.mock.db.lpj_nota.filter((n) => n.lpj_id === 'LPJ-08')
  const itemLama = s2.mock.db.lpj_nota_items.filter((r) => r.nota_id === 'LPJ-08-N1').length
  if (notaLama.length !== 1 || notaLama[0].id !== 'LPJ-08-N1' || itemLama !== awal) salah.push(`edit gagal: nota=${notaLama.map((n) => n.id)} item ${awal}->${itemLama}`)
  await s2.ctx.close()
  t('K45 LPJ: approve dobel dicegah, Edit LPJ gagal tidak menghapus nota lama', salah.length === 0, salah.join(' | '))
}

// ---------------- Putaran 6: role hanya diatur admin (brief Corsec) ----------------
// K46. Akun tanpa role -> layar "Menunggu akses"; /select-role & halaman lain dialihkan; tanpa pilihan role
{
  const salah = []
  for (const path of ['/dashboard', '/select-role', '/pengajuan/baru']) {
    const s = await openApp(b, base, { role: 'baru', path })
    await s.page.waitForTimeout(800)
    const url = new URL(s.page.url()).pathname
    const layar = await s.page.getByTestId('menunggu-akses').count().catch(() => 0)
    const pilihRole = await s.page.getByText(/Pilih role/).count().catch(() => 0)
    if (url !== '/menunggu-akses' || !layar || pilihRole) salah.push(`${path} -> ${url} layar=${layar} pilihRole=${pilihRole}`)
    await s.ctx.close()
  }
  const s = await openApp(b, base, { role: 'operational', path: '/menunggu-akses' })
  await s.page.waitForTimeout(800)
  if (new URL(s.page.url()).pathname !== '/dashboard') salah.push('user ber-role masih bisa buka /menunggu-akses')
  await s.ctx.close()
  t('K46 Tanpa role -> Menunggu akses; /select-role sudah tidak ada', salah.length === 0, salah.join(' | '))
}

// K47. Menu & halaman Pengaturan hanya untuk admin (CFO lain / role lain tidak)
{
  const salah = []
  for (const [role, harusAdmin] of [['cfo', true], ['finance', false], ['ceo', false], ['operational', false]]) {
    const s = await openApp(b, base, { role, path: '/dashboard' })
    await s.page.waitForTimeout(700)
    const menu = await s.page.getByRole('button', { name: /Pengaturan/ }).count().catch(() => 0)
    await s.page.goto(`${base}/pengaturan/pengguna`); await s.page.waitForTimeout(800)
    const url = new URL(s.page.url()).pathname
    if (harusAdmin ? (!menu || url !== '/pengaturan/pengguna') : (menu || url !== '/dashboard')) salah.push(`${role}: menu=${menu} url=${url}`)
    await s.ctx.close()
  }
  t('K47 Pengaturan → Pengguna hanya untuk admin', salah.length === 0, salah.join(' | '))
}

// K48. Admin ubah role: konfirmasi dulu, tersimpan, tercatat di riwayat; Batal tidak menyimpan; badge Menunggu role
{
  const salah = []
  const s = await openApp(b, base, { role: 'cfo', path: '/pengaturan/pengguna' })
  await s.page.waitForTimeout(800)
  const badge = await s.page.getByTestId('badge-menunggu').innerText().catch(() => '')
  if (!/Menunggu role \(1\)/.test(badge)) salah.push(`badge="${badge}"`)
  const baris = s.page.getByTestId('user-U-prc')
  await baris.locator('select').selectOption('finance').catch(() => {})
  const konf = await s.page.getByTestId('konfirmasi-ubah').innerText().catch(() => '')
  if (!/Ubah role Fajar Nugroho dari Procurement ke Finance/.test(konf)) salah.push(`konfirmasi="${konf}"`)
  if (s.mock.db.users.find((u) => u.id === 'U-prc').role !== 'procurement') salah.push('tersimpan sebelum konfirmasi')
  await s.page.getByRole('button', { name: 'Batal' }).click().catch(() => {})
  if (s.mock.db.users.find((u) => u.id === 'U-prc').role !== 'procurement') salah.push('Batal ikut menyimpan')
  await baris.locator('select').selectOption('finance').catch(() => {})
  await s.page.getByRole('button', { name: 'Ya, ubah' }).click().catch(() => {})
  await s.page.waitForTimeout(900)
  const role = s.mock.db.users.find((u) => u.id === 'U-prc').role
  const log = s.mock.db.role_change_log.at(-1)
  const pesan = await s.page.getByTestId('pesan-pengguna').innerText().catch(() => '')
  await s.page.getByText(/Riwayat perubahan role/).click().catch(() => {})
  const riwayat = await s.page.locator('details').innerText().catch(() => '')
  if (role !== 'finance' || log?.new_role !== 'finance' || !/sekarang Finance/.test(pesan) || !/Procurement → Finance/.test(riwayat)) salah.push(`role=${role} log=${JSON.stringify(log)} pesan="${pesan}" riwayat="${riwayat.slice(0, 120)}"`)
  await s.ctx.close()
  t('K48 Admin ubah role: konfirmasi, tersimpan, tercatat; Batal tidak menyimpan', salah.length === 0, salah.join(' | '))
}

// K49. Admin satu-satunya tidak bisa mencabut adminnya sendiri; menjadikan admin lain lalu cabut -> bisa
{
  const salah = []
  const s = await openApp(b, base, { role: 'cfo', path: '/pengaturan/pengguna' })
  await s.page.waitForTimeout(800)
  const cabut = s.page.getByTestId('user-U-cfo').getByRole('button', { name: 'Cabut admin' })
  if (!(await cabut.isDisabled().catch(() => false))) salah.push('tombol cabut admin sendiri tidak dikunci')
  await s.page.getByTestId('user-U-fin').getByRole('button', { name: 'Jadikan admin' }).click().catch(() => {})
  await s.page.getByRole('button', { name: 'Ya, ubah' }).click().catch(() => {})
  await s.page.waitForTimeout(900)
  if (!s.mock.db.users.find((u) => u.id === 'U-fin').is_admin) salah.push('gagal menjadikan Finance admin')
  if (await cabut.isDisabled().catch(() => true)) salah.push('setelah ada admin lain, cabut masih dikunci')
  await s.ctx.close()
  t('K49 Admin terakhir tidak bisa dicabut; dengan admin lain bisa', salah.length === 0, salah.join(' | '))
}

// K50. Ditolak server (admin dicabut dari tempat lain): pesan jelas, pilihan kembali, data tetap
//      - ubah role orang lain -> RLS: 0 baris -> "tidak punya izin"
//      - ubah role sendiri -> trigger: pesan dari database "Hanya admin..."
{
  const salah = []
  const s = await openApp(b, base, { role: 'cfo', path: '/pengaturan/pengguna' })
  await s.page.waitForTimeout(800)
  s.mock.db.users.find((u) => u.id === 'U-cfo').is_admin = false
  s.mock.db.users.find((u) => u.id === 'U-fin').is_admin = true
  for (const [id, awal, ke, pola] of [['U-opr', 'operational', 'ceo', /tidak punya izin/], ['U-cfo', 'cfo', 'ceo', /Hanya admin/]]) {
    const sel = s.page.getByTestId(`user-${id}`).locator('select')
    await sel.selectOption(ke).catch(() => {})
    await s.page.getByRole('button', { name: 'Ya, ubah' }).click().catch(() => {})
    await s.page.waitForTimeout(900)
    const pesan = await s.page.getByTestId('pesan-pengguna').innerText().catch(() => '')
    const nilai = await sel.inputValue().catch(() => '')
    const role = s.mock.db.users.find((u) => u.id === id).role
    if (!pola.test(pesan) || nilai !== awal || role !== awal) salah.push(`${id}: pesan="${pesan}" nilai=${nilai} role=${role}`)
  }
  await s.ctx.close()
  t('K50 Ditolak server: pesan jelas, pilihan kembali, data tetap', salah.length === 0, salah.join(' | '))
}

await b.close()
const gagal = hasil.filter((h) => !h.lulus)
hasil.forEach((h) => console.log((h.lulus ? 'LULUS ' : 'GAGAL ') + h.nama + (h.lulus || !h.detail ? '' : '  [' + h.detail.slice(0, 300) + ']')))
console.log(`\n${hasil.length - gagal.length}/${hasil.length} lulus`)
process.exit(gagal.length ? 1 : 0)
