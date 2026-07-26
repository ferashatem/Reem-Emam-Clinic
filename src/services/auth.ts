import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { auth, firebaseConfig } from './firebase'

// Only the clinic team has accounts — clients book from the public site without
// signing in. Team members log in with a username + password; Firebase Auth
// works with emails, so each username maps to a synthetic email under this
// domain. The domain is never emailed to.
const TEAM_EMAIL_DOMAIN = 'team.reem-emam.app'

/**
 * Accounts created through the app use a bare username; accounts created
 * straight from the Firebase console use a real email. Anything already
 * containing '@' is passed through untouched so both kinds can sign in.
 */
export function usernameToEmail(username: string): string {
  const value = username.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${TEAM_EMAIL_DOMAIN}`
}

/** Signs a team member (admin/staff) in with their username + password. */
export async function signInWithUsername(username: string, password: string) {
  return signInWithEmailAndPassword(auth, usernameToEmail(username), password)
}

/**
 * Creates a Firebase Auth account for a new team member WITHOUT signing the
 * current (super-admin) user out. Uses a throw-away secondary app instance so
 * the primary session is untouched. Returns the new user's UID.
 */
export async function createTeamMemberAuth(username: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(username), password)
    const uid = cred.user.uid
    await firebaseSignOut(secondaryAuth)
    return uid
  } finally {
    await deleteApp(secondaryApp)
  }
}

/** Signs out the currently authenticated user session. */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}
