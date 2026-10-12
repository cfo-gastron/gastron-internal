import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { notifyPengajuanUpdate } from '../lib/sendNotif'
import { canEditPengajuan, tahapTerakhir } from '../lib/approval'
import { STATUS_LABEL } from '../lib/status'
import DeleteButton from '../components/DeleteButton'
import RekeningTujuanFields from '../components/RekeningTujuanFields'
import { REKENING_KOSONG, rapikanRekening } from '../lib/rekening'
import SubkategoriOtomatis from '../components/SubkategoriOtomatis'
import { useSubkategoriOtomatis } from '../hooks/useSubkategoriOtomatis'
import JudulField from '../components/JudulField'

const SATUAN_OPTIONS = ['Pcs', 'Unit', 'Kaleng', 'Liter', 'Kg', 'Box', 'Lembar', 'Trip', 'Bulan', 'Lainnya']

const TIPE_OPTIONS = [
  { value: 'kebutuhan', label: 'Pengajuan Kebutuhan' },
  { value: 'reimbursement', label: 'Reimbursement' },
]

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function EditPengajuanPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [pengajuan, setPengajuan] = useState(null)

  // Form state
  const [judul, setJudul] = useState('')
  const [tipe, setTipe] = useState('kebutuhan')
  const [awalSub, setAwalSub] = useState(null)
  const [metodeBayar, setMetodeBayar] = useState('Transfer')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState([])
  const [penerima, setPenerima] = useState([])

  // Attachments: existing (dari DB) + new (File objects)
  const [existingAttachments, setExistingAttachments] = useState([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([])
  const [newAttachments, setNewAttachments] = useState([])

  const subOtomatis = useSubkategoriOtomatis(judul, items.map(it => it.uraian), awalSub)
  const total = items.reduce((s, i) => s + (Number(i.qty) * Number(i.harga_satuan)), 0)

  useEffect(() => {
    fetchData()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [id])

  async function fetchData() {
    setLoading(true)
    const [p, i, pn, a] = await Promise.all([
      supabase.from('pengajuan').select('*').eq('id', id).single(),
      supabase.from('pengajuan_items').select('*').eq('pengajuan_id', id).order('urutan'),
      supabase.from('pengajuan_penerima').select('*').eq('pengajuan_id', id),
      supabase.from('pengajuan_attachments').select('*').eq('pengajuan_id', id),
    ])

    const data = p.data
    if (!data) { setLoading(false); return }

    setPengajuan(data)
    setJudul(data.judul || '')
    setTipe(data.tipe || 'kebutuhan')
    setMetodeBayar(data.metode_pembayaran || 'Transfer')
    setCatatan(data.catatan || '')

    // Subkategori tersimpan dipakai selama judul & item tidak diubah
    setAwalSub({ judul: data.judul || '', items: (i.data || []).map(it => it.uraian), subkategori: data.subkategori })

    // Items
    setItems((i.data || []).map(item => ({
      id: item.id,
      uraian: item.uraian,
      qty: item.qty,
      satuan: item.satuan,
      harga_satuan: item.harga_satuan,
    })))

    // Penerima
    setPenerima((pn.data || []).map(p => ({
      id: p.id,
      nama_penerima: p.nama_penerima || '',
      bank: p.bank || '',
      no_rekening: p.no_rekening || '',
      atas_nama: p.atas_nama || '',
    })))
    if ((pn.data || []).length === 0) {
      setPenerima([{ ...REKENING_KOSONG }])
    }

    setExistingAttachments(a.data || [])
    setLoading(false)
  }

  function addItem() { setItems([...items, { uraian: '', qty: 1, satuan: 'Pcs', harga_satuan: 0 }]) }
  function removeItem(idx) { if (items.length === 1) return; setItems(items.filter((_, i) => i !== idx)) }
  function updateItem(idx, field, value) { const u = [...items]; u[idx][field] = value; setItems(u) }

  function addPenerima() { setPenerima([...penerima, { ...REKENING_KOSONG }]) }
  function removePenerima(idx) { if (penerima.length === 1) return; setPenerima(penerima.filter((_, i) => i !== idx)) }
  function updatePenerima(idx, field, value) { const u = [...penerima]; u[idx][field] = value; setPenerima(u) }

  function removeExistingAttachment(attachId) {
    setRemovedAttachmentIds(prev => [...prev, attachId])
    setExistingAttachments(prev => prev.filter(a => a.id !== attachId))
  }

  function handleFileChange(e) { setNewAttachments(prev => [...prev, ...Array.from(e.target.files)]) }
  function handlePaste(e) {
    const its = e.clipboardData?.items
    if (!its) return
    for (let i = 0; i < its.length; i++) {
      if (its[i].type.indexOf('image') !== -1) {
        const file = its[i].getAsFile()
        if (file) setNewAttachments(prev => [...prev, file])
      }
    }
  }
  function removeNewAttachment(idx) { setNewAttachments(newAttachments.filter((_, i) => i !== idx)) }

  async function handleSubmit() {
    if (!judul.trim()) { setError('Judul pengajuan wajib diisi'); return }
    if (items.some(i => !i.uraian.trim())) { setError('Semua uraian item wajib diisi'); return }

    setSubmitting(true)
    setError(null)

    try {
      const finalSubkategori = await subOtomatis.pastikan()
      // Ditahan: isi disimpan, tetap ditahan (approver yang melanjutkan).
      // Perlu Revisi: dikirim ulang ke tahap yang meminta revisi.
      const sedangDitahan = pengajuan.status === 'hold'
      const statusBaru = sedangDitahan ? 'hold' : tahapTerakhir(pengajuan)

      // Item & rekening disimpan AMAN: data baru masuk dulu, yang lama baru dihapus setelah semua berhasil.
      // (Dulu: hapus dulu lalu insert tanpa cek error. Insert selalu gagal karena kolom `jumlah` dihitung
      //  otomatis oleh database, jadi item hilang setiap kali pengajuan direvisi.)
      const { data: itemLama, error: ilErr } = await supabase.from('pengajuan_items').select('id').eq('pengajuan_id', id)
      if (ilErr) throw new Error(`Gagal membaca item lama (${ilErr.message})`)
      const { data: penLama, error: plErr } = await supabase.from('pengajuan_penerima').select('id').eq('pengajuan_id', id)
      if (plErr) throw new Error(`Gagal membaca rekening lama (${plErr.message})`)

      const { data: itemBaru, error: iErr } = await supabase.from('pengajuan_items').insert(
        items.map((item, idx) => ({
          pengajuan_id: id,
          urutan: idx + 1,
          uraian: item.uraian,
          qty: Number(item.qty),
          satuan: item.satuan,
          harga_satuan: Number(item.harga_satuan),
        }))
      ).select('id')
      if (iErr) throw new Error(`Item gagal disimpan (${iErr.message}). Belum ada yang berubah, coba lagi.`)

      const penerimaToInsert = rapikanRekening(penerima)
      let penBaru = []
      if (penerimaToInsert.length > 0) {
        const { data, error: penErr } = await supabase.from('pengajuan_penerima').insert(
          penerimaToInsert.map((r) => { const rest = { ...r }; delete rest.id; delete rest.created_at; return { ...rest, pengajuan_id: id } })
        ).select('id')
        if (penErr) {
          await supabase.from('pengajuan_items').delete().in('id', (itemBaru || []).map(r => r.id))
          throw new Error(`Rekening tujuan gagal disimpan (${penErr.message}). Belum ada yang berubah, coba lagi.`)
        }
        penBaru = data || []
      }
      const batalkanBaru = async () => {
        await supabase.from('pengajuan_items').delete().in('id', (itemBaru || []).map(r => r.id))
        if (penBaru.length) await supabase.from('pengajuan_penerima').delete().in('id', penBaru.map(r => r.id))
      }

      // Update pengajuan — kode_surat tidak berubah
      const { data: pUpdated, error: pErr } = await supabase.from('pengajuan').update({
        judul,
        tipe,
        subkategori: finalSubkategori,
        metode_pembayaran: metodeBayar,
        catatan,
        total_pengajuan: total,
        status: statusBaru,
        ...(statusBaru === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
        ...(sedangDitahan ? {} : { rejection_reason: null, rejection_type: null }),
      }).eq('id', id).eq('status', pengajuan.status).select('id')

      if (pErr) { await batalkanBaru(); throw pErr }
      if (!pUpdated || pUpdated.length === 0) { await batalkanBaru(); throw new Error('Pengajuan ini sudah tidak bisa diubah (statusnya berubah). Muat ulang halaman.') }

      // Semua data baru sudah masuk, baru hapus item & rekening lama
      if (itemLama?.length) {
        const { error } = await supabase.from('pengajuan_items').delete().in('id', itemLama.map(r => r.id))
        if (error) console.error('Item lama gagal dihapus:', error)
      }
      if (penLama?.length) {
        const { error } = await supabase.from('pengajuan_penerima').delete().in('id', penLama.map(r => r.id))
        if (error) console.error('Rekening lama gagal dihapus:', error)
      }

      // Hapus attachment yang di-remove
      for (const attachId of removedAttachmentIds) {
        await supabase.from('pengajuan_attachments').delete().eq('id', attachId)
      }

      // Upload attachment baru (yang gagal dilaporkan, tidak diam-diam hilang)
      const gagalUpload = []
      for (const file of newAttachments) {
        const ext = file.name?.split('.').pop() || 'jpg'
        const fileName = `${id}/${Date.now()}.${ext}`
        const { data: uploadData } = await supabase.storage.from('pengajuan-attachments').upload(fileName, file)
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('pengajuan-attachments').getPublicUrl(fileName)
          await supabase.from('pengajuan_attachments').insert({
            pengajuan_id: id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: profile.id,
          })
        } else gagalUpload.push(file.name || 'gambar')
      }

      // Catat di timeline
      const { error: logErr } = await supabase.from('approval_logs').insert({
        pengajuan_id: id,
        action: sedangDitahan ? 'diubah' : 'submitted',
        action_by: profile.id,
        role_at_time: profile.role,
        catatan: sedangDitahan ? 'Isi pengajuan diubah saat ditahan' : `Dikirim ulang setelah revisi, kembali ke ${STATUS_LABEL[statusBaru]}`,
      })
      if (logErr) console.error('Gagal mencatat di timeline:', logErr)

      notifyPengajuanUpdate(
        { ...pengajuan, id, judul, total_pengajuan: total },
        statusBaru,
        sedangDitahan
          ? { title: '✏️ Pengajuan yang ditahan diubah', body: `"${judul}" diubah oleh ${profile.full_name}. Masih ditahan.` }
          : { title: '📝 Pengajuan diajukan ulang', body: `"${judul}" diajukan ulang oleh ${profile.full_name} setelah revisi, kembali ke ${STATUS_LABEL[statusBaru]}` }
      )

      if (gagalUpload.length > 0) alert(`Perubahan tersimpan, tapi lampiran gagal diunggah: ${gagalUpload.join(', ')}. Coba tambahkan lagi lewat Ubah.`)
      navigate(`/pengajuan/${id}`)
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    }

    setSubmitting(false)
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #F0F0F0',
    padding: isMobile ? '16px' : '24px',
    marginBottom: 16,
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!pengajuan) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Pengajuan tidak ditemukan</div>
  if (!canEditPengajuan(profile?.id, pengajuan)) return <BlockedPage onBack={() => navigate(`/pengajuan/${id}`)} text="Pengajuan ini tidak bisa diubah. Hanya pengaju yang bisa mengubah, dan hanya saat statusnya Perlu Revisi atau Ditahan." />

  return (
    <div style={{ background: '#F8F8F8', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      {/* HEADER */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #F0F0F0',
        padding: isMobile ? '14px 16px' : '16px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxSizing: 'border-box',
        width: '100%',
      }}>
        <button onClick={() => navigate(`/pengajuan/${id}`)} aria-label="Kembali"
          style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 10, margin: -10, minWidth: 44, minHeight: 44, lineHeight: 1, flexShrink: 0 }}>
          ←
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Edit Pengajuan</div>
        <div style={{ marginLeft: 'auto', background: '#FFF8E1', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#B8860B' }}>
          {pengajuan.kode_surat}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{
        padding: isMobile ? '16px 16px 120px' : '24px 32px 80px',
        maxWidth: isMobile ? '100%' : 800,
        margin: '0 auto',
        boxSizing: 'border-box',
        width: '100%',
      }}>

        {/* Banner info revisi */}
        {pengajuan.rejection_reason && (
          <div style={{
            background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10,
            padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#B8860B', marginBottom: 4 }}>
              📝 Catatan Revisi
            </div>
            <div style={{ fontSize: 13, color: '#7A5C00' }}>{pengajuan.rejection_reason}</div>
          </div>
        )}

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#C0272D' }}>
            {error}
          </div>
        )}

        {/* Info Pengajuan */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 16 }}>Informasi Pengajuan</div>

          <JudulField value={judul} onChange={setJudul} />

          <div className="form-group">
            <label className="form-label">Tipe Pengajuan *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setTipe(opt.value)}
                  style={{
                    flex: 1, padding: '11px 8px',
                    background: tipe === opt.value ? '#FFF0F0' : '#F5F5F5',
                    border: `1.5px solid ${tipe === opt.value ? '#C0272D' : 'transparent'}`,
                    borderRadius: 10, fontSize: isMobile ? 12 : 13, fontWeight: 600,
                    color: tipe === opt.value ? '#C0272D' : '#555',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <SubkategoriOtomatis status={subOtomatis.status} subkategori={subOtomatis.subkategori} />

          <div className="form-group">
            <label className="form-label">Metode Pembayaran</label>
            <select className="form-input" value={metodeBayar} onChange={e => setMetodeBayar(e.target.value)}>
              <option>Transfer</option>
              <option>Cash</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Catatan</label>
            <textarea className="form-input" placeholder="Catatan tambahan (opsional)"
              value={catatan} onChange={e => setCatatan(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Items */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Item Pengajuan</div>
            <button onClick={addItem}
              style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah Item
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ background: '#FAFAFA', borderRadius: 10, padding: '14px', marginBottom: 10, position: 'relative' }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>Item #{idx + 1}</div>

              <div style={{ marginBottom: 10 }}>
                <input className="form-input" placeholder="Nama item / uraian"
                  value={item.uraian} onChange={e => updateItem(idx, 'uraian', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div className="form-label">Qty</div>
                  <input className="form-input" type="number" min="1" value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div className="form-label">Satuan</div>
                  <select className="form-input" value={item.satuan}
                    onChange={e => updateItem(idx, 'satuan', e.target.value)}>
                    {SATUAN_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="form-label">Harga Satuan (Rp)</div>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={item.harga_satuan || ''}
                  onChange={e => updateItem(idx, 'harga_satuan', e.target.value)}
                  style={{ textAlign: 'right' }} />
              </div>

              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#C0272D' }}>
                = {formatRp(Number(item.qty) * Number(item.harga_satuan))}
              </div>

              {items.length > 1 && (
                <div style={{ position: 'absolute', top: 2, right: 2 }}><DeleteButton label={`Hapus item ${idx + 1}`} onConfirm={() => removeItem(idx)} /></div>
              )}
            </div>
          ))}

          <div style={{ borderTop: '2px solid #111', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Total Pengajuan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#C0272D' }}>{formatRp(total)}</div>
          </div>
        </div>

        {/* Penerima */}
        {/* Rekening tujuan: urutan & label dari lib/rekening.js */}
        <RekeningTujuanFields penerima={penerima} onAdd={addPenerima} onRemove={removePenerima} onUpdate={updatePenerima} isMobile={isMobile} cardStyle={cardStyle} />

        {/* Attachments */}
        <div style={cardStyle} onPaste={handlePaste}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>Lampiran</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
            Upload foto nota, invoice, atau dokumen pendukung.
          </div>

          {/* Existing attachments */}
          {existingAttachments.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0F7FF', border: '1px solid #BBDEFB', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ flexShrink: 0 }}>{a.file_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                <div style={{ minWidth: 0 }}>
                  <a href={a.file_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, fontWeight: 500, color: '#1565C0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>
                    {a.file_name}
                  </a>
                  <div style={{ fontSize: 10, color: '#999' }}>File lama</div>
                </div>
              </div>
              <DeleteButton label="Hapus lampiran" style={{ flexShrink: 0, marginLeft: 8 }} onConfirm={() => removeExistingAttachment(a.id)} />
            </div>
          ))}

          {/* New attachments */}
          {newAttachments.map((file, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ flexShrink: 0 }}>{file.type?.includes('pdf') ? '📄' : '🖼️'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <DeleteButton label="Hapus lampiran" style={{ flexShrink: 0, marginLeft: 8 }} onConfirm={() => removeNewAttachment(idx)} />
            </div>
          ))}

          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            border: '1.5px dashed #E0E0E0', borderRadius: 10, padding: '20px',
            cursor: 'pointer', marginTop: existingAttachments.length > 0 || newAttachments.length > 0 ? 8 : 0,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Klik untuk upload file baru</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>PDF, JPG, PNG</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* STICKY BOTTOM */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #F0F0F0',
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 10, zIndex: 40,
      }}>
        <button onClick={() => navigate(`/pengajuan/${id}`)}
          style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
          Batal
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ flex: 2, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Menyimpan...' : pengajuan.status === 'hold' ? 'Simpan perubahan' : 'Submit Ulang'}
        </button>
      </div>
    </div>
  )
}

function BlockedPage({ text, onBack }) {
  return (
    <div style={{ padding: 40, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{text}</div>
      <button onClick={onBack} className="btn-primary" style={{ width: 'auto', padding: '12px 20px' }}>Kembali ke pengajuan</button>
    </div>
  )
}
