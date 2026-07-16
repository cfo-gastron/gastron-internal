import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { notifyPengajuanUpdate } from '../lib/sendNotif'

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

const DIVISION_MAP = {
  operational: 'OPR', procurement: 'PRC', corporate_secretary: 'ADM',
  finance: 'FIN', cfo: 'FIN', ceo: 'FIN', cao: 'ADM', coo: 'OPR',
}

const SATUAN_OPTIONS = ['Pcs', 'Unit', 'Kaleng', 'Liter', 'Kg', 'Box', 'Lembar', 'Trip', 'Bulan', 'Lainnya']

const TIPE_OPTIONS = [
  { value: 'kebutuhan', label: 'Pengajuan Kebutuhan' },
  { value: 'reimbursement', label: 'Reimbursement' },
]

// Penjelasan per subkategori
const SUBKATEGORI_INFO = {
  'Upah, Bensin, Parkir, Tol Kendaraan': 'Biaya perjalanan harian driver atau teknisi — bensin, tol, parkir, dan upah harian',
  'Operasional Kandang': 'Kebutuhan tim teknisi yang harus berangkat ke kandang — termasuk mob to mob dan recall PRS',
  'Pemeliharaan Alat': 'Servis atau perbaikan alat-alat yang ada di kandang',
  'Pemeliharaan Kendaraan': 'Servis, ganti oli, ban, atau perbaikan kendaraan operasional',
  'Marketing/Mobilisasi Operasional': 'Khusus untuk keperluan Pak Insan & Fajar ke kandang',
  'Pembelian Alat': 'Beli alat baru untuk operasional — tools, perlengkapan teknis, dll',
  'Pembelian Aset': 'Untuk pembelian aset yang jumlahnya besar — kayak DP truk atau pembuatan GTM',
  'Perjalanan Dinas': 'Perjalanan resmi ke luar kota untuk keperluan bisnis',
  'Perlengkapan Kantor': 'Kebutuhan kantor — ATK, peralatan, listrik, wifi, dll',
}

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function DeleteButton({ onConfirm, style = {} }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#C0272D', fontWeight: 500 }}>Hapus?</span>
        <button onClick={() => { setConfirming(false); onConfirm() }}
          style={{ background: '#C0272D', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Ya</button>
        <button onClick={() => setConfirming(false)}
          style={{ background: '#F5F5F5', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
      </div>
    )
  }
  return (
    <button onClick={() => setConfirming(true)}
      style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 20, lineHeight: 1, ...style }}>×</button>
  )
}

export default function FormPengajuanPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const [judul, setJudul] = useState('')
  const [tipe, setTipe] = useState('kebutuhan')
  const [subkategori, setSubkategori] = useState('')
  const [subkategoriList, setSubkategoriList] = useState([])
  const [isLainnya, setIsLainnya] = useState(false)
  const [lainnyaText, setLainnyaText] = useState('')
  const [showSubInfo, setShowSubInfo] = useState(false)
  const [metodeBayar, setMetodeBayar] = useState('Transfer')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState([{ uraian: '', qty: 1, satuan: 'Pcs', harga_satuan: 0 }])
  const [penerima, setPenerima] = useState([{ nama_penerima: '', bank: '', no_rekening: '', atas_nama: '' }])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const division = DIVISION_MAP[profile?.role] || 'OPR'
  const total = items.reduce((s, i) => s + (Number(i.qty) * Number(i.harga_satuan)), 0)
  const subInfo = SUBKATEGORI_INFO[subkategori]

  useEffect(() => {
    fetchSubkategori()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchSubkategori() {
    const { data } = await supabase.from('subkategori_pengajuan').select('nama').order('nama')
    setSubkategoriList(data?.map(d => d.nama) || [])
  }

  function handleSubkategoriChange(val) {
    if (val === 'lainnya') { setIsLainnya(true); setSubkategori(''); setShowSubInfo(false) }
    else { setIsLainnya(false); setSubkategori(val); setShowSubInfo(false) }
  }

  function addItem() { setItems([...items, { uraian: '', qty: 1, satuan: 'Pcs', harga_satuan: 0 }]) }
  function removeItem(idx) { if (items.length === 1) return; setItems(items.filter((_, i) => i !== idx)) }
  function updateItem(idx, field, value) { const u = [...items]; u[idx][field] = value; setItems(u) }

  function addPenerima() { setPenerima([...penerima, { nama_penerima: '', bank: '', no_rekening: '', atas_nama: '' }]) }
  function removePenerima(idx) { if (penerima.length === 1) return; setPenerima(penerima.filter((_, i) => i !== idx)) }
  function updatePenerima(idx, field, value) { const u = [...penerima]; u[idx][field] = value; setPenerima(u) }

  function handleFileChange(e) { setAttachments(prev => [...prev, ...Array.from(e.target.files)]) }
  function handlePaste(e) {
    const its = e.clipboardData?.items
    if (!its) return
    for (let i = 0; i < its.length; i++) {
      if (its[i].type.indexOf('image') !== -1) {
        const file = its[i].getAsFile()
        if (file) setAttachments(prev => [...prev, file])
      }
    }
  }
  function removeAttachment(idx) { setAttachments(attachments.filter((_, i) => i !== idx)) }

  async function handleSubmit() {
    if (!judul.trim()) { setError('Judul pengajuan wajib diisi'); return }
    const finalSubkategori = isLainnya ? lainnyaText.trim() : subkategori
    if (!finalSubkategori) { setError('Subkategori wajib diisi'); return }
    if (items.some(i => !i.uraian.trim())) { setError('Semua uraian item wajib diisi'); return }

    setLoading(true); setError(null)
    try {
      if (isLainnya && lainnyaText.trim()) {
        await supabase.from('subkategori_pengajuan').upsert({ nama: lainnyaText.trim() }, { onConflict: 'nama' })
      }

      const now = new Date()
      const { data: counterData } = await supabase.rpc('generate_kode_surat', { p_division: division })
      const kodeSurat = counterData || `GTR-${division}-001-${ROMAN_MONTHS[now.getMonth()]}-${now.getFullYear()}`

      const { data: pengajuan, error: pErr } = await supabase.from('pengajuan').insert({
        kode_surat: kodeSurat, judul, division, tipe,
        subkategori: finalSubkategori,
        submitted_by: profile.id,
        metode_pembayaran: metodeBayar,
        catatan, total_pengajuan: total,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      }).select().single()
      if (pErr) throw pErr

      await supabase.from('pengajuan_items').insert(
        items.map((item, idx) => ({
          pengajuan_id: pengajuan.id, urutan: idx + 1,
          uraian: item.uraian, qty: Number(item.qty),
          satuan: item.satuan, harga_satuan: Number(item.harga_satuan),
        }))
      )

      const penerimaToInsert = penerima.filter(p => p.nama_penerima.trim())
      if (penerimaToInsert.length > 0) {
        await supabase.from('pengajuan_penerima').insert(penerimaToInsert.map(p => ({ ...p, pengajuan_id: pengajuan.id })))
      }

      for (const file of attachments) {
        const ext = file.name?.split('.').pop() || 'jpg'
        const fileName = `${pengajuan.id}/${Date.now()}.${ext}`
        const { data: uploadData } = await supabase.storage.from('pengajuan-attachments').upload(fileName, file)
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('pengajuan-attachments').getPublicUrl(fileName)
          await supabase.from('pengajuan_attachments').insert({
            pengajuan_id: pengajuan.id, file_name: file.name,
            file_url: urlData.publicUrl, file_type: file.type,
            file_size: file.size, uploaded_by: profile.id,
          })
        }
      }

      await supabase.from('approval_logs').insert({
        pengajuan_id: pengajuan.id, action: 'submitted',
        action_by: profile.id, role_at_time: profile.role,
      })

      notifyPengajuanUpdate(
        { ...pengajuan },
        { title: '📝 Pengajuan baru', body: `${profile.full_name} ngajuin "${judul}"` }
      )

      navigate(`/pengajuan/${pengajuan.id}`)
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    }
    setLoading(false)
  }

  const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : '24px', marginBottom: 16 }

  return (
    <div style={{ background: '#F8F8F8', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0', padding: isMobile ? '14px 16px' : '16px 32px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40, boxSizing: 'border-box', width: '100%' }}>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Buat Pengajuan</div>
        <div style={{ marginLeft: 'auto', background: '#FFF0F0', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#C0272D' }}>{division}</div>
      </div>

      <div style={{ padding: isMobile ? '16px 16px 120px' : '24px 32px 80px', maxWidth: isMobile ? '100%' : 800, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#C0272D' }}>{error}</div>
        )}

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 16 }}>Informasi Pengajuan</div>

          {/* Judul — dengan keterangan konteks */}
          <div className="form-group">
            <label className="form-label">Judul Pengajuan *</label>
            <input className="form-input"
              placeholder="Tulis konteks pengajuannya — contoh: Service Truk Euro 2 Kandang Asrul, Mob to Mob Kandang Rahayu"
              value={judul} onChange={e => setJudul(e.target.value)} />
            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
              💡 Tulis konteks spesifiknya di sini — kandang mana, untuk apa, siapa yang terlibat
            </div>
          </div>

          {/* Tipe */}
          <div className="form-group">
            <label className="form-label">Tipe Pengajuan *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setTipe(opt.value)}
                  style={{ flex: 1, padding: '11px 8px', background: tipe === opt.value ? '#FFF0F0' : '#F5F5F5', border: `1.5px solid ${tipe === opt.value ? '#C0272D' : 'transparent'}`, borderRadius: 10, fontSize: isMobile ? 12 : 13, fontWeight: 600, color: tipe === opt.value ? '#C0272D' : '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subkategori + accordion penjelasan */}
          <div className="form-group">
            <label className="form-label">Subkategori *</label>
            <select className="form-input" value={isLainnya ? 'lainnya' : subkategori} onChange={e => handleSubkategoriChange(e.target.value)}>
              <option value="">Pilih subkategori</option>
              {subkategoriList.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="lainnya">Lainnya (ketik baru)</option>
            </select>

            {/* Accordion penjelasan */}
            {subInfo && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowSubInfo(!showSubInfo)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1565C0' }}>
                  <span style={{ fontSize: 10, transition: 'transform 0.2s', display: 'inline-block', transform: showSubInfo ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  {showSubInfo ? 'Sembunyikan penjelasan' : 'Apa itu ' + subkategori + '?'}
                </button>
                {showSubInfo && (
                  <div style={{ marginTop: 8, background: '#EEF4FF', border: '1px solid #BBDEFB', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1565C0', lineHeight: 1.6 }}>
                    {subInfo}
                  </div>
                )}
              </div>
            )}

            {isLainnya && (
              <input className="form-input" placeholder="Ketik subkategori baru"
                value={lainnyaText} onChange={e => setLainnyaText(e.target.value)} style={{ marginTop: 8 }} />
            )}
          </div>

          {/* Metode bayar */}
          <div className="form-group">
            <label className="form-label">Metode Pembayaran</label>
            <select className="form-input" value={metodeBayar} onChange={e => setMetodeBayar(e.target.value)}>
              <option>Transfer</option>
              <option>Cash</option>
            </select>
          </div>

          {/* Catatan */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Catatan</label>
            <textarea className="form-input" placeholder="Catatan tambahan kalau ada"
              value={catatan} onChange={e => setCatatan(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Item Pengajuan */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Item Pengajuan</div>
            <button onClick={addItem}
              style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah Item
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ background: '#FAFAFA', borderRadius: 10, padding: '14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#999' }}>Item #{idx + 1}</div>
                {items.length > 1 && <DeleteButton onConfirm={() => removeItem(idx)} />}
              </div>

              <div style={{ marginBottom: 10 }}>
                <input className="form-input" placeholder="Nama item / uraian"
                  value={item.uraian} onChange={e => updateItem(idx, 'uraian', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div className="form-label">Qty</div>
                  <input className="form-input" type="number" min="1" value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div className="form-label">Satuan</div>
                  <select className="form-input" value={item.satuan} onChange={e => updateItem(idx, 'satuan', e.target.value)}>
                    {SATUAN_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="form-label">Harga Satuan (Rp)</div>
                <input className="form-input" type="number" min="0" placeholder="0"
                  value={item.harga_satuan || ''} onChange={e => updateItem(idx, 'harga_satuan', e.target.value)} style={{ textAlign: 'right' }} />
              </div>

              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#C0272D' }}>
                = {formatRp(Number(item.qty) * Number(item.harga_satuan))}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '2px solid #111', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Total Pengajuan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#C0272D' }}>{formatRp(total)}</div>
          </div>
        </div>

        {/* Penerima Pembayaran */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Penerima Pembayaran</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Rekening tujuan transfer</div>
            </div>
            <button onClick={addPenerima}
              style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah
            </button>
          </div>

          {penerima.map((p, idx) => (
            <div key={idx} style={{ background: '#FAFAFA', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              {penerima.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <DeleteButton onConfirm={() => removePenerima(idx)} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
            </div>
          ))}
        </div>

        {/* Lampiran */}
        <div style={cardStyle} onPaste={handlePaste}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>Lampiran</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Upload foto nota, invoice, atau dokumen pendukung.</div>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1.5px dashed #E0E0E0', borderRadius: 10, padding: '20px', cursor: 'pointer', marginBottom: 12 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Klik untuk upload</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>PDF, JPG, PNG</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>

          {attachments.map((file, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ flexShrink: 0 }}>{file.type?.includes('pdf') ? '📄' : '🖼️'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <DeleteButton onConfirm={() => removeAttachment(idx)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #F0F0F0', padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', gap: 10, zIndex: 40 }}>
        <button onClick={() => navigate('/dashboard')}
          style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
          Batal
        </button>
        <button onClick={handleSubmit} disabled={loading}
          style={{ flex: 2, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Menyimpan...' : 'Submit Pengajuan'}
        </button>
      </div>
    </div>
  )
}