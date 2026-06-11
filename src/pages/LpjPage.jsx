import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const Sidebar = ({ onBack }) => (
  <div style={{
    width: 240, background: '#fff', borderRight: '1px solid #F0F0F0',
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    display: 'flex', flexDirection: 'column', padding: '24px 20px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
      <img src="/logo-gastron.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}><span style={{ color: '#C0272D' }}>G</span>astron</div>
        <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
      </div>
    </div>
    <button onClick={onBack}
      style={{ background: '#FFF0F0', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      ← Kembali
    </button>
  </div>
)

// ─── VIEW MODE (LPJ sudah disubmit) ───────────────────────────────────────────
function LpjViewMode({ pengajuan, lpj, profile, onApprove, approving }) {
  const sisaDana = Number(lpj.total_pengajuan) - Number(lpj.total_realisasi)
  const role = profile?.role

  const canApproveLpj = () => {
    if (lpj.status === 'submitted' && (role === 'finance' || role === 'cfo')) return true
    if (lpj.status === 'approved_finance' && role === 'cfo') return true
    return false
  }

  const approveLabel = () => {
    if (lpj.status === 'submitted' && role === 'finance') return '✓ Approve LPJ (Finance)'
    if (lpj.status === 'submitted' && role === 'cfo') return '✓ Approve LPJ (CFO)'
    if (lpj.status === 'approved_finance' && role === 'cfo') return '✓ Final Approve & Close LPJ'
    return ''
  }

  const statusLabel = {
    submitted: 'Menunggu Approval',
    approved_finance: 'Menunggu CFO',
    closed: 'Closed ✓',
  }

  const statusColor = {
    submitted: '#B8860B',
    approved_finance: '#1565C0',
    closed: '#2E7D32',
  }

  const statusBg = {
    submitted: '#FFF8E1',
    approved_finance: '#E3F2FD',
    closed: '#E8F5E9',
  }

  return (
    <div style={{ flex: 1, marginLeft: 240, padding: 32, maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Laporan Pertanggungjawaban</div>
        <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pengajuan?.judul} · {pengajuan?.kode_surat}</div>
      </div>

      {/* Status banner */}
      <div style={{ background: statusBg[lpj.status] || '#F5F5F5', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: statusColor[lpj.status] || '#555' }}>
          {statusLabel[lpj.status] || lpj.status}
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>Disubmit {formatDate(lpj.submitted_at)}</div>
      </div>

      {/* Summary */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { label: 'Total Anggaran', value: formatRp(lpj.total_pengajuan), color: '#111' },
            { label: 'Total Realisasi', value: formatRp(lpj.total_realisasi), color: '#2E7D32' },
            { label: 'Sisa Dana', value: formatRp(Math.abs(sisaDana)), color: sisaDana > 0 ? '#C0272D' : '#2E7D32' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
        {sisaDana > 0 && lpj.metode_pengembalian && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F5F5F5', fontSize: 13, color: '#888' }}>
            Sisa dikembalikan via: <strong style={{ color: '#111' }}>{lpj.metode_pengembalian === 'transfer' ? '🏦 Transfer' : '💵 Cash'}</strong>
          </div>
        )}
      </div>

      {/* Nota detail */}
      {lpj.lpj_nota?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111' }}>
            Detail Realisasi per Nota
          </div>
          {lpj.lpj_nota.map((nota, i) => (
            <div key={nota.id} style={{ padding: '16px 24px', borderBottom: '1px solid #F8F8F8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Nota #{i + 1} — {nota.nama_nota}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C0272D', marginTop: 2 }}>{formatRp(nota.total_nota)}</div>
                </div>
                {nota.file_url && (
                  <a href={nota.file_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', background: '#E3F2FD', padding: '6px 12px', borderRadius: 8 }}>
                    📎 Lihat Nota
                  </a>
                )}
              </div>
              {nota.lpj_nota_items?.length > 0 && (
                <div style={{ background: '#FAFAFA', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Item', 'Qty Realisasi', 'Harga Realisasi', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h === 'Item' ? 'left' : 'right', borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nota.lpj_nota_items.map(ni => (
                        <tr key={ni.id}>
                          <td style={{ padding: '8px 12px', fontSize: 13, color: '#111' }}>{ni.uraian || '-'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 13, color: '#555', textAlign: 'right' }}>{ni.realisasi_qty} {ni.satuan}</td>
                          <td style={{ padding: '8px 12px', fontSize: 13, color: '#555', textAlign: 'right' }}>{formatRp(ni.realisasi_harga)}</td>
                          <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{formatRp(ni.realisasi_qty * ni.realisasi_harga)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approval button */}
      {canApproveLpj() && (
        <button onClick={onApprove} disabled={approving}
          style={{
            width: '100%', padding: 14, background: '#2E7D32',
            border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff',
            cursor: 'pointer', fontFamily: 'inherit', opacity: approving ? 0.7 : 1
          }}>
          {approving ? 'Memproses...' : approveLabel()}
        </button>
      )}

      {lpj.status === 'closed' && (
        <div style={{ background: '#E8F5E9', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>✓ LPJ Closed</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Laporan pertanggungjawaban telah selesai diverifikasi</div>
        </div>
      )}
    </div>
  )
}

// ─── INPUT MODE (form LPJ baru) ────────────────────────────────────────────────
export default function LpjPage() {
  const { pengajuanId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pengajuan, setPengajuan] = useState(null)
  const [items, setItems] = useState([])
  const [existingLpj, setExistingLpj] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState(null)

  // Realisasi per item: { [itemId]: { qty, harga } }
  const [realisasi, setRealisasi] = useState({})

  // Notas: [{ nama_nota, file, itemIds: [] }]
  const [notas, setNotas] = useState([{ nama_nota: '', file: null, itemIds: [] }])

  const [metodePengembalian, setMetodePengembalian] = useState('transfer')

  useEffect(() => { fetchData() }, [pengajuanId])

  async function fetchData() {
    setLoading(true)
    const [p, i, l] = await Promise.all([
      supabase.from('pengajuan').select('*').eq('id', pengajuanId).single(),
      supabase.from('pengajuan_items').select('*').eq('pengajuan_id', pengajuanId).order('urutan'),
      supabase.from('lpj').select('*, lpj_nota(*, lpj_nota_items(*))').eq('pengajuan_id', pengajuanId).maybeSingle(),
    ])
    setPengajuan(p.data)
    const itemList = i.data || []
    setItems(itemList)

    // Pre-fill realisasi dari item pengajuan
    const prefilledRealisasi = {}
    itemList.forEach(item => {
      prefilledRealisasi[item.id] = {
        qty: item.qty,
        harga: item.harga_satuan,
      }
    })
    setRealisasi(prefilledRealisasi)

    if (l.data) setExistingLpj(l.data)
    setLoading(false)
  }

  // Hitung total realisasi dari semua item
  const totalRealisasi = items.reduce((sum, item) => {
    const r = realisasi[item.id]
    return sum + (Number(r?.qty || 0) * Number(r?.harga || 0))
  }, 0)

  const sisaDana = Number(pengajuan?.total_pengajuan || 0) - totalRealisasi

  function updateRealisasi(itemId, field, value) {
    setRealisasi(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }))
  }

  function addNota() {
    setNotas([...notas, { nama_nota: '', file: null, itemIds: [] }])
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

  function toggleItemInNota(notaIdx, itemId) {
    const updated = [...notas]
    const ids = updated[notaIdx].itemIds
    updated[notaIdx].itemIds = ids.includes(itemId)
      ? ids.filter(id => id !== itemId)
      : [...ids, itemId]
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

  async function handleApproveLpj() {
    setApproving(true)
    const role = profile?.role
    let updateData = {}

    if (existingLpj.status === 'submitted') {
      if (role === 'finance') {
        updateData = { status: 'approved_finance', approved_finance_at: new Date().toISOString(), approved_finance_by: profile.id }
      } else if (role === 'cfo') {
        updateData = { status: 'closed', approved_cfo_at: new Date().toISOString(), approved_cfo_by: profile.id }
      }
    } else if (existingLpj.status === 'approved_finance' && role === 'cfo') {
      updateData = { status: 'closed', approved_cfo_at: new Date().toISOString(), approved_cfo_by: profile.id }
    }

    await supabase.from('lpj').update(updateData).eq('id', existingLpj.id)
    await fetchData()
    setApproving(false)
  }

  async function handleSubmit() {
    // Validasi: semua item harus punya realisasi qty > 0
    const itemsValid = items.every(item => Number(realisasi[item.id]?.qty || 0) > 0)
    if (!itemsValid) { setError('Qty realisasi semua item harus diisi'); return }

    // Validasi: semua nota harus punya nama
    if (notas.some(n => !n.nama_nota.trim())) { setError('Nama nota wajib diisi semua'); return }

    // Validasi: semua item harus ter-assign ke minimal 1 nota
    const allAssignedItems = new Set(notas.flatMap(n => n.itemIds))
    const unassigned = items.filter(item => !allAssignedItems.has(item.id))
    if (unassigned.length > 0) {
      setError(`Item "${unassigned[0].uraian}" belum di-assign ke nota manapun`)
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

      // Insert notas + items
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
            fileName = nota.file.name || 'nota.jpg'
          }
        }

        // Hitung total nota dari item yang ter-assign
        const totalNota = nota.itemIds.reduce((sum, itemId) => {
          const r = realisasi[itemId]
          return sum + (Number(r?.qty || 0) * Number(r?.harga || 0))
        }, 0)

        const { data: notaData, error: notaErr } = await supabase
          .from('lpj_nota')
          .insert({
            lpj_id: lpj.id,
            nama_nota: nota.nama_nota,
            total_nota: totalNota,
            file_url: fileUrl,
            file_name: fileName,
          })
          .select()
          .single()

        if (notaErr) throw notaErr

        // Insert nota items
        if (nota.itemIds.length > 0) {
          const item = items.find(i => i.id === nota.itemIds[0])
          const notaItems = nota.itemIds.map(itemId => {
            const origItem = items.find(i => i.id === itemId)
            const r = realisasi[itemId]
            return {
              nota_id: notaData.id,
              pengajuan_item_id: itemId,
              uraian: origItem?.uraian || '',
              satuan: origItem?.satuan || '',
              qty_pengajuan: origItem?.qty || 0,
              harga_pengajuan: origItem?.harga_satuan || 0,
              realisasi_qty: Number(r?.qty || 0),
              realisasi_harga: Number(r?.harga || 0),
            }
          })
          await supabase.from('lpj_nota_items').insert(notaItems)
        }
      }

      await fetchData()
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    }

    setSubmitting(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (!pengajuan) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Pengajuan tidak ditemukan</div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>
      <Sidebar onBack={() => navigate(`/pengajuan/${pengajuanId}`)} />

      {existingLpj ? (
        <LpjViewMode
          pengajuan={pengajuan}
          lpj={existingLpj}
          profile={profile}
          onApprove={handleApproveLpj}
          approving={approving}
        />
      ) : (
        <div style={{ flex: 1, marginLeft: 240, padding: 32, maxWidth: 860 }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Laporan Pertanggungjawaban</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pengajuan.judul} · {pengajuan.kode_surat}</div>
          </div>

          {/* Summary anggaran */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {[
                { label: 'Total Anggaran', value: formatRp(pengajuan.total_pengajuan), color: '#111' },
                { label: 'Total Realisasi', value: formatRp(totalRealisasi), color: '#2E7D32' },
                { label: 'Sisa Dana', value: formatRp(Math.abs(sisaDana)), color: sisaDana > 0 ? '#C0272D' : '#2E7D32' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#C0272D' }}>
              {error}
            </div>
          )}

          {/* Realisasi per item */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111' }}>
              Realisasi Item
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Item', 'Qty Pengajuan', 'Qty Realisasi', 'Harga Realisasi', 'Subtotal'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h === 'Item' ? 'left' : 'right', borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const r = realisasi[item.id] || {}
                  const subtotal = Number(r.qty || 0) * Number(r.harga || 0)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F8F8F8' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#111' }}>
                        <div>{item.uraian}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Pengajuan: {item.qty} {item.satuan} × {formatRp(item.harga_satuan)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#999', textAlign: 'right' }}>
                        {item.qty} {item.satuan}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <input
                            type="number"
                            value={r.qty || ''}
                            onChange={e => updateRealisasi(item.id, 'qty', e.target.value)}
                            style={{ width: 70, padding: '6px 8px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }}
                          />
                          <span style={{ fontSize: 12, color: '#999' }}>{item.satuan}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={r.harga || ''}
                          onChange={e => updateRealisasi(item.id, 'harga', e.target.value)}
                          style={{ width: 110, padding: '6px 8px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>
                        {formatRp(subtotal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #111' }}>
                  <td colSpan={4} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#555' }}>Total Realisasi</td>
                  <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 700, color: '#C0272D', textAlign: 'right' }}>{formatRp(totalRealisasi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Bukti Nota</div>
              <button onClick={addNota}
                style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Tambah Nota
              </button>
            </div>

            {notas.map((nota, idx) => (
              <div key={idx} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: 20, marginBottom: 16 }}
                onPaste={e => handlePaste(idx, e)}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Nota #{idx + 1}</div>
                  {notas.length > 1 && (
                    <button onClick={() => removeNota(idx)}
                      style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 18 }}>×</button>
                  )}
                </div>

                {/* Nama nota */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Nama Toko / Keterangan Nota</label>
                  <input className="form-input" placeholder="Contoh: Toko ABC, Indomaret, dll"
                    value={nota.nama_nota} onChange={e => updateNota(idx, 'nama_nota', e.target.value)} />
                </div>

                {/* Assign items */}
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label" style={{ marginBottom: 8 }}>Item yang dicakup nota ini</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(item => {
                      const r = realisasi[item.id] || {}
                      const subtotal = Number(r.qty || 0) * Number(r.harga || 0)
                      const checked = nota.itemIds.includes(item.id)
                      return (
                        <label key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                          padding: '10px 12px', borderRadius: 8,
                          background: checked ? '#FFF5F5' : '#FAFAFA',
                          border: `1px solid ${checked ? '#C0272D' : '#F0F0F0'}`
                        }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleItemInNota(idx, item.id)}
                            style={{ accentColor: '#C0272D' }} />
                          <span style={{ fontSize: 13, color: '#333', flex: 1 }}>{item.uraian}</span>
                          <span style={{ fontSize: 12, color: '#888' }}>
                            {r.qty} {item.satuan} × {formatRp(r.harga)} = <strong>{formatRp(subtotal)}</strong>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Upload foto */}
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
                        style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 18 }}>×</button>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #E0E0E0', borderRadius: 10, padding: 20, cursor: 'pointer' }}>
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

          {/* Sisa dana */}
          {sisaDana > 0 && (
            <div style={{ background: '#FFF8E1', borderRadius: 12, border: '1px solid #FFE082', padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#B8860B', marginBottom: 12 }}>
                Sisa dana {formatRp(sisaDana)} — pilih metode pengembalian
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['transfer', 'cash'].map(m => (
                  <button key={m} onClick={() => setMetodePengembalian(m)}
                    style={{
                      flex: 1, padding: 10,
                      background: metodePengembalian === m ? '#FFF0F0' : '#fff',
                      border: `1.5px solid ${metodePengembalian === m ? '#C0272D' : '#E0E0E0'}`,
                      borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: metodePengembalian === m ? '#C0272D' : '#555',
                      cursor: 'pointer', fontFamily: 'inherit'
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
      )}
    </div>
  )
}