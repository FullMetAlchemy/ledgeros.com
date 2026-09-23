// MDA compliance rating, derived from open flags. This is the same rating the
// oversight console shows, so MDAs and auditors never disagree about it.

import { isOpen } from './flagMachine'
import { SEVERITY_RANK } from './policy'
import { flagLabel } from './templates'
import type { Flag, Rating, Severity } from './types'

export function ratingFor(openSeverities: Severity[]): Rating {
  if (openSeverities.some((s) => s === 'Critical' || s === 'High')) return 'High Risk'
  if (openSeverities.length) return 'Warning'
  return 'Clear'
}

export function deriveRating(flags: Flag[]): Rating {
  return ratingFor(flags.filter(isOpen).map((f) => f.severity))
}

export interface PathStep {
  flagId: string
  label: string
  severity: Severity
}

export interface RatingExplanation {
  rating: Rating
  /** Open flags that set the current rating. */
  drivers: Flag[]
  /** Next rating once the drivers are resolved (null when already Clear). */
  next: Rating | null
  /** Smallest set of resolutions that moves the rating up one level. */
  path: PathStep[]
}

export function explainRating(flags: Flag[]): RatingExplanation {
  const open = flags.filter(isOpen).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  const rating = ratingFor(open.map((f) => f.severity))
  if (rating === 'Clear') return { rating, drivers: [], next: null, path: [] }
  const drivers = rating === 'High Risk' ? open.filter((f) => f.severity === 'Critical' || f.severity === 'High') : open
  const remaining = open.filter((f) => !drivers.includes(f))
  return {
    rating,
    drivers,
    next: ratingFor(remaining.map((f) => f.severity)),
    path: drivers.map((f) => ({ flagId: f.id, label: flagLabel(f.type), severity: f.severity })),
  }
}
