import type { Reservation } from '../../types'

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
