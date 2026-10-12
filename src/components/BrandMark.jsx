// Logo + nama app. Satu komponen untuk semua sidebar & header HP (dulu 9 salinan dengan 3 gaya berbeda).
// compact = header HP (tanpa subjudul). Ikon tanpa tulisan "Pengajuan" supaya tetap terbaca di ukuran kecil.
export default function BrandMark({ compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 10, minWidth: 0 }}>
      <img src="/logo-mark.png" alt="" style={{ height: compact ? 22 : 26, width: 'auto', flexShrink: 0 }} />
      <div style={{ lineHeight: 1.2, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: '#C0272D' }}>Gastron</div>
        {!compact && <div style={{ fontSize: 11, color: '#666' }}>Sistem Pengajuan</div>}
      </div>
    </div>
  )
}
