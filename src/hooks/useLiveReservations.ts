import { useEffect, useMemo, useState } from 'react'
import { watchReservations, type ReservationFilters } from '../services/firestore'
import { messageFor } from './useLoader'
import type { Reservation } from '../types'

interface Result {
  /** Which subscription produced this, so a stale answer can't pose as a fresh one. */
  key: string
  rows: Reservation[] | null
  error: string | null
}

/**
 * Bookings that keep themselves up to date.
 *
 * Same shape as `useLoader` so a screen can swap one for the other, but instead
 * of re-asking the server on a timer it holds one open query: the first load is
 * billed, and after that only documents that actually change are. That makes it
 * both the cheaper option and the live one — the desk sees a session close the
 * moment it closes, not on the next tick.
 *
 * `filters` is compared by value, so callers can pass an object literal.
 */
export function useLiveReservations(filters?: ReservationFilters) {
  const key = JSON.stringify(filters ?? {})
  // Re-subscribing on every render would defeat the point, so the subscription
  // keys off the filter's contents rather than its identity.
  const stable = useMemo(() => JSON.parse(key) as ReservationFilters, [key])

  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Result>({ key, rows: null, error: null })

  useEffect(() => {
    return watchReservations(
      stable,
      rows => setResult({ key, rows, error: null }),
      err => setResult({ key, rows: null, error: messageFor(err) })
    )
  }, [stable, key, tick])

  // Until the new subscription answers, the previous filter's rows are not this
  // filter's rows — so the screen reads as loading rather than as wrong.
  const current = result.key === key ? result : null

  return {
    data: current?.rows ?? null,
    loading: !current || (current.rows === null && current.error === null),
    error: current?.error ?? null,
    /** Kept for parity with `useLoader` — a listener rarely needs it. */
    reload: () => setTick(t => t + 1),
  }
}
