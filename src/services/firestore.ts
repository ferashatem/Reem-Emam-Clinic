import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query,
  where, Timestamp, setDoc, runTransaction,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db } from './firebase'
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

export async function getServices(): Promise<Service[]> {
  const snap = await getDocs(collection(db, 'services'))
  return live<Service>(snap.docs).sort(bySeconds('created_at'))
}

export async function getActiveServices(): Promise<Service[]> {
  const all = await getServices()
  return all.filter(s => s.is_active === true)
}

export async function createService(data: DocumentData) {
  return addDoc(collection(db, 'services'), {
    ...data,
    is_active: true,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateService(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'services', id), data)
}

export async function softDeleteService(id: string) {
  return updateDoc(doc(db, 'services', id), { deleted_at: now(), is_active: false })
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const snap = await getDocs(collection(db, 'clients'))
  return live<Client>(snap.docs).sort(bySeconds('created_at'))
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

export async function getReservations(
  filters?: { adminId?: string; date?: string; month?: string; status?: string }
): Promise<Reservation[]> {
  const snap = await getDocs(collection(db, 'reservations'))
  let results = live<Reservation>(snap.docs).sort(byDateDesc)

  if (filters?.adminId) results = results.filter(r => r.admin_id === filters.adminId)
  if (filters?.date) results = results.filter(r => r.date === filters.date)
  if (filters?.month) results = results.filter(r => (r.date ?? '').startsWith(filters.month!))
  if (filters?.status) results = results.filter(r => r.status === filters.status)

  return results
}

export async function getReservationsByClient(clientId: string): Promise<Reservation[]> {
  const q = query(collection(db, 'reservations'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return live<Reservation>(snap.docs).sort(byDateDesc)
}

export async function createReservation(data: DocumentData) {
  return addDoc(collection(db, 'reservations'), {
    status: 'pending',
    paid_amount: 0,
    payment_status: 'unpaid',
    ...data,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateReservation(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'reservations', id), data)
}

export async function softDeleteReservation(id: string) {
  return updateDoc(doc(db, 'reservations', id), { deleted_at: now() })
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

export async function getPayments(
  filters?: { staffId?: string; date?: string; month?: string; clientId?: string }
): Promise<Payment[]> {
  const snap = await getDocs(collection(db, 'payments'))
  let results = live<Payment>(snap.docs).sort(bySeconds('created_at'))
  if (filters?.staffId) results = results.filter(p => p.staff_id === filters.staffId)
  if (filters?.date) results = results.filter(p => p.date === filters.date)
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
 * Closes a session: the pulse count, the price it produced, and the money the
 * client handed over — all in one transaction.
 *
 * These three facts are learnt in the same breath at the end of a session, and
 * they have to land together: pricing without the payment leaves a booking that
 * looks unpaid, and `createPayment` can't be reused here because it reads the
 * total off the booking, which we're changing in the same write.
 */
export async function closeSession(input: {
  reservationId: string
  pulses: number | null
  /** Final agreed total, after any discount the assistant typed. */
  total: number
  payment: { amount: number; method: string; note?: string; date?: string } | null
  staff: { id: string; name: string }
  clientId: string
  clientName: string
}) {
  const total = toNumber(input.total)
  const amount = toNumber(input.payment?.amount)
  const date = input.payment?.date || todayISO()
  const resRef = doc(db, 'reservations', input.reservationId)
  const paymentRef = amount > 0 ? doc(collection(db, 'payments')) : null

  await runTransaction(db, async (tx) => {
    const resSnap = await tx.get(resRef)
    if (!resSnap.exists()) throw new Error('الحجز ده مش موجود')

    // Any earlier money (a deposit, a first instalment) stays counted.
    const alreadyPaid = toNumber((resSnap.data() as Reservation).paid_amount)
    const paid = alreadyPaid + amount

    tx.update(resRef, {
      pulses: input.pulses,
      price_at_booking: total,
      priced_at: now(),
      status: 'completed',
      paid_amount: paid,
      payment_status: paymentStatusFor(paid, total),
    })

    if (paymentRef) {
      tx.set(paymentRef, {
        client_id: input.clientId,
        client_name: input.clientName,
        reservation_id: input.reservationId,
        amount,
        method: input.payment!.method,
        note: input.payment!.note ?? '',
        date,
        month: monthKey(date),
        staff_id: input.staff.id,
        staff_name: input.staff.name,
        created_at: now(),
        deleted_at: null,
      })
    }
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

