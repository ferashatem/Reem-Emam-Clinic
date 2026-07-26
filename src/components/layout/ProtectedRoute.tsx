import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../ui/Feedback'
import { C } from '../../theme'

interface Props {
  children: React.ReactNode
  role: 'super_admin' | 'admin' | 'staff'
}

function homeFor(role: string) {
  if (role === 'super_admin') return '/super-admin/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'staff') return '/staff/reservations'
  return '/login'
}

export default function ProtectedRoute({ children, role }: Props) {
  const { firebaseUser, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Spinner />
      </div>
    )
  }

  if (!firebaseUser || !userProfile) return <Navigate to="/login" replace />
  if (!userProfile.is_active) return <Navigate to="/login" replace />

  // Super admins can reach everything the partners can
  const allowed =
    userProfile.role === role ||
    (role === 'admin' && userProfile.role === 'super_admin')

  if (!allowed) return <Navigate to={homeFor(userProfile.role)} replace />

  return <>{children}</>
}
