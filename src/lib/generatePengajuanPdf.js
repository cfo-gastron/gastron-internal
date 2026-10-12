// src/lib/generatePengajuanPdf.js
//
// Cara pakai di DetailPengajuanPage.jsx:
//   import { generatePengajuanPdf } from '../lib/generatePengajuanPdf'
//   ...
//   <button onClick={() => generatePengajuanPdf(pengajuan, items, penerima, logs)}>
//     📄 Download Surat
//   </button>
//
// Pastikan sudah install: npm install jspdf jspdf-autotable

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { REKENING_FIELDS, REKENING_JUDUL } from './rekening'
import { persetujuanBerlaku } from './approval'

const SUPABASE_URL = 'https://vybfhlpmtsdtegbrdsvo.supabase.co'
const SIGNATURES_BUCKET = `${SUPABASE_URL}/storage/v1/object/public/signatures`

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

// Gambar dimuatkan ke kotak (maxW x maxH mm) dengan bentuk asli tetap — tidak ditarik / gepeng.
// align: 'left' | 'center' (horizontal); vertikal selalu di tengah kotak.
export function ukuranPas(imgW, imgH, maxW, maxH) {
  const skala = Math.min(maxW / imgW, maxH / imgH)
  return { w: imgW * skala, h: imgH * skala }
}

function gambarPas(doc, data, x, y, maxW, maxH, align = 'center') {
  const props = doc.getImageProperties(data)
  const { w, h } = ukuranPas(props.width, props.height, maxW, maxH)
  const gx = align === 'left' ? x : x + (maxW - w) / 2
  const gy = y + (maxH - h) / 2
  doc.addImage(data, props.fileType || 'PNG', gx, gy, w, h, undefined, 'FAST')
}

// Fetch image dari URL dan convert ke base64
async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Tentukan kotak persetujuan berdasarkan divisi. Nama & tanda tangan diambil dari kolom
// step1_approved_by / cfo_approved_by di pengajuan (siapa yang approve SEKARANG), bukan dari urutan log —
// supaya approval yang dibatalkan atau siklus revisi lama tidak ikut tampil.
function getApprovers(pengajuan, logs) {
  const division = pengajuan.division
  const namaDari = (userId) => {
    if (!userId) return null
    const log = [...logs].reverse().find(l => l.action_by === userId && l.user?.full_name)
    return log?.user?.full_name || null
  }
  // Hanya persetujuan yang masih berlaku untuk status sekarang (kolom sisa siklus lama diabaikan)
  const berlaku = persetujuanBerlaku(pengajuan)
  const step1 = { by: berlaku.step1 ? pengajuan.step1_approved_by : null, name: namaDari(pengajuan.step1_approved_by) }
  const cfo = { by: berlaku.cfo ? pengajuan.cfo_approved_by : null, name: namaDari(pengajuan.cfo_approved_by) }

  if (division === 'OPR') {
    return [
      { role: 'Chief Operational Officer', sigFile: 'ttd_coo.png', approved: !!step1.by, name: step1.name },
      { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', approved: !!cfo.by, name: cfo.name },
    ]
  } else if (division === 'ADM' || division === 'PRC') {
    return [
      { role: 'Chief Administrative Officer', sigFile: 'ttd_cao.png', approved: !!step1.by, name: step1.name },
      { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', approved: !!cfo.by, name: cfo.name },
    ]
  }
  // FIN — langsung CFO
  return [
    { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', approved: !!(cfo.by || step1.by), name: cfo.name || step1.name },
  ]
}

export async function generatePengajuanPdf(pengajuan, items, penerima, logs = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const RED = [192, 39, 45]
  const DARK = [17, 17, 17]
  const GRAY = [136, 136, 136]
  const LIGHTGRAY = [245, 245, 245]
  const WHITE = [255, 255, 255]

  const W = 210
  const H = 297
  const margin = 20
  const contentW = W - margin * 2

  // ── Fetch semua gambar parallel ──────────────────────────────────────────────
  const approvers = getApprovers(pengajuan, logs)

  const [logoBase64, ...sigBase64s] = await Promise.all([
    fetchImageAsBase64(`${SIGNATURES_BUCKET}/logo_gastron.png`),
    ...approvers.map((a) => a.approved
      ? fetchImageAsBase64(`${SIGNATURES_BUCKET}/${a.sigFile}`)
      : Promise.resolve(null)),
  ])

  // ── HEADER BAR ────────────────────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, W, 20, 'F')

  if (logoBase64) {
    // Logo di header merah (tinggi 20 mm): maks 50 x 12 mm, rata kiri
    gambarPas(doc, logoBase64, margin, 4, 50, 12, 'left')
  } else {
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('GASTRON', margin, 13)
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('PT Gastron Indo Energi', W - margin, 9, { align: 'right' })
  doc.text('Sistem Pengajuan Internal', W - margin, 14, { align: 'right' })

  // ── JUDUL ─────────────────────────────────────────────────────────────────────
  let y = 30

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const judulPdf = pengajuan.tipe === 'reimbursement' ? 'SURAT REIMBURSEMENT' : 'SURAT PENGAJUAN KEBUTUHAN'
  doc.text(judulPdf, margin, y)

  y += 4
  doc.setFillColor(...RED)
  doc.rect(margin, y, 38, 0.8, 'F')

  // ── INFO PENGAJUAN ────────────────────────────────────────────────────────────
  y += 8
  const infoRows = [
    ['Nomor Surat', pengajuan.kode_surat || '-'],
    ['Tanggal', formatDate(pengajuan.submitted_at)],
    ['Divisi', pengajuan.division],
    ['Tipe', pengajuan.tipe === 'reimbursement' ? 'Reimbursement' : 'Pengajuan Kebutuhan'],
    ['Subkategori', pengajuan.subkategori || '-'],
    ['Metode Bayar', pengajuan.metode_pembayaran || '-'],
    ['Perihal', pengajuan.judul],
  ]

  const rowH = 6.5
  const labelW = 38
  const valX = margin + labelW

  infoRows.forEach((row, i) => {
    const ry = y + i * rowH
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHTGRAY)
      doc.rect(margin, ry - 2, contentW, rowH, 'F')
    }
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(row[0], margin + 2, ry + 2)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(row[1], valX, ry + 2)
  })

  y += infoRows.length * rowH + 8

  // ── TABEL ITEM ─────────────────────────────────────────────────────────────────
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Detail Item Pengajuan', margin, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['No', 'Uraian Transaksi', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah']],
    body: items.map((item, idx) => [
      idx + 1,
      item.uraian,
      item.qty,
      item.satuan,
      formatRp(item.harga_satuan),
      formatRp(item.jumlah || item.qty * item.harga_satuan),
    ]),
    foot: [['', '', '', '', 'TOTAL', formatRp(pengajuan.total_pengajuan)]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: RED,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: [250, 250, 250] },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── PENERIMA PEMBAYARAN ────────────────────────────────────────────────────────
  if (penerima && penerima.length > 0) {
    // Cek apakah perlu halaman baru
    if (y > H - 80) { doc.addPage(); y = 20 }

    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(REKENING_JUDUL, margin, y)
    y += 4

    const boxH = penerima.length * 22 + 4
    doc.setFillColor(...LIGHTGRAY)
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F')

    penerima.forEach((p, pi) => {
      const py = y + pi * 22 + 4
      const fields = REKENING_FIELDS.map(f => [f.label, p[f.key]])
      const colW = contentW / 2
      fields.forEach((f, fi) => {
        const fx = margin + (fi % 2) * colW + 4
        const fy = py + (fi < 2 ? 0 : 10)
        doc.setTextColor(...GRAY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.text(f[0], fx, fy)
        doc.setTextColor(...DARK)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(f[1] || '-', fx, fy + 5)
      })
    })

    y += boxH + 8
  }

  // ── CATATAN ────────────────────────────────────────────────────────────────────
  if (pengajuan.catatan) {
    if (y > H - 60) { doc.addPage(); y = 20 }

    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Catatan', margin, y)
    y += 4

    doc.setFillColor(...LIGHTGRAY)
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F')
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(pengajuan.catatan, margin + 4, y + 7)
    y += 16
  }

  // ── TANDA TANGAN ──────────────────────────────────────────────────────────────
  if (y > H - 55) { doc.addPage(); y = 20 }

  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Persetujuan', margin, y)
  y += 4

  const ttdBoxH = 32
  const ttdW = approvers.length === 1
    ? contentW * 0.48
    : (contentW - 8) / approvers.length

  approvers.forEach((approver, ai) => {
    const ax = margin + ai * (ttdW + 8)

    // Box
    doc.setFillColor(...LIGHTGRAY)
    doc.roundedRect(ax, y, ttdW, ttdBoxH, 2, 2, 'F')

    // Label role
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(approver.role, ax + 4, y + 6)

    // Tanda tangan (kalau sudah approve)
    const sigData = sigBase64s[ai]
    if (sigData) {
      try {
        // Tanda tangan di tengah kotak: maks 40 x 15 mm, bentuk asli tetap
        gambarPas(doc, sigData, ax + 4, y + 8, Math.min(40, ttdW - 8), 15, 'center')
      } catch (e) { console.error('Gagal menggambar tanda tangan:', e) }
    } else {
      // Placeholder kosong kalau belum approve
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(ax + 6, y + 18, ax + ttdW - 6, y + 18)
    }

    // Nama approver
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const displayName = approver.approved ? (approver.name || '-') : '________________'
    doc.text(displayName, ax + 4, y + ttdBoxH - 4)
  })

  // Watermark kalau belum ada approval sama sekali
  if (!approvers.some(a => a.approved)) {
    doc.setTextColor(220, 220, 220)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(32)
    doc.text('BELUM FINAL', W / 2, H / 2, { align: 'center', angle: 45 })
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...RED)
    doc.rect(0, H - 9, W, 9, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(
      `PT Gastron Indo Energi  ·  Digenerate ${formatDate(new Date().toISOString())}  ·  Halaman ${i} dari ${totalPages}`,
      W / 2, H - 4,
      { align: 'center' }
    )
  }

  // ── SAVE ────────────────────────────────────────────────────────────────────────
  const fileName = `Surat_${pengajuan.kode_surat || pengajuan.id}.pdf`
  const pdfBlob = doc.output('blob')
const blobUrl = URL.createObjectURL(pdfBlob)
const link = document.createElement('a')
link.href = blobUrl
link.download = fileName
document.body.appendChild(link)
link.click()
document.body.removeChild(link)
setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
}