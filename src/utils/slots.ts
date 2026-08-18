import type { Reservation } from '../types'
import { todayISO } from './formatters'

/**
 * The clinic runs 09:00 → 21:00 and takes one client per hour, so the working
 * day is a fixed list of hourly slots. A session starting at 20:00 is the last
 * one — it ends exactly at closing.
 */
export const CLINIC_OPEN_HOUR = 9
export const CLINIC_CLOSE_HOUR = 21
export const SLOT_MINUTES = 60

export const CLINIC_SLOTS: string[] = buildSlots()

function buildSlots(): string[] {
  const out: string[] = []
  for (let m = CLINIC_OPEN_HOUR * 60; m + SLOT_MINUTES <= CLINIC_CLOSE_HOUR * 60; m += SLOT_MINUTES) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return out
}

/**
 * Which slot a stored time falls into. Bookings taken before the clinic moved
 * to fixed hours (and website requests) can hold any time, e.g. '14:30' — that
 * client is still in the chair at 14:00, so the whole hour is spoken for.
 */
export function slotOf(time?: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = Number(h)
  if (!Number.isFinite(hour)) return ''
  const minutes = hour * 60 + (Number(m) || 0)
  const floored = Math.floor((minutes - CLINIC_OPEN_HOUR * 60) / SLOT_MINUTES) * SLOT_MINUTES + CLINIC_OPEN_HOUR * 60
  const start = Math.max(floored, CLINIC_OPEN_HOUR * 60)
  return `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
}

/**
 * How long a booking holds its hour for. A booking taken before sessions had a
 * length carries none of its own; `fallback` is then what its service says
 * today, and only a booking whose service can't be found at all falls back to
 * holding the whole hour.
 */
export function minutesOf(
  r: Pick<Reservation, 'duration_minutes'>,
  fallback = SLOT_MINUTES
): number {
  const n = Number(r.duration_minutes)
  if (Number.isFinite(n) && n > 0) return Math.min(n, SLOT_MINUTES)
  return Math.min(Math.max(1, fallback), SLOT_MINUTES)
}

/**
 * Minutes already committed inside each hour of `date`. An hour holds 60 of
 * them, so a half-hour session leaves the other half open to someone whose
 * session is short enough to fit in it.
 *
 * `reservations` must already be narrowed to a single line — pass it through
 * `reservationsOfBranch` first. The laser room and the كشف room run side by
 * side, so an hour full in one is untouched in the other; counting both
 * together would turn two free rooms into none.
 *
 * `minutesFor` supplies the length for a booking that never stored one — pass
 * it wherever the services are on hand, so an old booking takes what its
 * service actually runs to instead of blocking the whole hour.
 */
export function slotUsage(
  reservations: Reservation[],
  date: string,
  exceptId?: string | null,
  minutesFor?: (r: Reservation) => number
): Map<string, number> {
  const used = new Map<string, number>()
  if (!date) return used
  for (const r of reservations) {
    if (r.date !== date) continue
    if (r.status === 'cancelled') continue
    if (exceptId && r.id === exceptId) continue
    const slot = slotOf(r.time)
    if (!slot) continue
    used.set(slot, (used.get(slot) ?? 0) + minutesOf(r, minutesFor?.(r)))
  }
  return used
}

/** Whether a session of `minutes` still fits in an hour that's `used` deep. */
export function fitsInSlot(used: number, minutes: number): boolean {
  return used + Math.max(0, minutes) <= SLOT_MINUTES
}

/** What's left of an hour, never below zero. */
export function freeMinutes(used: number): number {
  return Math.max(0, SLOT_MINUTES - used)
}

/**
 * Who's in each hour on `date`, for the desk's own view. A cancelled booking
 * frees its slot; `exceptId` keeps a booking from colliding with itself while
 * being edited. Like `slotUsage`, this expects one line's bookings only.
 */
export function takenSlots(
  reservations: Reservation[],
  date: string,
  exceptId?: string | null
): Map<string, Reservation[]> {
  const map = new Map<string, Reservation[]>()
  if (!date) return map
  for (const r of reservations) {
    if (r.date !== date) continue
    if (r.status === 'cancelled') continue
    if (exceptId && r.id === exceptId) continue
    const slot = slotOf(r.time)
    if (!slot) continue
    const list = map.get(slot)
    if (list) list.push(r)
    else map.set(slot, [r])
  }
  return map
}

/**
 * True once a slot on *today* has already started. Earlier dates stay open on
 * purpose — the desk still needs to log a session that already happened.
 */
export function isSlotPast(date: string, slot: string): boolean {
  if (date !== todayISO()) return false
  return slot < new Date().toTimeString().slice(0, 5)
}
