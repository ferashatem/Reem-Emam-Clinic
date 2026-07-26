import { format, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'

/** Local (Cairo) date as YYYY-MM-DD — never use toISOString(), it shifts to UTC. */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM' for the given ISO date (defaults to today). */
export function monthKey(dateISO?: string): string {
  return (dateISO ?? todayISO()).slice(0, 7)
}

export function formatDateAr(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'EEEE، d MMMM yyyy', { locale: ar })
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'd MMM yyyy', { locale: ar })
  } catch {
    return dateStr
  }
}

/** '2026-07' → 'يوليو 2026' */
export function formatMonthAr(month: string): string {
  if (!month) return '—'
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ar })
  } catch {
    return month
  }
}

/** '14:00' → '2:00 م' */
export function formatTime(time: string): string {
  if (!time) return '—'
  const [hStr, m = '00'] = time.split(':')
  const h = Number(hStr)
  if (Number.isNaN(h)) return time
  const period = h >= 12 ? 'م' : 'ص'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

/** Safely coerces anything (string, null, undefined, NaN) to a finite number. */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatPrice(price: unknown): string {
  return `${toNumber(price).toLocaleString('ar-EG')} جنيه`
}

/** Compact money for tables and stat cards. */
export function formatMoney(price: unknown): string {
  return `${toNumber(price).toLocaleString('ar-EG')} ج`
}

export function formatPhone(phone: string): string {
  if (!phone) return '—'
  return phone.startsWith('+20') ? phone : `+20${phone.replace(/^0/, '')}`
}

/** Firestore Timestamp | Date | ISO string → Date | null */
export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }
  if (typeof value === 'string') {
    const d = parseISO(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** True when the reservation's date+time is already behind us. */
export function isPastSlot(date: string, time?: string): boolean {
  if (!date) return false
  const today = todayISO()
  if (date < today) return true
  if (date > today) return false
  if (!time) return false
  return time < new Date().toTimeString().slice(0, 5)
}

export function weekRange(): { start: string; end: string } {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: toISODate(monday), end: toISODate(sunday) }
}

/** Last N months as 'YYYY-MM', newest first. */
export function recentMonths(count = 12): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}
