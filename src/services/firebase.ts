import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
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
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app