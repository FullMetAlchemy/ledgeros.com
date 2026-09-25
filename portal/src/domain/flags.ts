// Compliance flag workflow (FRD §4.7, §8):
//   Detected → Open → Assigned → MDA Response → Under Review → Resolved / Rejected / Escalated → Closed
//
// - Oversight opens a detected flag (setting the reviewer and response deadline).
// - The MDA Supervisor assigns it to an officer; the officer drafts the response.
// - An officer's response goes to the Supervisor (MDA Response) for sign-off;
//   a Supervisor's own response goes straight to Under Review.
// - The oversight reviewer accepts (Resolved), rejects, returns (Assigned) or escalates.
// - Escalation is also allowed once the response deadline passes (FR-FLAG-007).
// - Only oversight can close (FR-FLAG-006, BR-009).

import { addWorkingDays } from './calendar'
import { fail, ok, type AuditDraft, type Result } from './audit'
import type { Dataset } from './dataset'
import { can, inScope } from './roles'
import { RULE_LABEL } from './rules'
import type { EvidenceFile, Flag, FlagStatus, User } from './types'

export type FlagAction =
  | { type: 'OPEN'; reviewerId: string; note?: string }
  | { type: 'ASSIGN'; assigneeId: string }
  | { type: 'SAVE_DRAFT'; explanation?: string; correctiveAction?: string; evidence?: EvidenceFile[] }
  | { type: 'SUBMIT_RESPONSE' }
  | { type: 'APPROVE_RESPONSE'; note: string }
  | { type: 'RETURN_RESPONSE'; note: string }
  | { type: 'REVIEW'; outcome: 'accept' | 'reject' | 'return' | 'escalate'; note: string }
  | { type: 'ESCALATE'; note: string }
  | { type: 'CLOSE'; note: string }
  | { type: 'COMMENT'; body: string }

export const MIN_EXPLANATION = 40
export const MIN_NOTE = 10

export const isOverdue = (f: Pick<Flag, 'dueAt' | 'status'>, now: Date) =>
  !!f.dueAt && now > new Date(f.dueAt) && (f.status === 'Open' || f.status === 'Assigned' || f.status === 'MDA Response')

/** The step the flag is waiting on, for "needs you" lists. */
export function flagNextStep(f: Flag): string {
  switch (f.status) {
    case 'Detected':
      return 'Oversight to open and assign a reviewer'
    case 'Open':
      return 'MDA Supervisor to assign an officer'
    case 'Assigned':
      return 'MDA to prepare a response'
    case 'MDA Response':
      return 'MDA Supervisor to approve the response'
    case 'Under Review':
      return 'Oversight reviewer to decide'
    case 'Escalated':
      return 'Oversight to decide the escalated flag'
    case 'Resolved':
    case 'Rejected':
      return 'Oversight to close'
    case 'Closed':
      return 'Closed'
  }
}

/** Can this user take the flag's next step? */
export function flagNeedsUser(f: Flag, u: User, now: Date): boolean {
  if (!inScope(u, f.mdaId)) return false
  switch (f.status) {
    case 'Detected':
      return can(u, 'flag.open')
    case 'Open':
      return can(u, 'flag.assign') && u.mdaId === f.mdaId
    case 'Assigned':
      return can(u, 'flag.respond') && (f.assigneeId === u.id || (u.role === 'mda_supervisor' && u.mdaId === f.mdaId && !f.assigneeId))
    case 'MDA Response':
      return can(u, 'flag.approveResponse') && u.mdaId === f.mdaId && f.responses.at(-1)?.submittedBy !== u.id
    case 'Under Review':
    case 'Escalated':
      return can(u, 'flag.review') && (!f.reviewerId || f.reviewerId === u.id)
    case 'Resolved':
    case 'Rejected':
      return can(u, 'flag.close') && (!f.reviewerId || f.reviewerId === u.id)
    default:
      return isOverdue(f, now) && can(u, 'flag.escalate')
  }
}

export function transitionFlag(ds: Dataset, flag: Flag, action: FlagAction, actor: User, now: Date): Result<Flag> {
  const at = now.toISOString()
  if (!inScope(actor, flag.mdaId)) return fail('This flag is outside your data scope.')

  const move = (to: FlagStatus, patch: Partial<Flag>, action: string, summary: string, note?: string): Result<Flag> => {
    const next: Flag = {
      ...flag,
      ...patch,
      status: to,
      history: [...flag.history, { id: `${flag.id}-h${flag.history.length + 1}`, at, actorId: actor.id, from: flag.status, to, note }],
    }
    const ev: AuditDraft = {
      action,
      entityType: 'Flag',
      entityId: flag.id,
      mdaId: flag.mdaId,
      summary,
      before: { status: flag.status },
      after: { status: to, ...(note ? { note } : {}) },
    }
    return ok(next, [ev])
  }
  const need = (perm: Parameters<typeof can>[1], message: string) => (can(actor, perm) ? null : message)
  const noteErr = (n: string | undefined) => (n && n.trim().length >= MIN_NOTE ? null : `Give a reason of at least ${MIN_NOTE} characters for the record.`)

  switch (action.type) {
    case 'OPEN': {
      const err = need('flag.open', 'Only a Ministry Oversight Officer can open a flag.')
      if (err) return fail(err)
      if (flag.status !== 'Detected') return fail(`Only a detected flag can be opened (this one is ${flag.status}).`)
      const reviewer = ds.users.find((u) => u.id === action.reviewerId)
      if (!reviewer || !can(reviewer, 'flag.review') || reviewer.status !== 'Active') return fail('Choose an active oversight reviewer.')
      const due = addWorkingDays(now, ds.ruleConfig.responseSlaDays[flag.severity]).toISOString()
      return move('Open', { reviewerId: reviewer.id, dueAt: due }, 'FLAG_OPENED', `Opened; reviewer ${reviewer.name}; MDA response due ${due.slice(0, 10)}`, action.note)
    }

    case 'ASSIGN': {
      const err = need('flag.assign', 'Only the MDA Supervisor can assign a flag to an officer.')
      if (err) return fail(err)
      if (flag.status !== 'Open' && flag.status !== 'Assigned') return fail(`A flag can't be assigned while ${flag.status}.`)
      const assignee = ds.users.find((u) => u.id === action.assigneeId)
      if (!assignee || assignee.mdaId !== flag.mdaId || !can(assignee, 'flag.respond') || assignee.status !== 'Active')
        return fail('The assignee must be an active officer of this MDA.')
      return move('Assigned', { assigneeId: assignee.id }, 'FLAG_ASSIGNED', `Assigned to ${assignee.name}`)
    }

    case 'SAVE_DRAFT': {
      if (flag.status !== 'Assigned') return fail('The response can only be edited while the flag is assigned to the MDA.')
      if (!can(actor, 'flag.respond') || actor.mdaId !== flag.mdaId) return fail('Only officers of this MDA can prepare the response.')
      const draft = {
        explanation: action.explanation ?? flag.draft.explanation,
        correctiveAction: action.correctiveAction ?? flag.draft.correctiveAction,
        evidence: action.evidence ?? flag.draft.evidence,
      }
      return ok({ ...flag, draft })
    }

    case 'SUBMIT_RESPONSE': {
      if (flag.status !== 'Assigned') return fail('Only an assigned flag can receive a response.')
      if (!can(actor, 'flag.respond') || actor.mdaId !== flag.mdaId) return fail('Only officers of this MDA can respond.')
      if (actor.role === 'mda_officer' && flag.assigneeId !== actor.id) return fail('This flag is assigned to another officer.')
      if (flag.draft.explanation.trim().length < MIN_EXPLANATION)
        return fail(`Write an explanation of at least ${MIN_EXPLANATION} characters.`)
      if (!flag.draft.evidence.length) return fail('Attach at least one supporting document.')
      const supervisor = actor.role === 'mda_supervisor'
      const response = {
        id: `${flag.id}-r${flag.responses.length + 1}`,
        explanation: flag.draft.explanation.trim(),
        correctiveAction: flag.draft.correctiveAction.trim(),
        evidence: flag.draft.evidence,
        submittedBy: actor.id,
        submittedAt: at,
        supervisorDecision: supervisor ? { by: actor.id, at, approved: true, note: 'Submitted by the MDA Supervisor' } : null,
        review: null,
      }
      return move(
        supervisor ? 'Under Review' : 'MDA Response',
        { responses: [...flag.responses, response], draft: { explanation: '', correctiveAction: '', evidence: [] } },
        'FLAG_RESPONSE_SUBMITTED',
        supervisor ? 'Response submitted by the MDA Supervisor for oversight review' : 'Response submitted for MDA Supervisor approval',
      )
    }

    case 'APPROVE_RESPONSE':
    case 'RETURN_RESPONSE': {
      if (flag.status !== 'MDA Response') return fail('There is no response awaiting the Supervisor.')
      if (!can(actor, 'flag.approveResponse') || actor.mdaId !== flag.mdaId) return fail('Only the MDA Supervisor can approve or return the response.')
      const latest = flag.responses.at(-1)!
      if (latest.submittedBy === actor.id) return fail('You submitted this response, so another supervisor must approve it.')
      const approve = action.type === 'APPROVE_RESPONSE'
      if (!approve) {
        const err = noteErr(action.note)
        if (err) return fail(err)
      }
      const responses = flag.responses.map((r, i) =>
        i === flag.responses.length - 1 ? { ...r, supervisorDecision: { by: actor.id, at, approved: approve, note: action.note } } : r,
      )
      // A returned response goes back to the draft so the officer can revise it.
      const draft = approve ? flag.draft : { explanation: latest.explanation, correctiveAction: latest.correctiveAction, evidence: latest.evidence }
      return approve
        ? move('Under Review', { responses }, 'FLAG_RESPONSE_APPROVED', 'Response approved by the MDA Supervisor and sent for oversight review', action.note)
        : move('Assigned', { responses, draft }, 'FLAG_RESPONSE_RETURNED', 'Response returned to the officer by the MDA Supervisor', action.note)
    }

    case 'REVIEW': {
      const err = need('flag.review', 'Only a Ministry Oversight Officer can review responses.')
      if (err) return fail(err)
      if (flag.status !== 'Under Review' && flag.status !== 'Escalated') return fail('There is no response under review.')
      if (flag.status === 'Escalated' && action.outcome === 'escalate') return fail('The flag is already escalated.')
      const nErr = noteErr(action.note)
      if (nErr) return fail(nErr)
      const responses = flag.responses.map((r, i) =>
        i === flag.responses.length - 1 && !r.review ? { ...r, review: { by: actor.id, at, outcome: action.outcome, note: action.note } } : r,
      )
      const latest = flag.responses.at(-1)
      switch (action.outcome) {
        case 'accept':
          return move('Resolved', { responses }, 'FLAG_RESOLVED', 'Response accepted; flag resolved', action.note)
        case 'reject':
          return move('Rejected', { responses }, 'FLAG_REJECTED', 'Response rejected; the exception stands', action.note)
        case 'return': {
          const draft = latest ? { explanation: latest.explanation, correctiveAction: latest.correctiveAction, evidence: latest.evidence } : flag.draft
          return move('Assigned', { responses, draft }, 'FLAG_RETURNED', 'Returned to the MDA for more information', action.note)
        }
        case 'escalate':
          return move('Escalated', { responses }, 'FLAG_ESCALATED', 'Escalated by the reviewer', action.note)
      }
      break
    }

    case 'ESCALATE': {
      const err = need('flag.escalate', 'Your role cannot escalate flags.')
      if (err) return fail(err)
      if (!isOverdue(flag, now)) return fail('A flag can be escalated once its response deadline has passed without a response.')
      const nErr = noteErr(action.note)
      if (nErr) return fail(nErr)
      return move('Escalated', {}, 'FLAG_ESCALATED', 'Escalated: MDA response deadline passed', action.note)
    }

    case 'CLOSE': {
      const err = need('flag.close', 'Only a Ministry Oversight Officer can close flags (BR-009).')
      if (err) return fail(err)
      if (flag.status !== 'Resolved' && flag.status !== 'Rejected') return fail('Only a resolved or rejected flag can be closed.')
      const nErr = noteErr(action.note)
      if (nErr) return fail(nErr)
      return move('Closed', { closedOutcome: flag.status }, 'FLAG_CLOSED', `Closed as ${flag.status}`, action.note)
    }

    case 'COMMENT': {
      if (!can(actor, 'flag.comment')) return fail('Your role cannot comment on flags.')
      const body = action.body.trim()
      if (!body) return fail('Write a message first.')
      return ok({ ...flag, comments: [...flag.comments, { id: `${flag.id}-c${flag.comments.length + 1}`, at, authorId: actor.id, body }] }, [
        { action: 'FLAG_COMMENTED', entityType: 'Flag', entityId: flag.id, mdaId: flag.mdaId, summary: `Comment added to ${RULE_LABEL[flag.ruleId]} flag` },
      ])
    }
  }
  return fail('Unknown action.')
}
