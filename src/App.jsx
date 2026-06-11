import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SelectRolePage from './pages/SelectRolePage'
import DashboardPage from './pages/DashboardPage'
import FormPengajuanPage from './pages/FormPengajuanPage'
import DetailPengajuanPage from './pages/DetailPengajuanPage'
import LpjPage from './pages/LpjPage'
import ArchivedPage from './pages/ArchivedPage'

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/select-role" replace />
  return children
}

function AuthRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (user && profile) return <Navigate to="/dashboard" replace />
  if (user && !profile) return <Navigate to="/select-role" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/select-role" element={<SelectRolePage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/pengajuan/baru" element={<ProtectedRoute><FormPengajuanPage /></ProtectedRoute>} />
      <Route path="/pengajuan/:id" element={<ProtectedRoute><DetailPengajuanPage /></ProtectedRoute>} />
      <Route path="/lpj/:pengajuanId" element={<ProtectedRoute><LpjPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      <Route path="/arsip" element={<ProtectedRoute><ArchivedPage /></ProtectedRoute>} />
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