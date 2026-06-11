// generateLpjPdf.js
// Taruh di: src/lib/generateLpjPdf.js
//
// Cara pakai di LpjPage.jsx:
//   import { generateLpjPdf } from '../lib/generateLpjPdf'
//   ...
//   <button onClick={() => generateLpjPdf(pengajuan, lpj)}>Download PDF</button>
//
// Install dulu:
//   npm install jspdf jspdf-autotable

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export function generateLpjPdf(pengajuan, lpj) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const RED = [192, 39, 45]       // #C0272D
  const DARK = [17, 17, 17]       // #111
  const GRAY = [120, 120, 120]    // #888
  const LIGHT = [245, 245, 245]   // #F5F5F5
  const WHITE = [255, 255, 255]

  const pageW = 210
  const pageH = 297
  const margin = 20
  const contentW = pageW - margin * 2

  // ── HEADER BAR ──────────────────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, pageW, 22, 'F')

  // Nama perusahaan di header
  doc.setTextColor(...WHITE)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('PT Gastron Indo Energi', margin, 10)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Laporan Pertanggungjawaban (LPJ)', margin, 16)

  // Kode surat di kanan
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(pengajuan.kode_surat || '-', pageW - margin, 13, { align: 'right' })

  // ── JUDUL PENGAJUAN ──────────────────────────────────────────────────────────
  let y = 32

  doc.setTextColor(...DARK)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(pengajuan.judul || '-', margin, y)
  y += 7

  // ── INFO ROW ─────────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)

  const infoItems = [
    { label: 'Divisi', value: pengajuan.division || '-' },
    { label: 'Tanggal Submit', value: formatDate(pengajuan.submitted_at) },
    { label: 'Metode Bayar', value: pengajuan.metode_pembayaran || '-' },
    { label: 'Status LPJ', value: 'Closed ✓' },
  ]

  const colW = contentW / infoItems.length
  infoItems.forEach((info, i) => {
    const x = margin + i * colW
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.text(info.label.toUpperCase(), x, y)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text(info.value, x, y + 5)
  })

  y += 14

  // Garis tipis separator
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ── RINGKASAN ANGGARAN ────────────────────────────────────────────────────────
  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('RINGKASAN ANGGARAN', margin, y)
  y += 5

  const sisaDana = Number(lpj.total_pengajuan) - Number(lpj.total_realisasi)

  const summaryData = [
    ['Total Anggaran Pengajuan', formatRp(lpj.total_pengajuan)],
    ['Total Realisasi', formatRp(lpj.total_realisasi)],
    ['Sisa Dana', formatRp(Math.abs(sisaDana))],
  ]

  if (sisaDana > 0 && lpj.metode_pengembalian) {
    summaryData.push(['Metode Pengembalian Sisa', lpj.metode_pengembalian === 'transfer' ? 'Transfer Bank' : 'Cash'])
  }

  autoTable(doc, {
    startY: y,
    head: [],
    body: summaryData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 90, textColor: GRAY, fontStyle: 'normal' },
      1: { cellWidth: contentW - 90, textColor: DARK, fontStyle: 'bold', halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  })

  y = doc.lastAutoTable.finalY + 10

  // ── DETAIL REALISASI PER NOTA ─────────────────────────────────────────────────
  const notas = lpj.lpj_nota || []

  if (notas.length > 0) {
    doc.setTextColor(...DARK)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DETAIL REALISASI PER NOTA', margin, y)
    y += 5

    notas.forEach((nota, notaIdx) => {
      // Cek apakah perlu halaman baru
      if (y > pageH - 60) {
        doc.addPage()
        y = 20
      }

      // Header nota
      doc.setFillColor(...LIGHT)
      doc.roundedRect(margin, y, contentW, 8, 1, 1, 'F')
      doc.setTextColor(...DARK)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.text(`Nota #${notaIdx + 1} — ${nota.nama_nota}`, margin + 4, y + 5.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...RED)
      doc.text(formatRp(nota.total_nota), pageW - margin - 4, y + 5.5, { align: 'right' })
      y += 11

      const notaItems = nota.lpj_nota_items || []
      if (notaItems.length > 0) {
        const tableBody = notaItems.map(ni => [
          ni.uraian || '-',
          `${ni.qty_pengajuan} ${ni.satuan}`,
          formatRp(ni.harga_pengajuan),
          `${ni.realisasi_qty} ${ni.satuan}`,
          formatRp(ni.realisasi_harga),
          formatRp(ni.realisasi_qty * ni.realisasi_harga),
        ])

        autoTable(doc, {
          startY: y,
          head: [[
            'Item',
            'Qty Pengajuan',
            'Harga Pengajuan',
            'Qty Realisasi',
            'Harga Realisasi',
            'Subtotal',
          ]],
          body: tableBody,
          margin: { left: margin, right: margin },
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: {
            fillColor: DARK,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 7,
          },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { halign: 'center', cellWidth: 22 },
            2: { halign: 'right', cellWidth: 28 },
            3: { halign: 'center', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 25, fontStyle: 'bold', textColor: DARK },
          },
          theme: 'striped',
          alternateRowStyles: { fillColor: [250, 250, 250] },
        })

        y = doc.lastAutoTable.finalY + 8
      } else {
        doc.setFontSize(8)
        doc.setTextColor(...GRAY)
        doc.setFont('helvetica', 'italic')
        doc.text('Tidak ada item detail.', margin + 4, y + 4)
        y += 10
      }
    })
  }

  // ── APPROVAL INFO ─────────────────────────────────────────────────────────────
  if (y > pageH - 50) {
    doc.addPage()
    y = 20
  }

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  doc.setTextColor(...DARK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('RIWAYAT PERSETUJUAN', margin, y)
  y += 5

  const approvalRows = []
  if (lpj.submitted_at) {
    approvalRows.push(['Disubmit', formatDate(lpj.submitted_at), '-'])
  }
  if (lpj.approved_finance_at) {
    approvalRows.push(['Approved Finance', formatDate(lpj.approved_finance_at), '-'])
  }
  if (lpj.approved_cfo_at) {
    approvalRows.push(['Approved CFO / Closed', formatDate(lpj.approved_cfo_at), '-'])
  }

  if (approvalRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Status', 'Tanggal', 'Catatan']],
      body: approvalRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
      theme: 'striped',
      alternateRowStyles: { fillColor: [250, 250, 250] },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `PT Gastron Indo Energi  ·  Digenerate ${formatDate(new Date().toISOString())}  ·  Halaman ${i} dari ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    )
  }

  // ── SAVE ──────────────────────────────────────────────────────────────────────
  const fileName = `LPJ_${pengajuan.kode_surat || pengajuan.id}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}
