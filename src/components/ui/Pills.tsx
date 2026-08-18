import { C } from '../../theme'
import type { Reservation, Service } from '../../types'
import { isPerPulse } from '../../utils/pricing'

const pill =
  'inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-lg text-[11px] font-semibold'

/**
 * Which sessions will need a pulse count at the end of the day. Without this
 * every booking looks alike until you open it.
 */
export function PricingPill({
  reservation, service, className = '',
}: { reservation: Reservation; service?: Service | null; className?: string }) {
  const perPulse = isPerPulse(reservation, service)
  return (
    <span
      className={`${pill} ${className}`}
      style={perPulse
        ? { backgroundColor: '#FDF0F4', color: C.primary }
        : { backgroundColor: '#EFF6FF', color: C.blue }}
    >
      {perPulse ? '◈ بالنبضة' : '● سعر ثابت'}
    </span>
  )
}

/**
 * Where the booking came from. The two intake paths behave differently — a
 * website request arrives unconfirmed and unattached to a patient file — and
 * that distinction is worth keeping visible after the request is accepted.
 */
export function SourcePill({
  bookedBy, className = '',
}: { bookedBy?: Reservation['booked_by']; className?: string }) {
  const fromSite = bookedBy === 'client'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] whitespace-nowrap ${className}`}
      style={{ color: '#9CA3AF' }}>
      {fromSite ? '🌐 من الموقع' : '📞 تليفون'}
    </span>
  )
}
