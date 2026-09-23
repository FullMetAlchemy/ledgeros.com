import { chainCursor, isMyStep } from '../chain'
import { STEP_LABEL } from '../policy'
import type { User } from '../types'
import { DEFS } from './defs'
import type { Submission } from './types'

export type SubmissionTaskGroup = 'draft' | 'returned' | 'signoff' | 'oversight'

export interface SubmissionTask {
  submission: Submission
  group: SubmissionTaskGroup
  action: string
}

export function submissionTaskFor(sub: Submission, user: User): SubmissionTask | null {
  const def = DEFS[sub.kind]
  if (!user.mdaId) {
    return sub.state === 'UnderReview' && user.role === def.reviewer
      ? { submission: sub, group: 'oversight', action: def.reviewer === 'treasury' ? 'Decide release' : 'Review submission' }
      : null
  }
  if (user.mdaId !== sub.mdaId) return null
  const lead = user.role === 'dfa' || user.role === 'accounting_officer'
  switch (sub.state) {
    case 'Draft':
      if (sub.ownerId !== user.id) return null
      return sub.returned
        ? { submission: sub, group: 'returned', action: 'Revise returned submission' }
        : { submission: sub, group: 'draft', action: 'Complete draft' }
    case 'InChain': {
      if (!isMyStep(def.chain, sub.chain, user, sub.mdaId)) return null
      const cur = chainCursor(def.chain, sub.chain)!
      return { submission: sub, group: 'signoff', action: cur.isFinal ? 'Attest submission' : STEP_LABEL[cur.step] }
    }
    case 'Queried':
      return sub.ownerId === user.id || lead ? { submission: sub, group: 'returned', action: 'Answer query' } : null
    default:
      return null
  }
}

export function submissionTasksFor(subs: Submission[], user: User): SubmissionTask[] {
  return subs
    .map((s) => submissionTaskFor(s, user))
    .filter((t): t is SubmissionTask => t !== null)
    .sort((a, b) => a.submission.dueAt.localeCompare(b.submission.dueAt))
}
