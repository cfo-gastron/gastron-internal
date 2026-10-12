import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generatePengajuanPdf } from '../lib/generatePengajuanPdf'
import { notifyPengajuanUpdate } from '../lib/sendNotif'
import { canApprovePengajuan, canAccessLpj as canAccessLpjRule, canChangeSubkategori, rencanaBatalApproval, tahapTerakhir, canLanjutkanTahanan, langkahBerikutnya } from '../lib/approval'
import { BELUM_DIKATEGORIKAN } from '../lib/subkategori'
import { REKENING_FIELDS, REKENING_JUDUL, labelRekening } from '../lib/rekening'
import { insertPengajuanToCashflow } from '../lib/cashflow'
import { STATUS_LABEL, STATUS_CLASS } from '../lib/status'
import BrandMark from '../components/BrandMark'

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getApproveLabel(status) {
  if (status === 'approved_cfo') return '✓ Final Approve (as CEO)'
  return '✓ Approve'
}

function getLogCatatan(status, fullName) {
  if (status === 'approved_cfo') return `Final approval (CEO) oleh ${fullName}`
  if (status === 'approved_step1') return `Approved (CFO) oleh ${fullName}`
  return `Approved oleh ${fullName}`
}

function getNotifContent(newStatus, judul, fullName) {
  const map = {
    submitted: { title: '📝 Pengajuan baru', body: `${fullName} ngajuin "${judul}"` },
    approved_step1: { title: '✅ Pengajuan disetujui', body: `"${judul}" udah di-acc, lanjut ke CFO` },
    approved_cfo: { title: '✅ Pengajuan disetujui CFO', body: `"${judul}" udah di-acc CFO, tinggal final approve` },
    approved_ceo: { title: '🎉 Pengajuan di-final approve', body: `"${judul}" udah transferred, beres!` },
    revision: { title: '✏️ Perlu direvisi', body: `"${judul}" diminta direvisi nih` },
    hold: { title: '⏸️ Pengajuan di-hold', body: `"${judul}" lagi ditahan dulu` },
    rejected: { title: '❌ Pengajuan ditolak', body: `"${judul}" ditolak` },
  }
  return map[newStatus] || { title: 'Update pengajuan', body: judul }
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
  const [hasLpj, setHasLpj] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showFinalApproveModal, setShowFinalApproveModal] = useState(false)
  const [rejectType, setRejectType] = useState('revision')
  const [rejectReason, setRejectReason] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [ubahSub, setUbahSub] = useState(null) // null | { list, pilihan, menyimpan, error }
  const [batal, setBatal] = useState(null) // null | { alasan, error }

  const canArchive = ['cfo', 'finance', 'ceo'].includes(profile?.role)
  const isOwner = pengajuan?.submitted_by === profile?.id

  async function handleArchive() {
    if (!window.confirm('Arsipkan pengajuan ini?')) return
    setArchiving(true)
    await supabase.from('pengajuan').update({ is_archived: true }).eq('id', id)
    navigate('/arsip')
    setArchiving(false)
  }

  useEffect(() => {
    fetchDetail()
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [id])

  async function fetchDetail() {
    setLoading(true)
    const [p, i, pn, a, l, lpj] = await Promise.all([
      supabase.from('pengajuan').select('*').eq('id', id).single(),
      supabase.from('pengajuan_items').select('*').eq('pengajuan_id', id).order('urutan'),
      supabase.from('pengajuan_penerima').select('*').eq('pengajuan_id', id),
      supabase.from('pengajuan_attachments').select('*').eq('pengajuan_id', id),
      supabase.from('approval_logs').select('*, user:users!approval_logs_action_by_fkey(full_name, role)').eq('pengajuan_id', id).order('created_at'),
      supabase.from('lpj').select('id').eq('pengajuan_id', id).maybeSingle(),
    ])
    setPengajuan(p.data)
    setItems(i.data || [])
    setPenerima(pn.data || [])
    setAttachments(a.data || [])
    setLogs(l.data || [])
    setHasLpj(!!lpj.data)
    setLoading(false)
  }

  function canApprove() {
    if (!pengajuan) return false
    return canApprovePengajuan(profile?.role, pengajuan.status, pengajuan.division)
  }

  function canAccessLpj() {
    return canAccessLpjRule(profile?.id, profile?.role, pengajuan)
  }

  function canResubmit() {
    if (!pengajuan) return false
    if (!isOwner) return false
    return pengajuan.status === 'revision'
  }

  const isFinalApprove = pengajuan?.status === 'approved_cfo'

  function handleApproveClick() {
    if (isFinalApprove) setShowFinalApproveModal(true)
    else handleApprove()
  }

  async function handleApprove() {
    setActionLoading(true)
    const status = pengajuan.status
    let updateData = {}
    let newStatus = ''

    if (status === 'submitted') {
      if (pengajuan.division === 'FIN') {
        updateData = { status: 'approved_cfo', approved_step1_at: new Date().toISOString(), step1_approved_by: profile.id, approved_cfo_at: new Date().toISOString(), cfo_approved_by: profile.id }
        newStatus = 'approved_cfo'
      } else {
        updateData = { status: 'approved_step1', approved_step1_at: new Date().toISOString(), step1_approved_by: profile.id }
        newStatus = 'approved_step1'
      }
    } else if (status === 'approved_step1') {
      updateData = { status: 'approved_cfo', approved_cfo_at: new Date().toISOString(), cfo_approved_by: profile.id }
      newStatus = 'approved_cfo'
    } else if (status === 'approved_cfo') {
      updateData = { status: 'approved_ceo', approved_ceo_at: new Date().toISOString(), ceo_approved_by: profile.id }
      newStatus = 'approved_ceo'
    }

    setActionError('')
    // Update hanya kalau status belum diubah orang lain (mencegah approve dobel / cashflow dobel)
    const { data: updated, error: updateError } = await supabase.from('pengajuan')
      .update(updateData).eq('id', id).eq('status', status).select('id')
    if (updateError || !updated || updated.length === 0) {
      setActionError(updateError
        ? `Gagal menyimpan: ${updateError.message}. Tidak ada yang berubah, coba lagi.`
        : 'Pengajuan ini sudah diproses orang lain. Halaman dimuat ulang.')
      setShowFinalApproveModal(false)
      await fetchDetail()
      setActionLoading(false)
      return
    }
    await supabase.from('approval_logs').insert({
      pengajuan_id: id, action: 'approved',
      action_by: profile.id, role_at_time: profile.role,
      catatan: getLogCatatan(status, profile.full_name),
    })

    // Masuk ke cashflow kalau final approve (CEO). Jalur bersama, tidak pernah dobel.
    if (newStatus === 'approved_ceo') {
      const cf = await insertPengajuanToCashflow({ ...pengajuan, id }, { createdBy: profile.id, notes: `Auto dari pengajuan ${pengajuan.kode_surat}` })
      if (cf.error) {
        console.error('Gagal insert ke cashflow:', cf.error)
        setActionError(`Pengajuan sudah disetujui, TAPI gagal masuk ke Cashflow (${cf.error.message}). Masukkan lewat menu Sinkronisasi.`)
      }
    }

    const notifContent = getNotifContent(newStatus, pengajuan.judul, profile.full_name)
    notifyPengajuanUpdate({ ...pengajuan, id }, newStatus, notifContent)
    setShowFinalApproveModal(false)
    fetchDetail()
    setActionLoading(false)
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    setActionLoading(true)
    setActionError('')
    const { data: updated, error: updateError } = await supabase.from('pengajuan').update({
      status: rejectType, rejection_type: rejectType, rejection_reason: rejectReason,
    }).eq('id', id).eq('status', pengajuan.status).select('id')
    if (updateError || !updated || updated.length === 0) {
      setActionError(updateError ? `Gagal menyimpan: ${updateError.message}. Coba lagi.` : 'Pengajuan ini sudah diproses orang lain. Halaman dimuat ulang.')
      setShowRejectModal(false)
      await fetchDetail()
      setActionLoading(false)
      return
    }
    await supabase.from('approval_logs').insert({
      pengajuan_id: id, action: rejectType,
      action_by: profile.id, role_at_time: profile.role,
      rejection_type: rejectType, catatan: rejectReason,
    })
    const notifContent = getNotifContent(rejectType, pengajuan.judul, profile.full_name)
    notifyPengajuanUpdate({ ...pengajuan, id }, rejectType, notifContent)
    setShowRejectModal(false)
    setRejectReason('')
    fetchDetail()
    setActionLoading(false)
  }

  // Kirim ulang tanpa perubahan setelah revisi -> kembali ke tahap yang meminta revisi
  async function handleResubmit() {
    setActionLoading(true)
    const tahap = tahapTerakhir(pengajuan)
    const { data: updated, error: upErr } = await supabase.from('pengajuan').update({
      status: tahap, rejection_type: null, rejection_reason: null,
      ...(tahap === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
    }).eq('id', id).eq('status', 'revision').select('id')
    if (upErr || !updated?.length) {
      setActionError(upErr ? `Gagal mengirim ulang: ${upErr.message}` : 'Status pengajuan sudah berubah. Halaman dimuat ulang.')
      await fetchDetail(); setActionLoading(false); return
    }
    await supabase.from('approval_logs').insert({
      pengajuan_id: id, action: 'submitted',
      action_by: profile.id, role_at_time: profile.role,
      catatan: `Diajukan ulang oleh ${profile.full_name}`,
    })
    notifyPengajuanUpdate(
      { ...pengajuan, id },
      tahap,
      { title: '📝 Pengajuan diajukan ulang', body: `"${pengajuan.judul}" diajukan ulang oleh ${profile.full_name}, kembali ke ${STATUS_LABEL[tahap]}` }
    )
    fetchDetail()
    setActionLoading(false)
  }

  // Lanjutkan pengajuan yang Ditahan -> kembali ke tahap tempat ia ditahan (oleh approver tahap itu)
  async function handleLanjutkan() {
    setActionLoading(true); setActionError('')
    const tahap = tahapTerakhir(pengajuan)
    const { data: updated, error: upErr } = await supabase.from('pengajuan')
      .update({ status: tahap, rejection_type: null, rejection_reason: null })
      .eq('id', id).eq('status', 'hold').select('id')
    if (upErr || !updated?.length) {
      setActionError(upErr ? `Gagal melanjutkan: ${upErr.message}` : 'Status pengajuan sudah berubah. Halaman dimuat ulang.')
      await fetchDetail(); setActionLoading(false); return
    }
    const { error: logErr } = await supabase.from('approval_logs').insert({
      pengajuan_id: id, action: 'dilanjutkan', action_by: profile.id, role_at_time: profile.role,
      catatan: `Dilanjutkan oleh ${profile.full_name}, kembali ke ${STATUS_LABEL[tahap]}`,
    })
    if (logErr) console.error('Gagal mencatat di timeline:', logErr)
    notifyPengajuanUpdate({ ...pengajuan, id }, tahap, {
      title: '▶️ Pengajuan dilanjutkan',
      body: `"${pengajuan.judul}" tidak ditahan lagi, kembali ke ${STATUS_LABEL[tahap]}`,
    })
    await fetchDetail()
    setActionLoading(false)
  }

  function handleEditResubmit() {
    setShowRejectModal(false)
    navigate(`/pengajuan/${id}/edit`)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!pengajuan) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Pengajuan tidak ditemukan</div>

  const hasActions = canApprove() || canAccessLpj() || canResubmit() || canLanjutkanTahanan(profile?.role, pengajuan) || (isOwner && pengajuan.status === 'hold') || canArchive || !!actionError || !!rencanaBatalApproval(profile?.id, pengajuan)
  const penerimaUtama = penerima[0]
  const penerimaLabel = penerimaUtama
    ? labelRekening(penerimaUtama)
    : '-'

  async function mulaiUbahSubkategori() {
    const { data } = await supabase.from('subkategori_pengajuan').select('nama').order('nama')
    const list = (data || []).map(d => d.nama)
    setUbahSub({ list, pilihan: list.includes(pengajuan.subkategori) ? pengajuan.subkategori : '', menyimpan: false, error: '' })
  }

  async function simpanSubkategori() {
    if (!ubahSub.pilihan) { setUbahSub({ ...ubahSub, error: 'Pilih subkategori dulu' }); return }
    setUbahSub({ ...ubahSub, menyimpan: true, error: '' })
    const { data: updated, error } = await supabase.from('pengajuan').update({ subkategori: ubahSub.pilihan })
      .eq('id', id).neq('status', 'approved_ceo').select('id')
    if (error || !updated?.length) {
      setUbahSub({ ...ubahSub, menyimpan: false, error: error ? `Gagal menyimpan: ${error.message}` : 'Tidak bisa diubah: dana sudah ditransfer.' })
      return
    }
    setPengajuan(prev => ({ ...prev, subkategori: ubahSub.pilihan }))
    setUbahSub(null)
  }

  // Batalkan approval sendiri (selama tahap berikutnya belum bertindak)
  async function handleBatalApproval() {
    const rencana = rencanaBatalApproval(profile?.id, pengajuan)
    if (!rencana) return
    if (!batal.alasan.trim()) {
      setBatal({ ...batal, error: 'Tulis alasannya dulu' })
      document.getElementById('alasan-batal')?.focus()
      return
    }
    setActionLoading(true)
    setActionError('')
    const { data: updated, error } = await supabase.from('pengajuan')
      .update({ status: rencana.ke, ...rencana.kosongkan })
      .eq('id', id).eq('status', rencana.dari).select('id')
    if (error || !updated?.length) {
      setActionError(error ? `Gagal membatalkan: ${error.message}` : 'Tidak bisa dibatalkan: tahap berikutnya sudah memproses pengajuan ini.')
      setBatal(null); await fetchDetail(); setActionLoading(false)
      return
    }
    const { error: logErr } = await supabase.from('approval_logs').insert({
      pengajuan_id: id, action: 'approval_dibatalkan',
      action_by: profile.id, role_at_time: profile.role, catatan: batal.alasan.trim(),
    })
    if (logErr) console.error('Gagal mencatat pembatalan di timeline:', logErr)
    notifyPengajuanUpdate({ ...pengajuan, id }, rencana.ke, {
      title: '↩️ Approval dibatalkan',
      body: `"${pengajuan.judul}" — approval ${profile.full_name} dibatalkan, kembali ke ${STATUS_LABEL[rencana.ke]}. Alasan: ${batal.alasan.trim()}`,
    })
    setBatal(null)
    await fetchDetail()
    setActionLoading(false)
  }

  const ActionButtons = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {actionError && (
        <div role="alert" style={{ background: '#FFF0F0', border: '1px solid #F5C2C2', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#8B1A1F' }}>{actionError}</div>
      )}
      {canApprove() && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowRejectModal(true)}
            style={{ flex: 1, padding: isMobile ? '13px 8px' : '14px', background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            Tolak / Hold / Revisi
          </button>
          <button onClick={handleApproveClick} disabled={actionLoading}
            style={{ flex: 2, padding: isMobile ? '13px 8px' : '14px', background: '#C0272D', border: 'none', borderRadius: 12, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
            {actionLoading ? 'Memproses...' : getApproveLabel(pengajuan.status)}
          </button>
        </div>
      )}

      {rencanaBatalApproval(profile?.id, pengajuan) && (
        <button onClick={() => setBatal({ alasan: '', error: '' })} disabled={actionLoading}
          style={{ width: '100%', padding: '13px', minHeight: 44, background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: 'inherit' }}>
          ↩ Batalkan approval saya
        </button>
      )}

      {canResubmit() && (
        <div style={{ background: '#FFF8E1', borderRadius: 12, border: '1px solid #FFE082', padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#B8860B', marginBottom: 4 }}>Pengajuan perlu direvisi</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Silakan edit pengajuan atau ajukan ulang tanpa perubahan</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleEditResubmit}
              style={{ flex: 1, padding: '11px 8px', background: '#fff', border: '1.5px solid #FFE082', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#B8860B', cursor: 'pointer', fontFamily: 'inherit' }}>
              ✏️ Edit & Resubmit
            </button>
            <button onClick={handleResubmit} disabled={actionLoading}
              style={{ flex: 1, padding: '11px 8px', background: '#B8860B', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
              {actionLoading ? 'Memproses...' : '↩ Ajukan Ulang'}
            </button>
          </div>
        </div>
      )}

      {canLanjutkanTahanan(profile?.role, pengajuan) && (
        <button onClick={handleLanjutkan} disabled={actionLoading}
          style={{ width: '100%', padding: isMobile ? '13px' : '14px', minHeight: 44, background: '#C0272D', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
          {actionLoading ? 'Memproses...' : '▶ Lanjutkan pengajuan'}
        </button>
      )}

      {isOwner && pengajuan.status === 'hold' && (
        <div data-testid="info-ditahan" style={{ background: '#F7F7F7', borderRadius: 12, border: '1px solid #EBEBEB', padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 10 }}>
            Selama ditahan, kamu masih bisa mengubah isi pengajuan.
          </div>
          <button onClick={handleEditResubmit}
            style={{ width: '100%', padding: '11px', minHeight: 44, background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✏️ Ubah pengajuan
          </button>
        </div>
      )}

      {canAccessLpj() && (
        <button onClick={() => navigate(`/lpj/${id}`)}
          style={{ width: '100%', padding: isMobile ? '13px' : '14px', background: '#1565C0', border: 'none', borderRadius: 12, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
          📋 {hasLpj ? 'Lihat' : 'Buat'} Laporan Pertanggungjawaban (LPJ)
        </button>
      )}

      <button onClick={() => generatePengajuanPdf(pengajuan, items, penerima, logs)}
        style={{ width: '100%', padding: isMobile ? '13px' : '14px', background: '#fff', border: '1.5px solid #C0272D', borderRadius: 12, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#C0272D', cursor: 'pointer', fontFamily: 'inherit' }}>
        📄 Download Surat Pengajuan
      </button>

      {canArchive && (
        <button onClick={handleArchive} disabled={archiving}
          style={{ width: '100%', padding: isMobile ? '13px' : '14px', background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: 'inherit', opacity: archiving ? 0.7 : 1 }}>
          {archiving ? 'Mengarsipkan...' : '🗂 Arsipkan Pengajuan'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>

      {!isMobile && (
        <div style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
          <div style={{ marginBottom: 32 }}><BrandMark /></div>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: '#FFF0F0', border: 'none', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#C0272D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⊞ Dashboard
          </button>
        </div>
      )}

      <div style={{ flex: 1, marginLeft: isMobile ? 0 : 240, padding: isMobile ? '16px 16px 280px' : '32px', maxWidth: isMobile ? '100%' : 860 }}>

        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => navigate('/dashboard')} aria-label="Kembali" style={{ background: 'none', border: 'none', color: '#C0272D', fontSize: 20, cursor: 'pointer', padding: 10, margin: -10, minWidth: 44, minHeight: 44, lineHeight: 1, flexShrink: 0 }}>←</button>
            <div style={{ flex: 1 }}><BrandMark compact /></div>
          </div>
        ) : (
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 12 }}>
            ← Kembali
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>{pengajuan.judul}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>{pengajuan.kode_surat}</div>
            <div data-testid="langkah-berikutnya" style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
              <span style={{ color: '#999' }}>Berikutnya: </span>{langkahBerikutnya(pengajuan, { hasLpj })}
            </div>
          </div>
          <span className={`badge ${STATUS_CLASS[pengajuan.status]}`} style={{ fontSize: 11, padding: '5px 10px', flexShrink: 0 }}>
            {STATUS_LABEL[pengajuan.status]}
          </span>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 14 : 20 }}>
            {[
              { label: 'Divisi', value: pengajuan.division },
              { label: 'Metode Bayar', value: pengajuan.metode_pembayaran },
              { label: 'Tanggal Submit', value: formatDate(pengajuan.submitted_at) },
              { label: 'Total', value: formatRp(pengajuan.total_pengajuan) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Subkategori (ditebak otomatis; CFO/Finance bisa membetulkan sebelum transfer) */}
          <div data-testid="subkategori-detail" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F2F2F2' }}>
            <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Subkategori</div>
            {!ubahSub ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: pengajuan.subkategori === BELUM_DIKATEGORIKAN ? '#8B1A1F' : '#111' }}>
                  {pengajuan.subkategori || BELUM_DIKATEGORIKAN}
                </div>
                {canChangeSubkategori(profile?.role, pengajuan.status) && (
                  <button onClick={mulaiUbahSubkategori}
                    style={{ background: 'none', border: '1px solid #DDD', borderRadius: 8, padding: '6px 12px', minHeight: 32, fontSize: 12, color: '#333', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Ubah subkategori
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-input" aria-label="Pilih subkategori" value={ubahSub.pilihan}
                  onChange={e => setUbahSub({ ...ubahSub, pilihan: e.target.value, error: '' })}
                  style={{ flex: '1 1 220px', borderColor: ubahSub.error ? '#C0272D' : undefined }}>
                  <option value="">Pilih subkategori</option>
                  {ubahSub.list.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={simpanSubkategori} disabled={ubahSub.menyimpan} className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }}>
                  {ubahSub.menyimpan ? 'Menyimpan...' : 'Simpan subkategori'}
                </button>
                <button onClick={() => setUbahSub(null)} className="btn-secondary" style={{ width: 'auto', padding: '10px 16px' }}>Batal</button>
                {ubahSub.error && <div role="alert" style={{ flexBasis: '100%', fontSize: 12, color: '#C0272D' }}>{ubahSub.error}</div>}
              </div>
            )}
          </div>
          {pengajuan.catatan && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F5F5' }}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Catatan</div>
              <div style={{ fontSize: 13, color: '#555' }}>{pengajuan.catatan}</div>
            </div>
          )}
          {pengajuan.rejection_reason && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F5F5', background: '#FFF8F8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#C0272D', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Alasan {pengajuan.rejection_type === 'revision' ? 'Revisi' : pengajuan.rejection_type === 'hold' ? 'Hold' : 'Penolakan'}
              </div>
              <div style={{ fontSize: 13, color: '#C0272D' }}>{pengajuan.rejection_reason}</div>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', fontSize: 14, fontWeight: 600, color: '#111' }}>Item Pengajuan</div>
          {isMobile ? (
            <div>
              {items.map((item, idx) => (
                <div key={item.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F8F8F8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 4 }}>
                        <span style={{ color: '#BBB', marginRight: 6 }}>{idx + 1}.</span>{item.uraian}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{item.qty} {item.satuan} × {formatRp(item.harga_satuan)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', flexShrink: 0 }}>{formatRp(item.jumlah ?? Number(item.qty) * Number(item.harga_satuan))}</div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 16px', borderTop: '2px solid #111', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>Total Pengajuan</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#C0272D' }}>{formatRp(pengajuan.total_pengajuan)}</span>
              </div>
            </div>
          ) : (
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
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{formatRp(item.jumlah ?? Number(item.qty) * Number(item.harga_satuan))}</td>
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
          )}
        </div>

        {penerima.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>{REKENING_JUDUL}</div>
            {penerima.map((p) => (
              <div key={p.id} style={{ background: '#FAFAFA', borderRadius: 8, padding: '14px', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                  {REKENING_FIELDS.map(f => ({ label: f.label, value: p[f.key] })).map(({ label, value }) => (
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

        {attachments.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>Lampiran</div>
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

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F0F0F0', padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>Timeline Approval</div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 13, color: '#999' }}>Belum ada aktivitas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: log.action === 'approved' ? '#2E7D32' : log.action === 'submitted' ? '#1565C0' : log.action === 'approval_dibatalkan' ? '#999' : log.action === 'dilanjutkan' ? '#1565C0' : '#C0272D', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {log.action === 'submitted' ? 'Pengajuan disubmit' : log.action === 'approved' ? 'Disetujui' : log.action === 'approval_dibatalkan' ? 'Approval dibatalkan' : log.action === 'dilanjutkan' ? 'Dilanjutkan' : log.action === 'diubah' ? 'Isi pengajuan diubah' : log.action === 'revision' ? 'Diminta revisi' : log.action === 'hold' ? 'Ditahan' : log.action === 'rejected' ? 'Ditolak' : log.action}
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

        {hasActions && (
          isMobile ? (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #EBEBEB', padding: '12px 16px', paddingBottom: 'max(32px, calc(20px + env(safe-area-inset-bottom)))', zIndex: 90 }}>
              <ActionButtons />
            </div>
          ) : (
            <ActionButtons />
          )
        )}
      </div>

      {/* FINAL APPROVE MODAL */}
      {showFinalApproveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, padding: isMobile ? '28px 20px' : 32, paddingBottom: isMobile ? 'max(40px, calc(28px + env(safe-area-inset-bottom)))' : 32, width: isMobile ? '100%' : 420 }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />}
            <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8, textAlign: 'center' }}>Konfirmasi Transfer</div>
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Apakah dana <strong style={{ color: '#C0272D' }}>{formatRp(pengajuan.total_pengajuan)}</strong> ke <strong>{penerimaLabel}</strong> sudah ditransfer?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFinalApproveModal(false)}
                style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                Belum
              </button>
              <button onClick={handleApprove} disabled={actionLoading}
                style={{ flex: 1, padding: '13px', background: '#2E7D32', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Memproses...' : 'Sudah Ditransfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {batal && (() => {
        const rencana = rencanaBatalApproval(profile?.id, pengajuan)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }}>
            <div role="dialog" aria-label="Batalkan approval" style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, padding: isMobile ? '24px 20px' : 32, paddingBottom: isMobile ? 'max(40px, calc(28px + env(safe-area-inset-bottom)))' : 32, width: isMobile ? '100%' : 460 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8 }}>Batalkan approval kamu?</div>
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
                Pengajuan kembali ke <b>{rencana ? STATUS_LABEL[rencana.ke] : '-'}</b>. Tahap berikutnya tidak bisa approve sampai kamu approve lagi. Semua pihak terkait dapat notifikasi.
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="alasan-batal">Alasan *</label>
                <textarea id="alasan-batal" className="form-input" rows={3} placeholder="Contoh: nominal perlu dicek ulang dengan vendor"
                  value={batal.alasan} onChange={e => setBatal({ alasan: e.target.value, error: '' })}
                  style={{ borderColor: batal.error ? '#C0272D' : undefined }} />
                {batal.error && <div role="alert" style={{ fontSize: 12, color: '#C0272D', marginTop: 4 }}>{batal.error}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setBatal(null)}
                  style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Tidak jadi</button>
                <button onClick={handleBatalApproval} disabled={actionLoading}
                  style={{ flex: 1, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? 'Memproses...' : 'Ya, batalkan'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, padding: isMobile ? '24px 20px' : 32, paddingBottom: isMobile ? 'max(40px, calc(28px + env(safe-area-inset-bottom)))' : 32, width: isMobile ? '100%' : 480 }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E0E0E0', borderRadius: 2, margin: '0 auto 20px' }} />}
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 18 }}>Tolak Pengajuan</div>
            <div style={{ marginBottom: 16 }}>
              <div className="form-label">Tipe</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ value: 'revision', label: 'Perlu Revisi' }, { value: 'hold', label: 'Hold' }, { value: 'rejected', label: 'Tolak' }].map(opt => (
                  <button key={opt.value} onClick={() => setRejectType(opt.value)}
                    style={{ flex: 1, padding: '10px 6px', background: rejectType === opt.value ? '#FFF0F0' : '#F5F5F5', border: `1.5px solid ${rejectType === opt.value ? '#C0272D' : 'transparent'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: rejectType === opt.value ? '#C0272D' : '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Alasan *</label>
              <textarea className="form-input" placeholder="Jelaskan alasan penolakan / revisi / hold" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason('') }}
                style={{ flex: 1, padding: '13px', background: '#F5F5F5', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}
                style={{ flex: 1, padding: '13px', background: '#C0272D', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: !rejectReason.trim() ? 0.5 : 1 }}>
                {actionLoading ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}