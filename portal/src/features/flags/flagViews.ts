import { chainFor } from '../../domain/policy'
import type { Flag, HistoryEntry } from '../../domain/types'
import type { RailPhase } from '../../workflow/SignOffRail'
import type { TimelineEntry } from '../../workflow/StatusHistory'

const EVENT_LABEL: Record<HistoryEntry['event'], string> = {
  ACKNOWLEDGE: 'Acknowledged',
  ASSIGN: 'Owner assigned',
  SUBMIT: 'Response submitted to sign-off',
  APPROVE_STEP: 'Step approved',
  RETURN: 'Returned for changes',
  ACCEPT: 'Accepted by oversight',
  REQUEST_INFO: 'More information requested',
  REJECT: 'Rejected by oversight',
  RESUME: 'Drafting restarted',
  REOPEN: 'Reopened by oversight',
  ESCALATE: 'Escalated',
}

const PHASE: Partial<Record<Flag['state'], RailPhase>> = {
  Drafting: 'drafting',
  InChain: 'chain',
  OversightReview: 'external',
  Resolved: 'done',
}

export function flagRail(flag: Flag) {
  return {
    steps: chainFor(flag.severity),
    acts: flag.chain,
    phase: PHASE[flag.state] ?? 'idle',
    ownerId: flag.ownerId,
    attestedAt: flag.attestation?.at,
  }
}

export function flagTimeline(flag: Flag): { entries: TimelineEntry[]; origin: { label: string; at: string } } {
  return {
    entries: flag.history.map((h) => ({
      id: h.id,
      at: h.at,
      actorId: h.actorId,
      label: EVENT_LABEL[h.event],
      note: h.note,
      tone: h.event === 'ESCALATE' || h.event === 'REJECT' ? 'bad' : h.event === 'ACCEPT' ? 'good' : undefined,
    })),
    origin: { label: 'Raised by the Anomaly Engine', at: flag.raisedAt },
  }
}
