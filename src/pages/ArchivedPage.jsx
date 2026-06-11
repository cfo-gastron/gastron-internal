import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Menunggu Review',
  approved_step1: 'Menunggu CFO',
  approved_cfo: 'Menunggu CEO',
  approved_ceo: 'Transferred',
  revision: 'Perlu Revisi',
  hold: 'Ditahan',
  rejected: 'Ditolak',
}

const STATUS_CLASS = {
  draft: 'badge-pending',
  submitted: 'badge-pending',
  approved_step1: 'badge-step1',
  approved_cfo: 'badge-cfo',
  approved_ceo: 'badge-approved',
  revision: 'badge-revision',
  hold: 'badge-hold',
  rejected: 'badge-rejected',
}

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ArchivedPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [pengajuan, setPengajuan] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [unarchiving, setUnarchiving] = useState(null)

  const canAccess = ['cfo', 'finance', 'ceo'].includes(profile?.role)

  useEffect(() => {
    if (!canAccess) { navigate('/dashboard'); return }
    fetchArchived()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchArchived() {
    setLoading(true)
    const { data } = await supabase
      .from('pengajuan')
      .select('*')
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })
    setPengajuan(data || [])
    setLoading(false)
  }

  async function handleUnarchive(id) {
    setUnarchiving(id)
    await supabase.from('pengajuan').update({ is_archived: false }).eq('id', id)
    await fetchArchived()
    setUnarchiving(null)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR — desktop only */}
      {!isMobile && (
        <div style={{
          width: 240, background: '#fff', borderRight: '1px solid #F0F0F0',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        }}>
          <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo-gastron.png" alt="Gastron" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#C0272D' }}>Gastron</div>
                <div style={{ fontSize: 10, color: '#999', letterSpacing: 0.5 }}>Sistem Pengajuan</div>
              </div>
            </div>
          </div>

          <nav style={{ padding: '16px 12px', flex: 1 }}>
            {[
              { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
              { icon: '+', label: 'Buat Pengajuan', path: '/pengajuan/baru' },
              { icon: '🗂', label: 'Arsip', path: '/arsip' },
            ].map(item => (
              <button key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: item.path === '/arsip' ? '#FFF0F0' : 'transparent',
                  border: 'none', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontWeight: item.path === '/arsip' ? 600 : 400,
                  color: item.path === '/arsip' ? '#C0272D' : '#555',
                  cursor: 'pointer', textAlign: 'left', marginBottom: 4, fontFamily: 'inherit',
                }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ padding: '16px 20px', borderTop: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src={profile?.avatar_url || ''} alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F0' }}
                onError={e => { e.target.style.display = 'none' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{profile?.full_name}</div>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {profile?.role?.replace('_', ' ')}
                </div>
              </div>
            </div>
            <button onClick={signOut}
              style={{ width: '100%', padding: '8px', background: '#F5F5F5', border: 'none', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
              Keluar
            </button>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 240,
        padding: isMobile ? '20px 16px 90px' : '32px',
        minHeight: '100vh',
      }}>

        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C0272D' }}>Gastron</div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isMobile && (
              <button onClick={() => navigate('/dashboard')}
                style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                ← Dashboard
              </button>
            )}
          </div>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#111', marginTop: 8 }}>🗂 Arsip Pengajuan</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            {pengajuan.length} pengajuan diarsipkan
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Memuat...</div>
          ) : pengajuan.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗂</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Belum ada arsip</div>
              <div style={{ fontSize: 13, color: '#999' }}>Pengajuan yang diarsipkan akan muncul di sini</div>
            </div>
          ) : isMobile ? (
            <div style={{ padding: '8px 0' }}>
              {pengajuan.map(p => (
                <div key={p.id} style={{ padding: '14px 20px', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, marginRight: 12 }}
                      onClick={() => navigate(`/pengajuan/${p.id}`)}>{p.judul}</div>
                    <span className={`badge ${STATUS_CLASS[p.status] || 'badge-pending'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ background: '#F0F0F0', color: '#555', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{p.division}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#C0272D' }}>{formatRp(p.total_pengajuan)}</span>
                    <span style={{ fontSize: 11, color: '#BBB' }}>{formatDate(p.submitted_at || p.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleUnarchive(p.id)}
                    disabled={unarchiving === p.id}
                    style={{ fontSize: 12, color: '#1565C0', background: '#E3F2FD', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    {unarchiving === p.id ? 'Memproses...' : '↩ Kembalikan'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Kode Surat', 'Judul', 'Tim', 'Total', 'Tanggal', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pengajuan.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F8F8F8' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#555', fontFamily: 'monospace', cursor: 'pointer' }}
                      onClick={() => navigate(`/pengajuan/${p.id}`)}>{p.kode_surat || '-'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: '#111', cursor: 'pointer' }}
                      onClick={() => navigate(`/pengajuan/${p.id}`)}>{p.judul}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#F0F0F0', color: '#555', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.division}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#111' }}>{formatRp(p.total_pengajuan)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#888' }}>{formatDate(p.submitted_at || p.created_at)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${STATUS_CLASS[p.status] || 'badge-pending'}`}>{STATUS_LABEL[p.status] || p.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => handleUnarchive(p.id)}
                        disabled={unarchiving === p.id}
                        style={{ fontSize: 12, color: '#1565C0', background: '#E3F2FD', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {unarchiving === p.id ? 'Memproses...' : '↩ Kembalikan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BOTTOM NAV — mobile */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #EBEBEB',
          display: 'flex', zIndex: 100,
          paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom)))',
        }}>
          {[
            { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
            { icon: '🗂', label: 'Arsip', path: '/arsip' },
          ].map(item => (
            <button key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 0', gap: 4, background: 'transparent', border: 'none',
                cursor: 'pointer', color: item.path === '/arsip' ? '#C0272D' : '#999',
                fontSize: 10, fontWeight: 500, fontFamily: 'inherit',
              }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button onClick={signOut}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0', gap: 4, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#999', fontSize: 10, fontWeight: 500, fontFamily: 'inherit',
            }}>
            <span style={{ fontSize: 20 }}>↩</span>
            Keluar
          </button>
        </div>
      )}
    </div>
  )
}