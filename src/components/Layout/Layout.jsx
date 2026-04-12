import { useState } from 'react'
import Sidebar from '../Sidebar/Sidebar'
import './Layout.css'

export default function Layout({ title, actions, children, notifCount = 0 }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="admin-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menú"
          >
            ☰
          </button>

          <h1 className="admin-topbar-title">{title}</h1>

          <div className="admin-topbar-right">
            {notifCount > 0 && (
              <button className="notif-bell" title="Nuevas notificaciones">
                🔔
                <span className="notif-badge">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              </button>
            )}
            {actions}
          </div>
        </header>

        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  )
}
