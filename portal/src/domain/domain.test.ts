import { describe, expect, it } from 'vitest'
import { addWorkingDays, workingDaysBetween } from './calendar'
import { emptyDraft, sweepDeadlines } from './flagMachine'
import { naira } from './money'
import { activeDeadline, chainFor, deadlinesFor } from './policy'
import { explainRating, ratingFor } from './rating'
import { buildFlags, buildUsers, MDAS } from './seed'
import { canSubmit, validateResponse } from './validation'
import type { Flag } from './types'

describe('calendar', () => {
  it('skips weekends and lands at close of business', () => {
    const fri = new Date('2026-09-25T10:00:00')
    const due = addWorkingDays(fri, 1)
    expect(due.getDay()).toBe(1) // Monday
    expect(due.getHours()).toBe(17)
  })

  it('counts working days between dates', () => {
    expect(workingDaysBetween(new Date('2026-09-21'), new Date('2026-09-28'))).toBe(5)
    expect(workingDaysBetween(new Date('2026-09-28'), new Date('2026-09-21'))).toBe(-5)
  })
})

describe('policy', () => {
  it('maps severity to chain length', () => {
    expect(chainFor('Critical')).toHaveLength(4)
    expect(chainFor('High')).toHaveLength(4)
    expect(chainFor('Medium')).toEqual(['prepare', 'review'])
  })

  it('reports deadline status', () => {
    const raised = new Date('2026-09-21T09:00:00')
    const f = { state: 'Drafting', ...deadlinesFor('Critical', raised) } as Flag
    expect(activeDeadline(f, new Date('2026-09-22T09:00:00'))?.status).toBe('ok')
    expect(activeDeadline(f, new Date('2026-09-25T09:00:00'))?.status).toBe('soon')
    expect(activeDeadline(f, new Date('2026-09-29T09:00:00'))?.status).toBe('over')
    expect(activeDeadline({ ...f, state: 'Resolved' }, raised)).toBeNull()
  })
})

describe('rating', () => {
  it('derives rating from open severities', () => {
    expect(ratingFor(['Critical', 'Low'])).toBe('High Risk')
    expect(ratingFor(['Medium'])).toBe('Warning')
    expect(ratingFor([])).toBe('Clear')
  })

  it('explains the path to the next rating', () => {
    const flags = buildFlags(new Date(), buildUsers()).filter((f) => f.mdaId === 'FMW')
    const e = explainRating(flags)
    expect(e.rating).toBe('High Risk')
    expect(e.next).toBe('Warning') // the Medium capital-vote flag remains
    expect(e.path.every((p) => p.severity === 'Critical' || p.severity === 'High')).toBe(true)
  })
})

describe('validation', () => {
  const base = buildFlags(new Date(), buildUsers()).find((f) => f.id === 'FLG-0231-009')!

  it('blocks until a type is chosen', () => {
    const issues = validateResponse(base, emptyDraft())
    expect(issues.map((i) => i.id)).toEqual(['type'])
    expect(canSubmit(issues)).toBe(false)
  })

  it('advises referencing the related voucher without blocking', () => {
    const draft = {
      ...emptyDraft(),
      type: 'correct' as const,
      correctiveRef: 'REV-0001',
      narrative: 'The payment has been reversed and funds returned to the sub-account.',
      evidence: [{ id: 'x', slotId: 'correction', name: 'r.pdf', size: 1, mime: 'application/pdf', sha256: 'a', uploadedBy: 'u', uploadedAt: '' }],
    }
    const issues = validateResponse(base, draft)
    expect(issues.map((i) => i.tier)).toEqual(['advisory'])
    expect(canSubmit(issues)).toBe(true)
  })
})

describe('seed', () => {
  const now = new Date()
  const users = buildUsers()
  const flags = buildFlags(now, users)

  it('builds every seeded flag through the state machine', () => {
    expect(flags.length).toBeGreaterThan(10)
    expect(new Set(flags.map((f) => f.id)).size).toBe(flags.length)
    for (const f of flags) expect(MDAS.some((m) => m.id === f.mdaId)).toBe(true)
  })

  it('has one unacknowledged NEMA Critical that the sweep escalates', () => {
    const changed = sweepDeadlines(flags, now, users)
    expect(changed.map((f) => f.id)).toEqual(['FLG-0880-005'])
  })

  it('formats naira like the oversight console', () => {
    expect(naira(1.02e12)).toBe('₦1.02T')
    expect(naira(612e9)).toBe('₦612.0B')
    expect(naira(250e6)).toBe('₦250M')
  })
})
