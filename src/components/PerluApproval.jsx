import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatRp, isMyTurnLpj, isMyTurnPengajuan, LPJ_TAHAP, PENGAJUAN_TAHAP, waitingSince } from '../lib/approval'

const DAY = 864e5

function lamaMenunggu(iso, now) {
  if (!iso) return ''
  const hari = Math.floor((now - new Date(iso).getTime()) / DAY)
  return hari <= 0 ? 'hari ini' : `${hari} hari`
}

// Daftar "Perlu approval kamu" di Dashboard: pengajuan & LPJ yang sedang menunggu role user ini.
// Aturannya sama persis dengan penerima notif Telegram "🔔 Perlu approval kamu".
export default function PerluApproval({ role, pengajuan, lpjMap, isMobile }) {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())

  const items = [
    ...pengajuan
      .filter((p) => isMyTurnPengajuan(role, p.status, p.division))
      .map((p) => ({ key: p.id, judul: p.judul, info: [formatRp(p.total_pengajuan), p.division, PENGAJUAN_TAHAP[p.status]], sejak: waitingSince(p), url: `/pengajuan/${p.id}` })),
    ...pengajuan
      .filter((p) => lpjMap[p.id] && isMyTurnLpj(role, lpjMap[p.id]))
      .map((p) => ({ key: `lpj-${p.id}`, judul: `LPJ · ${p.judul}`, info: [formatRp(p.total_pengajuan), p.division, LPJ_TAHAP[lpjMap[p.id]]], sejak: p.approved_ceo_at, url: `/lpj/${p.id}` })),
  ].sort((a, b) => new Date(a.sejak || 0) - new Date(b.sejak || 0))

  if (items.length === 0) {
    return (
      <div data-testid="perlu-approval" style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        ✓ Tidak ada yang menunggu approval kamu.
      </div>
    )
  }

  return (
    <section data-testid="perlu-approval" aria-label="Perlu approval kamu" style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '14px 16px 10px' : '16px 20px 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Perlu approval kamu</div>
        <span style={{ background: '#C0272D', color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, padding: '1px 8px' }}>{items.length}</span>
      </div>
      {items.map((it) => (
        <button key={it.key} onClick={() => navigate(it.url)}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #F2F2F2', padding: isMobile ? '12px 16px' : '12px 20px', minHeight: 56, cursor: 'pointer', fontFamily: 'inherit' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.judul}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{it.info.filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{lamaMenunggu(it.sejak, now)}</div>
          <span aria-hidden="true" style={{ color: '#C0272D', fontSize: 18 }}>›</span>
        </button>
      ))}
    </section>
  )
}
