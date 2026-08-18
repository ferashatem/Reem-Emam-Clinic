import { formatMoney, isPastSlot, toNumber } from './formatters'
import type { Reservation, Service } from '../types'

/**
 * A booking is priced only after its session is closed — that's the moment the
 * figure is actually agreed. Bookings created before `priced_at` existed carry
 * a total instead, so a positive price still counts as priced.
 */
export function isPriced(r: Pick<Reservation, 'priced_at' | 'price_at_booking'>): boolean {
  return r.priced_at != null || toNumber(r.price_at_booking) > 0
}

/** What the client still owes. Meaningless before pricing, so it reads 0. */
export function dueOf(r: Pick<Reservation, 'priced_at' | 'price_at_booking' | 'paid_amount'>): number {
  if (!isPriced(r)) return 0
  return Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount))
}

/** What a session of this service is listed at. */
export function priceOf(service?: Service | null): number {
  return Math.max(0, toNumber(service?.price))
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

  // Still to come. Every session now has one listed price, so quoting it here
  // is useful — but it stays marked pending: what the client is actually
  // charged is only settled when the session is closed.
  const listed = priceOf(service)
  return listed > 0
    ? { text: `سعر الجلسة ${formatMoney(listed)}`, pending: true }
    : { text: 'السعر بيتحدد بعد الجلسة', pending: true }
}
