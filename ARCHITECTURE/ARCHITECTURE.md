# System Architecture

## Overview

Laser clinic platform with three user types: public visitors, clients, and staff (admin + super_admin). Built entirely on Firebase — no separate backend server needed.

## Architecture diagram

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND                         │
│  Next.js 14 (App Router)                            │
│  ┌──────────────┬─────────────────┬──────────────┐  │
│  │ Public site  │  Client portal  │    Admin     │  │
│  │ /            │  /dashboard     │  /admin      │  │
│  │ No auth      │  role=client    │  role=admin  │  │
│  └──────────────┴─────────────────┴──────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ Firebase SDK
┌──────────────────────▼──────────────────────────────┐
│                    FIREBASE                          │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Auth       │  │ Firestore  │  │   Storage     │  │
│  │ Phone+Pass │  │ Main DB    │  │ Session photos│  │
│  └────────────┘  └────────────┘  └───────────────┘  │
│  ┌──────────────────────────────────────────────┐    │
│  │            Cloud Functions                   │    │
│  │  onBookingCreate → notify admin             │    │
│  │  onBookingConfirm → SMS to client           │    │
│  │  onReportWrite → notify client              │    │
│  │  scheduledReminder → 24h before session     │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## User roles & access

| Role | Registration | Can do |
|---|---|---|
| Public | None | Browse services + prices |
| Client | Self-register (phone + password) | Book sessions, view own history + reports |
| Admin | Created by super_admin | Manage all bookings, write session reports, manage services |
| Super admin | Manual (Firestore console) | Everything admin can do + manage admin accounts |

## Data flow

### Client books a session
```
Client selects service
→ Auth check (redirect to login if not authenticated)
→ Client picks available time slot
→ Booking saved to Firestore (status: pending)
→ Cloud Function triggers → admin gets notification
→ Admin sees booking in dashboard → confirms it
→ Cloud Function triggers → client gets SMS + in-app notification
→ Booking appears in client's dashboard (status: confirmed)
```

### Admin writes session report
```
Admin opens booking → clicks "Start Session"
→ Fills device settings + clinical notes + skin reaction
→ Uploads before/after photos to Firebase Storage
→ Writes report summary + next steps
→ Session saved as subcollection under booking
→ Booking status updated to "done"
→ Cloud Function triggers → client notified
→ Report visible in client's portal
```

## Key architectural decisions

### Why Firebase over custom backend
- Single clinic = predictable traffic, Firebase free tier covers it
- Auth, DB, Storage, Functions in one platform = less infrastructure
- Firebase Auth handles phone OTP natively
- Realtime listeners = no polling for notifications

### Why sessions as subcollection
Sessions live at `/bookings/{id}/sessions/{id}` — not a top-level collection. Because:
- Sessions are always read in context of their booking
- Simpler security rules (access to booking = access to its sessions)
- Natural grouping for the admin's "session history" view

### Why denormalize clientName + serviceName in bookings
Firestore doesn't support JOINs. To show the admin a booking list with client name and service name, we'd need N extra reads. Denormalizing avoids this. Trade-off: if name changes, update both places.

### Why Next.js App Router
- Server Components for admin pages (role check server-side, never exposed to client)
- Single codebase for public site + client portal + admin dashboard
- Built-in API routes replace simple Cloud Functions where needed
