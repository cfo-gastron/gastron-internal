// DashboardPage.jsx — full updated

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

// ── LPJ Badge ─────────────────────────────────────────────────────────────────
function LpjBadge({ lpjStatus, onClick }) {
  // hanya tampil kalau pengajuan sudah transferred
  const config = {
    none:             { label: 'Butuh LPJ',      bg: '#FFF0F0', color: '#C0272D', border: '#FFCDD2' },
    submitted:        { label: 'LPJ Menunggu',   bg: '#FFF8E1', color: '#B8860B', border: '#FFE082' },
    approved_finance: { label: 'LPJ Menunggu CFO', bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
    closed:           { label: 'LPJ Closed ✓',   bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  }

  const c = config[lpjStatus] || config.none

  return (
    <span
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        display: 'inline-block',
        background: c.bg, color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: 6, padding: '3px 8px',
        fontSize: 11, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  )
}

export default function DashboardPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [pengajuan, setPengajuan] = useState([])
  const [lpjMap, setLpjMap] = useState({})   // { [pengajuan_id]: lpj_status | 'none' }
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('/dashboard')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const isApprover = ['cfo', 'ceo', 'cao', 'coo', 'finance'].includes(profile?.role)

  useEffect(() => {
    fetchPengajuan()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchPengajuan() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pengajuan')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPengajuan(data)

      // Fetch LPJ hanya untuk yang sudah transferred
      const transferredIds = data
        .filter(p => p.status === 'approved_ceo')
        .map(p => p.id)

      if (transferredIds.length > 0) {
        const { data: lpjData } = await supabase
          .from('lpj')
          .select('pengajuan_id, status')
          .in('pengajuan_id', transferredIds)

        const map = {}
        // Default semua ke 'none' dulu
        transferredIds.forEach(id => { map[id] = 'none' })
        // Override dengan status LPJ yang ada
        lpjData?.forEach(l => { map[l.pengajuan_id] = l.status })
        setLpjMap(map)
      }
    }
    setLoading(false)
  }

  const stats = {
    total: pengajuan.length,
    pending: pengajuan.filter(p => ['submitted', 'approved_step1', 'approved_cfo'].includes(p.status)).length,
    approved: pengajuan.filter(p => p.status === 'approved_ceo').length,
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
            ].map(item => (
              <button key={item.path}
                onClick={() => { setActiveNav(item.path); navigate(item.path) }}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: activeNav === item.path ? '#FFF0F0' : 'transparent',
                  border: 'none', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontWeight: activeNav === item.path ? 600 : 400,
                  color: activeNav === item.path ? '#C0272D' : '#555',
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

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 240,
        padding: isMobile ? '20px 16px 90px' : '32px',
        minHeight: '100vh',
      }}>

        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C0272D' }}>Gastron</div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#111' }}>
            {isApprover ? 'Semua Pengajuan' : 'Pengajuan Saya'}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: '#111' },
            { label: 'Menunggu', value: stats.pending, color: '#B8860B' },
            { label: 'Transferred', value: stats.approved, color: '#2E7D32' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: isMobile ? '14px 12px' : '20px', border: '1px solid #F0F0F0' }}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Table / List */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Daftar Pengajuan</div>
            {!isApprover && !isMobile && (
              <button onClick={() => navigate('/pengajuan/baru')}
                style={{ padding: '8px 16px', background: '#C0272D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            </div>
          ) : isMobile ? (
            // ── Mobile: card list ──────────────────────────────────────────────
            <div style={{ padding: '8px 0' }}>
              {pengajuan.map(p => (
                <div key={p.id}
                  onClick={() => navigate(`/pengajuan/${p.id}`)}
                  style={{ padding: '14px 20px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, marginRight: 12 }}>{p.judul}</div>
                    <span className={`badge ${STATUS_CLASS[p.status] || 'badge-pending'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: '#F0F0F0', color: '#555', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{p.division}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#C0272D' }}>{formatRp(p.total_pengajuan)}</span>
                    <span style={{ fontSize: 11, color: '#BBB' }}>{formatDate(p.submitted_at || p.created_at)}</span>
                  </div>
                  {/* LPJ badge — mobile */}
                  {p.status === 'approved_ceo' && lpjMap[p.id] !== undefined && (
                    <div style={{ marginTop: 8 }}>
                      <LpjBadge
                        lpjStatus={lpjMap[p.id]}
                        onClick={() => navigate(`/lpj/${p.id}`)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // ── Desktop: table ─────────────────────────────────────────────────
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Kode Surat', 'Judul', 'Tim', 'Total', 'Tanggal', 'Status', 'LPJ', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pengajuan.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F8F8F8', cursor: 'pointer' }}
                    onClick={() => navigate(`/pengajuan/${p.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#555', fontFamily: 'monospace' }}>{p.kode_surat || '-'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: '#111' }}>{p.judul}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#F0F0F0', color: '#555', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.division}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#111' }}>{formatRp(p.total_pengajuan)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#888' }}>{formatDate(p.submitted_at || p.created_at)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${STATUS_CLASS[p.status] || 'badge-pending'}`}>{STATUS_LABEL[p.status] || p.status}</span>
                    </td>
                    {/* ── LPJ column ── */}
                    <td style={{ padding: '14px 16px' }}>
                      {p.status === 'approved_ceo' && lpjMap[p.id] !== undefined && (
                        <LpjBadge
                          lpjStatus={lpjMap[p.id]}
                          onClick={() => navigate(`/lpj/${p.id}`)}
                        />
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#C0272D', fontWeight: 600 }}>Lihat →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BOTTOM NAV — mobile only */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '1px solid #EBEBEB',
          display: 'flex', zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {[
            { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
            { icon: '+', label: 'Buat Pengajuan', path: '/pengajuan/baru' },
          ].map(item => (
            <button key={item.path}
              onClick={() => { setActiveNav(item.path); navigate(item.path) }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 0', gap: 4, background: 'transparent', border: 'none',
                cursor: 'pointer', color: activeNav === item.path ? '#C0272D' : '#999',
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