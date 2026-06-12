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

// Tentukan approver berdasarkan division dan approval logs
function getApprovers(pengajuan, logs) {
  const division = pengajuan.division

  // Cari nama approver dari logs
  const getApproverName = (action, stepHint) => {
    // Cari dari logs berdasarkan action approved dan role
    const approvedLogs = logs.filter(l => l.action === 'approved')
    if (approvedLogs.length === 0) return null
    if (stepHint === 'step1' && approvedLogs[0]) return approvedLogs[0].user?.full_name || null
    if (stepHint === 'cfo' && approvedLogs.length >= 2) return approvedLogs[1].user?.full_name || null
    if (stepHint === 'ceo' && approvedLogs.length >= 3) return approvedLogs[2].user?.full_name || null
    return null
  }

  // Tentukan approver berdasarkan division
  if (division === 'OPR') {
    return [
      { role: 'Chief Operational Officer', sigFile: 'ttd_coo.png', name: getApproverName('approved', 'step1') },
      { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', name: getApproverName('approved', 'cfo') },
    ]
  } else if (division === 'ADM' || division === 'PRC') {
    return [
      { role: 'Chief Administrative Officer', sigFile: 'ttd_cao.png', name: getApproverName('approved', 'step1') },
      { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', name: getApproverName('approved', 'cfo') },
    ]
  } else {
    // FIN — langsung CFO
    return [
      { role: 'Chief Financial Officer', sigFile: 'ttd_cfo.png', name: getApproverName('approved', 'step1') },
    ]
  }
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
  const isApproved = pengajuan.status === 'approved_ceo'

  const [logoBase64, ...sigBase64s] = await Promise.all([
    fetchImageAsBase64(`${SIGNATURES_BUCKET}/logo_gastron.png`),
    ...approvers.map(a =>
      isApproved
        ? fetchImageAsBase64(`${SIGNATURES_BUCKET}/${a.sigFile}`)
        : Promise.resolve(null)
    ),
  ])

  // ── HEADER BAR ────────────────────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, W, 20, 'F')

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 3, 32, 13, undefined, 'FAST')
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
  doc.text('SURAT PENGAJUAN', margin, y)

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
    doc.text('Penerima Pembayaran', margin, y)
    y += 4

    const boxH = penerima.length * 22 + 4
    doc.setFillColor(...LIGHTGRAY)
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F')

    penerima.forEach((p, pi) => {
      const py = y + pi * 22 + 4
      const fields = [
        ['Nama Penerima', p.nama_penerima],
        ['Bank', p.bank],
        ['No. Rekening', p.no_rekening],
        ['Atas Nama', p.atas_nama],
      ]
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
        // Render kecil dan center biar tidak melebar
        const sigW = 28
        const sigH = 12
        const sigX = ax + (ttdW - sigW) / 2
        doc.addImage(sigData, 'PNG', sigX, y + 7, sigW, sigH, undefined, 'FAST')
      } catch {}
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
    const displayName = approver.name || (isApproved ? '-' : '________________')
    doc.text(displayName, ax + 4, y + ttdBoxH - 4)
  })

  // Status watermark kalau belum final approve
  if (!isApproved) {
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
  const fileName = `Surat_${pengajuan.kode_surat || pengajuan.id}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}