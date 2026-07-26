/**
 * The clinic's own interior photography — bundled (and hashed) by Vite so the
 * landing page never waits on Firebase Storage rules or a network round trip.
 */
import reception from './reception.jpg'
import lounge from './lounge.jpg'
import treatment from './treatment.jpg'
import consult from './consult.jpg'

export const photos = { reception, lounge, treatment, consult } as const

/** Same order the gallery copy in `lang/` uses. */
export const galleryOrder = [reception, lounge, treatment, consult] as const
