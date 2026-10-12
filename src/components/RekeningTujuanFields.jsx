import DeleteButton from './DeleteButton'
import { REKENING_FIELDS, REKENING_JUDUL, REKENING_SUBJUDUL } from '../lib/rekening'

// Isian rekening tujuan, dipakai form Buat & Ubah pengajuan (satu tampilan, satu urutan).
export default function RekeningTujuanFields({ penerima, onAdd, onRemove, onUpdate, isMobile, cardStyle }) {
  return (
    <div style={cardStyle} data-testid="rekening-tujuan">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{REKENING_JUDUL}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{REKENING_SUBJUDUL}</div>
        </div>
        <button onClick={onAdd}
          style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '9px 12px', minHeight: 36, fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Tambah Rekening
        </button>
      </div>

      {penerima.map((p, idx) => (
        <div key={p.id || idx} style={{ background: '#FAFAFA', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
          {penerima.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#666' }}>Rekening {idx + 1}</span>
              <DeleteButton label={`Hapus rekening ${idx + 1}`} onConfirm={() => onRemove(idx)} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            {REKENING_FIELDS.map((f) => (
              <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`rek-${idx}-${f.key}`}>{f.label}</label>
                <input id={`rek-${idx}-${f.key}`} className="form-input" placeholder={f.placeholder} inputMode={f.inputMode}
                  value={p[f.key] || ''} onChange={(e) => onUpdate(idx, f.key, e.target.value)} />
                {f.bantuan && <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{f.bantuan}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
