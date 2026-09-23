import { chainCursor } from '../../domain/chain'
import { shortDate } from '../../domain/calendar'
import { STEP_LABEL } from '../../domain/policy'
import { DEFS, REVIEWER_LABEL } from '../../domain/submissions/defs'
import { isWithMda } from '../../domain/submissions/machine'
import type { Submission, SubmissionHistoryEntry } from '../../domain/submissions/types'
import type { Tone } from '../../ui/tone'
import type { RailPhase } from '../../workflow/SignOffRail'
import type { TimelineEntry } from '../../workflow/StatusHistory'

export function submissionStatus(sub: Submission): { label: string; tone: Tone } {
  const treasury = DEFS[sub.kind].reviewer === 'treasury'
  switch (sub.state) {
    case 'Draft':
      return sub.returned ? { label: 'Returned', tone: 'flow' } : { label: 'Draft', tone: 'neu' }
    case 'InChain': {
      const cur = chainCursor(DEFS[sub.kind].chain, sub.chain)
      return { label: cur ? `${STEP_LABEL[cur.step]} pending` : 'In sign-off', tone: 'flow' }
    }
    case 'UnderReview':
      return { label: treasury ? 'With Treasury' : 'With oversight', tone: 'flow' }
    case 'Queried':
      return { label: 'Queried', tone: 'flow' }
    case 'Accepted':
      return { label: treasury ? 'Released' : 'Accepted', tone: 'ok' }
  }
}

/** Due-chip inputs: the clock runs while the submission is with the MDA. */
export function submissionDue(sub: Submission) {
  const submittedAt = sub.submitted && sub.attestation ? sub.attestation.at : null
  return {
    due: sub.dueAt,
    open: isWithMda(sub),
    closedLabel: sub.state === 'Accepted' ? 'Closed' : submittedAt ? `Filed ${shortDate(submittedAt)}` : 'Filed',
  }
}

const PHASE: Record<Submission['state'], RailPhase> = {
  Draft: 'drafting',
  InChain: 'chain',
  UnderReview: 'external',
  Accepted: 'done',
  Queried: 'idle',
}

export function submissionRail(sub: Submission) {
  const def = DEFS[sub.kind]
  return {
    steps: def.chain,
    acts: sub.chain,
    phase: PHASE[sub.state],
    ownerId: sub.ownerId,
    attestedAt: sub.attestation?.at,
    externalLabel: REVIEWER_LABEL[def.reviewer],
    externalWho: def.reviewer === 'treasury' ? 'Treasury Officer' : 'Chief Auditor',
  }
}

const EVENT_LABEL: Record<SubmissionHistoryEntry['event'], string> = {
  CREATE: 'Draft created',
  SUBMIT: 'Submitted to sign-off',
  APPROVE_STEP: 'Step approved',
  RETURN: 'Returned for changes',
  ACCEPT: 'Accepted',
  QUERY: 'Queried',
  REVISE: 'Revision started',
}

export function submissionTimeline(sub: Submission): { entries: TimelineEntry[]; origin: { label: string; at: string; actorId: string } } {
  const [first, ...rest] = sub.history
  return {
    entries: rest.map((h) => ({
      id: h.id,
      at: h.at,
      actorId: h.actorId,
      label: h.event === 'ACCEPT' && DEFS[sub.kind].reviewer === 'treasury' ? 'Release approved' : EVENT_LABEL[h.event],
      note: h.event === 'ACCEPT' ? undefined : h.note,
      tone: h.event === 'ACCEPT' ? 'good' : undefined,
    })),
    origin: { label: first?.note ?? 'Draft created', at: first?.at ?? sub.createdAt, actorId: first?.actorId ?? sub.ownerId },
  }
}

export const submissionPath = (basePath: string, sub: Pick<Submission, 'id'>) => `${basePath}/${sub.id}`
