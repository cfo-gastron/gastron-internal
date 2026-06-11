import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F8F8',
      padding: '24px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: 32 }}>
          <img
            src="/logo-gastron.png"
            alt="Gastron"
            style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 16 }}
          />
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111' }}>
            <span style={{ color: '#C0272D' }}>Gastron</span>
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
            Sistem Pengajuan Internal
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>
            Masuk ke akun
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            Gunakan akun Google perusahaan
          </div>
        </div>

        <button
          onClick={signInWithGoogle}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#fff',
            border: '1.5px solid #E0E0E0',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 15,
            fontWeight: 500,
            color: '#333',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Masuk dengan Google
        </button>

        <div style={{ marginTop: 24, fontSize: 12, color: '#BBB' }}>
          PT Gastron Indo Energi
        </div>
      </div>
    </div>
  )
}
