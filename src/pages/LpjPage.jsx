import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { notifyLpjUpdate } from '../lib/sendNotif'

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function LpjViewMode({ pengajuan, lpj, profile, onApprove, approving, error, isMobile, onBack, onEdit }) {
  const sisaDana = Number(lpj.total_pengajuan) - Number(lpj.total_realisasi)
  const role = profile?.role
  const [showCloseModal, setShowCloseModal] = useState(false)

  const canApproveLpj = () => {
    if (lpj.status === 'submitted' && (role === 'finance' || role === 'cfo')) return true
    if (lpj.status === 'approved_finance' && role === 'cfo') return true
    return false
  }

  const canEditLpj = () => {
    if (lpj.status !== 'submitted') return false
    if (role === 'cfo' || role === 'finance') return true
    if (lpj.submitted_by === profile?.id) return true
    return false
  }

  const approveLabel = () => {
    if (lpj.status === 'submitted' && role === 'finance') return '✓ Approve LPJ (Finance)'
    if (lpj.status === 'submitted' && role === 'cfo') return '✓ Approve LPJ (CFO)'
    if (lpj.status === 'approved_finance' && role === 'cfo') return '✓ Final Approve & Close LPJ'
    return ''
  }

  // Cek apakah action ini akan close LPJ
  const willClose = (lpj.status === 'submitted' && role === 'cfo') || lpj.status === 'approved_finance'

  function handleApproveClick() {
    if (willClose) setShowCloseModal(true)
    else onApprove()
  }

  const statusLabel = { submitted: 'Menunggu Approval', approved_finance: 'Menunggu CFO', closed: 'Closed ✓' }
  const statusColor = { submitted: '#B8860B', approved_finance: '#1565C0', closed: '#2E7D32' }
  const statusBg = { submitted: '#FFF8E1', approved_finance: '#E3F2FD', closed: '#E8F5E9' }

  return (
    <div style={{ flex: 1, marginLeft: isMobile ? 0 : 240, padding: isMobile ? '16px 16px 100px' : '32px', maxWidth: isMobile ? '100%' : 860 }}>
      {isMobile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#C0272D' }}>Gastron</span>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111' }}>Laporan Pertanggungjawaban</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pengajuan?.judul} · {pengajuan?.kode_surat}</div>
        </div>
        {canEditLpj() && (
          <button onClick={onEdit} style={{ background: '#FFF0F0', border: '1.5px solid #C0272D', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#C0272D', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            ✏️ Edit LPJ
          </button>
        )}
      </div>

      <div style={{ background: statusBg[lpj.status] || '#F5F5F5', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: statusColor[lpj.status] || '#555' }}>{statusLabel[lpj.status] || lpj.status}</div>
        <div style={{ fontSize: 11, color: '#999' }}>Disubmit {formatDate(lpj.submitted_at)}</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : 24, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 12 : 20 }}>
          {[
            { label: 'Total Anggaran', value: formatRp(lpj.total_pengajuan), color: '#111' },
            { label: 'Realisasi', value: formatRp(lpj.total_realisasi), color: '#2E7D32' },
            { label: 'Sisa Dana', value: formatRp(Math.abs(sisaDana)), color: sisaDana > 0 ? '#C0272D' : '#2E7D32' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
        {sisaDana > 0 && lpj.metode_pengembalian && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F5F5F5', fontSize: 13, color: '#888' }}>
            Sisa dikembalikan via: <strong style={{ color: '#111' }}>{lpj.metode_pengembalian === 'transfer' ? '🏦 Transfer' : '💵 Cash'}</strong>
          </div>
        )}
      </div>

      {lpj.lpj_nota?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111' }}>Detail Realisasi per Nota</div>
          {lpj.lpj_nota.map((nota, i) => (
            <div key={nota.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F8F8F8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Nota #{i + 1} — {nota.nama_nota}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C0272D', marginTop: 2 }}>{formatRp(nota.total_nota)}</div>
                </div>
                {nota.file_url && (
                  <a href={nota.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', background: '#E3F2FD', padding: '6px 10px', borderRadius: 8, flexShrink: 0 }}>
                    📎 Lihat Nota
                  </a>
                )}
              </div>
              {nota.lpj_nota_items?.length > 0 && (
                isMobile ? (
                  <div style={{ background: '#FAFAFA', borderRadius: 8, overflow: 'hidden' }}>
                    {nota.lpj_nota_items.map(ni => (
                      <div key={ni.id} style={{ padding: '10px 12px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>{ni.uraian || '-'}</div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{ni.realisasi_qty} {ni.satuan} × {formatRp(ni.realisasi_harga)}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', flexShrink: 0 }}>{formatRp(ni.realisasi_qty * ni.realisasi_harga)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                )
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#C0272D' }}>{error}</div>}

      {canApproveLpj() && (
        isMobile ? (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #EBEBEB', padding: '12px 16px', paddingBottom: 'max(32px, calc(20px + env(safe-area-inset-bottom)))', zIndex: 90 }}>
            <button onClick={handleApproveClick} disabled={approving} style={{ width: '100%', padding: 14, background: '#2E7D32', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: approving ? 0.7 : 1 }}>
              {approving ? 'Memproses...' : approveLabel()}
            </button>
          </div>
        ) : (
          <button onClick={handleApproveClick} disabled={approving} style={{ width: '100%', padding: 14, background: '#2E7D32', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: approving ? 0.7 : 1, marginBottom: 12 }}>
            {approving ? 'Memproses...' : approveLabel()}
          </button>
        )
      )}

      {lpj.status === 'closed' && (
        <div style={{ background: '#E8F5E9', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>✓ LPJ Closed</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Laporan pertanggungjawaban telah selesai diverifikasi</div>
        </div>
      )}

      {/* CLOSE LPJ MODAL */}
      {showCloseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, padding: isMobile ? '28px 20px' : 32, paddingBottom: isMobile ? 'max(40px, calc(28px + env(safe-area-inset-bottom)))' : 32, width: isMobile ? '100%' : 420 }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />}
            <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8, textAlign: 'center' }}>Close LPJ?</div>
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Yakin mau close LPJ ini? Total realisasi <strong style={{ color: '#2E7D32' }}>{formatRp(lpj.total_realisasi)}</strong>, sisa dana <strong style={{ color: '#C0272D' }}>{formatRp(Math.abs(sisaDana))}</strong>. Setelah closed tidak bisa diubah.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCloseModal(false)}
                style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={() => { setShowCloseModal(false); onApprove() }} disabled={approving}
                style={{ flex: 1, padding: '13px', background: '#2E7D32', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: approving ? 0.7 : 1 }}>
                {approving ? 'Memproses...' : 'Ya, Close LPJ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function genId() { return 'extra_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) }

export default function LpjPage() {
  const { pengajuanId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pengajuan, setPengajuan] = useState(null)
  const [items, setItems] = useState([])
  const [extraItems, setExtraItems] = useState([])
  const [existingLpj, setExistingLpj] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const [realisasi, setRealisasi] = useState({})
  const [notas, setNotas] = useState([{ nama_nota: '', file: null, existingFileUrl: null, existingFileName: null, itemIds: [] }])
  const [metodePengembalian, setMetodePengembalian] = useState('transfer')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchData()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pengajuanId])

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
    const pre = {}
    itemList.forEach(item => { pre[item.id] = { qty: '', harga: item.harga_satuan } })
    setRealisasi(pre)
    if (l.data) setExistingLpj(l.data)
    setLoading(false)
  }

  function enterEditMode() {
    if (!existingLpj) return
    const origIds = new Set(items.map(i => i.id))
    const newRealisasi = {}
    items.forEach(item => { newRealisasi[item.id] = { qty: '', harga: item.harga_satuan } })
    const rebuilt_extras = []

    existingLpj.lpj_nota?.forEach(nota => {
      nota.lpj_nota_items?.forEach(ni => {
        if (origIds.has(ni.pengajuan_item_id)) {
          newRealisasi[ni.pengajuan_item_id] = { qty: ni.realisasi_qty, harga: ni.realisasi_harga }
        } else {
          const tempId = genId()
          rebuilt_extras.push({ id: tempId, uraian: ni.uraian, satuan: ni.satuan, qty: ni.realisasi_qty, harga: ni.realisasi_harga })
        }
      })
    })
    setRealisasi(newRealisasi)
    setExtraItems(rebuilt_extras)

    const rebuiltNotas = existingLpj.lpj_nota?.map(nota => {
      const itemIds = nota.lpj_nota_items?.map(ni => {
        if (origIds.has(ni.pengajuan_item_id)) return ni.pengajuan_item_id
        const match = rebuilt_extras.find(e => e.uraian === ni.uraian && Number(e.harga) === Number(ni.realisasi_harga))
        return match ? match.id : null
      }).filter(Boolean) || []
      return { nama_nota: nota.nama_nota, file: null, existingFileUrl: nota.file_url || null, existingFileName: nota.file_name || null, itemIds }
    }) || [{ nama_nota: '', file: null, existingFileUrl: null, existingFileName: null, itemIds: [] }]

    setNotas(rebuiltNotas)
    setMetodePengembalian(existingLpj.metode_pengembalian || 'transfer')
    setIsEditing(true)
    setError(null)
  }

  function cancelEdit() { setIsEditing(false); setError(null) }

  function addExtraItem() {
    setExtraItems(prev => [...prev, { id: genId(), uraian: '', satuan: '', qty: '', harga: '' }])
  }
  function removeExtraItem(id) {
    setExtraItems(prev => prev.filter(e => e.id !== id))
    setNotas(prev => prev.map(n => ({ ...n, itemIds: n.itemIds.filter(iid => iid !== id) })))
  }
  function updateExtraItem(id, field, value) {
    setExtraItems(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const activeOrigItems = items.filter(item => Number(realisasi[item.id]?.qty || 0) > 0)
  const totalRealisasiOriginal = activeOrigItems.reduce((sum, item) => {
    const r = realisasi[item.id]
    return sum + (Number(r?.qty || 0) * Number(r?.harga || 0))
  }, 0)
  const totalRealisasiExtra = extraItems.reduce((sum, e) => sum + (Number(e.qty || 0) * Number(e.harga || 0)), 0)
  const totalRealisasi = totalRealisasiOriginal + totalRealisasiExtra
  const sisaDana = Number(pengajuan?.total_pengajuan || 0) - totalRealisasi

  const allItemsForNota = [
    ...activeOrigItems.map(item => ({
      id: item.id, uraian: item.uraian, satuan: item.satuan,
      qty: realisasi[item.id]?.qty || 0, harga: realisasi[item.id]?.harga || 0, isExtra: false,
    })),
    ...extraItems.map(e => ({
      id: e.id, uraian: e.uraian || '(item tambahan)', satuan: e.satuan,
      qty: e.qty || 0, harga: e.harga || 0, isExtra: true,
    })),
  ]

  function updateRealisasi(itemId, field, value) {
    setRealisasi(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }))
  }

  function addNota() { setNotas([...notas, { nama_nota: '', file: null, existingFileUrl: null, existingFileName: null, itemIds: [] }]) }
  function removeNota(idx) { if (notas.length === 1) return; setNotas(notas.filter((_, i) => i !== idx)) }
  function updateNota(idx, field, value) { const u = [...notas]; u[idx][field] = value; setNotas(u) }

  function toggleItemInNota(notaIdx, itemId) {
    const updated = [...notas]
    const ids = updated[notaIdx].itemIds
    updated[notaIdx].itemIds = ids.includes(itemId) ? ids.filter(id => id !== itemId) : [...ids, itemId]
    setNotas(updated)
  }

  function handleFileChange(idx, e) { const file = e.target.files[0]; if (file) updateNota(idx, 'file', file) }
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
    setApproving(true); setError(null)
    const role = profile?.role
    let updateData = {}
    let newStatus = ''
    if (existingLpj.status === 'submitted' && role === 'finance') {
      updateData = { status: 'approved_finance', approved_finance_at: new Date().toISOString(), approved_finance_by: profile.id }
      newStatus = 'approved_finance'
    } else if (existingLpj.status === 'submitted' && role === 'cfo') {
      updateData = { status: 'closed', approved_cfo_at: new Date().toISOString(), approved_cfo_by: profile.id }
      newStatus = 'closed'
    } else if (existingLpj.status === 'approved_finance' && role === 'cfo') {
      updateData = { status: 'closed', approved_cfo_at: new Date().toISOString(), approved_cfo_by: profile.id }
      newStatus = 'closed'
    } else {
      setError(`Role "${role}" tidak bisa approve LPJ dengan status "${existingLpj.status}"`)
      setApproving(false); return
    }
    const { error: updateErr } = await supabase.from('lpj').update(updateData).eq('id', existingLpj.id)
    if (updateErr) { setError('Gagal approve: ' + updateErr.message); setApproving(false); return }

    const notifMap = {
      approved_finance: { title: '✅ LPJ disetujui Finance', body: `LPJ "${pengajuan.judul}" udah di-acc Finance, tinggal CFO` },
      closed: { title: '🎉 LPJ closed', body: `LPJ "${pengajuan.judul}" udah selesai diverifikasi, beres!` },
    }
    const notifContent = notifMap[newStatus]
    if (notifContent) notifyLpjUpdate({ ...pengajuan, id: pengajuanId }, existingLpj.submitted_by, notifContent)

    setApproving(false)
    navigate(`/pengajuan/${pengajuanId}`)
  }

  function validateForm() {
    const anyItemFilled = items.some(item => Number(realisasi[item.id]?.qty || 0) > 0)
    if (!anyItemFilled) { setError('Minimal 1 item harus ada realisasinya'); return false }
    const extraValid = extraItems.every(e => e.uraian.trim() && Number(e.qty || 0) > 0 && Number(e.harga || 0) > 0)
    if (!extraValid) { setError('Item tambahan harus diisi lengkap (nama, qty, harga)'); return false }
    if (notas.some(n => !n.nama_nota.trim())) { setError('Nama nota wajib diisi semua'); return false }
    const allAssignedItems = new Set(notas.flatMap(n => n.itemIds))
    const unassignedOrig = activeOrigItems.filter(item => !allAssignedItems.has(item.id))
    if (unassignedOrig.length > 0) { setError(`Item "${unassignedOrig[0].uraian}" belum di-assign ke nota manapun`); return false }
    const unassignedExtra = extraItems.filter(e => !allAssignedItems.has(e.id))
    if (unassignedExtra.length > 0) { setError(`Item tambahan "${unassignedExtra[0].uraian || 'baru'}" belum di-assign ke nota manapun`); return false }
    return true
  }

  async function uploadNotaFile(lpjId, nota) {
    if (!nota.file) return { fileUrl: nota.existingFileUrl || null, fileName: nota.existingFileName || null }
    const ext = nota.file.name?.split('.').pop() || 'jpg'
    const path = `${lpjId}/${Date.now()}.${ext}`
    const { data: uploadData } = await supabase.storage.from('lpj-nota').upload(path, nota.file)
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('lpj-nota').getPublicUrl(path)
      return { fileUrl: urlData.publicUrl, fileName: nota.file.name || 'nota.jpg' }
    }
    return { fileUrl: nota.existingFileUrl || null, fileName: nota.existingFileName || null }
  }

  async function handleSubmit() {
    if (!validateForm()) return
    setSubmitting(true); setError(null)
    try {
      const { data: lpj, error: lpjErr } = await supabase.from('lpj').insert({
        pengajuan_id: pengajuanId, submitted_by: profile.id, status: 'submitted',
        total_realisasi: totalRealisasi, total_pengajuan: pengajuan.total_pengajuan,
        metode_pengembalian: sisaDana > 0 ? metodePengembalian : null,
        submitted_at: new Date().toISOString(),
      }).select().single()
      if (lpjErr) throw lpjErr
      await insertNotas(lpj.id)
      notifyLpjUpdate(
        { ...pengajuan, id: pengajuanId }, profile.id,
        { title: '📋 LPJ baru', body: `${profile.full_name} submit LPJ untuk "${pengajuan.judul}"` }
      )
      await fetchData()
    } catch (err) { setError(err.message || 'Terjadi kesalahan') }
    setSubmitting(false)
  }

  async function handleUpdate() {
    if (!validateForm()) return
    setSubmitting(true); setError(null)
    try {
      const lpjId = existingLpj.id
      const { data: oldNotas } = await supabase.from('lpj_nota').select('id').eq('lpj_id', lpjId)
      if (oldNotas?.length > 0) {
        const oldNotaIds = oldNotas.map(n => n.id)
        await supabase.from('lpj_nota_items').delete().in('nota_id', oldNotaIds)
        await supabase.from('lpj_nota').delete().eq('lpj_id', lpjId)
      }
      const { error: updateErr } = await supabase.from('lpj').update({
        total_realisasi: totalRealisasi,
        metode_pengembalian: sisaDana > 0 ? metodePengembalian : null,
      }).eq('id', lpjId)
      if (updateErr) throw updateErr
      await insertNotas(lpjId)
      setIsEditing(false)
      setExtraItems([])
      await fetchData()
    } catch (err) { setError(err.message || 'Terjadi kesalahan') }
    setSubmitting(false)
  }

  async function insertNotas(lpjId) {
    for (const nota of notas) {
      const { fileUrl, fileName } = await uploadNotaFile(lpjId, nota)
      const totalNota = nota.itemIds.reduce((sum, itemId) => {
        const origItem = items.find(i => i.id === itemId)
        if (origItem) {
          const r = realisasi[itemId]
          if (Number(r?.qty || 0) === 0) return sum
          return sum + (Number(r?.qty || 0) * Number(r?.harga || 0))
        }
        const extra = extraItems.find(e => e.id === itemId)
        if (extra) return sum + (Number(extra.qty || 0) * Number(extra.harga || 0))
        return sum
      }, 0)

      const { data: notaData, error: notaErr } = await supabase.from('lpj_nota').insert({
        lpj_id: lpjId, nama_nota: nota.nama_nota, total_nota: totalNota, file_url: fileUrl, file_name: fileName,
      }).select().single()
      if (notaErr) throw notaErr

      if (nota.itemIds.length > 0) {
        const notaItems = nota.itemIds.map(itemId => {
          const origItem = items.find(i => i.id === itemId)
          if (origItem) {
            const r = realisasi[itemId]
            if (Number(r?.qty || 0) === 0) return null
            return { nota_id: notaData.id, pengajuan_item_id: itemId, uraian: origItem.uraian, satuan: origItem.satuan, qty_pengajuan: origItem.qty, harga_pengajuan: origItem.harga_satuan, realisasi_qty: Number(r?.qty || 0), realisasi_harga: Number(r?.harga || 0) }
          }
          const extra = extraItems.find(e => e.id === itemId)
          if (extra) {
            return { nota_id: notaData.id, pengajuan_item_id: null, uraian: extra.uraian, satuan: extra.satuan, qty_pengajuan: 0, harga_pengajuan: 0, realisasi_qty: Number(extra.qty || 0), realisasi_harga: Number(extra.harga || 0) }
          }
          return null
        }).filter(Boolean)
        if (notaItems.length > 0) await supabase.from('lpj_nota_items').insert(notaItems)
      }
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!pengajuan) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Pengajuan tidak ditemukan</div>

  const backTo = () => navigate(`/pengajuan/${pengajuanId}`)
  const inputStyle = { padding: '6px 8px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: 13, textAlign: 'right', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }

  const renderForm = (isEditMode = false) => (
    <div style={{ flex: 1, marginLeft: isMobile ? 0 : 240, padding: isMobile ? '16px 16px 120px' : '32px', maxWidth: isMobile ? '100%' : 900 }}>

      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={isEditMode ? cancelEdit : backTo} style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#C0272D' }}>Gastron</span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111' }}>
          {isEditMode ? 'Edit Laporan Pertanggungjawaban' : 'Laporan Pertanggungjawaban'}
        </div>
        <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{pengajuan.judul} · {pengajuan.kode_surat}</div>
        {isEditMode && (
          <div style={{ marginTop: 8, background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#B8860B', display: 'inline-block' }}>
            ✏️ Mode Edit — perubahan akan menggantikan data LPJ sebelumnya
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : 24, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 12 : 20 }}>
          {[
            { label: 'Total Anggaran', value: formatRp(pengajuan.total_pengajuan), color: '#111' },
            { label: 'Realisasi', value: formatRp(totalRealisasi), color: '#2E7D32' },
            { label: 'Sisa Dana', value: formatRp(Math.abs(sisaDana)), color: sisaDana > 0 ? '#C0272D' : '#2E7D32' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#C0272D' }}>{error}</div>}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Realisasi Item</span>
          <button onClick={addExtraItem} style={{ background: '#F0F7FF', border: '1px solid #BBDEFB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#1565C0', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tambah Item
          </button>
        </div>

        {isMobile ? (
          <div>
            {items.map(item => {
              const r = realisasi[item.id] || {}
              const subtotal = Number(r.qty || 0) * Number(r.harga || 0)
              const isZero = Number(r.qty || 0) === 0
              return (
                <div key={item.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F8F8F8', opacity: isZero ? 0.6 : 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>{item.uraian}</div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>Pengajuan: {item.qty} {item.satuan} × {formatRp(item.harga_satuan)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Qty Realisasi <span style={{ color: '#BBB' }}>(0 = tidak jadi)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" value={r.qty} onChange={e => updateRealisasi(item.id, 'qty', e.target.value)}
                          style={{ flex: 1, padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }} />
                        <span style={{ fontSize: 11, color: '#999' }}>{item.satuan}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Harga Realisasi</div>
                      <input type="number" value={r.harga || ''} onChange={e => updateRealisasi(item.id, 'harga', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {isZero
                    ? <div style={{ textAlign: 'right', fontSize: 12, color: '#BBB', fontStyle: 'italic' }}>Tidak jadi dibeli</div>
                    : <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#C0272D' }}>= {formatRp(subtotal)}</div>
                  }
                </div>
              )
            })}
            {extraItems.map((e, idx) => {
              const subtotal = Number(e.qty || 0) * Number(e.harga || 0)
              return (
                <div key={e.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F8F8F8', background: '#FAFFF4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Item Tambahan #{idx + 1}</div>
                    <button onClick={() => removeExtraItem(e.id)} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                  <input placeholder="Nama item" value={e.uraian} onChange={ev => updateExtraItem(e.id, 'uraian', ev.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Qty</div>
                      <input type="number" placeholder="0" value={e.qty} onChange={ev => updateExtraItem(e.id, 'qty', ev.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, textAlign: 'center', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Satuan</div>
                      <input placeholder="Pcs" value={e.satuan} onChange={ev => updateExtraItem(e.id, 'satuan', ev.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Harga</div>
                      <input type="number" placeholder="0" value={e.harga} onChange={ev => updateExtraItem(e.id, 'harga', ev.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>= {formatRp(subtotal)}</div>
                </div>
              )
            })}
            <div style={{ padding: '12px 16px', borderTop: '2px solid #111', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>Total Realisasi</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#C0272D' }}>{formatRp(totalRealisasi)}</span>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Item', 'Qty Pengajuan', 'Satuan', 'Qty Realisasi', 'Harga Realisasi', 'Subtotal', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: ['Qty Pengajuan', 'Qty Realisasi', 'Harga Realisasi', 'Subtotal'].includes(h) ? 'right' : 'left', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const r = realisasi[item.id] || {}
                const subtotal = Number(r.qty || 0) * Number(r.harga || 0)
                const isZero = Number(r.qty || 0) === 0
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F8F8F8', opacity: isZero ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#111', minWidth: 160 }}>
                      <div>{item.uraian}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{formatRp(item.harga_satuan)} / {item.satuan}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#999', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qty}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#AAA' }}>{item.satuan}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" value={r.qty} onChange={e => updateRealisasi(item.id, 'qty', e.target.value)} placeholder="0"
                        style={{ ...inputStyle, width: 72, borderColor: isZero ? '#E0E0E0' : '#C0272D' }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" value={r.harga || ''} onChange={e => updateRealisasi(item.id, 'harga', e.target.value)}
                        style={{ ...inputStyle, width: 120 }} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: isZero ? '#BBB' : '#111' }}>
                      {isZero ? <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Tidak jadi</span> : formatRp(subtotal)}
                    </td>
                    <td style={{ padding: '10px 12px' }} />
                  </tr>
                )
              })}
              {extraItems.map((e, idx) => {
                const subtotal = Number(e.qty || 0) * Number(e.harga || 0)
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #F8F8F8', background: '#FAFFF4' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input placeholder={`Item tambahan ${idx + 1}`} value={e.uraian} onChange={ev => updateExtraItem(e.id, 'uraian', ev.target.value)}
                        style={{ ...inputStyle, textAlign: 'left', width: '100%', minWidth: 140 }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: '#B8C0B0', fontStyle: 'italic' }}>—</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <input placeholder="Pcs" value={e.satuan} onChange={ev => updateExtraItem(e.id, 'satuan', ev.target.value)}
                        style={{ ...inputStyle, textAlign: 'left', width: 56 }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" placeholder="0" value={e.qty} onChange={ev => updateExtraItem(e.id, 'qty', ev.target.value)}
                        style={{ ...inputStyle, width: 72 }} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input type="number" placeholder="0" value={e.harga} onChange={ev => updateExtraItem(e.id, 'harga', ev.target.value)}
                        style={{ ...inputStyle, width: 120 }} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#2E7D32', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRp(subtotal)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => removeExtraItem(e.id)} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111' }}>
                <td colSpan={5} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#555' }}>Total Realisasi</td>
                <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 700, color: '#C0272D', textAlign: 'right' }}>{formatRp(totalRealisasi)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Bukti Nota</div>
          <button onClick={addNota} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>+ Tambah Nota</button>
        </div>

        {notas.map((nota, idx) => (
          <div key={idx} style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : 20, marginBottom: 14 }} onPaste={e => handlePaste(idx, e)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Nota #{idx + 1}</div>
              {notas.length > 1 && <button onClick={() => removeNota(idx)} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 20 }}>×</button>}
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Nama Toko / Keterangan Nota</label>
              <input className="form-input" placeholder="Contoh: Toko ABC, Indomaret" value={nota.nama_nota} onChange={e => updateNota(idx, 'nama_nota', e.target.value)} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Item yang dicakup nota ini</div>
              {allItemsForNota.length === 0 ? (
                <div style={{ fontSize: 13, color: '#BBB', fontStyle: 'italic', padding: '10px 0' }}>Isi qty realisasi item dulu di atas</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allItemsForNota.map(item => {
                    const subtotal = Number(item.qty || 0) * Number(item.harga || 0)
                    const checked = nota.itemIds.includes(item.id)
                    const assignedToOther = notas.some((n, nIdx) => nIdx !== idx && n.itemIds.includes(item.id))
                    const disabled = assignedToOther && !checked
                    return (
                      <label key={item.id} style={{
                        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                        padding: '10px 12px', borderRadius: 8,
                        background: checked ? (item.isExtra ? '#F0FFF4' : '#FFF5F5') : disabled ? '#F5F5F5' : '#FAFAFA',
                        border: `1px solid ${checked ? (item.isExtra ? '#2E7D32' : '#C0272D') : '#F0F0F0'}`,
                        opacity: disabled ? 0.5 : 1,
                      }}>
                        <input type="checkbox" checked={checked} disabled={disabled}
                          onChange={() => !disabled && toggleItemInNota(idx, item.id)}
                          style={{ accentColor: item.isExtra ? '#2E7D32' : '#C0272D', marginTop: isMobile ? 2 : 0, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: disabled ? '#AAA' : '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.uraian}
                            {item.isExtra && <span style={{ fontSize: 10, background: '#E8F5E9', color: '#2E7D32', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>+</span>}
                            {assignedToOther && !checked && <span style={{ fontSize: 11, color: '#AAA' }}>(sudah di nota lain)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.qty} {item.satuan} × {formatRp(item.harga)} = <strong>{formatRp(subtotal)}</strong></div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Foto / Scan Nota</div>
              {nota.file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FAFAFA', borderRadius: 8, padding: '10px 14px' }}>
                  <span>{nota.file.type?.includes('pdf') ? '📄' : '🖼️'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{nota.file.name || 'Gambar dari clipboard'}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{nota.file.size ? `${(nota.file.size / 1024).toFixed(1)} KB` : ''}</div>
                  </div>
                  <button onClick={() => updateNota(idx, 'file', null)} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              ) : nota.existingFileUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F7FF', borderRadius: 8, padding: '10px 14px', border: '1px solid #BBDEFB' }}>
                  <span>📎</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1565C0' }}>{nota.existingFileName || 'File nota'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>File sebelumnya — upload baru untuk mengganti</div>
                  </div>
                  <a href={nota.existingFileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1565C0', textDecoration: 'none', flexShrink: 0 }}>Lihat</a>
                  <label style={{ fontSize: 12, color: '#555', cursor: 'pointer', flexShrink: 0, background: '#E3F2FD', padding: '4px 8px', borderRadius: 6 }}>
                    Ganti
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileChange(idx, e)} style={{ display: 'none' }} />
                  </label>
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

      {sisaDana > 0 && (
        <div style={{ background: '#FFF8E1', borderRadius: 12, border: '1px solid #FFE082', padding: isMobile ? '16px' : 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#B8860B', marginBottom: 12 }}>Sisa dana {formatRp(sisaDana)} — pilih metode pengembalian</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['transfer', 'cash'].map(m => (
              <button key={m} onClick={() => setMetodePengembalian(m)}
                style={{ flex: 1, padding: 10, background: metodePengembalian === m ? '#FFF0F0' : '#fff', border: `1.5px solid ${metodePengembalian === m ? '#C0272D' : '#E0E0E0'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: metodePengembalian === m ? '#C0272D' : '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                {m === 'transfer' ? '🏦 Transfer' : '💵 Cash'}
              </button>
            ))}
          </div>
        </div>
      )}

      {isMobile ? (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #EBEBEB', padding: '12px 16px', paddingBottom: 'max(32px, calc(20px + env(safe-area-inset-bottom)))', zIndex: 90, display: 'flex', gap: 10 }}>
          <button onClick={isEditMode ? cancelEdit : backTo} style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={isEditMode ? handleUpdate : handleSubmit} disabled={submitting} style={{ flex: 2, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Submit LPJ'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={isEditMode ? cancelEdit : backTo} style={{ flex: 1, padding: 14, background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={isEditMode ? handleUpdate : handleSubmit} disabled={submitting} style={{ flex: 2, padding: 14, background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Submit LPJ'}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>
      {!isMobile && (
        <div style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}><span style={{ color: '#C0272D' }}>G</span>astron</div>
              <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
            </div>
          </div>
          <button onClick={isEditing ? cancelEdit : backTo} style={{ background: '#FFF0F0', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← {isEditing ? 'Batalkan Edit' : 'Kembali'}
          </button>
        </div>
      )}

      {existingLpj && !isEditing ? (
        <LpjViewMode
          pengajuan={pengajuan} lpj={existingLpj} profile={profile}
          onApprove={handleApproveLpj} approving={approving} error={error}
          isMobile={isMobile} onBack={backTo} onEdit={enterEditMode}
        />
      ) : (
        renderForm(isEditing)
      )}
    </div>
  )
}