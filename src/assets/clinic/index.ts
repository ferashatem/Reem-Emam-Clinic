/**
 * The clinic's own interior photography — bundled (and hashed) by Vite so the
 * landing page never waits on Firebase Storage rules or a network round trip.
 *
 * WebP: the same photographs at roughly half the bytes, which on a phone on
 * mobile data is the difference between a landing page that appears and one
 * that is still arriving. Every browser in use has supported it for years.
 */
import reception from './reception.webp'
import lounge from './lounge.webp'
import treatment from './treatment.webp'
import consult from './consult.webp'

export const photos = { reception, lounge, treatment, consult } as const

/** Same order the gallery copy in `lang/` uses. */
export const galleryOrder = [reception, lounge, treatment, consult] as const
