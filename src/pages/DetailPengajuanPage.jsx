import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getApproveLabel(status, role) {
  if (status === 'approved_cfo') return '✓ Final Approve (as CEO)'
  return '✓ Approve'
}

function getLogCatatan(status, fullName) {
  if (status === 'approved_cfo') return `Final approval (CEO) oleh ${fullName}`
  if (status === 'approved_step1') return `Approved (CFO) oleh ${fullName}`
  return `Approved oleh ${fullName}`
}

export default function DetailPengajuanPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [pengajuan, setPengajuan] = useState(null)
  const [items, setItems] = useState([])
  const [penerima, setPenerima] = useState([])
  const [attachments, setAttachments] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectType, setRejectType] = useState('revision')
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { fetchDetail() }, [id])

  async function fetchDetail() {
    setLoading(true)
    const [p, i, pn, a, l] = await Promise.all([
      supabase.from('pengajuan').select('*').eq('id', id).single(),
      supabase.from('pengajuan_items').select('*').eq('pengajuan_id', id).order('urutan'),
      supabase.from('pengajuan_penerima').select('*').eq('pengajuan_id', id),
      supabase.from('pengajuan_attachments').select('*').eq('pengajuan_id', id),
      supabase.from('approval_logs').select('*, user:users!approval_logs_action_by_fkey(full_name, role)').eq('pengajuan_id', id).order('created_at'),
    ])
    setPengajuan(p.data)
    setItems(i.data || [])
    setPenerima(pn.data || [])
    setAttachments(a.data || [])
    setLogs(l.data || [])
    setLoading(false)
  }

  function canApprove() {
    if (!pengajuan) return false
    const role = profile?.role
    const status = pengajuan.status

    if (status === 'submitted') {
      if (pengajuan.division === 'OPR' && role === 'coo') return true
      if (['ADM', 'PRC'].includes(pengajuan.division) && role === 'cao') return true
      if (pengajuan.division === 'FIN' && role === 'cfo') return true
    }
    if (status === 'approved_step1' && role === 'cfo') return true
    if (status === 'approved_cfo' && (role === 'ceo' || role === 'cfo' || role === 'finance')) return true

    return false
  }

  async function handleApprove() {
    setActionLoading(true)
    const status = pengajuan.status
    let updateData = {}

    if (status === 'submitted') {
      if (pengajuan.division === 'FIN') {
        updateData = { status: 'approved_cfo', approved_step1_at: new Date().toISOString(), step1_approved_by: profile.id, approved_cfo_at: new Date().toISOString(), cfo_approved_by: profile.id }
      } else {
        updateData = { status: 'approved_step1', approved_step1_at: new Date().toISOString(), step1_approved_by: profile.id }
      }
    } else if (status === 'approved_step1') {
      updateData = { status: 'approved_cfo', approved_cfo_at: new Date().toISOString(), cfo_approved_by: profile.id }
    } else if (status === 'approved_cfo') {
      updateData = { status: 'approved_ceo', approved_ceo_at: new Date().toISOString(), ceo_approved_by: profile.id }
    }

    await supabase.from('pengajuan').update(updateData).eq('id', id)
    await supabase.from('approval_logs').insert({
      pengajuan_id: id,
      action: 'approved',
      action_by: profile.id,
      role_at_time: profile.role,
      catatan: getLogCatatan(status, profile.full_name),
    })

    fetchDetail()
    setActionLoading(false)
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    setActionLoading(true)

    await supabase.from('pengajuan').update({
      status: rejectType,
      rejection_type: rejectType,
      rejection_reason: rejectReason,
    }).eq('id', id)

    await supabase.from('approval_logs').insert({
      pengajuan_id: id,
      action: rejectType,
      action_by: profile.id,
      role_at_time: profile.role,
      rejection_type: rejectType,
      catatan: rejectReason,
    })

    setShowRejectModal(false)
    setRejectReason('')
    fetchDetail()
    setActionLoading(false)
  }

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /></div>
  )

  if (!pengajuan) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Pengajuan tidak ditemukan</div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {/* SIDEBAR */}
      <div style={{
        width: 240, background: '#fff', borderRight: '1px solid #F0F0F0',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: '24px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/logo-gastron.png" alt="Gastron" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
              <span style={{ color: '#C0272D' }}>G</span>astron
            </div>
            <div style={{ fontSize: 10, color: '#999' }}>Sistem Pengajuan</div>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: '#FFF0F0', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⊞ Dashboard
        </button>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: 240, padding: '32px', maxWidth: 860 }}>

        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12 }}>
          ← Kembali
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{pengajuan.judul}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>{pengajuan.kode_surat}</div>
          </div>
          <span className={`badge ${STATUS_CLASS[pengajuan.status]}`} style={{ fontSize: 12, padding: '6px 14px' }}>
            {STATUS_LABEL[pengajuan.status]}
          </span>
        </div>

        {/* Meta info */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {[
              { label: 'Divisi', value: pengajuan.division },
              { label: 'Metode Bayar', value: pengajuan.metode_pembayaran },
              { label: 'Tanggal Submit', value: formatDate(pengajuan.submitted_at) },
              { label: 'Total', value: formatRp(pengajuan.total_pengajuan) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{value}</div>
              </div>
            ))}
          </div>
          {pengajuan.catatan && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F5F5F5' }}>
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Catatan</div>
              <div style={{ fontSize: 13, color: '#555' }}>{pengajuan.catatan}</div>
            </div>
          )}
          {pengajuan.rejection_reason && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F5F5F5', background: '#FFF8F8', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#C0272D', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Alasan {pengajuan.rejection_type === 'revision' ? 'Revisi' : pengajuan.rejection_type === 'hold' ? 'Hold' : 'Penolakan'}
              </div>
              <div style={{ fontSize: 13, color: '#C0272D' }}>{pengajuan.rejection_reason}</div>
            </div>
          )}
        </div>

        {/* Items table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111' }}>
            Item Pengajuan
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['No', 'Uraian Transaksi', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Harga Satuan' || h === 'Jumlah' ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #F0F0F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F8F8F8' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#999', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#111' }}>{item.uraian}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#555', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#555', textAlign: 'center' }}>{item.satuan}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#555', textAlign: 'right' }}>{formatRp(item.harga_satuan)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{formatRp(item.jumlah)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111' }}>
                <td colSpan={5} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#555' }}>Total Pengajuan</td>
                <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 700, color: '#C0272D', textAlign: 'right' }}>{formatRp(pengajuan.total_pengajuan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Penerima */}
        {penerima.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Penerima Pembayaran</div>
            {penerima.map((p) => (
              <div key={p.id} style={{ background: '#FAFAFA', borderRadius: 8, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Nama', value: p.nama_penerima },
                    { label: 'Bank', value: p.bank },
                    { label: 'No. Rekening', value: p.no_rekening },
                    { label: 'Atas Nama', value: p.atas_nama },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{value || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Lampiran</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {attachments.map(a => (
                <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, padding: '10px 14px', textDecoration: 'none', color: '#111' }}>
                  <span>{a.file_type?.includes('pdf') ? '📄' : '🖼️'}</span>
                  <span style={{ fontSize: 12 }}>{a.file_name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Approval Timeline */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Timeline Approval</div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 13, color: '#999' }}>Belum ada aktivitas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: log.action === 'approved' ? '#2E7D32' : log.action === 'submitted' ? '#1565C0' : '#C0272D',
                    marginTop: 4, flexShrink: 0
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {log.action === 'submitted' ? 'Pengajuan disubmit'
                        : log.action === 'approved' ? 'Disetujui'
                        : log.action === 'revision' ? 'Diminta revisi'
                        : log.action === 'hold' ? 'Ditahan'
                        : 'Ditolak'}
                      {log.user && <span style={{ color: '#999', fontWeight: 400 }}> oleh {log.user.full_name}</span>}
                    </div>
                    {log.catatan && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{log.catatan}</div>}
                    <div style={{ fontSize: 11, color: '#BBB', marginTop: 2 }}>{formatDate(log.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approve / Reject buttons */}
        {canApprove() && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowRejectModal(true)}
              style={{
                flex: 1, padding: '14px', background: '#fff',
                border: '1.5px solid #E0E0E0', borderRadius: 12,
                fontSize: 14, fontWeight: 600, color: '#555',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Tolak / Hold / Revisi
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              style={{
                flex: 2, padding: '14px', background: '#C0272D',
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: actionLoading ? 0.7 : 1
              }}
            >
              {actionLoading ? 'Memproses...' : getApproveLabel(pengajuan.status, profile?.role)}
            </button>
          </div>
        )}

        {/* LPJ button */}
        {pengajuan.status === 'approved_ceo' && pengajuan.submitted_by === profile?.id && (
          <button
            onClick={() => navigate(`/lpj/${id}`)}
            style={{
              width: '100%', padding: '14px', background: '#1565C0',
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 600, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 12
            }}
          >
            📋 Buat Laporan Pertanggungjawaban (LPJ)
          </button>
        )}
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 480, maxWidth: '90vw' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 20 }}>Tolak Pengajuan</div>

            <div style={{ marginBottom: 16 }}>
              <div className="form-label">Tipe</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'revision', label: 'Perlu Revisi' },
                  { value: 'hold', label: 'Hold' },
                  { value: 'rejected', label: 'Tolak Permanen' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setRejectType(opt.value)}
                    style={{
                      flex: 1, padding: '10px 8px',
                      background: rejectType === opt.value ? '#FFF0F0' : '#F5F5F5',
                      border: `1.5px solid ${rejectType === opt.value ? '#C0272D' : 'transparent'}`,
                      borderRadius: 8, fontSize: 12, fontWeight: 600,
                      color: rejectType === opt.value ? '#C0272D' : '#555',
                      cursor: 'pointer', fontFamily: 'inherit'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Alasan *</label>
              <textarea
                className="form-input"
                placeholder="Jelaskan alasan penolakan / revisi / hold"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason('') }}
                style={{ flex: 1, padding: '12px', background: '#F5F5F5', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                style={{ flex: 1, padding: '12px', background: '#C0272D', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: !rejectReason.trim() ? 0.5 : 1 }}
              >
                {actionLoading ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}