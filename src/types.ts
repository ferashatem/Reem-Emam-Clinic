import type { Timestamp } from 'firebase/firestore'

/** Only the clinic team has accounts — visitors book without signing in. */
export type Role = 'super_admin' | 'admin' | 'staff'

export interface TeamMember {
  id: string
  uid: string
  username?: string
  name: string
  phone?: string
  email?: string
  role: Role
  is_active: boolean
  working_hours?: string
  created_by?: string
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

/**
 * The two lines the place runs: the laser centre, and the consultation clinic
 * («كشف») next to it. They sit in different rooms and keep different books, so
 * an hour spoken for in one says nothing about the same hour in the other.
 *
 * Everything written before the clinic existed is laser work, which is why
 * absent always reads as `laser` — see `asBranch` in `utils/branches.ts`.
 */
export type Branch = 'laser' | 'consult'

export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod = 'cash' | 'instapay' | 'wallet' | 'card'
export type ExpenseCategory =
  | 'electricity' | 'water' | 'rent' | 'salaries'
  | 'supplies' | 'maintenance' | 'marketing' | 'other'

export interface Client {
  id: string
  uid?: string | null
  name: string
  phone: string
  email?: string
  age?: number
  skin_type?: string
  source?: string
  notes?: string
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface Service {
  id: string
  name: string
  /**
   * Which line sells this. Only a main service carries one — a variant is
   * always in the same room as the service above it, so it inherits rather
   * than storing its own. Absent = `laser`.
   */
  branch?: Branch
  /**
   * Set when this doc is a variant *inside* another service — the device under
   * «ليزر», the area under «شعر». Null/absent = a main service the client picks
   * first. A main service that has variants is never booked directly.
   */
  parent_id?: string | null
  description?: string
  /**
   * How long a session of this service runs. It's what decides whether another
   * client still fits in the same hour. A type may set its own; blank means it
   * takes its service's length.
   */
  duration_minutes?: number
  /** What one session of this service costs. */
  price?: number | null
  is_active?: boolean
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface Reservation {
  id: string
  /**
   * The line this booking belongs to, snapshotted from its service the same
   * way `service_name` is. It's what keeps the two schedules apart, so it has
   * to be readable without looking the service up again — and it has to stay
   * put even if the service is later moved to the other line.
   */
  branch?: Branch
  client_id: string
  client_name?: string
  client_phone?: string
  service_id: string
  service_name?: string
  /**
   * How much of the hour this session takes, snapshotted at booking time. The
   * hour holds 60 minutes in total, so a 15-minute session leaves 45 for
   * whoever books next. Absent = the booking holds the whole hour.
   */
  duration_minutes?: number | null
  /**
   * Final agreed total. Stays 0 until the session is closed — nothing is
   * charged against a booking until someone has actually agreed the figure.
   */
  price_at_booking: number
  /** Set when the session was closed and priced. Null = not priced yet. */
  priced_at?: Timestamp | null
  /** Sum of all payments recorded against this reservation. */
  paid_amount?: number
  payment_status?: PaymentStatus
  date: string   // YYYY-MM-DD
  time: string   // HH:mm
  status: ReservationStatus
  notes?: string
  admin_id?: string | null
  booked_by?: 'client' | 'staff' | 'admin'
  reviewed?: boolean
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface Payment {
  id: string
  /** Which line's books this money lands in. Absent = `laser`. */
  branch?: Branch
  client_id: string
  client_name?: string
  reservation_id?: string | null
  amount: number
  method: PaymentMethod
  note?: string
  date: string    // YYYY-MM-DD
  month: string   // YYYY-MM
  staff_id?: string
  staff_name?: string
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface Expense {
  id: string
  /**
   * Which line pays this bill. The books are separate, so a shared cost (rent
   * on one floor, a shared receptionist) has to be entered once per line for
   * the share each one carries — there is no "both" on purpose.
   */
  branch?: Branch
  title: string
  category: ExpenseCategory
  amount: number
  date: string    // YYYY-MM-DD
  month: string   // YYYY-MM
  note?: string
  created_by?: string
  created_by_name?: string
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface PartnerShare {
  name: string
  amount: number
}

/** Locked snapshot of a month's numbers — the "جرد" the partners sign off on. */
export interface MonthlyClosing {
  /** `{YYYY-MM}_{branch}` — each line closes its own month independently. */
  id: string
  branch?: Branch
  month: string
  total_revenue: number
  total_expenses: number
  net_profit: number
  partners: PartnerShare[]
  payments_count: number
  sessions_count: number
  notes?: string
  closed_by?: string
  closed_by_name?: string
  closed_at?: Timestamp
}

export interface SessionReport {
  id: string
  reservation_id?: string
  client_id: string
  admin_id?: string
  diagnosis?: string
  treatment?: string
  products_used?: string
  next_steps?: string
  medicines?: unknown
  prohibited_items?: string
  food_recommendations?: string
  photos?: string[]
  session_date?: Timestamp
  created_at?: Timestamp
}
