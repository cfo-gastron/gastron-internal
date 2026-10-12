import { useState } from 'react'

// Tombol hapus dengan konfirmasi inline ("Hapus? Ya / Batal").
// Satu komponen untuk semua form (Buat, Ubah, LPJ). `label` menyebut objeknya, mis. "Hapus item 2".
export default function DeleteButton({ onConfirm, label = 'Hapus', style = {} }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#C0272D', fontWeight: 500 }}>{label}?</span>
        <button onClick={() => { setConfirming(false); onConfirm() }}
          style={{ background: '#C0272D', border: 'none', borderRadius: 6, padding: '6px 12px', minHeight: 32, fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Ya</button>
        <button onClick={() => setConfirming(false)}
          style={{ background: '#F5F5F5', border: 'none', borderRadius: 6, padding: '6px 12px', minHeight: 32, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)} aria-label={label} title={label}
      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1, minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>×</button>
  )
}
