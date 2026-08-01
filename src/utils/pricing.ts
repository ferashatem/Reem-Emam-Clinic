import { formatMoney, isPastSlot, toNumber } from './formatters'
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

/** True when the booking is charged per pulse rather than at a flat rate. */
export function isPerPulse(
  r: Pick<Reservation, 'price_per_pulse'>,
  service?: Service | null
): boolean {
  return (toNumber(r.price_per_pulse) || perPulseOf(service)) > 0
}

/**
 * What to put in a price cell. An empty price means two very different things:
 * a session that hasn't happened yet is *supposed* to have no total, while one
 * that's over and still unpriced is a job someone has to finish. Saying
 * "لسه متسعّرتش" for both makes the normal case look like a problem.
 */
export function priceLabel(
  r: Reservation,
  service?: Service | null
): { text: string; pending: boolean } {
  if (isPriced(r)) return { text: formatMoney(r.price_at_booking), pending: false }

  const over = r.status === 'completed' || isPastSlot(r.date, r.time)
  if (over) return { text: 'لسه متسعّرتش', pending: true }

  if (isPerPulse(r, service)) return { text: 'حسب النبضات', pending: true }

  // Flat-rate service. The catalogue price is deliberately not shown here: no
  // number is quoted against a booking until its session is closed, so the
  // figure on screen is always one someone actually agreed to.
  return { text: 'سعر ثابت', pending: true }
}
