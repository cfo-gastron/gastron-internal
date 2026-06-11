import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function LpjPage() {
  const { pengajuanId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pengajuan, setPengajuan] = useState(null)
  const [items, setItems] = useState([])
  const [existingLpj, setExistingLpj] = useState(null)
  const [notas, setNotas] = useState([
    { nama_nota: '', total_nota: 0, file: null, selectedItems: [] }
  ])
  const [metodePengembalian, setMetodePengembalian] = useState('transfer')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchData() }, [pengajuanId])

  async function fetchData() {
    setLoading(true)
    const [p, i, l] = await Promise.all([
      supabase.from('pengajuan').select('*').eq('id', pengajuanId).single(),
      supabase.from('pengajuan_items').select('*').eq('pengajuan_id', pengajuanId).order('urutan'),
      supabase.from('lpj').select('*, lpj_nota(*, lpj_nota_items(*))').eq('pengajuan_id', pengajuanId).single(),
    ])
    setPengajuan(p.data)
    setItems(i.data || [])
    if (l.data) setExistingLpj(l.data)
    setLoading(false)
  }

  function addNota() {
    setNotas([...notas, { nama_nota: '', total_nota: 0, file: null, selectedItems: [] }])
  }

  function removeNota(idx) {
    if (notas.length === 1) return
    setNotas(notas.filter((_, i) => i !== idx))
  }

  function updateNota(idx, field, value) {
    const updated = [...notas]
    updated[idx][field] = value
    setNotas(updated)
  }

  function toggleItem(notaIdx, itemId) {
    const updated = [...notas]
    const selected = updated[notaIdx].selectedItems
    if (selected.includes(itemId)) {
      updated[notaIdx].selectedItems = selected.filter(id => id !== itemId)
    } else {
      updated[notaIdx].selectedItems = [...selected, itemId]
    }
    setNotas(updated)
  }

  function handleFileChange(idx, e) {
    const file = e.target.files[0]
    if (file) updateNota(idx, 'file', file)
  }

  function handlePaste(idx, e) {
    const clipItems = e.clipboardData?.items
    if (!clipItems) return
    for (let i = 0; i < clipItems.length; i++) {
      if (clipItems[i].type.indexOf('image') !== -1) {
        const file = clipItems[i].getAsFile()
        if (file) updateNota(idx, 'file', file)
      }
    }
  }

  const totalRealisasi = notas.reduce((s, n) => s + Number(n.total_nota || 0), 0)
  const sisaDana = Number(pengajuan?.total_pengajuan || 0) - totalRealisasi

  async function handleSubmit() {
    if (notas.some(n => !n.nama_nota.trim())) {
      setError('Nama nota wajib diisi semua')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      // Insert LPJ
      const { data: lpj, error: lpjErr } = await supabase
        .from('lpj')
        .insert({
          pengajuan_id: pengajuanId,
          submitted_by: profile.id,
          status: 'submitted',
          total_realisasi: totalRealisasi,
          total_pengajuan: pengajuan.total_pengajuan,
          metode_pengembalian: sisaDana > 0 ? metodePengembalian : null,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (lpjErr) throw lpjErr

      // Insert notas
      for (const nota of notas) {
        let fileUrl = null
        let fileName = null

        if (nota.file) {
          const ext = nota.file.name?.split('.').pop() || 'jpg'
          const path = `${lpj.id}/${Date.now()}.${ext}`
          const { data: uploadData } = await supabase.storage
            .from('lpj-nota')
            .upload(path, nota.file)

          if (uploadData) {
            const { data: urlData } = supabase.storage.from('lpj-nota').getPublicUrl(path)
            fileUrl = urlData.publicUrl
            fileName = nota.file.name
          }
        }

        const { data: notaData } = await supabase
          .from('lpj_nota')
          .insert({
            lpj_id: lpj.id,
            nama_nota: nota.nama_nota,
            total_nota: Number(nota.total_nota),
            file_url: fileUrl,
            file_name: fileName,
          })
          .select()
          .single()

        // Insert nota items mapping
        if (notaData && nota.selectedItems.length > 0) {
          const notaItems = nota.selectedItems.map(itemId => {
            const item = items.find(i => i.id === itemId)
            return {
              nota_id: notaData.id,
              pengajuan_item_id: itemId,
              realisasi_qty: item?.qty || 0,
              realisasi_harga: item?.harga_satuan || 0,
            }
          })
          await supabase.from('lpj_nota_items').insert(notaItems)
        }
      }

      navigate(`/pengajuan/${pengajuanId}`)

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    }

    setSubmitting(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // Kalau LPJ udah ada, tampilkan view mode
  if (existingLpj) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>
        <div style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0', position: 'fixed', top: 0, left: 0, bottom: 0, padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}><span style={{ color: '#C0272D' }}>G</span>astron</div>
              <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
            </div>
          </div>
          <button onClick={() => navigate(`/pengajuan/${pengajuanId}`)}
            style={{ background: '#FFF0F0', border: 'none', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
            ← Kembali
          </button>
        </div>
        <div style={{ flex: 1, marginLeft: 240, padding: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Laporan Pertanggungjawaban</div>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>{pengajuan?.kode_surat}</div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Total Pengajuan</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{formatRp(existingLpj.total_pengajuan)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Realisasi</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>{formatRp(existingLpj.total_realisasi)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Sisa Dana</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: existingLpj.sisa_dana > 0 ? '#C0272D' : '#2E7D32' }}>{formatRp(existingLpj.sisa_dana)}</div>
              </div>
            </div>
          </div>

          <div style={{ background: '#E8F5E9', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2E7D32' }}>
              ✓ LPJ sudah disubmit — menunggu approval Finance
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/logo-gastron.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}><span style={{ color: '#C0272D' }}>G</span>astron</div>
            <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
          </div>
        </div>
        <button onClick={() => navigate(`/pengajuan/${pengajuanId}`)}
          style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Kembali ke Detail
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: 240, padding: 32, maxWidth: 860 }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Laporan Pertanggungjawaban</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pengajuan?.judul} · {pengajuan?.kode_surat}</div>
        </div>

        {/* Summary anggaran */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Total Anggaran</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{formatRp(pengajuan?.total_pengajuan)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Realisasi</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2E7D32' }}>{formatRp(totalRealisasi)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Sisa Dana</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: sisaDana > 0 ? '#C0272D' : '#2E7D32' }}>{formatRp(sisaDana)}</div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#C0272D' }}>
            {error}
          </div>
        )}

        {/* Daftar item untuk referensi */}
        <div style={{ background: '#FAFAFA', borderRadius: 12, border: '1px solid #F0F0F0', padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 12 }}>Item Pengajuan (untuk referensi checklist)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
                <span>{i + 1}. {item.uraian}</span>
                <span style={{ color: '#888' }}>{item.qty} {item.satuan} × {formatRp(item.harga_satuan)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Input Nota / Bukti Pembelian</div>
            <button onClick={addNota}
              style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah Nota
            </button>
          </div>

          {notas.map((nota, idx) => (
            <div key={idx} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 20, marginBottom: 16, position: 'relative' }}
              onPaste={e => handlePaste(idx, e)}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Nota #{idx + 1}</div>
                {notas.length > 1 && (
                  <button onClick={() => removeNota(idx)}
                    style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 16 }}>×</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nama Nota / Toko</label>
                  <input className="form-input" placeholder="Contoh: Nota Toko ABC"
                    value={nota.nama_nota} onChange={e => updateNota(idx, 'nama_nota', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Total Nota (Rp)</label>
                  <input className="form-input" type="number" placeholder="0"
                    value={nota.total_nota || ''} onChange={e => updateNota(idx, 'total_nota', e.target.value)} style={{ textAlign: 'right' }} />
                </div>
              </div>

              {/* Checklist items */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Item yang tercakup nota ini</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: nota.selectedItems.includes(item.id) ? '#FFF5F5' : '#FAFAFA', border: `1px solid ${nota.selectedItems.includes(item.id) ? '#C0272D' : '#F0F0F0'}` }}>
                      <input
                        type="checkbox"
                        checked={nota.selectedItems.includes(item.id)}
                        onChange={() => toggleItem(idx, item.id)}
                        style={{ accentColor: '#C0272D' }}
                      />
                      <span style={{ fontSize: 13, color: '#333' }}>{item.uraian}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{formatRp(item.harga_satuan)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Upload foto nota */}
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Foto / Scan Nota</div>
                {nota.file ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FAFAFA', borderRadius: 8, padding: '10px 14px' }}>
                    <span>{nota.file.type?.includes('pdf') ? '📄' : '🖼️'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{nota.file.name || 'Gambar dari clipboard'}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{nota.file.size ? `${(nota.file.size / 1024).toFixed(1)} KB` : ''}</div>
                    </div>
                    <button onClick={() => updateNota(idx, 'file', null)}
                      style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #E0E0E0', borderRadius: 10, padding: '20px', cursor: 'pointer' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>📎</div>
                    <div style={{ fontSize: 13, color: '#555' }}>Upload atau paste gambar</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>PDF, JPG, PNG</div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(idx, e)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Metode pengembalian kalau ada sisa */}
        {sisaDana > 0 && (
          <div style={{ background: '#FFF8E1', borderRadius: 12, border: '1px solid #FFE082', padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B8860B', marginBottom: 12 }}>
              Ada sisa dana {formatRp(sisaDana)} — pilih metode pengembalian
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {['transfer', 'cash'].map(m => (
                <button key={m} onClick={() => setMetodePengembalian(m)}
                  style={{
                    flex: 1, padding: '10px', background: metodePengembalian === m ? '#FFF0F0' : '#fff',
                    border: `1.5px solid ${metodePengembalian === m ? '#C0272D' : '#E0E0E0'}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    color: metodePengembalian === m ? '#C0272D' : '#555',
                    cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
                  }}>
                  {m === 'transfer' ? '🏦 Transfer' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate(`/pengajuan/${pengajuanId}`)}
            style={{ flex: 1, padding: 14, background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            Batal
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 2, padding: 14, background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Menyimpan...' : 'Submit LPJ'}
          </button>
        </div>
      </div>
    </div>
  )
}