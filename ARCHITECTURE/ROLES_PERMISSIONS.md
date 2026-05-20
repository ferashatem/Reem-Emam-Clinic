# Roles & Permissions

## Role hierarchy

```
super_admin
    └── admin
            └── client
                    └── public (unauthenticated)
```

Super admin has everything admin has, plus admin management.

---

## Permissions matrix

### Firestore collections

| Action | Public | Client | Admin | Super Admin |
|---|---|---|---|---|
| Read services | ✅ | ✅ | ✅ | ✅ |
| Write services | ❌ | ❌ | ✅ | ✅ |
| Read own booking | ❌ | ✅ | ✅ | ✅ |
| Read all bookings | ❌ | ❌ | ✅ | ✅ |
| Create booking | ❌ | ✅ | ✅ | ✅ |
| Confirm / cancel booking | ❌ | Own only (cancel) | ✅ | ✅ |
| Read own sessions | ❌ | ✅ | ✅ | ✅ |
| Read all sessions | ❌ | ❌ | ✅ | ✅ |
| Write session + report | ❌ | ❌ | ✅ | ✅ |
| Read own user doc | ❌ | ✅ | ✅ | ✅ |
| Read all users | ❌ | ❌ | ✅ | ✅ |
| Create admin account | ❌ | ❌ | ❌ | ✅ |
| Deactivate any account | ❌ | ❌ | ❌ | ✅ |
| Read own notifications | ❌ | ✅ | ✅ | ✅ |

---

## Role check implementation

**Always check role server-side.** Never trust client-side role for sensitive operations.

```ts
// lib/auth.ts

import { adminAuth, adminDb } from './firebase-admin'

export async function getUserRole(uid: string): Promise<string | null> {
  const doc = await adminDb.collection('users').doc(uid).get()
  if (!doc.exists) return null
  return doc.data()?.role ?? null
}

export async function requireRole(
  uid: string,
  allowedRoles: string[]
): Promise<void> {
  const role = await getUserRole(uid)
  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Unauthorized')
  }
}
```

**In Next.js Server Components / Route Handlers:**
```ts
// app/(admin)/bookings/page.tsx
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase-admin'
import { requireRole } from '@/lib/auth'

export default async function AdminBookingsPage() {
  const token = cookies().get('__session')?.value
  if (!token) redirect('/login')

  const decoded = await adminAuth.verifySessionCookie(token)
  await requireRole(decoded.uid, ['admin', 'super_admin'])

  // Safe to render admin content
}
```

---

## Firestore security rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAdmin() {
      return isAuth() && role() in ['admin', 'super_admin'];
    }

    function isSuperAdmin() {
      return isAuth() && role() == 'super_admin';
    }

    function isOwner(uid) {
      return isAuth() && request.auth.uid == uid;
    }

    // Users
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isSuperAdmin();
      allow update: if isSuperAdmin() ||
        (isOwner(userId) && !('role' in request.resource.data.diff(resource.data).affectedKeys()));
      allow delete: if false;
    }

    // Bookings
    match /bookings/{bookingId} {
      allow read: if isAdmin() ||
        (isAuth() && resource.data.clientRef == /databases/$(database)/documents/users/$(request.auth.uid));
      allow create: if isAuth();
      allow update: if isAdmin() ||
        (isAuth() &&
          resource.data.clientRef == /databases/$(database)/documents/users/$(request.auth.uid) &&
          request.resource.data.status == 'cancelled');
      allow delete: if false;

      // Sessions subcollection
      match /sessions/{sessionId} {
        allow read: if isAdmin() ||
          (isAuth() && get(/databases/$(database)/documents/bookings/$(bookingId)).data.clientRef ==
            /databases/$(database)/documents/users/$(request.auth.uid));
        allow write: if isAdmin();
      }
    }

    // Services
    match /services/{serviceId} {
      allow read: if true;                  // Public
      allow write: if isAdmin();
    }

    // Notifications
    match /notifications/{notifId} {
      allow read, update: if isAuth() &&
        resource.data.userRef == /databases/$(database)/documents/users/$(request.auth.uid);
      allow create: if isAdmin();           // Only Cloud Functions / admin create notifications
      allow delete: if false;
    }
  }
}
```

---

## Super admin setup

Super admin is created manually — not through the app UI.

**Steps:**
1. Create user in Firebase Auth console with phone number
2. In Firestore console, create document `/users/{uid}`:
```json
{
  "uid": "{uid}",
  "fullName": "Super Admin",
  "phone": "+201xxxxxxxxx",
  "role": "super_admin",
  "isActive": true,
  "createdBy": null,
  "createdAt": "server timestamp"
}
```

Only one super admin account needed. If compromised, recreate manually.
