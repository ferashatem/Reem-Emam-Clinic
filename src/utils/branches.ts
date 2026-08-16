import type { Branch, Reservation, Service } from '../types'

/**
 * The place runs two lines out of two rooms: the laser centre, and the
 * consultation clinic beside it. They book independently — the same hour can
 * hold a كشف and a laser session at once — and they keep separate books.
 *
 * This module is the only place that decides which line a thing belongs to.
 * Everything else asks it, so the "absent means laser" rule below is stated
 * once instead of being re-guessed at every call site.
 */

/** In the order they're shown, everywhere they're shown. */
export const BRANCHES: readonly Branch[] = ['laser', 'consult']

/**
 * What a record with no branch on it means. The laser centre came first and
 * ran alone, so every booking, payment and expense written before the clinic
 * opened is laser work. Nothing has to be backfilled for the split to be
 * correct — it just has to keep answering this way.
 */
export const DEFAULT_BRANCH: Branch = 'laser'

export interface BranchInfo {
  /** Full name, for page headers and the public site. */
  name: string
  /** Short name, for tabs and pills where the full one won't fit. */
  short: string
  icon: string
  /** Ties the two lines to the palette so a screen reads as one or the other. */
  color: string
}

export const BRANCH_INFO: Record<Branch, BranchInfo> = {
  laser: { name: 'مركز الليزر', short: 'ليزر', icon: '✨', color: '#8B3A52' },
  consult: { name: 'عيادة الكشف', short: 'كشف', icon: '🩺', color: '#2E6F72' },
}

export function branchName(branch: Branch): string {
  return BRANCH_INFO[branch].name
}

export function branchShort(branch: Branch): string {
  return BRANCH_INFO[branch].short
}

/** Narrows anything read out of Firestore to a branch we actually run. */
export function asBranch(value: unknown): Branch {
  return value === 'consult' || value === 'laser' ? value : DEFAULT_BRANCH
}

/**
 * Which line a service is sold by. A variant («كانديلا» under «ليزر») is in the
 * same room as the service above it, so it takes its parent's rather than
 * carrying one of its own — the same way it inherits a price and a length.
 */
export function branchOf(
  service: Service | undefined | null,
  all: Service[] = []
): Branch {
  if (!service) return DEFAULT_BRANCH
  if (service.parent_id) {
    const parent = all.find(s => s.id === service.parent_id)
    // A variant whose parent is missing keeps whatever it was stored with —
    // it's the only thing left to go on.
    if (parent) return asBranch(parent.branch)
  }
  return asBranch(service.branch)
}

/**
 * Which line a booking belongs to. The booking's own snapshot wins: a service
 * moved to the other line must not drag last month's sessions across with it,
 * because their money has already been counted in the line they were sold by.
 */
export function branchOfReservation(
  r: Pick<Reservation, 'branch' | 'service_id'>,
  services: Service[] = []
): Branch {
  if (r.branch) return asBranch(r.branch)
  // Written before the split — fall back to wherever its service sits today.
  const service = services.find(s => s.id === r.service_id)
  return service ? branchOf(service, services) : DEFAULT_BRANCH
}

/** Only the services one line sells, parents and variants alike. */
export function servicesOfBranch(all: Service[], branch: Branch): Service[] {
  return all.filter(s => branchOf(s, all) === branch)
}

/**
 * One line's bookings. Every schedule question — which hours are free, who is
 * in the chair — has to be asked through this first: the two rooms run at the
 * same time, so counting both lines together would close an hour that is
 * genuinely open.
 */
export function reservationsOfBranch<T extends Pick<Reservation, 'branch' | 'service_id'>>(
  reservations: T[],
  branch: Branch,
  services: Service[] = []
): T[] {
  return reservations.filter(r => branchOfReservation(r, services) === branch)
}
