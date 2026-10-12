import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import BrandMark from '../components/BrandMark'

// Akun tanpa role: belum bisa memakai app sampai CFO (admin) mengatur role-nya.
export default function WaitingAccessPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [dicek, setDicek] = useState(null)
  async function muatUlang() {
    await refreshProfile()
    setDicek(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
  }
  const nama = profile?.full_name || user?.user_metadata?.full_name || user?.email
  const foto = profile?.avatar_url || user?.user_metadata?.avatar_url
  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', padding: '24px 16px' }}>
      <div data-testid="menunggu-akses" style={{ maxWidth: 420, margin: '48px auto', background: '#fff', border: '1px solid #EBEBEB', borderRadius: 16, padding: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><BrandMark /></div>
        {foto && <img src={foto} alt="" style={{ width: 56, height: 56, borderRadius: '50%', marginBottom: 10 }} onError={e => { e.target.style.display = 'none' }} />}
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{nama}</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 18 }}>{user?.email}</div>
        <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 22 }}>
          Akunmu belum punya role. Minta CFO mengatur role kamu di <b>Pengaturan → Pengguna</b>.
        </div>
        <button type="button" onClick={muatUlang} className="btn-primary" style={{ width: '100%', padding: 14, marginBottom: 10 }}>Muat ulang</button>
        {dicek && <div role="status" style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>Dicek pukul {dicek}: role belum diatur.</div>}
        <button type="button" onClick={signOut} style={{ width: '100%', padding: 12, background: 'transparent', color: '#888', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>Keluar</button>
      </div>
    </div>
  )
}
