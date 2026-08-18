import { toNumber } from './formatters'
import { SLOT_MINUTES } from './slots'
import type { Service } from '../types'

/**
 * The catalogue is two levels deep: a main service («ليزر») and the variants
 * booked under it («كانديلا», «ألكسندرايت»). Both live in the same collection —
 * a variant is just a service carrying `parent_id` — so a booking keeps
 * pointing at one service doc whichever level it came from.
 */
export interface ServiceGroup {
  service: Service
  /** Empty when the service is booked directly, with no inner choice. */
  options: Service[]
}

export function isMainService(s: Service): boolean {
  return !s.parent_id
}

/** The variants hanging off a service, in catalogue order. */
export function optionsOf(all: Service[], parentId: string | undefined): Service[] {
  if (!parentId) return []
  return all.filter(s => s.parent_id === parentId)
}

/**
 * Main services with their variants attached. A variant whose parent is missing
 * from `all` is dropped rather than promoted — a hidden «ليزر» must not leave
 * its devices bookable on their own.
 */
export function groupServices(all: Service[]): ServiceGroup[] {
  const byParent = new Map<string, Service[]>()
  for (const s of all) {
    if (!s.parent_id) continue
    const list = byParent.get(s.parent_id)
    if (list) list.push(s)
    else byParent.set(s.parent_id, [s])
  }
  return all
    .filter(isMainService)
    .map(service => ({ service, options: byParent.get(service.id) ?? [] }))
}

/** True when the client has to pick a variant before this service can be booked. */
export function needsOption(all: Service[], serviceId: string | undefined): boolean {
  return optionsOf(all, serviceId).length > 0
}

/**
 * How long a session of this service runs, in minutes. A type may set its own
 * length; blank means it takes its service's. Nothing set at all = the whole
 * hour, which is how every booking behaved before lengths existed.
 */
export function sessionMinutes(
  service: Service | undefined | null,
  all: Service[]
): number {
  if (!service) return SLOT_MINUTES
  const own = toNumber(service.duration_minutes)
  if (own > 0) return Math.min(own, SLOT_MINUTES)
  const parent = service.parent_id ? all.find(s => s.id === service.parent_id) : null
  const inherited = toNumber(parent?.duration_minutes)
  return inherited > 0 ? Math.min(inherited, SLOT_MINUTES) : SLOT_MINUTES
}

/**
 * Where a booking's rate lives. A type is only a choice of *what* is used — the
 * price sits on the service above it — so pricing a booking made on a type
 * means walking back up to its parent.
 */
export function pricedService(
  service: Service | undefined | null,
  all: Service[]
): Service | undefined {
  if (!service) return undefined
  const carriesOwnPrice = toNumber(service.price) > 0
  if (carriesOwnPrice || !service.parent_id) return service
  return all.find(s => s.id === service.parent_id) ?? service
}

/**
 * The flat price a client can be quoted before booking. A variant with no price
 * of its own is sold at its service's price, so the two levels answer the same
 * question. 0 = nothing fixed to quote (a per-pulse service, or one that has
 * never been priced).
 */
export function fixedPrice(service: Service | undefined | null, all: Service[]): number {
  if (!service) return 0
  const own = toNumber(service.price)
  if (own > 0) return own
  const parent = service.parent_id ? all.find(s => s.id === service.parent_id) : null
  return Math.max(0, toNumber(parent?.price))
}

/**
 * What a whole card costs. A service whose variants are priced one by one has a
 * span rather than a number — «من ٥٠٠ لـ ٩٠٠» — so the client sees what the
 * cheapest and dearest choices inside it are before she opens the form.
 */
export function priceRange(
  group: ServiceGroup,
  all: Service[]
): { min: number; max: number } | null {
  const prices = group.options.length > 0
    ? group.options.map(o => fixedPrice(o, all)).filter(p => p > 0)
    : [fixedPrice(group.service, all)].filter(p => p > 0)
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/**
 * What goes on the booking: «ليزر — كانديلا» for a variant, the plain name for a
 * service booked directly. Every screen reads `service_name`, so the two levels
 * have to arrive there already joined.
 */
export function serviceLabel(service: Service | undefined | null, all: Service[]): string {
  if (!service) return ''
  const parent = service.parent_id ? all.find(s => s.id === service.parent_id) : null
  return parent ? `${parent.name} — ${service.name}` : service.name
}
