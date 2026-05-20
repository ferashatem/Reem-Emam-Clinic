# Firestore Schema

## Collections overview

```
/users/{userId}
/bookings/{bookingId}
    /sessions/{sessionId}        ← subcollection
/services/{serviceId}
/notifications/{notifId}
```

---

## /users/{userId}

Document ID = Firebase Auth UID.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase Auth UID — same as document ID |
| `fullName` | string | |
| `phone` | string | Format: `+201xxxxxxxxx` — unique — used for login |
| `role` | string | `client` \| `admin` \| `super_admin` |
| `isActive` | boolean | Super admin can deactivate any account |
| `createdBy` | reference | `/users/{adminId}` — who added this user (null for self-registered clients) |
| `createdAt` | timestamp | |

**Role rules:**
- `client` — self-registers via phone + password
- `admin` — created only by `super_admin`
- `super_admin` — created manually in Firestore console (one account)

**Example document:**
```json
{
  "uid": "abc123",
  "fullName": "Sara Ahmed",
  "phone": "+201001234567",
  "role": "client",
  "isActive": true,
  "createdBy": null,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

## /bookings/{bookingId}

| Field | Type | Notes |
|---|---|---|
| `clientRef` | reference | `/users/{clientId}` |
| `clientName` | string | Denormalized from user — for fast list queries |
| `clientPhone` | string | Denormalized — for admin contact |
| `serviceRef` | reference | `/services/{serviceId}` |
| `serviceName` | string | Denormalized — snapshot at booking time |
| `servicePrice` | number | Denormalized — price snapshot at booking time |
| `adminRef` | reference | `/users/{adminId}` — assigned admin (nullable) |
| `scheduledAt` | timestamp | Session date and time |
| `status` | string | `pending` \| `confirmed` \| `done` \| `cancelled` |
| `notes` | string | Client notes at booking time |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Status flow:**
```
pending → confirmed → done
   ↓           ↓
cancelled   cancelled
```

**Useful queries:**
```js
// Admin: all pending bookings
db.collection('bookings')
  .where('status', '==', 'pending')
  .orderBy('scheduledAt', 'asc')

// Client: their upcoming bookings
db.collection('bookings')
  .where('clientRef', '==', userRef)
  .where('scheduledAt', '>=', Timestamp.now())
  .orderBy('scheduledAt', 'asc')

// Admin: bookings for specific date
db.collection('bookings')
  .where('scheduledAt', '>=', startOfDay)
  .where('scheduledAt', '<=', endOfDay)
  .orderBy('scheduledAt')
```

**Required Firestore indexes:**
- `clientRef` + `scheduledAt`
- `status` + `scheduledAt`
- `adminRef` + `scheduledAt`

---

## /bookings/{bookingId}/sessions/{sessionId}

Subcollection — one document per session visit. A booking can have multiple sessions.

| Field | Type | Notes |
|---|---|---|
| `adminRef` | reference | `/users/{adminId}` — who conducted the session |
| `adminName` | string | Denormalized |
| `sessionDate` | timestamp | Actual date of session (may differ from scheduledAt) |
| `clinicalNotes` | string | Free text — admin's clinical observations |
| `deviceSettings` | map | See structure below |
| `skinReaction` | string | e.g. "redness", "no reaction", "mild swelling" |
| `photosUrls` | array | Firebase Storage URLs — before/after photos |
| `report` | map | See structure below |
| `createdAt` | timestamp | |

**deviceSettings map:**
```json
{
  "power": "20J",
  "frequency": "10Hz",
  "pulseWidth": "30ms",
  "handpiece": "755nm Alexandrite",
  "coolingLevel": "3"
}
```

**report map:**
```json
{
  "summary": "Good response. Significant hair reduction noted.",
  "nextSteps": "Next session in 6 weeks. Avoid sun exposure.",
  "nextSessionDate": "2024-03-15T11:00:00Z",
  "writtenBy": "/users/{adminId}",
  "writtenAt": "2024-01-15T12:00:00Z"
}
```

**Fetch sessions for a booking:**
```js
db.collection('bookings')
  .doc(bookingId)
  .collection('sessions')
  .orderBy('sessionDate', 'desc')
```

---

## /services/{serviceId}

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g. "Laser Hair Removal — Full Leg" |
| `description` | string | Shown on public website |
| `price` | number | Price in EGP |
| `durationMin` | number | Session duration in minutes |
| `category` | string | e.g. "hair_removal" \| "skin_rejuvenation" \| "tattoo_removal" |
| `isActive` | boolean | False = hidden from public website |
| `sortOrder` | number | Display order on website |
| `createdBy` | reference | `/users/{adminId}` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## /notifications/{notifId}

| Field | Type | Notes |
|---|---|---|
| `userRef` | reference | `/users/{userId}` — recipient |
| `type` | string | See types below |
| `message` | string | Notification text in Arabic |
| `isRead` | boolean | Default: false |
| `bookingRef` | reference | `/bookings/{bookingId}` — optional, for deep link |
| `sentAt` | timestamp | |

**Notification types:**
| Type | Trigger | Recipient |
|---|---|---|
| `booking_pending` | Client creates booking | Admin |
| `booking_confirmed` | Admin confirms booking | Client |
| `booking_cancelled` | Any cancellation | Client or Admin |
| `session_reminder` | 24h before session | Client |
| `report_ready` | Admin writes session report | Client |

**Real-time listener for unread notifications:**
```js
db.collection('notifications')
  .where('userRef', '==', userRef)
  .where('isRead', '==', false)
  .orderBy('sentAt', 'desc')
  .onSnapshot(snapshot => { ... })
```

---

## Security rules summary

```
users:     read own doc | admin reads all | super_admin writes
bookings:  client reads own | admin reads+writes all
sessions:  client reads own booking's sessions | admin writes
services:  public read | admin writes
notifications: read+write own only
```

See `firestore.rules` for full implementation.
