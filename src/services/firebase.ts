import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: "AIzaSyCnjxQyuMAWdUxO_A9M-fxJmn1u2HBmgG8",
  authDomain: "reem-emam.firebaseapp.com",
  projectId: "reem-emam",
  storageBucket: "reem-emam.firebasestorage.app",
  messagingSenderId: "494781355578",
  appId: "1:494781355578:web:dc0af165a7152583f04703",
  measurementId: "G-9T7V85VMYY"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
if (import.meta.env.DEV) {
  auth.settings.appVerificationDisabledForTesting = true
}
/**
 * Plain in-memory Firestore, deliberately.
 *
 * IndexedDB persistence was measured at +21 kB gzipped on the first download —
 * paid by every visitor to the public site, who gets nothing back for it, while
 * the screens that would benefit already hold live queries that keep their own
 * local view. If the dashboard ever moves to its own entry point, it becomes
 * worth turning on there.
 */
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app