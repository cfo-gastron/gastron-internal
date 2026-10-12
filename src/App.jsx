import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import WaitingAccessPage from './pages/WaitingAccessPage'
import UsersSettingsPage from './pages/UsersSettingsPage'
import DashboardPage from './pages/DashboardPage'
import FormPengajuanPage from './pages/FormPengajuanPage'
import DetailPengajuanPage from './pages/DetailPengajuanPage'
import EditPengajuanPage from './pages/EditPengajuanPage'
import LpjPage from './pages/LpjPage'
import ArchivedPage from './pages/ArchivedPage'
import MappingKategoriPage from './pages/MappingKategoriPage'

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.role) return <Navigate to="/menunggu-akses" replace />
  return children
}

// Khusus admin (kolom is_admin, dijaga juga di database). Non-admin ke Dashboard.
function AdminRoute({ children }) {
  const { profile, isAdmin } = useAuth()
  if (profile?.role && !isAdmin) return <Navigate to="/dashboard" replace />
  return <ProtectedRoute>{children}</ProtectedRoute>
}

// Halaman "Menunggu akses": hanya untuk akun yang sudah login tapi belum punya role
function WaitingRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role) return <Navigate to="/dashboard" replace />
  return children
}

function AuthRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (user && profile?.role) return <Navigate to="/dashboard" replace />
  if (user) return <Navigate to="/menunggu-akses" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/menunggu-akses" element={<WaitingRoute><WaitingAccessPage /></WaitingRoute>} />
      <Route path="/select-role" element={<Navigate to="/menunggu-akses" replace />} />
      <Route path="/pengaturan/pengguna" element={<AdminRoute><UsersSettingsPage /></AdminRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/pengajuan/baru" element={<ProtectedRoute><FormPengajuanPage /></ProtectedRoute>} />
      <Route path="/pengajuan/:id" element={<ProtectedRoute><DetailPengajuanPage /></ProtectedRoute>} />
      <Route path="/pengajuan/:id/edit" element={<ProtectedRoute><EditPengajuanPage /></ProtectedRoute>} />
      <Route path="/lpj/:pengajuanId" element={<ProtectedRoute><LpjPage /></ProtectedRoute>} />
      <Route path="/arsip" element={<ProtectedRoute><ArchivedPage /></ProtectedRoute>} />
      <Route path="/mapping-kategori" element={<ProtectedRoute><MappingKategoriPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}