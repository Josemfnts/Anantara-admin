import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login        from './pages/auth/Login'
import Dashboard    from './pages/dashboard/Dashboard'
import Agenda       from './pages/agenda/Agenda'
import Horarios     from './pages/agenda/Horarios'
import Bloqueados   from './pages/agenda/Bloqueados'
import Espera       from './pages/agenda/Espera'
import SlotsManager from './pages/slots/SlotsManager'
import Pacientes    from './pages/pacientes/Pacientes'

// Ruta solo para admins
function PrivateRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0f5f0', fontFamily: 'sans-serif',
    }}>
      <p style={{ color: '#2d7a3f' }}>Cargando panel…</p>
    </div>
  )
  if (!user || !isAdmin) return <Navigate to="/login" replace />
  return children
}

// Ruta pública: si ya es admin, redirige al panel
function PublicRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return null
  if (user && isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Dashboard */}
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

      {/* Osteopatía — Agenda */}
      <Route path="/agenda"
        element={<PrivateRoute><Agenda /></PrivateRoute>} />
      <Route path="/agenda/horarios"
        element={<PrivateRoute><Horarios /></PrivateRoute>} />
      <Route path="/agenda/bloqueados"
        element={<PrivateRoute><Bloqueados /></PrivateRoute>} />
      <Route path="/agenda/espera"
        element={<PrivateRoute><Espera /></PrivateRoute>} />

      {/* Clases */}
      <Route path="/yoga"
        element={<PrivateRoute><SlotsManager section="yoga" /></PrivateRoute>} />
      <Route path="/belleza"
        element={<PrivateRoute><SlotsManager section="belleza" /></PrivateRoute>} />

      {/* Centro */}
      <Route path="/pacientes"
        element={<PrivateRoute><Pacientes /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
