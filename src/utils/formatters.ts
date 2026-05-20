import { format, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'

export function formatDateAr(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'EEEE، d MMMM yyyy', { locale: ar })
  } catch {
    return dateStr
  }
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString('ar-EG')} جنيه`
}

export function formatPhone(phone: string): string {
  return phone.startsWith('+20') ? phone : `+20${phone.replace(/^0/, '')}`
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function weekRange(): { start: string; end: string } {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(today.setDate(diff))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0],
  }
}
