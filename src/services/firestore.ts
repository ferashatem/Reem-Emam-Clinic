import {
  collection, doc, getDoc, getDocs, getCountFromServer, addDoc, updateDoc, query,
  where, onSnapshot, Timestamp, setDoc, runTransaction,
} from 'firebase/firestore'
import type { DocumentData, QueryConstraint } from 'firebase/firestore'
import { auth, db } from './firebase'
import { holdSlot, syncBusySlots } from './availability'
import { monthKey, toNumber, todayISO } from '../utils/formatters'
import type {
  Client, Expense, MonthlyClosing, Payment, Reservation,
  SessionReport, Service, TeamMember,
} from '../types'

const now = () => Timestamp.now()

/** Maps a snapshot to `{ id, ...data }` and drops soft-deleted rows. */
function live<T>(docs: { id: string; data: () => DocumentData }[]): T[] {
  return docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((r) => (r as DocumentData).deleted_at == null) as T[]
}

function bySeconds(field: string) {
  return (a: DocumentData, b: DocumentData) =>
    (b[field]?.seconds ?? 0) - (a[field]?.seconds ?? 0)
}

/** Newest first by 'YYYY-MM-DD' + 'HH:mm'. */
function byDateDesc(a: DocumentData, b: DocumentData) {
  const l = `${a.date ?? ''} ${a.time ?? ''}`
  const r = `${b.date ?? ''} ${b.time ?? ''}`
  return r.localeCompare(l)
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserById(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Everyone on the internal team — super admins, partners, and assistants. */
export async function getAdmins(): Promise<TeamMember[]> {
  const snap = await getDocs(collection(db, 'users'))
  return live<TeamMember>(snap.docs).sort(bySeconds('created_at'))
}

const TEAM_ROLES = ['super_admin', 'admin', 'staff']

export async function createAdmin(data: DocumentData) {
  return setDoc(doc(db, 'users', data.uid), {
    ...data,
    role: TEAM_ROLES.includes(data.role) ? data.role : 'admin',
    is_active: true,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateAdmin(uid: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'users', uid), data)
}

export async function softDeleteAdmin(uid: string) {
  return updateDoc(doc(db, 'users', uid), { deleted_at: now(), is_active: false })
}

// ─── Services ────────────────────────────────────────────────────────────────

/**
 * The catalogue, fetched once per session.
 *
 * Eight screens ask for it, several of them on every visit, and it changes
 * about as often as the clinic buys a new machine. The in-flight promise is
 * shared too, so two screens mounting together make one request rather than
 * two. Any write below clears it, so an edit shows up immediately.
 */
let servicesCache: Promise<Service[]> | null = null

export function invalidateServices() {
  servicesCache = null
}

export function getServices(): Promise<Service[]> {
  servicesCache ??= getDocs(collection(db, 'services'))
    .then(snap => live<Service>(snap.docs).sort(bySeconds('created_at')))
    .catch(err => {
      // A failed fetch must not become the answer for the rest of the session
      servicesCache = null
      throw err
    })
  return servicesCache
}

export async function getActiveServices(): Promise<Service[]> {
  const all = await getServices()
  return all.filter(s => s.is_active === true)
}

export async function createService(data: DocumentData) {
  invalidateServices()
  return addDoc(collection(db, 'services'), {
    // A variant («كانديلا» under «ليزر») carries its parent; a main service null.
    parent_id: data.parent_id ?? null,
    ...data,
    is_active: true,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateService(id: string, data: Partial<DocumentData>) {
  invalidateServices()
  return updateDoc(doc(db, 'services', id), data)
}

/** The variants living under a service. */
async function serviceOptionDocs(parentId: string) {
  const snap = await getDocs(query(collection(db, 'services'), where('parent_id', '==', parentId)))
  return snap.docs.filter(d => d.data().deleted_at == null)
}

/**
 * Hiding or showing a main service carries its variants along — a device left
 * active under a hidden «ليزر» would otherwise stay bookable on its own.
 */
export async function setServiceActive(id: string, isActive: boolean) {
  invalidateServices()
  const options = await serviceOptionDocs(id)
  await Promise.all(options.map(d => updateDoc(d.ref, { is_active: isActive })))
  return updateDoc(doc(db, 'services', id), { is_active: isActive })
}

export async function softDeleteService(id: string) {
  invalidateServices()
  const options = await serviceOptionDocs(id)
  await Promise.all(
    options.map(d => updateDoc(d.ref, { deleted_at: now(), is_active: false }))
  )
  return updateDoc(doc(db, 'services', id), { deleted_at: now(), is_active: false })
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const snap = await getDocs(collection(db, 'clients'))
  return live<Client>(snap.docs).sort(bySeconds('created_at'))
}

/**
 * How many patient files there are, counted **on the server**.
 *
 * Firestore bills an aggregation at one read per 1,000 documents, so a number
 * that used to cost one read per patient on every dashboard load now costs
 * one, and stops growing with the clinic.
 */
export async function getClientCount(): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, 'clients'), where('deleted_at', '==', null))
  )
  return snap.data().count
}

export async function getClientById(id: string) {
  const snap = await getDoc(doc(db, 'clients', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getClientByPhone(phone: string) {
  const q = query(collection(db, 'clients'), where('phone', '==', phone), where('deleted_at', '==', null))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function createClient(data: DocumentData) {
  return addDoc(collection(db, 'clients'), {
    ...data,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateClient(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'clients', id), data)
}

export async function softDeleteClient(id: string) {
  return updateDoc(doc(db, 'clients', id), { deleted_at: now() })
}

// ─── Reservations ────────────────────────────────────────────────────────────

/**
 * Bookings, narrowed **on the server**.
 *
 * `date`, `month` and `from`/`to` all become real query constraints, so a screen
 * that wants one day downloads one day. Reading the whole collection and
 * filtering here is what the bill is actually made of: every screen paid for
 * every booking the clinic had ever taken, and the price grew with the archive.
 *
 * Only `date` is constrained server-side at a time (a single range on one field
 * needs no composite index). `adminId` and `status` still filter here — by then
 * the set is already small.
 */
export interface ReservationFilters {
  adminId?: string
  date?: string
  month?: string
  status?: string
  /** Inclusive 'YYYY-MM-DD' bounds. `from` alone means "from then on". */
  from?: string
  to?: string
  /**
   * Only what still owes money, however old it is. Money outstanding must
   * never fall off the end of a date window — a debt from last spring is
   * still a debt — and the set stays small on its own, because a clinic that
   * collects its money has few of these.
   */
  unsettled?: boolean
}

/** The server-side half of a filter, shared by the read and the listener. */
function reservationQuery(filters?: ReservationFilters) {
  const clauses: QueryConstraint[] = []

  if (filters?.unsettled) {
    clauses.push(where('payment_status', 'in', ['unpaid', 'partial']))
  } else if (filters?.date) {
    clauses.push(where('date', '==', filters.date))
  } else if (filters?.month) {
    clauses.push(where('date', '>=', `${filters.month}-01`))
    clauses.push(where('date', '<=', `${filters.month}-31`))
  } else {
    if (filters?.from) clauses.push(where('date', '>=', filters.from))
    if (filters?.to) clauses.push(where('date', '<=', filters.to))
  }

  return clauses.length
    ? query(collection(db, 'reservations'), ...clauses)
    : query(collection(db, 'reservations'))
}

/** The client-side half — fields a single-field index can't cover for free. */
function narrowReservations(rows: Reservation[], filters?: ReservationFilters) {
  let results = rows
  if (filters?.adminId) results = results.filter(r => r.admin_id === filters.adminId)
  if (filters?.status) results = results.filter(r => r.status === filters.status)
  return results
}

export async function getReservations(filters?: ReservationFilters): Promise<Reservation[]> {
  const snap = await getDocs(reservationQuery(filters))
  return narrowReservations(live<Reservation>(snap.docs).sort(byDateDesc), filters)
}

/**
 * The same query, kept open.
 *
 * A screen that polls pays for every document again on every tick; a listener
 * pays for the first load and then only for documents that actually change.
 * It is also simply correct: the desk sees a session close the moment the
 * doctor closes it, rather than up to half a minute later.
 *
 * Returns the unsubscribe function — call it when the screen goes away.
 */
export function watchReservations(
  filters: ReservationFilters | undefined,
  onData: (rows: Reservation[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    reservationQuery(filters),
    snap => onData(narrowReservations(live<Reservation>(snap.docs).sort(byDateDesc), filters)),
    err => onError?.(err)
  )
}

export async function getReservationsByClient(clientId: string): Promise<Reservation[]> {
  const q = query(collection(db, 'reservations'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return live<Reservation>(snap.docs).sort(byDateDesc)
}

/**
 * Republishes the name-free slot mirror the public booking form reads.
 * Best-effort on purpose: the mirror is a courtesy to the visitor, so a failure
 * here must never lose a booking that was already written.
 */
async function refreshAvailability(...dates: (string | null | undefined)[]) {
  const unique = [...new Set(dates.filter((d): d is string => !!d))]
  if (unique.length === 0) return
  // Bookings made before sessions had lengths carry none, so the mirror asks
  // the catalogue how long each one runs rather than writing off a whole hour.
  const services = await getServices().catch(() => [] as Service[])
  for (const date of unique) {
    try {
      await syncBusySlots(date, await getReservations({ date }), services)
    } catch { /* the bookings are the source of truth — the mirror can lag */ }
  }
}

export async function createReservation(data: DocumentData) {
  const ref = await addDoc(collection(db, 'reservations'), {
    status: 'pending',
    paid_amount: 0,
    payment_status: 'unpaid',
    ...data,
    created_at: now(),
    deleted_at: null,
  })

  // A visitor can't read the day to rebuild it, so she just claims her own hour.
  if (auth.currentUser) await refreshAvailability(data.date as string)
  else {
    try {
      await holdSlot(
        String(data.date ?? ''),
        String(data.time ?? ''),
        data.duration_minutes as number | null | undefined
      )
    } catch { /* the request is in — the desk's next write fixes the mirror */ }
  }

  return ref
}

export async function updateReservation(id: string, data: Partial<DocumentData>) {
  const ref = doc(db, 'reservations', id)
  // Pricing and payment edits don't move anyone's hour — only re-read the
  // booking when the change could free or claim a slot. A different session
  // length changes how much of the hour is left, so it counts too.
  const movesSlot = 'date' in data || 'time' in data || 'status' in data ||
    'duration_minutes' in data
  const before = movesSlot ? (await getDoc(ref)).data() : null

  await updateDoc(ref, data)
  if (movesSlot) await refreshAvailability(before?.date, data.date as string)
}

export async function softDeleteReservation(id: string) {
  const ref = doc(db, 'reservations', id)
  const before = (await getDoc(ref)).data()
  await updateDoc(ref, { deleted_at: now() })
  await refreshAvailability(before?.date)
}

// ─── Timetable ───────────────────────────────────────────────────────────────

export async function getTimetable(adminId: string, startDay: string, endDay: string) {
  const q = query(
    collection(db, 'timetable'),
    where('admin_id', '==', adminId),
    where('day', '>=', startDay),
    where('day', '<=', endDay)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createTimetableSlot(data: DocumentData) {
  return addDoc(collection(db, 'timetable'), data)
}

export async function updateTimetableSlot(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'timetable', id), data)
}

// ─── Session Reports ─────────────────────────────────────────────────────────

export async function getSessionReports(
  filters?: { adminId?: string; clientId?: string }
): Promise<SessionReport[]> {
  const snap = await getDocs(collection(db, 'session_reports'))
  let results = (snap.docs.map(d => ({ id: d.id, ...d.data() })) as SessionReport[])
    .sort(bySeconds('created_at'))
  if (filters?.adminId) results = results.filter(r => r.admin_id === filters.adminId)
  if (filters?.clientId) results = results.filter(r => r.client_id === filters.clientId)
  return results
}

export async function getSessionReportsByClient(clientId: string): Promise<SessionReport[]> {
  const q = query(collection(db, 'session_reports'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return (snap.docs.map(d => ({ id: d.id, ...d.data() })) as SessionReport[])
    .sort(bySeconds('created_at'))
}

export async function createSessionReport(data: DocumentData) {
  return addDoc(collection(db, 'session_reports'), {
    ...data,
    session_date: now(),
    created_at: now(),
  })
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function getReviews() {
  const snap = await getDocs(collection(db, 'reviews'))
  return live<DocumentData & { id: string }>(snap.docs).sort(bySeconds('created_at'))
}

export async function updateReview(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'reviews', id), data)
}

// ─── Payments / Collections (التحصيلات) ──────────────────────────────────────

/** Collections, narrowed on the server for the same reason as the bookings. */
export async function getPayments(
  filters?: {
    staffId?: string
    date?: string
    month?: string
    clientId?: string
    /** Inclusive 'YYYY-MM-DD' bounds. */
    from?: string
    to?: string
  }
): Promise<Payment[]> {
  const clauses: QueryConstraint[] = []

  if (filters?.date) {
    clauses.push(where('date', '==', filters.date))
  } else if (filters?.from || filters?.to) {
    if (filters.from) clauses.push(where('date', '>=', filters.from))
    if (filters.to) clauses.push(where('date', '<=', filters.to))
  }

  const snap = await getDocs(
    clauses.length ? query(collection(db, 'payments'), ...clauses) : collection(db, 'payments')
  )
  let results = live<Payment>(snap.docs).sort(bySeconds('created_at'))
  if (filters?.staffId) results = results.filter(p => p.staff_id === filters.staffId)
  // `month` predates the `date` index, so it stays a local filter
  if (filters?.month) results = results.filter(p => monthOf(p) === filters.month)
  if (filters?.clientId) results = results.filter(p => p.client_id === filters.clientId)
  return results
}

export async function getPaymentsByClient(clientId: string): Promise<Payment[]> {
  const q = query(collection(db, 'payments'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return live<Payment>(snap.docs).sort(bySeconds('created_at'))
}

/** `month` was added later — fall back to slicing `date` for older records. */
export function monthOf(p: { month?: string; date?: string }): string {
  return p.month ?? (p.date ?? '').slice(0, 7)
}

/**
 * Records a payment and keeps the linked reservation's paid_amount /
 * payment_status in sync, atomically — so the accounting totals and the
 * booking row can never drift apart.
 */
export async function createPayment(data: DocumentData) {
  const paymentRef = doc(collection(db, 'payments'))
  const amount = toNumber(data.amount)
  const date = data.date || todayISO()
  const reservationId: string | null = data.reservation_id || null

  await runTransaction(db, async (tx) => {
    let reservationUpdate: { ref: ReturnType<typeof doc>; paid: number; total: number } | null = null

    if (reservationId) {
      const resRef = doc(db, 'reservations', reservationId)
      const resSnap = await tx.get(resRef)
      if (resSnap.exists()) {
        const res = resSnap.data() as Reservation
        reservationUpdate = {
          ref: resRef,
          paid: toNumber(res.paid_amount) + amount,
          total: toNumber(res.price_at_booking),
        }
      }
    }

    tx.set(paymentRef, {
      ...data,
      amount,
      date,
      month: monthKey(date),
      reservation_id: reservationId,
      created_at: now(),
      deleted_at: null,
    })

    if (reservationUpdate) {
      tx.update(reservationUpdate.ref, {
        paid_amount: reservationUpdate.paid,
        payment_status: paymentStatusFor(reservationUpdate.paid, reservationUpdate.total),
      })
    }
  })

  return paymentRef
}

/**
 * Prices a finished session and marks it done. Whoever is at the desk when the
 * patient stands up records the agreed total; the money itself is taken against
 * it via `createPayment`.
 *
 * Runs as a transaction because `payment_status` has to be re-derived against
 * the new total: a client who paid a deposit against an unpriced booking would
 * otherwise be left marked "paid" once a real total lands.
 */
export async function closeSession(input: {
  reservationId: string
  /** Final agreed total, after any discount. */
  total: number
}) {
  const total = toNumber(input.total)
  const resRef = doc(db, 'reservations', input.reservationId)

  await runTransaction(db, async (tx) => {
    const resSnap = await tx.get(resRef)
    if (!resSnap.exists()) throw new Error('الحجز ده مش موجود')

    const paid = toNumber((resSnap.data() as Reservation).paid_amount)

    tx.update(resRef, {
      price_at_booking: total,
      priced_at: now(),
      status: 'completed',
      payment_status: paymentStatusFor(paid, total),
    })
  })
}

/** Soft-deletes a payment and rolls its amount back off the reservation. */
export async function softDeletePayment(id: string) {
  const paymentRef = doc(db, 'payments', id)

  await runTransaction(db, async (tx) => {
    const paySnap = await tx.get(paymentRef)
    if (!paySnap.exists()) throw new Error('Payment not found')
    const payment = paySnap.data() as Payment
    if (payment.deleted_at) return // already deleted — nothing to roll back

    let reservationUpdate: { ref: ReturnType<typeof doc>; paid: number; total: number } | null = null
    if (payment.reservation_id) {
      const resRef = doc(db, 'reservations', payment.reservation_id)
      const resSnap = await tx.get(resRef)
      if (resSnap.exists()) {
        const res = resSnap.data() as Reservation
        reservationUpdate = {
          ref: resRef,
          paid: Math.max(0, toNumber(res.paid_amount) - toNumber(payment.amount)),
          total: toNumber(res.price_at_booking),
        }
      }
    }

    tx.update(paymentRef, { deleted_at: now() })

    if (reservationUpdate) {
      tx.update(reservationUpdate.ref, {
        paid_amount: reservationUpdate.paid,
        payment_status: paymentStatusFor(reservationUpdate.paid, reservationUpdate.total),
      })
    }
  })
}

export function paymentStatusFor(paid: number, total: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0) return 'unpaid'
  if (total > 0 && paid < total) return 'partial'
  return 'paid'
}

// ─── Expenses (المصاريف) ─────────────────────────────────────────────────────

export async function getExpenses(filters?: { month?: string }): Promise<Expense[]> {
  const snap = await getDocs(collection(db, 'expenses'))
  let results = live<Expense>(snap.docs).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  if (filters?.month) results = results.filter(e => monthOf(e) === filters.month)
  return results
}

export async function createExpense(data: DocumentData) {
  const date = data.date || todayISO()
  return addDoc(collection(db, 'expenses'), {
    ...data,
    amount: toNumber(data.amount),
    date,
    month: monthKey(date),
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateExpense(id: string, data: Partial<DocumentData>) {
  const patch: DocumentData = { ...data }
  if (patch.amount !== undefined) patch.amount = toNumber(patch.amount)
  if (patch.date) patch.month = monthKey(patch.date as string)
  return updateDoc(doc(db, 'expenses', id), patch)
}

export async function softDeleteExpense(id: string) {
  return updateDoc(doc(db, 'expenses', id), { deleted_at: now() })
}

// ─── Monthly closing (الجرد الشهري) ──────────────────────────────────────────

export async function getMonthlyClosings(): Promise<MonthlyClosing[]> {
  const snap = await getDocs(collection(db, 'monthly_closings'))
  return (snap.docs.map(d => ({ id: d.id, ...d.data() })) as MonthlyClosing[])
    .sort((a, b) => (b.month ?? '').localeCompare(a.month ?? ''))
}

export async function getMonthlyClosing(month: string): Promise<MonthlyClosing | null> {
  const snap = await getDoc(doc(db, 'monthly_closings', month))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as MonthlyClosing) : null
}

/** Document ID is the month itself, so closing twice overwrites rather than duplicates. */
export async function saveMonthlyClosing(month: string, data: DocumentData) {
  return setDoc(doc(db, 'monthly_closings', month), {
    ...data,
    month,
    closed_at: now(),
  })
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getClinicSettings() {
  const snap = await getDoc(doc(db, 'settings', 'clinic'))
  return snap.exists() ? snap.data() : null
}

export async function saveClinicSettings(data: DocumentData) {
  return setDoc(doc(db, 'settings', 'clinic'), data, { merge: true })
}

