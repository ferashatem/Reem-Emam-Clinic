import { toNumber } from './formatters'
import type { Reservation, Service } from '../types'

/**
 * A booking is priced only after its session is closed — that's the moment the
 * pulse count is known. Bookings created before `priced_at` existed carry a
 * total instead, so a positive price still counts as priced.
 */
export function isPriced(r: Pick<Reservation, 'priced_at' | 'price_at_booking'>): boolean {
  return r.priced_at != null || toNumber(r.price_at_booking) > 0
}

/** What the client still owes. Meaningless before pricing, so it reads 0. */
export function dueOf(r: Pick<Reservation, 'priced_at' | 'price_at_booking' | 'paid_amount'>): number {
  if (!isPriced(r)) return 0
  return Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount))
}

/** Per-pulse rate for a service — 0 means it's a flat-price service. */
export function perPulseOf(service?: Service | null): number {
  return Math.max(0, toNumber(service?.price_per_pulse))
}

/**
 * What the session costs before any manual discount: pulses × rate for
 * per-pulse services, the flat price otherwise.
 */
export function computeTotal(pulses: number, perPulse: number, flatPrice: number): number {
  return perPulse > 0 ? Math.max(0, pulses) * perPulse : Math.max(0, flatPrice)
}
