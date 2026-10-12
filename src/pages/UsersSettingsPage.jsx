import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BrandMark from '../components/BrandMark'
import { ROLES, BELUM_ADA_ROLE, labelRole, bolehCabutAdmin } from '../lib/roles'

// Pengaturan → Pengguna (khusus admin). Role & admin hanya bisa diubah di sini;
// database menolak perubahan role oleh non-admin (trigger users_guard).
export default function UsersSettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [users, setUsers] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [cari, setCari] = useState('')
  const [hanyaMenunggu, setHanyaMenunggu] = useState(false)
  const [ubah, setUbah] = useState(null) // { user, jenis: 'role'|'admin', ke }
  const [menyimpan, setMenyimpan] = useState(false)
  const [pesan, setPesan] = useState(null) // { jenis: 'ok'|'gagal', teks }

  useEffect(() => {
    muat()
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function muat() {
    const [u, l] = await Promise.all([
      supabase.from('users').select('id, email, full_name, avatar_url, role, is_admin').order('full_name'),
      supabase.from('role_change_log').select('*').order('changed_at', { ascending: false }).limit(20),
    ])
    setUsers(u.data || [])
    setLog(l.data || [])
    setLoading(false)
  }

  const nama = (id) => users.find((u) => u.id === id)?.full_name || users.find((u) => u.id === id)?.email || '—'
  const menunggu = users.filter((u) => !u.role)
  const q = cari.trim().toLowerCase()
  const tampil = users
    .filter((u) => !hanyaMenunggu || !u.role)
    .filter((u) => !q || `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(q))

  async function simpan() {
    const { user, jenis, ke } = ubah
    setMenyimpan(true); setPesan(null)
    const data = jenis === 'role' ? { role: ke || null } : { is_admin: ke }
    const { data: hasil, error } = await supabase.from('users').update(data).eq('id', user.id).select('id')
    setMenyimpan(false)
    setUbah(null)
    if (error || !hasil?.length) {
      setPesan({ jenis: 'gagal', teks: error ? `Tidak tersimpan: ${error.message}` : 'Tidak tersimpan: kamu tidak punya izin mengubah pengguna ini.' })
      return
    }
    const siapa = user.full_name || user.email
    setPesan({ jenis: 'ok', teks: jenis === 'role' ? `Role ${siapa} sekarang ${labelRole(ke)}.` : ke ? `${siapa} sekarang admin.` : `Admin ${siapa} dicabut.` })
    await muat()
    if (user.id === profile?.id) refreshProfile()
  }

  const teksKonfirmasi = (u) => {
    const siapa = u.full_name || u.email
    if (ubah.jenis === 'role') return `Ubah role ${siapa} dari ${labelRole(u.role)} ke ${labelRole(ubah.ke)}?`
    return ubah.ke ? `Jadikan ${siapa} admin? Admin bisa mengubah role semua pengguna.` : `Cabut admin ${siapa}?`
  }

  const tombolKecil = { padding: '8px 12px', minHeight: 40, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', padding: isMobile ? '16px 16px 80px' : '32px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <button onClick={() => navigate('/dashboard')} aria-label="Kembali ke Dashboard"
            style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44, padding: 0 }}>←</button>
          <BrandMark compact={isMobile} />
        </div>

        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111' }}>Pengaturan → Pengguna</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4, marginBottom: 16 }}>Atur role tiap akun. Hanya admin yang bisa mengubah role, dan setiap perubahan tercatat.</div>

        {pesan && (
          <div role={pesan.jenis === 'gagal' ? 'alert' : 'status'} data-testid="pesan-pengguna"
            style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, fontSize: 13, background: pesan.jenis === 'gagal' ? '#FFF0F0' : '#F1F8F2', border: `1px solid ${pesan.jenis === 'gagal' ? '#F5C2C2' : '#CDE6D0'}`, color: pesan.jenis === 'gagal' ? '#8B1A1F' : '#1E5E26' }}>
            {pesan.teks}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email" aria-label="Cari pengguna"
            style={{ flex: 1, minWidth: 200, padding: '10px 12px', border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' }} />
          {menunggu.length > 0 && (
            <button type="button" data-testid="badge-menunggu" aria-pressed={hanyaMenunggu} onClick={() => setHanyaMenunggu(!hanyaMenunggu)}
              style={{ ...tombolKecil, background: hanyaMenunggu ? '#B8860B' : '#FFF8E1', color: hanyaMenunggu ? '#fff' : '#8A6400', border: '1px solid #FFE082' }}>
              Menunggu role ({menunggu.length})
            </button>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, overflow: 'hidden' }}>
          {loading && <div style={{ padding: 20, fontSize: 13, color: '#999' }}>Memuat…</div>}
          {!loading && tampil.length === 0 && <div style={{ padding: 20, fontSize: 13, color: '#999' }}>Tidak ada pengguna yang cocok.</div>}
          {tampil.map((u) => {
            const sayaSendiri = u.id === profile?.id
            const cabutDikunci = u.is_admin && !bolehCabutAdmin(u, users)
            return (
              <div key={u.id} data-testid={`user-${u.id}`} style={{ borderTop: '1px solid #F2F2F2', padding: isMobile ? '12px 14px' : '12px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <img src={u.avatar_url || ''} alt="" style={{ width: 34, height: 34, borderRadius: '50%', background: '#F0F0F0', flexShrink: 0 }} onError={(e) => { e.target.style.visibility = 'hidden' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                        {u.full_name || '(tanpa nama)'}{sayaSendiri && <span style={{ color: '#999', fontWeight: 400 }}> · kamu</span>}
                        {u.is_admin && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#555', background: '#F0F0F0', borderRadius: 6, padding: '2px 8px' }}>Admin</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                  </div>
                  <select aria-label={`Role ${u.full_name || u.email}`} value={ubah?.user.id === u.id && ubah.jenis === 'role' ? (ubah.ke || '') : (u.role || '')} disabled={menyimpan}
                    onChange={(e) => { setPesan(null); setUbah({ user: u, jenis: 'role', ke: e.target.value || null }) }}
                    style={{ padding: '9px 10px', minHeight: 40, border: `1.5px solid ${u.role ? '#E0E0E0' : '#FFE082'}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', width: isMobile ? '100%' : 210 }}>
                    <option value="">{BELUM_ADA_ROLE}</option>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button type="button" disabled={menyimpan || cabutDikunci}
                    title={cabutDikunci ? 'Minimal harus ada satu admin' : undefined}
                    onClick={() => { setPesan(null); setUbah({ user: u, jenis: 'admin', ke: !u.is_admin }) }}
                    style={{ ...tombolKecil, background: '#fff', color: cabutDikunci ? '#BBB' : '#555', border: '1.5px solid #E0E0E0', cursor: cabutDikunci ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 150 }}>
                    {u.is_admin ? 'Cabut admin' : 'Jadikan admin'}
                  </button>
                </div>
                {cabutDikunci && <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Admin satu-satunya: tidak bisa dicabut sebelum ada admin lain.</div>}
                {ubah?.user.id === u.id && (
                  <div data-testid="konfirmasi-ubah" style={{ marginTop: 10, background: '#FAFAFA', border: '1px solid #EBEBEB', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#333' }}>{teksKonfirmasi(u)}</div>
                    <button type="button" onClick={() => setUbah(null)} disabled={menyimpan} style={{ ...tombolKecil, background: '#fff', border: '1.5px solid #E0E0E0', color: '#555' }}>Batal</button>
                    <button type="button" onClick={simpan} disabled={menyimpan} style={{ ...tombolKecil, background: '#C0272D', border: 'none', color: '#fff' }}>{menyimpan ? 'Menyimpan…' : 'Ya, ubah'}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <details style={{ marginTop: 18, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, padding: '12px 18px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111', minHeight: 32 }}>Riwayat perubahan role ({log.length})</summary>
          {log.length === 0 && <div style={{ fontSize: 13, color: '#999', padding: '8px 0' }}>Belum ada perubahan.</div>}
          {log.map((r) => (
            <div key={r.id} style={{ fontSize: 13, color: '#444', padding: '8px 0', borderTop: '1px solid #F5F5F5', lineHeight: 1.5 }}>
              <b>{nama(r.user_id)}</b>
              {r.old_role !== r.new_role && <> · {labelRole(r.old_role)} → {labelRole(r.new_role)}</>}
              {r.old_admin !== r.new_admin && <> · {r.new_admin ? 'dijadikan admin' : 'admin dicabut'}</>}
              <div style={{ fontSize: 12, color: '#999' }}>
                oleh {r.changed_by ? nama(r.changed_by) : 'sistem'} · {new Date(r.changed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </details>
      </div>
    </div>
  )
}
