# Booking Flow

## Step by step

### 1. Client browses services (public — no auth)
- Page: `/`
- Reads from `/services` where `isActive == true`
- Shows name, description, price, duration

### 2. Client selects a service
- Clicks "Book Now" on a service card
- If not authenticated → redirect to `/login?redirect=/bookings/new?serviceId=xxx`
- If authenticated → go to step 4

### 3. Authentication
**New client:**
1. Register at `/register` — phone + full name + password
2. Firebase Auth creates account with phone number
3. User document created in `/users/{uid}` with `role: "client"`
4. Redirect back to booking flow

**Existing client:**
1. Login at `/login` — phone + password
2. Firebase Auth verifies credentials
3. Check user document exists and `isActive == true`
4. Redirect back to booking flow

### 4. Client picks a time slot
- Page: `/bookings/new?serviceId=xxx`
- Calendar shows available dates
- Available slots = all slots NOT already booked with status `pending` or `confirmed`
- Time slots are 30-min intervals during clinic hours (configurable)

### 5. Client confirms booking
- Review screen: service name + price + selected date/time
- Client can add optional notes
- On confirm → write to Firestore:

```js
await db.collection('bookings').add({
  clientRef: db.doc(`/users/${uid}`),
  clientName: user.fullName,           // denormalized
  clientPhone: user.phone,             // denormalized
  serviceRef: db.doc(`/services/${serviceId}`),
  serviceName: service.name,           // denormalized
  servicePrice: service.price,         // price snapshot
  adminRef: null,                      // assigned later by admin
  scheduledAt: Timestamp.fromDate(selectedDateTime),
  status: 'pending',
  notes: clientNotes,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
})
```

### 6. Cloud Function triggers on booking create
```js
// functions/bookings.ts
export const onBookingCreate = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    // 1. Create in-app notification for all admins
    // 2. Send SMS to admin phone (Twilio) — optional
  })
```

### 7. Admin sees booking in dashboard
- Page: `/admin/bookings`
- Filtered view: by status, date, service, admin
- Pending bookings highlighted

### 8. Admin confirms booking
- Admin clicks "Confirm"
- Updates booking: `status: "confirmed"`, `adminRef: /users/{adminId}`, `updatedAt: now()`
- Cloud Function triggers → sends SMS to client

### 9. Client receives confirmation
- In-app notification created in `/notifications/{id}`
- SMS sent: "تم تأكيد موعدك في [date] — عيادة ليزر [name]"
- Booking appears in client dashboard at `/dashboard`

---

## Booking status rules

| From | To | Who can do it |
|---|---|---|
| `pending` | `confirmed` | Admin only |
| `pending` | `cancelled` | Client or Admin |
| `confirmed` | `done` | Admin only (when session is written) |
| `confirmed` | `cancelled` | Admin only |
| `done` | — | Final state, cannot change |

---

## Available time slots logic

```js
// Get booked slots for a date
const bookedSlots = await db.collection('bookings')
  .where('scheduledAt', '>=', startOfDay)
  .where('scheduledAt', '<', endOfDay)
  .where('status', 'in', ['pending', 'confirmed'])
  .get()

const bookedTimes = bookedSlots.docs.map(d => d.data().scheduledAt.toDate())

// Generate all slots (e.g. 10:00 AM to 6:00 PM, every 30 min)
const allSlots = generateSlots('10:00', '18:00', 30)

// Return available = all - booked
const available = allSlots.filter(slot =>
  !bookedTimes.some(booked => isSameTime(booked, slot))
)
```

---

## Reminder notification (scheduled)

Cloud Function runs daily at 8:00 AM Cairo time:
```js
// Find bookings scheduled for tomorrow
// Send SMS reminder to each client
// Create in-app notification
```
