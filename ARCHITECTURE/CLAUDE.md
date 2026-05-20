# Laser Clinic Platform — Claude Code Guide

## Project overview

A SaaS platform for a laser clinic. Clients can browse services, register, book sessions, and view their session history and reports. Admins manage bookings and write session reports. Super admins manage the admin team.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | Firebase Auth (phone + password) |
| Database | Firestore |
| Storage | Firebase Storage (session photos) |
| Functions | Firebase Cloud Functions |
| Hosting | Firebase Hosting |

## Project structure

```
/
├── app/                      # Next.js App Router
│   ├── (public)/             # Public website — no auth required
│   │   └── page.tsx          # Landing page + services list
│   ├── (client)/             # Client portal — requires auth + role=client
│   │   ├── dashboard/        # Upcoming & past bookings
│   │   ├── bookings/         # Book a service
│   │   └── reports/          # Session reports
│   ├── (admin)/              # Admin dashboard — requires role=admin or super_admin
│   │   ├── bookings/         # All bookings + filters
│   │   ├── patients/         # Patient list + details
│   │   ├── sessions/         # Write session reports
│   │   └── services/         # Manage services catalog
│   └── (super-admin)/        # Super admin only — requires role=super_admin
│       └── admins/           # Manage admin accounts
├── lib/
│   ├── firebase.ts           # Firebase init (client-side)
│   ├── firebase-admin.ts     # Firebase Admin SDK (server-side / Cloud Functions)
│   └── auth.ts               # Auth helpers + role checks
├── functions/                # Firebase Cloud Functions
│   ├── bookings.ts           # onCreate booking → send notification
│   ├── notifications.ts      # SMS via Twilio / email helpers
│   └── index.ts
├── docs/                     # This folder — read before coding
│   ├── CLAUDE.md             ← You are here
│   ├── FIRESTORE_SCHEMA.md   ← Collections, fields, subcollections
│   ├── ARCHITECTURE.md       ← System design overview
│   ├── BOOKING_FLOW.md       ← Step-by-step booking logic
│   ├── ROLES_PERMISSIONS.md  ← Who can do what
│   └── API_ENDPOINTS.md      ← Cloud Functions endpoints
└── components/
    ├── ui/                   # shadcn/ui components
    ├── booking/              # Booking-related components
    ├── admin/                # Admin dashboard components
    └── shared/               # Shared components
```

## Key conventions

- **Role check** always server-side via Firebase Admin SDK — never trust client-side role
- **Timestamps** always stored as Firestore `Timestamp`, displayed in Cairo timezone (`Africa/Cairo`)
- **Phone numbers** stored in international format: `+201xxxxxxxxx`
- **Booking status flow**: `pending` → `confirmed` → `done` (or `cancelled` at any step)
- **Denormalized fields** in bookings: `clientName`, `serviceName` — update both if source changes
- **Session reports** are subcollections under `/bookings/{id}/sessions/{id}/` — never a top-level collection

## Environment variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PRIVATE_KEY=        # Server only
FIREBASE_ADMIN_CLIENT_EMAIL=       # Server only
```

## Important decisions

1. **Single `users` collection** for all roles — role field determines access level
2. **Sessions as subcollection** under bookings — always fetched together with their booking
3. **Denormalization in bookings** — clientName + serviceName stored directly to avoid extra reads
4. **No separate payments collection** — price stored as snapshot in booking at time of creation
