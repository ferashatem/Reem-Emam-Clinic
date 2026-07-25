import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface Props {
  children: React.ReactNode
  role: 'super_admin' | 'admin' | 'staff' | 'client'
}

function redirectForRole(role: string) {
  if (role === 'super_admin') return '/super-admin/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'staff') return '/staff/reservations'
  if (role === 'client') return '/client/home'
  return '/login'
}

export default function ProtectedRoute({ children, role }: Props) {
  const { firebaseUser, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDF6F0' }}>
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
      </div>
    )
  }

  if (!firebaseUser || !userProfile) return <Navigate to="/login" replace />

  const allowed =
    userProfile.role === role ||
    (role === 'admin' && userProfile.role === 'super_admin')

  if (!allowed) return <Navigate to={redirectForRole(userProfile.role)} replace />

  // For team roles (admin/super_admin/staff), check is_active
  if (userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.role === 'staff') {
    const teamUser = userProfile as { is_active: boolean }
    if (!teamUser.is_active) return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
