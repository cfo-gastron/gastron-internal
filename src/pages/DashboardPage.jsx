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

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
  { icon: '+', label: 'Buat Pengajuan', path: '/pengajuan/baru' },
]

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [pengajuan, setPengajuan] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('/dashboard')

  const isApprover = ['cfo', 'ceo', 'cao', 'coo'].includes(profile?.role)
  const isFinance = profile?.role === 'finance'

  useEffect(() => {
    fetchPengajuan()
  }, [])

  async function fetchPengajuan() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pengajuan')
      .select('*, submitted_by_user:users!pengajuan_submitted_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })
    if (!error) setPengajuan(data || [])
    setLoading(false)
  }

  const stats = {
    total: pengajuan.length,
    pending: pengajuan.filter(p => ['submitted', 'approved_step1', 'approved_cfo'].includes(p.status)).length,
    approved: pengajuan.filter(p => p.status === 'approved_ceo').length,
    totalNominal: pengajuan.reduce((s, p) => s + Number(p.total_pengajuan || 0), 0),
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR — desktop only */}
      <div style={{
        width: 240,
        background: '#fff',
        borderRight: '1px solid #F0F0F0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
      }} className="sidebar-desktop">

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #F5F5F5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-gastron.png" alt="Gastron" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                <span style={{ color: '#C0272D' }}>G</span>astron
              </div>
              <div style={{ fontSize: 10, color: '#999', letterSpacing: 0.5 }}>Sistem Pengajuan</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => { setActiveNav(item.path); navigate(item.path) }}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: activeNav === item.path ? '#FFF0F0' : 'transparent',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                fontWeight: activeNav === item.path ? 600 : 400,
                color: activeNav === item.path ? '#C0272D' : '#555',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 4,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Profile */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F5F5F5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img
              src={profile?.avatar_url || ''}
              alt=""
              style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F0' }}
              onError={e => { e.target.style.display = 'none' }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{profile?.full_name}</div>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {profile?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '8px', background: '#F5F5F5',
              border: 'none', borderRadius: 8, fontSize: 12, color: '#888',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Keluar
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, marginLeft: 240, padding: '32px', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>
            {isApprover ? 'Semua Pengajuan' : 'Pengajuan Saya'}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Pengajuan', value: stats.total, color: '#111' },
            { label: 'Menunggu Review', value: stats.pending, color: '#B8860B' },
            { label: 'Transferred', value: stats.approved, color: '#2E7D32' },
            { label: 'Total Nominal', value: formatRp(stats.totalNominal), color: '#C0272D', small: true },
          ].map((s, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 12,
              padding: '20px',
              border: '1px solid #F0F0F0',
            }}>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                {s.label}
              </div>
              <div style={{ fontSize: s.small ? 18 : 28, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Daftar Pengajuan</div>
            {!isApprover && (
              <button
                onClick={() => navigate('/pengajuan/baru')}
                style={{
                  padding: '8px 16px',
                  background: '#C0272D',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + Buat Pengajuan
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Memuat...</div>
          ) : pengajuan.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Belum ada pengajuan</div>
              <div style={{ fontSize: 13, color: '#999' }}>
                {isApprover ? 'Belum ada pengajuan masuk' : 'Buat pengajuan pertama'}
              </div>
              {!isApprover && (
                <button
                  onClick={() => navigate('/pengajuan/baru')}
                  style={{
                    marginTop: 16, padding: '10px 20px',
                    background: '#C0272D', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  Buat Pengajuan
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Kode Surat', 'Judul', 'Tim', 'Total', 'Tanggal', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      borderBottom: '1px solid #F0F0F0',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pengajuan.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid #F8F8F8', cursor: 'pointer' }}
                    onClick={() => navigate(`/pengajuan/${p.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
                      {p.kode_surat || '-'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {p.judul}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: '#F0F0F0', color: '#555',
                        borderRadius: 6, padding: '2px 8px',
                        fontSize: 11, fontWeight: 700
                      }}>
                        {p.division}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#111' }}>
                      {formatRp(p.total_pengajuan)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#888' }}>
                      {formatDate(p.submitted_at || p.created_at)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${STATUS_CLASS[p.status] || 'badge-pending'}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#C0272D', fontWeight: 600 }}>
                      Lihat →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BOTTOM NAV — mobile */}
      <div className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`bottom-nav-item ${activeNav === item.path ? 'active' : ''}`}
            onClick={() => { setActiveNav(item.path); navigate(item.path) }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button className="bottom-nav-item" onClick={signOut}>
          <span style={{ fontSize: 20 }}>↩</span>
          Keluar
        </button>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .sidebar-desktop { display: none !important; }
          div[style*="marginLeft: 240px"] { margin-left: 0 !important; padding: 16px 16px 80px !important; }
          div[style*="gridTemplateColumns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}