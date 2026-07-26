import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../services/firebase'
import { getUserById } from '../services/firestore'

/**
 * Only clinic team members have accounts. Clients book from the public site
 * without signing in, so there is no client profile here.
 */
export interface TeamProfile {
  id: string
  uid: string
  name: string
  phone: string
  email: string
  role: 'super_admin' | 'admin' | 'staff'
  is_active: boolean
  working_hours?: string
}

export type UserProfile = TeamProfile

interface AuthContextType {
  firebaseUser: User | null
  userProfile: UserProfile | null
  loading: boolean
  role: 'super_admin' | 'admin' | 'staff' | null
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  role: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      if (!user) {
        setUserProfile(null)
        setLoading(false)
        return
      }

      try {
        // Team docs live at /users/{uid} — created by the super admin.
        const profile = await getUserById(user.uid) as TeamProfile | null
        setUserProfile(profile ?? null)
      } catch (err) {
        console.error('AuthContext: failed to load profile', err)
        setUserProfile(null)
      } finally {
        setLoading(false)
      }
    })

    return unsub
  }, [])

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        role: userProfile?.role ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
