import { JUDUL_BANTUAN, JUDUL_CONTOH, JUDUL_PLACEHOLDER } from '../lib/subkategori'

// Isian judul pengajuan + arahan, dipakai form Buat & Ubah (teks arahan satu sumber).
export default function JudulField({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor="judul-pengajuan">Judul Pengajuan *</label>
      <input id="judul-pengajuan" className="form-input" placeholder={JUDUL_PLACEHOLDER}
        value={value} onChange={e => onChange(e.target.value)} />
      <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.5 }}>
        {JUDUL_BANTUAN}
        <div style={{ marginTop: 2 }}>Contoh: {JUDUL_CONTOH.join(' · ')}</div>
      </div>
    </div>
  )
}
