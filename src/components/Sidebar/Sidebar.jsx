import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Sidebar.css'

const NAV = [
  {
    group: null,
    items: [
      { to: '/',          icon: '📊', label: 'Dashboard',      end: true },
    ]
  },
  {
    group: 'Osteopatía',
    items: [
      { to: '/agenda',              icon: '📅', label: 'Agenda semanal' },
      { to: '/agenda/horarios',     icon: '⏰', label: 'Horarios',         sub: true },
      { to: '/agenda/bloqueados',   icon: '🚫', label: 'Días bloqueados',  sub: true },
      { to: '/agenda/espera',       icon: '⏳', label: 'Lista de espera',  sub: true },
    ]
  },
  {
    group: 'Clases',
    items: [
      { to: '/yoga',    icon: '🧘', label: 'Yoga' },
      { to: '/belleza', icon: '✨', label: 'Belleza' },
    ]
  },
  {
    group: 'Centro',
    items: [
      { to: '/pacientes', icon: '👥', label: 'Pacientes' },
    ]
  },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const email = user?.email || ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-badge">A</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">ANANTARA</span>
            <span className="sidebar-logo-sub">Panel Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map((section, si) => (
            <div key={si} className="sidebar-group">
              {section.group && (
                <div className="sidebar-group-label">{section.group}</div>
              )}
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar-link ${item.sub ? 'sub' : ''} ${isActive ? 'active' : ''}`
                  }
                  onClick={onClose}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <span className="sidebar-user-email">{email}</span>
          </div>
          <button className="sidebar-signout" onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>

      </aside>
    </>
  )
}
