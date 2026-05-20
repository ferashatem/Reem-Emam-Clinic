import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../services/auth'
import toast from 'react-hot-toast'

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/admin/clients', label: 'Clients', icon: '👤' },
  { to: '/admin/reservations', label: 'Reservations', icon: '📅' },
  { to: '/admin/timetable', label: 'Timetable', icon: '🗓️' },
  { to: '/admin/session-reports', label: 'Session Reports', icon: '📋' },
  { to: '/admin/whatsapp', label: 'WhatsApp', icon: '💬' },
]

export default function AdminLayout() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#FDF6F0' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l flex flex-col" style={{ borderColor: '#F2C4CE' }}>
        <div className="p-6 border-b" style={{ borderColor: '#F2C4CE' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F2C4CE' }}>
              <span className="text-xl">🌸</span>
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#8B3A52' }}>Reem Glow House</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: '#F2C4CE' }}>
          <div className="mb-3 px-2">
            <p className="text-sm font-medium" style={{ color: '#2C1A1D' }}>{userProfile?.name}</p>
            <p className="text-xs text-gray-400">{userProfile?.phone}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-right px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            Sign out →
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
