// DashboardPage.jsx — with search, filter, pagination, skip LPJ for reimbursement & trip operasional

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { subscribeToPush, isPushSupported, getPushPermissionStatus } from '../lib/pushNotif'

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

const NO_LPJ_TYPES = (p) => p.tipe === 'reimbursement' || p.subkategori === 'Trip Operasional'

const PAGE_SIZE = 20

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function LpjBadge({ lpjStatus, onClick }) {
  const config = {
    none:             { label: 'Butuh LPJ',        bg: '#FFF0F0', color: '#C0272D', border: '#FFCDD2' },
    submitted:        { label: 'LPJ Menunggu',     bg: '#FFF8E1', color: '#B8860B', border: '#FFE082' },
    approved_finance: { label: 'LPJ Menunggu CFO', bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
    closed:           { label: 'LPJ Closed ✓',     bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  }
  const c = config[lpjStatus] || config.none
  return (
    <span onClick={e => { e.stopPropagation(); onClick() }} style={{
      display: 'inline-block', background: c.bg, color: c.color,
      border: `1px solid ${c.border}`, borderRadius: 6, padding: '3px 8px',
      fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

export default function DashboardPage() {
  const { profile, signOut } = useAuth()
  const isApprover = ['cfo', 'ceo', 'cao', 'coo', 'finance'].includes(profile?.role)
  const navigate = useNavigate()

  const [pengajuan, setPengajuan] = useState([])
  const [lpjMap, setLpjMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('/dashboard')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const PULL_THRESHOLD = 70

  // Push notif
  const [notifLoading, setNotifLoading] = useState(false)
  const [showNotifBanner, setShowNotifBanner] = useState(false)

  // Search & filter
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDivisi, setFilterDivisi] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!isPushSupported()) return
    const status = getPushPermissionStatus()
    setShowNotifBanner(status === 'default')
  }, [])

  async function handleEnableNotif() {
    if (!profile?.id) return
    setNotifLoading(true)
    const result = await subscribeToPush(profile.id)
    setNotifLoading(false)
    if (result.success || result.reason === 'permission_denied') setShowNotifBanner(false)
  }

  function handleTouchStart(e) {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e) {
    if (window.scrollY > 0) return
    touchCurrentY.current = e.touches[0].clientY
    const dist = Math.max(0, Math.min(touchCurrentY.current - touchStartY.current, 100))
    setPullDistance(dist)
  }

  async function handleTouchEnd() {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true); setPullDistance(0)
      await fetchPengajuan()
      setRefreshing(false)
    } else { setPullDistance(0) }
  }

  useEffect(() => {
    fetchPengajuan()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function fetchPengajuan() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pengajuan').select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPengajuan(data)
      const transferredIds = data.filter(p => p.status === 'approved_ceo' && !NO_LPJ_TYPES(p)).map(p => p.id)
      if (transferredIds.length > 0) {
        const { data: lpjData } = await supabase.from('lpj').select('pengajuan_id, status').in('pengajuan_id', transferredIds)
        const map = {}
        transferredIds.forEach(id => { map[id] = 'none' })
        lpjData?.forEach(l => { map[l.pengajuan_id] = l.status })
        setLpjMap(map)
      }
    }
    setLoading(false)
  }

  // Filter + search (client-side)
  const filtered = pengajuan.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.judul?.toLowerCase().includes(q) || p.kode_surat?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || p.status === filterStatus
    const matchDivisi = !filterDivisi || p.division === filterDivisi
    return matchSearch && matchStatus && matchDivisi
  })

  // Reset ke page 1 saat filter berubah
  useEffect(() => { setCurrentPage(1) }, [search, filterStatus, filterDivisi])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const stats = {
    total: pengajuan.length,
    pending: pengajuan.filter(p => ['submitted', 'approved_step1', 'approved_cfo'].includes(p.status)).length,
    approved: pengajuan.filter(p => p.status === 'approved_ceo').length,
    rejected: pengajuan.filter(p => ['rejected', 'hold', 'revision'].includes(p.status)).length,
  }

  const hasFilter = search || filterStatus || filterDivisi

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR */}
      {!isMobile && (
        <div style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 }}>
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
              ...(['cfo', 'finance', 'ceo'].includes(profile?.role) ? [{ icon: '🗂', label: 'Arsip', path: '/arsip' }] : []),
            ].map(item => (
              <button key={item.path} onClick={() => { setActiveNav(item.path); navigate(item.path) }}
                style={{ width: '100%', padding: '10px 12px', background: activeNav === item.path ? '#FFF0F0' : 'transparent', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: activeNav === item.path ? 600 : 400, color: activeNav === item.path ? '#C0272D' : '#555', cursor: 'pointer', textAlign: 'left', marginBottom: 4, fontFamily: 'inherit' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src={profile?.avatar_url || ''} alt="" style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F0' }} onError={e => { e.target.style.display = 'none' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{profile?.full_name}</div>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>{profile?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <button onClick={() => setShowLogoutModal(true)} style={{ width: '100%', padding: '8px', background: '#F5F5F5', border: 'none', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>Keluar</button>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div onTouchStart={isMobile ? handleTouchStart : undefined} onTouchMove={isMobile ? handleTouchMove : undefined} onTouchEnd={isMobile ? handleTouchEnd : undefined}
        style={{ flex: 1, marginLeft: isMobile ? 0 : 240, padding: isMobile ? '20px 16px 90px' : '32px', minHeight: '100vh' }}>

        {isMobile && (pullDistance > 0 || refreshing) && (
          <div style={{ textAlign: 'center', padding: '8px 0', marginTop: -16, marginBottom: 8, fontSize: 12, color: pullDistance >= 70 || refreshing ? '#C0272D' : '#999' }}>
            {refreshing ? '🔄 Memperbarui...' : pullDistance >= 70 ? '↑ Lepas untuk refresh' : '↓ Tarik untuk refresh'}
          </div>
        )}

        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <img src="/logo-gastron.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C0272D' }}>Gastron</div>
          </div>
        )}

        {/* Notif banner */}
        {showNotifBanner && (
          <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7A5C00' }}>Aktifkan notifikasi</div>
                <div style={{ fontSize: 11, color: '#9C8030' }}>Biar gak ketinggalan pengajuan baru</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setShowNotifBanner(false)} style={{ padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 12, color: '#9C8030', cursor: 'pointer', fontFamily: 'inherit' }}>Nanti</button>
              <button onClick={handleEnableNotif} disabled={notifLoading} style={{ padding: '8px 14px', background: '#B8860B', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: notifLoading ? 0.7 : 1 }}>
                {notifLoading ? 'Memproses...' : 'Aktifkan'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#111' }}>{isApprover ? 'Semua Pengajuan' : 'Pengajuan Saya'}</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: '#111' },
            { label: 'Menunggu ACC', value: stats.pending, color: '#B8860B' },
            { label: 'Transferred', value: stats.approved, color: '#2E7D32' },
            { label: 'Ditolak / Hold', value: stats.rejected, color: '#C0272D' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: isMobile ? '14px 12px' : '20px', border: '1px solid #F0F0F0' }}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden' }}>

          {/* Header + search + filter */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Daftar Pengajuan</div>
              {!isApprover && !isMobile && (
                <button onClick={() => navigate('/pengajuan/baru')} style={{ padding: '8px 16px', background: '#C0272D', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Buat Pengajuan
                </button>
              )}
            </div>

            {/* Search + filter row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#BBB' }}>🔍</span>
                <input
                  placeholder="Cari judul / kode surat..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {/* Filter status */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', color: filterStatus ? '#111' : '#999', background: '#fff', cursor: 'pointer' }}>
                <option value="">Semua Status</option>
                <option value="submitted">Menunggu Review</option>
                <option value="approved_step1">Menunggu CFO</option>
                <option value="approved_cfo">Menunggu CEO</option>
                <option value="approved_ceo">Transferred</option>
                <option value="revision">Perlu Revisi</option>
                <option value="hold">Ditahan</option>
                <option value="rejected">Ditolak</option>
              </select>

              {/* Filter divisi */}
              <select value={filterDivisi} onChange={e => setFilterDivisi(e.target.value)}
                style={{ padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', color: filterDivisi ? '#111' : '#999', background: '#fff', cursor: 'pointer' }}>
                <option value="">Semua Divisi</option>
                <option value="OPR">OPR</option>
                <option value="ADM">ADM</option>
                <option value="PRC">PRC</option>
                <option value="FIN">FIN</option>
              </select>

              {/* Clear filter */}
              {hasFilter && (
                <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterDivisi('') }}
                  style={{ padding: '8px 12px', background: '#F5F5F5', border: 'none', borderRadius: 8, fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  ✕ Reset
                </button>
              )}
            </div>

            {/* Info hasil filter */}
            {hasFilter && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                Menampilkan {filtered.length} dari {pengajuan.length} pengajuan
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>
                {hasFilter ? 'Tidak ada hasil' : 'Belum ada pengajuan'}
              </div>
              <div style={{ fontSize: 13, color: '#999' }}>
                {hasFilter ? 'Coba ubah filter pencarian' : isApprover ? 'Belum ada pengajuan masuk' : 'Buat pengajuan pertama'}
              </div>
            </div>
          ) : isMobile ? (
            <div style={{ padding: '4px 0' }}>
              {paginated.map(p => {
                const statusColors = {
                  submitted: { bg: '#FFF8E1', color: '#7A5C00' },
                  approved_step1: { bg: '#E3F2FD', color: '#0C447C' },
                  approved_cfo: { bg: '#EDE7F6', color: '#4527A0' },
                  approved_ceo: { bg: '#E8F5E9', color: '#1B5E20' },
                  revision: { bg: '#FFF3E0', color: '#7A4200' },
                  hold: { bg: '#F3E5F5', color: '#4A148C' },
                  rejected: { bg: '#FFEBEE', color: '#7f1d1d' },
                }
                const sc = statusColors[p.status] || { bg: '#F5F5F5', color: '#555' }
                const lpjConfig = {
                  none: { dot: '#C0272D', text: 'Butuh LPJ' },
                  submitted: { dot: '#EF9F27', text: 'LPJ menunggu approval' },
                  approved_finance: { dot: '#185FA5', text: 'LPJ menunggu CFO' },
                  closed: { dot: '#3B6D11', text: 'LPJ selesai' },
                }
                const showLpj = p.status === 'approved_ceo' && !NO_LPJ_TYPES(p) && lpjMap[p.id] !== undefined
                const lpj = showLpj ? (lpjConfig[lpjMap[p.id]] || lpjConfig.none) : null

                return (
                  <div key={p.id} onClick={() => navigate(`/pengajuan/${p.id}`)} style={{ padding: '14px 16px', borderBottom: '0.5px solid #F0F0F0', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111', flex: 1, lineHeight: 1.3 }}>{p.judul}</div>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ background: '#F0F0F0', color: '#666', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500 }}>{p.division}</span>
                      {p.tipe === 'reimbursement' && (
                        <span style={{ background: '#E6F1FB', color: '#185FA5', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 500, border: '0.5px solid #B5D4F4' }}>Reimburse</span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#C0272D' }}>{formatRp(p.total_pengajuan)}</span>
                      <span style={{ fontSize: 11, color: '#BBB', marginLeft: 'auto' }}>{formatDate(p.submitted_at || p.created_at)}</span>
                    </div>
                    {showLpj && lpj && (
                      <div onClick={e => { e.stopPropagation(); navigate(`/lpj/${p.id}`) }} style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: lpj.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#888' }}>{lpj.text}</span>
                        <span style={{ fontSize: 11, color: '#C0272D', marginLeft: 'auto' }}>Lihat LPJ →</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Kode Surat', 'Judul', 'Tim', 'Total', 'Tanggal', 'Status', 'LPJ', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
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
                    <td style={{ padding: '14px 16px' }}>
                      {p.status === 'approved_ceo' && !NO_LPJ_TYPES(p) && lpjMap[p.id] !== undefined && (
                        <LpjBadge lpjStatus={lpjMap[p.id]} onClick={() => navigate(`/lpj/${p.id}`)} />
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#C0272D', fontWeight: 600 }}>Lihat →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#999' }}>
                Halaman {currentPage} dari {totalPages} · {filtered.length} pengajuan
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: '6px 12px', background: currentPage === 1 ? '#F5F5F5' : '#fff', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 12, color: currentPage === 1 ? '#CCC' : '#555', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`dot-${i}`} style={{ padding: '6px 4px', fontSize: 12, color: '#CCC' }}>···</span>
                    : <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ padding: '6px 10px', background: currentPage === p ? '#C0272D' : '#fff', border: `1.5px solid ${currentPage === p ? '#C0272D' : '#E0E0E0'}`, borderRadius: 8, fontSize: 12, color: currentPage === p ? '#fff' : '#555', cursor: 'pointer', fontFamily: 'inherit', fontWeight: currentPage === p ? 700 : 400 }}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', background: currentPage === totalPages ? '#F5F5F5' : '#fff', border: '1.5px solid #E0E0E0', borderRadius: 8, fontSize: 12, color: currentPage === totalPages ? '#CCC' : '#555', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM NAV */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #EBEBEB', display: 'flex', zIndex: 100, paddingBottom: 'max(24px, calc(16px + env(safe-area-inset-bottom)))' }}>
          {[
            { icon: '⊞', label: 'Dashboard', path: '/dashboard' },
            { icon: '+', label: 'Buat Pengajuan', path: '/pengajuan/baru' },
          ].map(item => (
            <button key={item.path} onClick={() => { setActiveNav(item.path); navigate(item.path) }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: activeNav === item.path ? '#C0272D' : '#999', fontSize: 10, fontWeight: 500, fontFamily: 'inherit' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <button onClick={() => setShowLogoutModal(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#999', fontSize: 10, fontWeight: 500, fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }}>↩</span>Keluar
          </button>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, padding: isMobile ? '28px 20px' : 32, paddingBottom: isMobile ? 'max(32px, calc(20px + env(safe-area-inset-bottom)))' : 32, width: isMobile ? '100%' : 360 }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />}
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8, textAlign: 'center' }}>Yakin mau logout?</div>
            <div style={{ fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 24 }}>Kamu akan keluar dari akun ini</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
              <button onClick={() => { setShowLogoutModal(false); signOut() }} style={{ flex: 1, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}