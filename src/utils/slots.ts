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
 * Slots already spoken for on `date`. A cancelled booking frees its slot;
 * `exceptId` keeps a booking from colliding with itself while being edited.
 */
export function takenSlots(
  reservations: Reservation[],
  date: string,
  exceptId?: string | null
): Map<string, Reservation> {
  const map = new Map<string, Reservation>()
  if (!date) return map
  for (const r of reservations) {
    if (r.date !== date) continue
    if (r.status === 'cancelled') continue
    if (exceptId && r.id === exceptId) continue
    const slot = slotOf(r.time)
    if (slot) map.set(slot, r)
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
