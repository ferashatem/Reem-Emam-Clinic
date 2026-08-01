import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { todayISO } from '../utils/formatters'
import { slotOf } from '../utils/slots'
import type { Reservation } from '../types'

/**
 * A name-free mirror of each day's booked hours — one doc per date:
 * `availability/2026-08-01 = { taken: ['10:00', '14:00'] }`.
 *
 * The public booking form needs to grey out hours that are already spoken for,
 * but it can never read `reservations` — patient names and phones live there.
 * So it reads this instead: the hours, and nothing about who booked them.
 *
 * `reservations` stays the source of truth; this is a projection of it that the
 * team rebuilds on every booking write.
 */
const COL = 'availability'

/** The hours already taken on `date`. Readable by anyone. */
export async function getBusySlots(date: string): Promise<string[]> {
  if (!date) return []
  const snap = await getDoc(doc(db, COL, date))
  const taken: unknown = snap.exists() ? snap.data().taken : null
  if (!Array.isArray(taken)) return []
  return taken.filter((s): s is string => typeof s === 'string')
}

/** Rebuilds a date from the bookings themselves. Team only — needs the read. */
export async function syncBusySlots(date: string, reservations: Reservation[]) {
  if (!date) return
  const slots = new Set<string>()
  for (const r of reservations) {
    if (r.date !== date || r.status === 'cancelled') continue
    const slot = slotOf(r.time)
    if (slot) slots.add(slot)
  }
  await setDoc(doc(db, COL, date), { taken: [...slots].sort() })
}

let backfilled = false

/**
 * Publishes the days that were already booked before this mirror existed —
 * otherwise the site would show a full day as wide open until someone happens
 * to edit one of its bookings. Only upcoming days matter, and only once per
 * session: after that every booking write keeps its own date in step.
 */
export async function backfillAvailability(reservations: Reservation[]) {
  if (backfilled) return
  const today = todayISO()
  const dates = new Set(
    reservations
      .filter(r => (r.date ?? '') >= today && r.status !== 'cancelled')
      .map(r => r.date as string)
  )

  try {
    for (const date of dates) await syncBusySlots(date, reservations)
    backfilled = true
  } catch (err) {
    // Left unflagged on purpose, so the next load tries again — the usual cause
    // is rules that haven't been deployed yet, which a refresh will clear.
    console.warn('[availability] backfill failed — the public site may show booked hours as free', err)
  }
}

/**
 * Marks the hour a visitor just requested. A visitor has no account and can't
 * read the bookings, so this only ever appends — which is all the rules let an
 * unauthenticated writer do. The desk's next write rebuilds the day properly.
 */
export async function holdSlot(date: string, time: string) {
  const slot = slotOf(time)
  if (!date || !slot) return
  const current = await getBusySlots(date)
  if (current.includes(slot)) return
  await setDoc(doc(db, COL, date), { taken: [...current, slot] })
}
