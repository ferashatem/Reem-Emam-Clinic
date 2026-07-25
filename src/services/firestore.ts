import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query,
  where, Timestamp, setDoc
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db } from './firebase'

const now = () => Timestamp.now()

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserById(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getUserByPhone(phone: string) {
  const q = query(collection(db, 'users'), where('phone', '==', phone))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function linkUidToUser(docId: string, uid: string) {
  await updateDoc(doc(db, 'users', docId), { uid })
  // Copy to new doc with UID as ID so future lookups work
  const snap = await getDoc(doc(db, 'users', docId))
  if (snap.exists()) {
    await setDoc(doc(db, 'users', uid), { ...snap.data(), uid })
  }
}

export async function getAdmins() {
  // Returns both admins and staff (the internal team)
  const q = query(
    collection(db, 'users'),
    where('role', 'in', ['admin', 'staff']),
    where('deleted_at', '==', null)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createAdmin(data: DocumentData) {
  return setDoc(doc(db, 'users', data.uid), {
    ...data,
    role: data.role === 'staff' ? 'staff' : 'admin',
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

export async function getServices() {
  const snap = await getDocs(collection(db, 'services'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((s: DocumentData) => s.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export async function getActiveServices() {
  const snap = await getDocs(collection(db, 'services'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((s: DocumentData) => s.is_active === true && s.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
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

export async function getClients() {
  const snap = await getDocs(collection(db, 'clients'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((c: DocumentData) => c.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
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

export async function getClientByUid(uid: string) {
  const q = query(collection(db, 'clients'), where('uid', '==', uid), where('deleted_at', '==', null))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function linkUidToClient(docId: string, uid: string) {
  await updateDoc(doc(db, 'clients', docId), { uid })
}

export async function createClient(data: DocumentData) {
  return addDoc(collection(db, 'clients'), {
    ...data,
    created_at: now(),
    deleted_at: null,
  })
}

export async function saveClientByUid(uid: string, data: DocumentData) {
  await setDoc(doc(db, 'clients', uid), {
    ...data,
    uid,
    deleted_at: null,
  }, { merge: true })
}

export async function updateClient(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'clients', id), data)
}

export async function softDeleteClient(id: string) {
  return updateDoc(doc(db, 'clients', id), { deleted_at: now() })
}

// ─── Reservations ────────────────────────────────────────────────────────────

export async function getReservationsByClient(clientId: string) {
  const q = query(collection(db, 'reservations'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((r: DocumentData) => r.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.date > a.date ? 1 : -1))
}

export async function getSessionReportsByClient(clientId: string) {
  const q = query(collection(db, 'session_reports'), where('client_id', '==', clientId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export async function getReviewByReservation(reservationId: string) {
  const q = query(
    collection(db, 'reviews'),
    where('reservation_id', '==', reservationId),
    where('deleted_at', '==', null)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export async function getReservationById(id: string) {
  const snap = await getDoc(doc(db, 'reservations', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getAvailableTimeSlots(date: string): Promise<string[]> {
  const q = query(
    collection(db, 'reservations'),
    where('date', '==', date),
    where('deleted_at', '==', null),
    where('status', 'in', ['pending', 'confirmed'])
  )
  const snap = await getDocs(q)
  const bookedTimes = snap.docs.map(d => d.data().time as string)

  // 12:00 PM to 10:00 PM every 1 hour
  const slots: string[] = []
  for (let h = 12; h <= 22; h++) {
    const time = `${String(h).padStart(2, '0')}:00`
    if (!bookedTimes.includes(time)) slots.push(time)
  }
  return slots
}

// ─── (original Reservations section continues below) ─────────────────────────

export async function getPendingClientReservations() {
  const q = query(
    collection(db, 'reservations'),
    where('booked_by', '==', 'client'),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((r: DocumentData) => r.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export async function getReservations(filters?: { adminId?: string; date?: string; status?: string }) {
  const snap = await getDocs(collection(db, 'reservations'))
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DocumentData[]
  results = results.filter((r: DocumentData) => r.deleted_at === null)
  results = results.sort((a: DocumentData, b: DocumentData) => (b.date > a.date ? 1 : -1))

  if (filters?.adminId) results = results.filter((r: DocumentData) => r.admin_id === filters.adminId)
  if (filters?.date) results = results.filter((r: DocumentData) => r.date === filters.date)
  if (filters?.status) results = results.filter((r: DocumentData) => r.status === filters.status)

  return results
}

export async function createReservation(data: DocumentData) {
  return addDoc(collection(db, 'reservations'), {
    ...data,
    status: 'pending',
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

// ─── Session Reports ──────────────────────────────────────────────────────────

export async function getSessionReports(filters?: { adminId?: string; clientId?: string }) {
  const snap = await getDocs(collection(db, 'session_reports'))
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DocumentData[]
  results = results.sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
  if (filters?.adminId) results = results.filter((r: DocumentData) => r.admin_id === filters.adminId)
  if (filters?.clientId) results = results.filter((r: DocumentData) => r.client_id === filters.clientId)
  return results
}

export async function createSessionReport(data: DocumentData) {
  return addDoc(collection(db, 'session_reports'), {
    ...data,
    session_date: now(),
    created_at: now(),
  })
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function getReviews() {
  const snap = await getDocs(collection(db, 'reviews'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((r: DocumentData) => r.deleted_at === null)
    .sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export async function createReview(data: DocumentData) {
  return addDoc(collection(db, 'reviews'), {
    ...data,
    wa_sent: false,
    created_at: now(),
    deleted_at: null,
  })
}

export async function updateReview(id: string, data: Partial<DocumentData>) {
  return updateDoc(doc(db, 'reviews', id), data)
}

// ─── Payments / Collections (تحصيلات) ─────────────────────────────────────────

export async function getPayments(filters?: { staffId?: string; date?: string }) {
  const snap = await getDocs(collection(db, 'payments'))
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DocumentData[]
  results = results.filter((p: DocumentData) => p.deleted_at === null)
  results = results.sort((a: DocumentData, b: DocumentData) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
  if (filters?.staffId) results = results.filter((p: DocumentData) => p.staff_id === filters.staffId)
  if (filters?.date) results = results.filter((p: DocumentData) => p.date === filters.date)
  return results
}

export async function createPayment(data: DocumentData) {
  return addDoc(collection(db, 'payments'), {
    ...data,
    created_at: now(),
    deleted_at: null,
  })
}

export async function softDeletePayment(id: string) {
  return updateDoc(doc(db, 'payments', id), { deleted_at: now() })
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(data: DocumentData) {
  return addDoc(collection(db, 'notifications'), {
    ...data,
    sent_at: now(),
  })
}
