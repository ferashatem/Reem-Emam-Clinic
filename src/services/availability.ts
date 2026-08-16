import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { todayISO } from '../utils/formatters'
import { SLOT_MINUTES, minutesOf, slotOf, slotUsage } from '../utils/slots'
import { sessionMinutes } from '../utils/services'
import { BRANCHES, DEFAULT_BRANCH, reservationsOfBranch } from '../utils/branches'
import type { Branch, Reservation, Service } from '../types'

/**
 * A name-free mirror of each day's load — one doc per date *per line*:
 * `availability/2026-08-01_laser = { used: { '13:00': 45 }, taken: ['13:00'] }`.
 *
 * The two rooms run at the same time, so each keeps its own doc: an hour full
 * in the laser centre is still open for a كشف. The key carries the line
 * because the rules let a visitor write her own hour without signing in, and
 * she must not be able to reach across into the other line's day.
 *
 * The public booking form needs to know what's still open, but it can never
 * read `reservations` — patient names and phones live there. So it reads this
 * instead: how many of each hour's 60 minutes are spoken for, and nothing about
 * who spoke for them. `taken` is the same thing said the old way — the hours
 * with no minutes left — kept so a day written before minutes existed still
 * reads correctly.
 *
 * `reservations` stays the source of truth; this is a projection of it that the
 * team rebuilds on every booking write.
 */
const COL = 'availability'

/**
 * The doc holding one line's load on one day. The laser centre keeps the bare
 * date it always used, so every day already published stays exactly where the
 * public form looks for it — only the newer line takes a suffix.
 */
function dayKey(date: string, branch: Branch): string {
  return branch === DEFAULT_BRANCH ? date : `${date}_${branch}`
}

/** The stored day, exactly as it sits in the doc. */
async function readDay(
  date: string,
  branch: Branch
): Promise<{ used: Record<string, number>; taken: string[] }> {
  const snap = await getDoc(doc(db, COL, dayKey(date, branch)))
  if (!snap.exists()) return { used: {}, taken: [] }
  const data = snap.data()

  const used: Record<string, number> = {}
  if (data.used && typeof data.used === 'object') {
    for (const [slot, minutes] of Object.entries(data.used as Record<string, unknown>)) {
      const n = Number(minutes)
      if (Number.isFinite(n) && n >= 0) used[slot] = n
    }
  }
  const taken = Array.isArray(data.taken)
    ? data.taken.filter((s): s is string => typeof s === 'string')
    : []
  return { used, taken }
}

/** Minutes committed per hour on `date`, in one line. Readable by anyone. */
export async function getSlotUsage(
  date: string,
  branch: Branch = DEFAULT_BRANCH
): Promise<Record<string, number>> {
  if (!date) return {}
  const { used, taken } = await readDay(date, branch)
  // A day written before sessions had lengths only lists hours — each of those
  // held someone for the whole hour, so that's what it still means.
  const usage: Record<string, number> = {}
  for (const slot of taken) usage[slot] = SLOT_MINUTES
  return { ...usage, ...used }
}

/** The hours with nothing left in them. */
function fullSlots(usage: Record<string, number>): string[] {
  return Object.keys(usage).filter(slot => usage[slot] >= SLOT_MINUTES).sort()
}

/**
 * Rebuilds a date from the bookings themselves. Team only — needs the read.
 * `services` lets a booking that never stored a length take the one its service
 * runs to today, instead of holding an hour it doesn't need.
 */
export async function syncBusySlots(
  date: string,
  reservations: Reservation[],
  services: Service[] = []
) {
  if (!date) return
  const byId = new Map(services.map(s => [s.id, s]))
  // Each line's room is rebuilt from its own bookings — one day, two docs.
  for (const branch of BRANCHES) {
    const usage = Object.fromEntries(
      slotUsage(
        reservationsOfBranch(reservations, branch, services),
        date, null,
        r => sessionMinutes(byId.get(r.service_id), services)
      )
    )
    await setDoc(doc(db, COL, dayKey(date, branch)), { used: usage, taken: fullSlots(usage) })
  }
}

let backfilled = false

/**
 * Publishes the days that were already booked before this mirror existed —
 * otherwise the site would show a full day as wide open until someone happens
 * to edit one of its bookings. Only upcoming days matter, and only once per
 * session: after that every booking write keeps its own date in step.
 */
export async function backfillAvailability(reservations: Reservation[], services: Service[] = []) {
  if (backfilled) return
  const today = todayISO()
  const dates = new Set(
    reservations
      .filter(r => (r.date ?? '') >= today && r.status !== 'cancelled')
      .map(r => r.date as string)
  )

  try {
    for (const date of dates) await syncBusySlots(date, reservations, services)
    backfilled = true
  } catch (err) {
    // Left unflagged on purpose, so the next load tries again — the usual cause
    // is rules that haven't been deployed yet, which a refresh will clear.
    console.warn('[availability] backfill failed — the public site may show booked hours as free', err)
  }
}

/**
 * Books a visitor's minutes into the hour she just requested. A visitor has no
 * account and can't read the bookings, so this only ever adds to a single hour
 * — which is all the rules let an unauthenticated writer do. The desk's next
 * write rebuilds the day properly.
 */
export async function holdSlot(
  date: string,
  time: string,
  minutes?: number | null,
  branch: Branch = DEFAULT_BRANCH
) {
  const slot = slotOf(time)
  if (!date || !slot) return

  const { used, taken } = await readDay(date, branch)
  const taking = minutesOf({ duration_minutes: minutes ?? null })
  // The hour she's claiming may only be described by the old `taken` list — she
  // still starts from what that meant (a full hour), but writes nothing about
  // any other hour: the rules let a visitor move one hour and no more.
  const before = used[slot] ?? (taken.includes(slot) ? SLOT_MINUTES : 0)
  const nextUsed = { ...used, [slot]: Math.min(SLOT_MINUTES, before + taking) }

  await setDoc(doc(db, COL, dayKey(date, branch)), {
    used: nextUsed,
    // `taken` only ever grows here — dropping an hour someone else's booking
    // filled is the desk's job, and it rebuilds the whole day when it does.
    taken: [...new Set([...taken, ...fullSlots(nextUsed)])].sort(),
  })
}
