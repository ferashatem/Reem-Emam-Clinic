import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../services/auth'
import { useConfirm } from '../ui/ConfirmDialog'
import { C } from '../../theme'

export interface NavItem {
  to: string
  label: string
  icon: string
}

interface Props {
  roleLabel: string
  links: NavItem[]
}

/**
 * Shared dashboard chrome for every internal role.
 * Desktop: fixed sidebar. Mobile: top bar + slide-in drawer, plus a bottom bar
 * for the first four links so the common actions stay one tap away.
 */
export default function AppShell({ roleLabel, links }: Props) {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [drawerOpen])

  async function handleSignOut() {
    const ok = await confirm({
      title: 'تسجيل الخروج',
      message: 'متأكدة إنك عايزة تخرجي من الحساب؟',
      confirmLabel: 'خروج',
      danger: true,
    })
    if (!ok) return
    try {
      await signOut()
      toast.success('تم تسجيل الخروج')
      navigate('/login')
    } catch {
      toast.error('حصل خطأ أثناء تسجيل الخروج')
    }
  }

  const bottomLinks = links.slice(0, 4)

  const brand = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: C.primarySoft }}>
        <span className="text-xl">🌸</span>
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: C.primary }}>ريم غلو هاوس</p>
        <p className="text-xs text-gray-400 truncate">{roleLabel}</p>
      </div>
    </div>
  )

  /** `onNavigate` lets the drawer close itself the moment a link is tapped. */
  const navFor = (onNavigate?: () => void) => (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {links.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <span aria-hidden>{link.icon}</span>
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )

  const account = (
    <div className="p-4 border-t" style={{ borderColor: C.primarySoft }}>
      <div className="mb-3 px-2 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: C.text }}>{userProfile?.name}</p>
        <p className="text-xs text-gray-400 truncate" dir="ltr">{userProfile?.phone}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="w-full text-start px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
      >
        تسجيل الخروج ←
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: C.bg }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-l flex-col sticky top-0 h-screen" style={{ borderColor: C.primarySoft }}>
        <div className="p-6 border-b" style={{ borderColor: C.primarySoft }}>{brand}</div>
        {navFor()}
        {account}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85%] bg-white flex flex-col mr-auto shadow-2xl h-full">
            <div className="p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: C.primarySoft }}>
              {brand}
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="إغلاق القائمة"
                className="w-9 h-9 shrink-0 rounded-full hover:bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>
            {navFor(() => setDrawerOpen(false))}
            {account}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderColor: C.primarySoft }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="فتح القائمة"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: C.bg, color: C.primary }}
          >
            ☰
          </button>
          <span className="font-bold text-sm truncate" style={{ color: C.primary }}>ريم غلو هاوس</span>
          <span className="text-xs text-gray-400 truncate max-w-[35%]">{userProfile?.name}</span>
        </header>

        <main className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 ${bottomLinks.length > 1 ? 'pb-24 lg:pb-8' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar — quick access to the main screens */}
      {bottomLinks.length > 1 && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t flex"
          style={{ borderColor: C.primarySoft }}
        >
          {bottomLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-[#8B3A52]' : 'text-gray-400'
                }`
              }
            >
              <span className="text-lg" aria-hidden>{link.icon}</span>
              <span className="truncate max-w-full px-1">{link.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {dialog}
    </div>
  )
}
