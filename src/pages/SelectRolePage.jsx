import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'operational', label: 'Operational Assistant', division: 'OPR', desc: 'Tim operasional & kandang' },
  { value: 'procurement', label: 'Procurement', division: 'PRC', desc: 'Pembelian alat & service' },
  { value: 'corporate_secretary', label: 'Corporate Secretary', division: 'ADM', desc: 'Izin & legalitas' },
  { value: 'finance', label: 'Finance & Accounting', division: 'FIN', desc: 'Keuangan & pembukuan' },
  { value: 'coo', label: 'Chief Operating Officer', division: null, desc: 'COO' },
  { value: 'cao', label: 'Chief Administrative Officer', division: null, desc: 'CAO' },
  { value: 'cfo', label: 'Chief Financial Officer', division: null, desc: 'CFO' },
  { value: 'ceo', label: 'Chief Executive Officer', division: null, desc: 'CEO' },
]

export default function SelectRolePage() {
  const { saveRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!selected || loading) return
    setLoading(true)
    const { error } = await saveRole(selected)
    setLoading(false)
    if (!error) navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', padding: '24px 16px' }}>
      <div style={{ maxWidth: 480, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: 22, fontWeight: 700 }}>
          Pilih role
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {ROLES.map(role => (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelected(role.value)}
              style={{
                padding: '16px 20px',
                background: selected === role.value ? '#FFF5F5' : '#fff',
                border: `1.5px solid ${selected === role.value ? '#C0272D' : '#EBEBEB'}`,
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{role.label}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{role.desc}</div>
              </div>
              {role.division && (
                <span style={{
                  background: selected === role.value ? '#C0272D' : '#F0F0F0',
                  color: selected === role.value ? '#fff' : '#888',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {role.division}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selected || loading}
          style={{
            width: '100%',
            padding: '15px',
            background: selected ? '#C0272D' : '#E0E0E0',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: selected ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            display: 'block',
          }}
        >
          {loading ? 'Menyimpan...' : 'Lanjutkan'}
        </button>

        <button
          type="button"
          onClick={signOut}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '12px',
            background: 'transparent',
            color: '#999',
            border: 'none',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Keluar
        </button>
      </div>
    </div>
  )
}