import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../services/firebase'
import {
  getUserById, getUserByPhone, linkUidToUser,
  getClientById, getClientByUid, getClientByPhone, linkUidToClient, createClient,
} from '../services/firestore'

interface AdminProfile {
  id: string
  uid: string
  name: string
  phone: string
  email: string
  role: 'super_admin' | 'admin'
  is_active: boolean
  working_hours?: string
}

export interface ClientProfile {
  id: string
  uid: string
  name: string
  phone: string
  email?: string
  age?: number
  skin_type?: string
  source?: string
  notes?: string
  role: 'client'
}

export type UserProfile = AdminProfile | ClientProfile

interface AuthContextType {
  firebaseUser: User | null
  userProfile: UserProfile | null
  clientProfile: ClientProfile | null
  loading: boolean
  role: 'super_admin' | 'admin' | 'client' | null
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  userProfile: null,
  clientProfile: null,
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
        // 1. Try admin/super_admin users collection by UID
        let profile = await getUserById(user.uid) as AdminProfile | null

        if (!profile && user.phoneNumber) {
          // 2. Fallback: lookup admin by phone (may fail for non-admin phone users)
          try {
            const byPhone = await getUserByPhone(user.phoneNumber) as AdminProfile | null
            if (byPhone) {
              await linkUidToUser(byPhone.id, user.uid)
              profile = await getUserById(user.uid) as AdminProfile | null
            }
          } catch (_) {
            // phone-auth client users don't have permission to query users collection
          }
        }

        if (profile) {
          setUserProfile({ ...profile, role: profile.role })
          return
        }

        // 3. Try direct doc read by uid (uid used as document ID in saveClientByUid)
        let clientDoc = await getClientById(user.uid) as ClientProfile | null

        // Fallback: query by uid field
        if (!clientDoc) clientDoc = await getClientByUid(user.uid) as ClientProfile | null

        if (!clientDoc && user.phoneNumber) {
          // 4. Fallback: lookup client by phone then link UID
          try {
            const clientByPhone = await getClientByPhone(user.phoneNumber) as ClientProfile | null
            if (clientByPhone) {
              await linkUidToClient(clientByPhone.id, user.uid)
              clientDoc = await getClientByUid(user.uid) as ClientProfile | null
            }
          } catch (_) {}
        }

        if (!clientDoc && user.phoneNumber) {
          // Auto-register: new client logging in for the first time
          const ref = await createClient({
            uid: user.uid,
            phone: user.phoneNumber,
            name: user.displayName || user.phoneNumber,
          })
          clientDoc = { id: ref.id, uid: user.uid, phone: user.phoneNumber, name: user.displayName || user.phoneNumber } as ClientProfile
        }

        setUserProfile(clientDoc ? { ...clientDoc, role: 'client' } : null)
      } catch (_) {
        // If Firestore fails, create a minimal profile so the user isn't stuck
        if (user.phoneNumber) {
          setUserProfile({
            id: user.uid,
            uid: user.uid,
            phone: user.phoneNumber,
            name: user.phoneNumber,
            role: 'client',
          } as ClientProfile)
        } else {
          setUserProfile(null)
        }
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const clientProfile = userProfile?.role === 'client' ? (userProfile as ClientProfile) : null

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      userProfile,
      clientProfile,
      loading,
      role: userProfile?.role ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
