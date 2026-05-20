# TASK: Implement Auth Flow — Laser Clinic Platform

Read this file fully before writing any code.
All decisions are already made — just implement exactly as described.

---

## Context

Firebase + Next.js 14 (App Router) project already initialized.
Tailwind CSS + shadcn/ui installed.
This task: implement the full authentication flow.

---

## Files to create

Create all files below with the exact content described.
Do not change folder structure.

---

### 1. `lib/firebase.ts`

Firebase client-side initialization. Export `auth`, `db`, `storage`.

```ts
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

---

### 2. `lib/firebase-admin.ts`

Firebase Admin SDK — server-side only. Never import this in client components.

```ts
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()
```

---

### 3. `lib/auth.ts`

All auth logic — register, login, signout, role checks.

Phone numbers are stored as fake emails in Firebase Auth:
`+201001234567` → `201001234567@clinic.app`
Real phone stored in Firestore `/users/{uid}`.

Types:
- `Role` = `'client' | 'admin' | 'super_admin'`
- `UserProfile` = `{ uid, fullName, phone, role, isActive, createdAt }`

Functions to implement:

**`registerClient({ fullName, phone, password })`**
1. Convert phone to email format
2. `createUserWithEmailAndPassword`
3. Write `/users/{uid}` to Firestore with `role: 'client'`, `isActive: true`, `createdBy: null`
4. Get ID token → call `POST /api/auth/session`
5. Return UserProfile

**`loginWithPhone({ phone, password })`**
1. Convert phone to email
2. `signInWithEmailAndPassword`
3. Fetch `/users/{uid}` from Firestore
4. Throw `'user-not-found'` if doc missing
5. Throw `'account-disabled'` if `isActive === false`
6. Get ID token → call `POST /api/auth/session`
7. Return UserProfile

**`signOut()`**
1. Firebase `signOut`
2. Call `DELETE /api/auth/session`

**`getUserProfile(uid)`** — client side
- Read `/users/{uid}` from Firestore, return UserProfile or null

**`getSessionUser(sessionCookie)`** — server side, uses adminAuth
- Verify session cookie with `adminAuth.verifySessionCookie(cookie, true)`
- Fetch user doc from adminDb
- Return UserProfile or null on any error

**`requireRole(sessionCookie, allowedRoles[])`** — server side
- Call `getSessionUser`
- Throw `'unauthenticated'` if no user
- Throw `'unauthorized'` if role not in allowedRoles
- Return UserProfile

Helper: `phoneToEmail(phone)` — strips `+`, appends `@clinic.app`
Helper: `createSessionCookie(idToken)` — POST to `/api/auth/session`

---

### 4. `app/api/auth/session/route.ts`

HTTP handlers for session cookie.

**POST** — receives `{ idToken }`, calls `adminAuth.createSessionCookie(idToken, { expiresIn: 14 days })`, sets httpOnly cookie named `__session`.

**DELETE** — deletes `__session` cookie.

Cookie settings:
- `httpOnly: true`
- `secure: true` in production
- `sameSite: 'lax'`
- `path: '/'`
- `maxAge`: 14 days in seconds

---

### 5. `middleware.ts` (root of project)

Protects routes by role. Runs on every request except static files.

Public paths (no auth needed): `/`, `/login`, `/register`, any `/api/` path.

Protected path rules:
- `/admin/*` → requires `role` in `['admin', 'super_admin']`
- `/super-admin/*` → requires `role === 'super_admin'`
- `/dashboard/*` → requires `role === 'client'`
- `/bookings/*` → requires `role === 'client'`

Logic:
1. If public path → `NextResponse.next()`
2. Read `__session` cookie
3. If no cookie → redirect to `/login?redirect={pathname}`
4. `adminAuth.verifySessionCookie(cookie, true)`
5. Fetch user doc from adminDb, get `role` + `isActive`
6. If `!isActive` → redirect to `/login?error=disabled`
7. Check role against protected path rules
8. Wrong role → redirect to role home:
   - admin/super_admin → `/admin/bookings`
   - client → `/dashboard`
   - unknown → `/`
9. Any error → delete cookie, redirect to `/login?redirect={pathname}`

Matcher: exclude `_next/static`, `_next/image`, `favicon.ico`, image files.

---

### 6. `app/(auth)/login/page.tsx`

Client component. Arabic UI. Tailwind styled.

Fields: phone (tel input, dir="ltr"), password.
On submit:
1. Format phone → `formatPhone()` util
2. Call `loginWithPhone`
3. On success: if role is client → redirect to `?redirect` param or `/dashboard`. If admin → `/admin/bookings`
4. On error → show Arabic error message

Error messages in Arabic:
- `account-disabled` → "الحساب موقوف. تواصل مع العيادة."
- `user-not-found` / `auth/wrong-password` / `auth/invalid-credential` → "رقم التليفون أو كلمة المرور غلط."
- `auth/too-many-requests` → "كتير أوي. استنى شوية وحاول تاني."
- default → "حصل مشكلة. حاول تاني."

Link to `/register` at bottom.

If `?error=disabled` in URL → show disabled message on load.

`formatPhone(phone)`:
- Strip non-digits
- If starts with `20` → `+{digits}`
- If starts with `0` → `+20{digits without leading 0}`
- else → `+20{digits}`

---

### 7. `app/(auth)/register/page.tsx`

Client component. Arabic UI. Tailwind styled.

Fields: fullName, phone (tel, dir="ltr"), password, confirmPassword.
Validation before submit:
- password !== confirmPassword → "كلمة المرور مش متطابقة."
- password.length < 8 → "كلمة المرور لازم تكون 8 حروف على الأقل."

On submit:
1. Format phone
2. Call `registerClient`
3. Redirect to `?redirect` param or `/dashboard`

Error messages in Arabic:
- `auth/email-already-in-use` → "رقم التليفون ده مسجّل قبل كده. سجّل دخول."
- `auth/weak-password` → "كلمة المرور ضعيفة."
- default → "حصل مشكلة. حاول تاني."

Link to `/login` at bottom.

---

### 8. `components/auth/useAuth.ts`

Client-side hook. Returns `{ user, profile, loading }`.

Uses `onAuthStateChanged` from Firebase Auth.
When user exists → fetch profile via `getUserProfile(uid)`.
When user is null → set profile to null.
Initial state: `loading: true`.

---

## Packages to install

Run this before creating any files:

```bash
npm install firebase firebase-admin
```

---

## After creating all files

1. Check all imports are correct
2. Make sure `middleware.ts` is at project root (not inside any folder)
3. Make sure `firebase-admin.ts` is never imported in any `'use client'` file
4. Run `npm run build` — fix any TypeScript errors

---

## What NOT to do

- Do not create any extra files not listed above
- Do not add any new packages beyond firebase + firebase-admin
- Do not change the folder structure
- Do not add comments in Arabic inside the code
- Do not use `any` type — keep everything typed
