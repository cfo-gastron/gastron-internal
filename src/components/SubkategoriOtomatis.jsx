import { useState } from 'react'

// Tampilan subkategori otomatis di form (tidak bisa dipilih pengaju).
export default function SubkategoriOtomatis({ status, subkategori }) {
  const [bantuan, setBantuan] = useState(false)
  const teks = {
    kosong: { t: 'Ditentukan otomatis setelah judul diisi', c: '#666' },
    mendeteksi: { t: 'Mendeteksi…', c: '#666' },
    terdeteksi: { t: subkategori, c: '#111' },
    tidak_yakin: { t: 'Belum terdeteksi — perjelas judulnya (contoh: "Ganti ban truk B 9123 KZ")', c: '#8B1A1F' },
    gagal: { t: 'Belum bisa dideteksi. Tetap bisa dikirim, Finance yang menentukan.', c: '#8B1A1F' },
  }[status]

  return (
    <div style={{ marginBottom: 16 }} data-testid="subkategori-otomatis">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className="form-label" style={{ marginBottom: 0 }}>Subkategori</span>
        <button type="button" onClick={() => setBantuan(!bantuan)} aria-label="Apa itu subkategori otomatis?" aria-expanded={bantuan}
          style={{ width: 22, height: 22, borderRadius: 11, border: '1px solid #DDD', background: '#fff', fontSize: 12, color: '#555', cursor: 'pointer', padding: 0, lineHeight: '20px' }}>?</button>
      </div>
      <div aria-live="polite" style={{ background: '#F7F7F7', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: status === 'terdeteksi' ? 600 : 400, color: teks.c }}>
        {status === 'terdeteksi' && <span style={{ color: '#666', fontWeight: 400 }}>Terdeteksi: </span>}{teks.t}
      </div>
      {bantuan && (
        <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.5 }}>
          Subkategori dipilih otomatis oleh sistem dari judul dan nama item. Kalau keliru, CFO atau Finance yang membetulkan sebelum dana ditransfer. Judul yang jelas = kategori tepat.
        </div>
      )}
    </div>
  )
}
