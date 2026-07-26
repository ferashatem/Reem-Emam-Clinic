import type { Timestamp } from 'firebase/firestore'

export type Role = 'super_admin' | 'admin' | 'staff' | 'client'

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
  description?: string
  duration_minutes?: number
  /** Flat price. Used when price_per_pulse is not set. */
  price: number
  /** When set (> 0), the booking form charges pulses × this value. */
  price_per_pulse?: number | null
  is_active?: boolean
  created_at?: Timestamp
  deleted_at?: Timestamp | null
}

export interface Reservation {
  id: string
  client_id: string
  client_name?: string
  client_phone?: string
  service_id: string
  service_name?: string
  /** Number of laser pulses delivered in this session. */
  pulses?: number | null
  /** Snapshot of the service's per-pulse price at booking time. */
  price_per_pulse?: number | null
  /** Final agreed total — auto-computed from pulses but always editable. */
  price_at_booking: number
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
  id: string      // = month, YYYY-MM
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
