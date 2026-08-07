import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FALLBACK = { cat_id: 'd_opex', cat_name: 'Operational Expenditure', subcat_id: 'd_opex3', subcat_name: 'Operasional Tak Terduga' }

export default function MappingKategoriPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [unmapped, setUnmapped] = useState([])
  const [catOptions, setCatOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState({})
  const [suggestions, setSuggestions] = useState({})
  const [manualPick, setManualPick] = useState({})
  const [saving, setSaving] = useState({})
  const [recat, setRecat] = useState({}) // nama -> { count, ids, mapping, checking, done }

  const allowed = ['cfo', 'finance'].includes(profile?.role)

  useEffect(() => {
    if (allowed) loadData()
    else setLoading(false)
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: subs }, { data: cats }] = await Promise.all([
      supabase.from('subkategori_pengajuan').select('*').is('cashflow_cat_id', null).order('nama'),
      supabase.from('cashflow_categories').select('*'),
    ])
    setUnmapped(subs || [])
    const opts = []
    for (const c of (cats || [])) {
      for (const s of (c.subcats || [])) {
        opts.push({ cat_id: c.id, cat_name: c.name, subcat_id: s.id, subcat_name: s.name })
      }
    }
    setCatOptions(opts)
    setLoading(false)
  }

  async function mintaSaranAI(nama) {
    setAiLoading(prev => ({ ...prev, [nama]: true }))
    try {
      const daftarKategori = catOptions.map(o => `${o.cat_name} > ${o.subcat_name} (cat_id: ${o.cat_id}, subcat_id: ${o.subcat_id})`).join('\n')
      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: 'Kamu bantu mapping nama subkategori pengajuan finance ke kategori cashflow yang paling cocok. Balas HANYA JSON tanpa teks lain, format: {"cat_id":"...","cat_name":"...","subcat_id":"...","subcat_name":"..."}. Pilih SALAH SATU dari daftar kategori yang dikasih, jangan bikin baru.',
          messages: [{
            role: 'user',
            content: `Nama subkategori pengajuan: "${nama}"\n\nDaftar kategori cashflow yang tersedia:\n${daftarKategori}\n\nPilih yang paling cocok.`,
          }],
        }),
      })
      const data = await resp.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setSuggestions(prev => ({ ...prev, [nama]: parsed }))
    } catch (e) {
      alert('Gagal minta saran AI: ' + e.message)
    } finally {
      setAiLoading(prev => ({ ...prev, [nama]: false }))
    }
  }

  async function konfirmasiMapping(nama, mapping) {
    if (!mapping || !mapping.cat_id) return
    setSaving(prev => ({ ...prev, [nama]: true }))
    try {
      const { error } = await supabase.from('subkategori_pengajuan').update({
        cashflow_cat_id: mapping.cat_id,
        cashflow_cat_name: mapping.cat_name,
        cashflow_subcat_id: mapping.subcat_id,
        cashflow_subcat_name: mapping.subcat_name,
      }).eq('nama', nama)
      if (error) throw error
      setUnmapped(prev => prev.filter(u => u.nama !== nama))
      cekTransaksiLama(nama, mapping)
    } catch (e) {
      alert('Gagal simpan mapping: ' + e.message)
    } finally {
      setSaving(prev => ({ ...prev, [nama]: false }))
    }
  }

  // Cari transaksi lama yang masih nyangkut di "Operasional Tak Terduga" gara-gara subkategori ini
  async function cekTransaksiLama(nama, mapping) {
    setRecat(prev => ({ ...prev, [nama]: { checking: true } }))
    try {
      const { data: pengajuanList } = await supabase
        .from('pengajuan')
        .select('id')
        .eq('subkategori', nama)
        .eq('status', 'approved_ceo')
      const ids = (pengajuanList || []).map(p => p.id)
      if (ids.length === 0) {
        setRecat(prev => ({ ...prev, [nama]: null }))
        return
      }
      const { data: oldTx } = await supabase
        .from('cashflow_transactions')
        .select('id, amount')
        .in('linked_id', ids)
        .eq('cat_id', FALLBACK.cat_id)
        .eq('subcat_id', FALLBACK.subcat_id)
      if (!oldTx || oldTx.length === 0) {
        setRecat(prev => ({ ...prev, [nama]: null }))
        return
      }
      setRecat(prev => ({ ...prev, [nama]: { count: oldTx.length, ids: oldTx.map(t => t.id), total: oldTx.reduce((s, t) => s + Number(t.amount), 0), mapping, checking: false, done: false } }))
    } catch (e) {
      setRecat(prev => ({ ...prev, [nama]: null }))
    }
  }

  async function rekategorikanSemua(nama) {
    const r = recat[nama]
    if (!r || !r.ids?.length) return
    setRecat(prev => ({ ...prev, [nama]: { ...r, applying: true } }))
    try {
      const { error } = await supabase.from('cashflow_transactions').update({
        cat_id: r.mapping.cat_id,
        cat_name: r.mapping.cat_name,
        subcat_id: r.mapping.subcat_id,
        subcat_name: r.mapping.subcat_name,
      }).in('id', r.ids)
      if (error) throw error
      await supabase.from('cashflow_activity_log').insert({
        action: 'edit', entity: 'transaksi',
        description: `Re-kategorisasi massal: ${r.ids.length} transaksi "${nama}" → ${r.mapping.cat_name}/${r.mapping.subcat_name}`,
      })
      setRecat(prev => ({ ...prev, [nama]: { ...r, applying: false, done: true } }))
    } catch (e) {
      alert('Gagal re-kategorikan: ' + e.message)
      setRecat(prev => ({ ...prev, [nama]: { ...r, applying: false } }))
    }
  }

  if (!allowed) {
    return (
      <div style={{ padding: 40, fontFamily: 'inherit' }}>
        <p style={{ fontSize: 14, color: '#888' }}>Halaman ini cuma bisa diakses CFO/Finance.</p>
        <button onClick={() => navigate('/dashboard')} style={{ marginTop: 12, padding: '8px 16px', background: '#C0272D', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Kembali</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, fontFamily: 'inherit', maxWidth: 800 }}>
      <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>← Kembali</button>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>Sinkronisasi Kategori</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Subkategori pengajuan di bawah ini belum ke-mapping ke kategori Cashflow. Sebelum ke-mapping, transaksi yang pakai subkategori ini otomatis masuk kategori "Operasional Tak Terduga".
      </p>

      {loading && <p style={{ fontSize: 13, color: '#888' }}>Memuat...</p>}
      {!loading && unmapped.length === 0 && Object.keys(recat).length === 0 && (
        <p style={{ fontSize: 13, color: '#4CAF50' }}>✓ Semua subkategori udah ke-mapping.</p>
      )}

      {unmapped.map(u => (
        <div key={u.nama} style={{ border: '1px solid #EBEBEB', borderRadius: 12, padding: 16, marginBottom: 12, background: '#fff' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 10 }}>{u.nama}</div>

          {!suggestions[u.nama] && (
            <button
              onClick={() => mintaSaranAI(u.nama)}
              disabled={aiLoading[u.nama]}
              style={{ padding: '7px 14px', background: '#FFF0F0', color: '#C0272D', border: '1px solid #C0272D', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {aiLoading[u.nama] ? 'Mikir...' : '✦ Saran AI'}
            </button>
          )}

          {suggestions[u.nama] && (
            <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>
              Saran: <b>{suggestions[u.nama].cat_name} → {suggestions[u.nama].subcat_name}</b>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              onChange={e => {
                const opt = catOptions.find(o => `${o.cat_id}|${o.subcat_id}` === e.target.value)
                setManualPick(prev => ({ ...prev, [u.nama]: opt }))
              }}
              value={manualPick[u.nama] ? `${manualPick[u.nama].cat_id}|${manualPick[u.nama].subcat_id}` : ''}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #EBEBEB', fontSize: 12, fontFamily: 'inherit' }}
            >
              <option value="">— atau pilih manual —</option>
              {catOptions.map(o => (
                <option key={`${o.cat_id}|${o.subcat_id}`} value={`${o.cat_id}|${o.subcat_id}`}>{o.cat_name} → {o.subcat_name}</option>
              ))}
            </select>

            <button
              onClick={() => konfirmasiMapping(u.nama, manualPick[u.nama] || suggestions[u.nama])}
              disabled={saving[u.nama] || (!manualPick[u.nama] && !suggestions[u.nama])}
              style={{ padding: '7px 14px', background: '#C0272D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!manualPick[u.nama] && !suggestions[u.nama]) ? 0.4 : 1 }}
            >
              {saving[u.nama] ? 'Nyimpen...' : '✓ Konfirmasi'}
            </button>
          </div>
        </div>
      ))}

      {Object.entries(recat).filter(([, r]) => r).map(([nama, r]) => (
        <div key={nama} style={{ border: '1px solid #FFD700', background: '#FFFBEA', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          {r.checking && <p style={{ fontSize: 13, color: '#888' }}>Nyari transaksi lama buat "{nama}"...</p>}
          {!r.checking && !r.done && (
            <>
              <p style={{ fontSize: 13, color: '#111', marginBottom: 10 }}>
                Ketemu <b>{r.count} transaksi lama</b> (total Rp {Number(r.total).toLocaleString('id-ID')}) yang masih nyangkut di "Operasional Tak Terduga" gara-gara subkategori "{nama}".
              </p>
              <button
                onClick={() => rekategorikanSemua(nama)}
                disabled={r.applying}
                style={{ padding: '7px 14px', background: '#C0272D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {r.applying ? 'Mindahin...' : `Ya, Re-kategorikan Semua (${r.count})`}
              </button>
            </>
          )}
          {r.done && <p style={{ fontSize: 13, color: '#4CAF50' }}>✓ {r.count} transaksi udah dipindah ke kategori baru.</p>}
        </div>
      ))}
    </div>
  )
}
