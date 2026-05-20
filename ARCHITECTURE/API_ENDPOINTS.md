# API Endpoints (Cloud Functions)

Most data operations go directly through Firestore SDK from the frontend.
Cloud Functions are used only for:
- Triggers (on document create/update)
- Scheduled jobs (reminders)
- Operations requiring admin privileges (sending SMS, creating admin accounts)

---

## Triggered functions (Firestore triggers)

### `onBookingCreate`
```
Trigger:  /bookings/{bookingId} — onCreate
Purpose:  Notify admin when new booking is created
```
```ts
// What it does:
// 1. Reads all admin users from /users where role in ['admin', 'super_admin']
// 2. Creates /notifications/{id} for each admin
// 3. Optionally sends SMS to clinic main number
```

### `onBookingStatusChange`
```
Trigger:  /bookings/{bookingId} — onUpdate (status field)
Purpose:  Notify client when booking is confirmed or cancelled
```
```ts
// What it does:
// status: pending → confirmed  →  SMS to client + in-app notification
// status: * → cancelled        →  SMS to client + in-app notification
```

### `onSessionReportWrite`
```
Trigger:  /bookings/{bookingId}/sessions/{sessionId} — onCreate
Purpose:  Notify client that their session report is ready
```
```ts
// What it does:
// 1. Reads clientRef from parent booking
// 2. Creates notification: type = "report_ready"
// 3. Sends email with report summary (Resend)
```

---

## Scheduled functions

### `dailyReminders`
```
Schedule: Every day at 08:00 AM Africa/Cairo
Purpose:  Send reminder to clients with sessions tomorrow
```
```ts
// What it does:
// 1. Query bookings where scheduledAt is between tomorrow 00:00 and tomorrow 23:59
//    AND status == "confirmed"
// 2. For each booking → send SMS + in-app notification to client
```

---

## Callable functions (HTTPS)

Called directly from frontend using Firebase Functions SDK.
All callable functions verify auth token automatically.

### `createAdmin`
```
Method:   Callable
Auth:     super_admin only
Purpose:  Create a new admin account
```
```ts
// Request
{
  fullName: string,
  phone: string,       // +201xxxxxxxxx
  password: string,
  permissions: string  // "full" | "bookings_only"
}

// Response
{
  uid: string,
  success: boolean
}

// What it does:
// 1. Verify caller is super_admin
// 2. Create Firebase Auth user with phone + password
// 3. Create /users/{uid} document with role: "admin"
// 4. Return new uid
```

### `deactivateUser`
```
Method:   Callable
Auth:     super_admin only
Purpose:  Deactivate a client or admin account
```
```ts
// Request
{ uid: string }

// Response
{ success: boolean }

// What it does:
// 1. Verify caller is super_admin
// 2. Disable Firebase Auth account (user can't login)
// 3. Update /users/{uid}: isActive = false
```

### `getAvailableSlots`
```
Method:   Callable
Auth:     Any authenticated user
Purpose:  Get available time slots for a given date
```
```ts
// Request
{
  date: string,        // "2024-03-15" (ISO date)
  serviceId: string
}

// Response
{
  slots: string[]      // ["10:00", "10:30", "11:00", ...]
}

// What it does:
// 1. Get clinic hours from config (or hardcoded)
// 2. Query bookings for that date with status in ['pending', 'confirmed']
// 3. Return all slots minus booked ones
```

---

## Functions setup

```ts
// functions/index.ts

import * as functions from 'firebase-functions'
import { onBookingCreate } from './bookings'
import { dailyReminders } from './scheduler'
import { createAdmin, deactivateUser, getAvailableSlots } from './admin'

export {
  onBookingCreate,
  dailyReminders,
  createAdmin,
  deactivateUser,
  getAvailableSlots,
}
```

## Environment config for functions

```bash
firebase functions:config:set \
  twilio.account_sid="ACxxx" \
  twilio.auth_token="xxx" \
  twilio.from_number="+1xxx" \
  clinic.admin_phone="+201xxxxxxxxx" \
  clinic.name="اسم العيادة" \
  resend.api_key="re_xxx"
```
