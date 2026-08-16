import { C } from '../../theme'
import type { Branch, Reservation, Service } from '../../types'
import { isPerPulse } from '../../utils/pricing'
import { BRANCH_INFO } from '../../utils/branches'

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
 * Which line a row belongs to. Only worth showing on a view holding both —
 * inside a single line's screen every row would carry the same badge, which
 * says nothing.
 */
export function BranchPill({
  branch, className = '',
}: { branch: Branch; className?: string }) {
  const info = BRANCH_INFO[branch]
  return (
    <span
      className={`${pill} ${className}`}
      style={{ backgroundColor: `${info.color}14`, color: info.color }}
    >
      {info.icon} {info.short}
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
