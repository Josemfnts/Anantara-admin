import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'

// Placeholder temporal — reemplazamos en la siguiente fase
function Placeholder({ title }) {
  const { signOut, user } = useAuth()
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#1d5c2e' }}>Panel · {title}</h2>
        <button
          onClick={signOut}
          style={{ padding: '8px 16px', background: '#f0f5f0', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#666' }}
        >
          Cerrar sesión
        </button>
      </div>
      <p style={{ color: '#888' }}>Conectado como {user?.email}</p>
      <p style={{ color: '#aaa', marginTop: 8, fontSize: 14 }}>Esta sección está en construcción.</p>
    </div>
  )
}

// Ruta privada: solo admins
function PrivateRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f5f0' }}>
      <p style={{ color: '#2d7a3f', fontFamily: 'sans-serif' }}>Cargando...</p>
    </div>
  )
  if (!user || !isAdmin) return <Navigate to="/login" replace />
  return children
}

// Ruta pública: si ya es admin manda al dashboard
function PublicRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return null
  if (user && isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Dashboard */}
      <Route path="/" element={<PrivateRoute><Placeholder title="Dashboard" /></PrivateRoute>} />

      {/* Osteopatía */}
      <Route path="/agenda"                 element={<PrivateRoute><Placeholder title="Agenda" /></PrivateRoute>} />
      <Route path="/agenda/horarios"        element={<PrivateRoute><Placeholder title="Horarios" /></PrivateRoute>} />
      <Route path="/agenda/dias-bloqueados" element={<PrivateRoute><Placeholder title="Días bloqueados" /></PrivateRoute>} />
      <Route path="/agenda/lista-espera"    element={<PrivateRoute><Placeholder title="Lista de espera" /></PrivateRoute>} />

      {/* Yoga */}
      <Route path="/yoga"    element={<PrivateRoute><Placeholder title="Yoga · Slots" /></PrivateRoute>} />

      {/* Belleza */}
      <Route path="/belleza" element={<PrivateRoute><Placeholder title="Belleza · Slots" /></PrivateRoute>} />

      {/* General */}
      <Route path="/servicios" element={<PrivateRoute><Placeholder title="Servicios" /></PrivateRoute>} />
      <Route path="/pacientes" element={<PrivateRoute><Placeholder title="Pacientes" /></PrivateRoute>} />

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
