import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut
} from 'firebase/auth'
import type { ConfirmationResult } from 'firebase/auth'
import { auth } from './firebase'

// Keep track of the single active verifier instance
let globalVerifier: RecaptchaVerifier | null = null

/**
 * Cleans up existing reCAPTCHA verifier instances from memory and the DOM.
 */
export function destroyRecaptcha(): void {
  if (globalVerifier) {
    try {
      globalVerifier.clear()
    } catch (error) {
      console.warn('Failed to clear RecaptchaVerifier instance:', error)
    }
    globalVerifier = null
  }
}

/**
 * Empty initialization function to keep your existing imports and component 
 * lifecycles from breaking, while shifting the heavy lifting safely to sendOTP.
 */
export async function initRecaptcha(): Promise<void> {
  // Safe cleanup if called explicitly during component mount
  destroyRecaptcha()
}

/**
 * Configures a fresh invisible reCAPTCHA instance just-in-time and 
 * requests Firebase to send an OTP SMS token payload to the target number.
 * * @param phone string - The E.164 formatted phone number (e.g., +20111XXXXXXXX)
 * @returns Promise<ConfirmationResult>
 */
export async function sendOTP(phone: string): Promise<ConfirmationResult> {
  // 1. Ensure any stale widgets from previous clicks or validations are removed
  destroyRecaptcha()

  // 2. Sanitize and validate input presence
  const sanitizedPhone = phone?.trim()
  if (!sanitizedPhone) {
    throw new Error('A valid phone number is required to send an OTP.')
  }

  try {
    // 3. Bind a fresh invisible verifier directly to document.body.
    // This allows Firebase to generate and append its hidden iframe natively
    // right when the network request is ready to execute.
    const container = document.getElementById('recaptcha-container') ?? (() => {
      const el = document.createElement('div')
      el.id = 'recaptcha-container'
      document.body.appendChild(el)
      return el
    })()

    globalVerifier = new RecaptchaVerifier(auth, container, {
      size: 'invisible',
      callback: () => {
        // Triggered natively by Firebase when validation completes successfully
      },
      'expired-callback': () => {
        destroyRecaptcha()
      }
    })

    const confirmationResult = await signInWithPhoneNumber(auth, sanitizedPhone, globalVerifier)
    return confirmationResult
  } catch (err: unknown) {
    console.error('=== sendOTP FAILED ===')
    console.error('Phone:', sanitizedPhone)
    console.error('Error object:', err)
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>
      console.error('code:', e.code)
      console.error('message:', e.message)
      console.error('serverResponse:', e.serverResponse)
    }
    destroyRecaptcha()
    throw err
  }
}

/**
 * Signs out the currently authenticated user session.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}