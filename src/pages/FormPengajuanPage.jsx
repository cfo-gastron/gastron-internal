import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

const DIVISION_MAP = {
  operational: 'OPR',
  procurement: 'PRC',
  corporate_secretary: 'ADM',
  finance: 'FIN',
  cfo: 'FIN',
  ceo: 'FIN',
  cao: 'ADM',
  coo: 'OPR',
}

const SATUAN_OPTIONS = ['Pcs', 'Unit', 'Kaleng', 'Liter', 'Kg', 'Box', 'Lembar', 'Trip', 'Bulan', 'Lainnya']

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function FormPengajuanPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [judul, setJudul] = useState('')
  const [metodeBayar, setMetodeBayar] = useState('Transfer')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState([
    { uraian: '', qty: 1, satuan: 'Pcs', harga_satuan: 0 }
  ])
  const [penerima, setPenerima] = useState([
    { nama_penerima: '', bank: '', no_rekening: '', atas_nama: '' }
  ])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const division = DIVISION_MAP[profile?.role] || 'OPR'
  const total = items.reduce((s, i) => s + (Number(i.qty) * Number(i.harga_satuan)), 0)

  function addItem() {
    setItems([...items, { uraian: '', qty: 1, satuan: 'Pcs', harga_satuan: 0 }])
  }

  function removeItem(idx) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx, field, value) {
    const updated = [...items]
    updated[idx][field] = value
    setItems(updated)
  }

  function addPenerima() {
    setPenerima([...penerima, { nama_penerima: '', bank: '', no_rekening: '', atas_nama: '' }])
  }

  function removePenerima(idx) {
    if (penerima.length === 1) return
    setPenerima(penerima.filter((_, i) => i !== idx))
  }

  function updatePenerima(idx, field, value) {
    const updated = [...penerima]
    updated[idx][field] = value
    setPenerima(updated)
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files)
    setAttachments(prev => [...prev, ...files])
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) setAttachments(prev => [...prev, file])
      }
    }
  }

  function removeAttachment(idx) {
    setAttachments(attachments.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!judul.trim()) { setError('Judul pengajuan wajib diisi'); return }
    if (items.some(i => !i.uraian.trim())) { setError('Semua uraian item wajib diisi'); return }

    setLoading(true)
    setError(null)

    try {
      // Generate kode surat
      const now = new Date()
      const month = ROMAN_MONTHS[now.getMonth()]
      const year = now.getFullYear()

      // Get counter
      const { data: counterData } = await supabase.rpc('generate_kode_surat', { p_division: division })
      const kodeSurat = counterData || `GTR-${division}-001-${month}-${year}`

      // Insert pengajuan
      const { data: pengajuan, error: pErr } = await supabase
        .from('pengajuan')
        .insert({
          kode_surat: kodeSurat,
          judul,
          division,
          submitted_by: profile.id,
          metode_pembayaran: metodeBayar,
          catatan,
          total_pengajuan: total,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (pErr) throw pErr

      // Insert items
      const itemsToInsert = items.map((item, idx) => ({
        pengajuan_id: pengajuan.id,
        urutan: idx + 1,
        uraian: item.uraian,
        qty: Number(item.qty),
        satuan: item.satuan,
        harga_satuan: Number(item.harga_satuan),
      }))

      await supabase.from('pengajuan_items').insert(itemsToInsert)

      // Insert penerima (filter yang ada isinya)
      const penerimaToInsert = penerima.filter(p => p.nama_penerima.trim())
      if (penerimaToInsert.length > 0) {
        await supabase.from('pengajuan_penerima').insert(
          penerimaToInsert.map(p => ({ ...p, pengajuan_id: pengajuan.id }))
        )
      }

      // Upload attachments
      for (const file of attachments) {
        const ext = file.name.split('.').pop()
        const fileName = `${pengajuan.id}/${Date.now()}.${ext}`
        const { data: uploadData } = await supabase.storage
          .from('pengajuan-attachments')
          .upload(fileName, file)

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('pengajuan-attachments')
            .getPublicUrl(fileName)

          await supabase.from('pengajuan_attachments').insert({
            pengajuan_id: pengajuan.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: profile.id,
          })
        }
      }

      // Insert approval log
      await supabase.from('approval_logs').insert({
        pengajuan_id: pengajuan.id,
        action: 'submitted',
        action_by: profile.id,
        role_at_time: profile.role,
      })

      navigate(`/pengajuan/${pengajuan.id}`)

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR */}
      <div style={{
        width: 240, background: '#fff', borderRight: '1px solid #F0F0F0',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: '24px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/logo-gastron.png" alt="Gastron" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
              <span style={{ color: '#C0272D' }}>G</span>astron
            </div>
            <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'transparent', border: 'none', textAlign: 'left',
            padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#555',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4,
          }}
        >
          ⊞ Dashboard
        </button>
        <button
          style={{
            background: '#FFF0F0', border: 'none', textAlign: 'left',
            padding: '10px 12px', borderRadius: 8, fontSize: 13,
            color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Buat Pengajuan
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: 240, padding: '32px', maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none', color: '#999', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12
            }}
          >
            ← Kembali
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Buat Pengajuan</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            Divisi: <strong>{division}</strong>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8,
            padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#C0272D'
          }}>
            {error}
          </div>
        )}

        {/* Form Card */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 20 }}>Informasi Pengajuan</div>

          <div className="form-group">
            <label className="form-label">Judul Pengajuan *</label>
            <input
              className="form-input"
              placeholder="Contoh: Kebutuhan Kandang Service Truk"
              value={judul}
              onChange={e => setJudul(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Metode Pembayaran</label>
              <select
                className="form-input"
                value={metodeBayar}
                onChange={e => setMetodeBayar(e.target.value)}
              >
                <option>Transfer</option>
                <option>Cash</option>
                <option>Reimburse</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea
              className="form-input"
              placeholder="Catatan tambahan (opsional)"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Items */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Item Pengajuan</div>
            <button
              onClick={addItem}
              style={{
                background: '#F5F5F5', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                color: '#555', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              + Tambah Item
            </button>
          </div>

          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 80px 100px 120px 100px 32px',
            gap: 8, marginBottom: 8,
            padding: '0 4px',
          }}>
            {['No', 'Uraian Transaksi', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {h}
              </div>
            ))}
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 80px 100px 120px 100px 32px',
              gap: 8, marginBottom: 8, alignItems: 'center',
            }}>
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>{idx + 1}</div>
              <input
                className="form-input"
                placeholder="Nama item"
                value={item.uraian}
                onChange={e => updateItem(idx, 'uraian', e.target.value)}
                style={{ padding: '10px 12px', fontSize: 13 }}
              />
              <input
                className="form-input"
                type="number"
                min="1"
                value={item.qty}
                onChange={e => updateItem(idx, 'qty', e.target.value)}
                style={{ padding: '10px 12px', fontSize: 13, textAlign: 'center' }}
              />
              <select
                className="form-input"
                value={item.satuan}
                onChange={e => updateItem(idx, 'satuan', e.target.value)}
                style={{ padding: '10px 12px', fontSize: 13 }}
              >
                {SATUAN_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="0"
                value={item.harga_satuan || ''}
                onChange={e => updateItem(idx, 'harga_satuan', e.target.value)}
                style={{ padding: '10px 12px', fontSize: 13, textAlign: 'right' }}
              />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right', paddingRight: 4 }}>
                {formatRp(Number(item.qty) * Number(item.harga_satuan))}
              </div>
              <button
                onClick={() => removeItem(idx)}
                style={{
                  background: 'none', border: 'none', color: '#DDD',
                  cursor: 'pointer', fontSize: 16, padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          ))}

          {/* Total */}
          <div style={{
            borderTop: '2px solid #111', marginTop: 12, paddingTop: 12,
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Pengajuan
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#C0272D' }}>
              {formatRp(total)}
            </div>
          </div>
        </div>

        {/* Penerima */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Penerima Pembayaran</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Rekening tujuan transfer</div>
            </div>
            <button
              onClick={addPenerima}
              style={{
                background: '#F5F5F5', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                color: '#555', cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              + Tambah
            </button>
          </div>

          {penerima.map((p, idx) => (
            <div key={idx} style={{
              background: '#FAFAFA', borderRadius: 8, padding: '16px',
              marginBottom: 12, position: 'relative'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nama Penerima</label>
                  <input className="form-input" placeholder="Nama vendor / supplier"
                    value={p.nama_penerima} onChange={e => updatePenerima(idx, 'nama_penerima', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Bank</label>
                  <input className="form-input" placeholder="BCA / Mandiri / BRI"
                    value={p.bank} onChange={e => updatePenerima(idx, 'bank', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">No. Rekening</label>
                  <input className="form-input" placeholder="Nomor rekening"
                    value={p.no_rekening} onChange={e => updatePenerima(idx, 'no_rekening', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Atas Nama</label>
                  <input className="form-input" placeholder="Nama pemilik rekening"
                    value={p.atas_nama} onChange={e => updatePenerima(idx, 'atas_nama', e.target.value)} />
                </div>
              </div>
              {penerima.length > 1 && (
                <button
                  onClick={() => removePenerima(idx)}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'none', border: 'none', color: '#CCC',
                    cursor: 'pointer', fontSize: 16
                  }}
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Attachments */}
        <div
          style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '24px', marginBottom: 24 }}
          onPaste={handlePaste}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>Lampiran</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>Upload foto nota, invoice, atau dokumen pendukung. Bisa paste gambar langsung.</div>

          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1.5px dashed #E0E0E0', borderRadius: 10, padding: '24px',
            cursor: 'pointer', marginBottom: 16, transition: 'border-color 0.15s'
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Klik untuk upload atau drag & drop</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>PDF, JPG, PNG</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attachments.map((file, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#FAFAFA', borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>{file.type.includes('pdf') ? '📄' : '🖼️'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button onClick={() => removeAttachment(idx)}
                    style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 16 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              flex: 1, padding: '14px', background: '#F5F5F5', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2, padding: '14px', background: '#C0272D', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Menyimpan...' : 'Submit Pengajuan'}
          </button>
        </div>
      </div>
    </div>
  )
}