import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { requestTelegramLink } from '../lib/telegram'

const DISMISS_KEY = 'gastron-telegram-banner-nanti'

function readDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

// Banner di Dashboard untuk user yang belum menghubungkan Telegram.
// Alur: Hubungkan Telegram -> Buka Telegram -> tekan Start di bot -> kembali ke app -> banner hilang.
export default function TelegramBanner() {
  const { profile, refreshProfile } = useAuth()
  const [step, setStep] = useState('idle') // idle | loading | ready
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(readDismissed)

  // Saat user kembali dari Telegram, cek apakah sudah terhubung
  useEffect(() => {
    if (step !== 'ready') return
    const check = () => { if (document.visibilityState === 'visible') refreshProfile() }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [step, refreshProfile])

  if (!profile || profile.telegram_chat_id || dismissed) return null

  async function handleHubungkan() {
    setError('')
    setStep('loading')
    try {
      setLink(await requestTelegramLink())
      setStep('ready')
    } catch (e) {
      setError(e.message)
      setStep('idle')
    }
  }

  function handleNanti() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* sessionStorage tidak tersedia */ }
    setDismissed(true)
  }

  const ready = step === 'ready'

  return (
    <div data-testid="telegram-banner" style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FBEAEA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={18} color="#C0272D" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
              {ready ? 'Satu langkah lagi' : 'Terima notifikasi di Telegram'}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {ready ? 'Buka Telegram, tekan Start, lalu kembali ke sini.' : 'Pengajuan baru & approval langsung masuk ke Telegram kamu.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleNanti} style={{ padding: '10px 12px', minHeight: 40, background: 'transparent', border: 'none', borderRadius: 8, fontSize: 12, color: '#666', cursor: 'pointer' }}>
            Nanti
          </button>
          {ready ? (
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 14px', minHeight: 40, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', background: '#C0272D', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>
              Buka Telegram
            </a>
          ) : (
            <button onClick={handleHubungkan} disabled={step === 'loading'} style={{ padding: '10px 14px', minHeight: 40, background: '#C0272D', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: step === 'loading' ? 'default' : 'pointer', opacity: step === 'loading' ? 0.7 : 1 }}>
              {step === 'loading' ? 'Membuat link...' : 'Hubungkan Telegram'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 12, color: '#C0272D', marginTop: 10 }}>
          Gagal membuat link Telegram ({error}). Coba lagi.
        </div>
      )}
    </div>
  )
}
