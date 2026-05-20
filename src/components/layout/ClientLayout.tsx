import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import { signOut } from '../../services/auth'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/client/home', label: 'الرئيسية', icon: '🏠' },
  { to: '/client/book', label: 'احجزي', icon: '✨' },
  { to: '/client/sessions', label: 'جلساتي', icon: '📅' },
  { to: '/client/reports', label: 'تقاريري', icon: '📋' },
  { to: '/client/profile', label: 'بروفايلي', icon: '👤' },
]

export default function ClientLayout() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success('تم تسجيل الخروج')
    navigate('/login')
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#FDF6F0' }}>
      {/* Top bar */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10"
        style={{ borderColor: '#F2C4CE' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#F2C4CE' }}>
            <span className="text-sm">🌸</span>
          </div>
          <span className="font-bold text-sm" style={{ color: '#8B3A52' }}>ريم غلو هاوس</span>
        </div>
        {client && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{client.name}</span>
            <button onClick={handleSignOut} className="text-xs text-red-400 hover:text-red-600">خروج</button>
          </div>
        )}
      </header>

      {/* Page content with bottom padding for nav */}
      <main className="flex-1 overflow-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t z-10"
        style={{ borderColor: '#F2C4CE' }}>
        <div className="flex">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-[#8B3A52]' : 'text-gray-400'
                }`
              }
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
