// The flag case lifecycle, shared by the MDA portal and the oversight console.
//
//   Raised ──ACKNOWLEDGE──▶ Acknowledged ──ASSIGN──▶ Drafting ──SUBMIT──▶ InChain
//     │                                               ▲   ▲                │ APPROVE_STEP (×n)
//     └─ESCALATE(ack)─▶ Escalated ──ASSIGN/RESUME─────┘   └─RETURN─────────┤
//                          ▲                                               ▼
//                          └──────────REJECT──────────────────────── OversightReview
//   InfoRequested ◀─REQUEST_INFO─┘   Resolved ◀─ACCEPT─┘   Resolved ─REOPEN─▶ Reopened ─RESUME─▶ Drafting
//
// `transition` is pure: it returns a new Flag or an error explaining which rule
// blocked the action. Every guard here must also be enforced server-side.

import { approveStep } from './chain'
import { chainFor, currentStep, rolesForStep, STEP_LABEL } from './policy'
import { canSubmit, validateResponse } from './validation'
import type { Actor, Comment, Flag, FlagEvent, FlagState, HistoryEntry, ResponseDraft, User } from './types'

export type TransitionResult = { ok: true; flag: Flag } | { ok: false; error: string }

export interface TransitionContext {
  actor: Actor
  now: Date
  users: User[]
  newId?: () => string
}

let seq = 0
const defaultId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${++seq}`

export function emptyDraft(): ResponseDraft {
  return {
    type: null,
    answers: {},
    narrative: '',
    evidence: [],
    correctiveRef: '',
    extensionDate: '',
    justifications: {},
    step: 0,
    updatedAt: null,
    updatedBy: null,
  }
}

const OPEN_STATES: FlagState[] = [
  'Raised',
  'Acknowledged',
  'Drafting',
  'InChain',
  'OversightReview',
  'InfoRequested',
  'Escalated',
  'Reopened',
]

export function isOpen(flag: Pick<Flag, 'state'>): boolean {
  return OPEN_STATES.includes(flag.state)
}

const fail = (error: string): TransitionResult => ({ ok: false, error })

function isMdaUser(actor: Actor, flag: Flag): actor is User {
  return actor !== 'system' && actor.mdaId === flag.mdaId
}

function isAuditor(actor: Actor): actor is User {
  return actor !== 'system' && actor.role === 'auditor'
}

function hasRole(actor: Actor, roles: User['role'][]): boolean {
  return actor !== 'system' && roles.includes(actor.role)
}

export function transition(flag: Flag, event: FlagEvent, ctx: TransitionContext): TransitionResult {
  const { actor, now } = ctx
  const newId = ctx.newId ?? defaultId
  const at = now.toISOString()
  const actorId = actor === 'system' ? 'system' : actor.id

  const move = (to: FlagState, patch: Partial<Flag> = {}, note?: string, comment?: string): TransitionResult => {
    const entry: HistoryEntry = { id: newId(), at, actorId, event: event.type, from: flag.state, to, note }
    const comments: Comment[] = comment
      ? [
          ...flag.comments,
          { id: newId(), at, authorId: actorId, side: isAuditor(actor) ? 'oversight' : 'mda', body: comment },
        ]
      : flag.comments
    return { ok: true, flag: { ...flag, ...patch, state: to, history: [...flag.history, entry], comments } }
  }

  const requireComment = (c: string | undefined, min = 10): string | null =>
    c && c.trim().length >= min ? null : `Add a comment of at least ${min} characters explaining why.`

  switch (event.type) {
    case 'ACKNOWLEDGE': {
      if (flag.state !== 'Raised') return fail(`A flag can only be acknowledged while Raised (it is ${flag.state}).`)
      if (!isMdaUser(actor, flag) || !hasRole(actor, ['dfa', 'accounting_officer']))
        return fail('Only the DFA or the Accounting Officer of this MDA can acknowledge a flag.')
      return move('Acknowledged')
    }

    case 'ASSIGN': {
      if (!['Acknowledged', 'Escalated', 'Drafting'].includes(flag.state))
        return fail(`An owner can't be assigned while the flag is ${flag.state}.`)
      if (!isMdaUser(actor, flag) || !hasRole(actor, ['dfa', 'accounting_officer']))
        return fail('Only the DFA or the Accounting Officer can assign an owner.')
      const owner = ctx.users.find((u) => u.id === event.ownerId)
      if (!owner || owner.mdaId !== flag.mdaId || !['finance_officer', 'dfa'].includes(owner.role))
        return fail('The owner must be a Finance Officer or the DFA of this MDA.')
      const note = flag.ownerId && flag.ownerId !== owner.id ? `Reassigned to ${owner.name}` : `Assigned to ${owner.name}`
      return move('Drafting', { ownerId: owner.id }, note)
    }

    case 'SUBMIT': {
      if (flag.state !== 'Drafting') return fail('Only a response in Drafting can be submitted.')
      if (actor === 'system' || actor.id !== flag.ownerId) return fail('Only the assigned owner can submit this response.')
      if (!rolesForStep('prepare', false).includes(actor.role)) return fail('Your role cannot prepare responses.')
      const issues = validateResponse(flag, flag.draft)
      if (!canSubmit(issues)) return fail('The response has unresolved issues. Fix them before submitting.')
      const snapshot: ResponseDraft = { ...flag.draft, updatedAt: at, updatedBy: actor.id }
      return move('InChain', {
        submitted: snapshot,
        chain: [{ step: 'prepare', userId: actor.id, at }],
        returned: false,
        attestation: null,
      })
    }

    case 'APPROVE_STEP': {
      if (flag.state !== 'InChain') return fail('This response is not in the sign-off chain.')
      const step = currentStep(flag)
      const r = approveStep(chainFor(flag.severity), flag.chain, actor, flag.mdaId, at, event.attestation)
      if (!r.ok) return fail(r.error)
      if (!r.complete) return move('InChain', { chain: r.acts }, step ? STEP_LABEL[step] : undefined)
      return move('OversightReview', { chain: r.acts, attestation: r.attestation }, 'Attested and sent to oversight')
    }

    case 'RETURN': {
      if (flag.state !== 'InChain') return fail('Only a response in the sign-off chain can be returned.')
      const step = currentStep(flag)!
      const isFinal = flag.chain.length === chainFor(flag.severity).length - 1
      if (!isMdaUser(actor, flag) || !rolesForStep(step, isFinal).includes(actor.role))
        return fail('Only the officer at the current step can return this response.')
      const err = requireComment(event.comment)
      if (err) return fail(err)
      return move('Drafting', { chain: [], returned: true, draft: { ...flag.draft, step: 0 } }, `Returned at ${STEP_LABEL[step]}`, event.comment)
    }

    case 'ACCEPT': {
      if (flag.state !== 'OversightReview') return fail('Only a response under oversight review can be accepted.')
      if (!isAuditor(actor)) return fail('Only oversight can accept a response.')
      const sub = flag.submitted
      if (sub?.type === 'extension') {
        // Accepting an extension moves the deadline; the case goes back to drafting.
        const newDue = new Date(`${sub.extensionDate}T17:00:00`).toISOString()
        return move(
          'Drafting',
          {
            resolveDueAt: newDue,
            extensionUsed: true,
            chain: [],
            attestation: null,
            cycle: flag.cycle + 1,
            draft: { ...sub, type: null, step: 0, extensionDate: '' },
            escalations: flag.escalations.filter((e) => e !== 'resolve_overdue'),
          },
          'Extension granted',
          event.comment,
        )
      }
      return move('Resolved', {}, 'Response accepted', event.comment)
    }

    case 'REQUEST_INFO': {
      if (flag.state !== 'OversightReview') return fail('More information can only be requested during oversight review.')
      if (!isAuditor(actor)) return fail('Only oversight can request more information.')
      const err = requireComment(event.comment)
      if (err) return fail(err)
      return move('InfoRequested', {}, undefined, event.comment)
    }

    case 'REJECT': {
      if (flag.state !== 'OversightReview') return fail('Only a response under oversight review can be rejected.')
      if (!isAuditor(actor)) return fail('Only oversight can reject a response.')
      const err = requireComment(event.comment)
      if (err) return fail(err)
      return move('Escalated', { escalations: [...flag.escalations, 'rejected'] }, 'Rejected by oversight', event.comment)
    }

    case 'RESUME': {
      if (!['InfoRequested', 'Reopened', 'Escalated'].includes(flag.state))
        return fail(`Drafting can't be resumed from ${flag.state}.`)
      if (!flag.ownerId) return fail('Assign an owner first.')
      const allowed = isMdaUser(actor, flag) && (actor.id === flag.ownerId || hasRole(actor, ['dfa', 'accounting_officer']))
      if (!allowed) return fail('Only the owner, the DFA or the Accounting Officer can restart drafting.')
      // Start the new cycle from what was last submitted, so nothing is retyped.
      const base = flag.submitted ?? flag.draft
      return move('Drafting', {
        chain: [],
        attestation: null,
        cycle: flag.cycle + 1,
        draft: { ...base, step: 0 },
      })
    }

    case 'REOPEN': {
      if (flag.state !== 'Resolved') return fail('Only a resolved flag can be reopened.')
      if (!isAuditor(actor)) return fail('Only oversight can reopen a flag.')
      const err = requireComment(event.comment)
      if (err) return fail(err)
      return move('Reopened', {}, undefined, event.comment)
    }

    case 'ESCALATE': {
      if (actor !== 'system') return fail('Deadline escalation is raised by the system.')
      if (flag.escalations.includes(event.reason)) return fail('Already escalated for this reason.')
      const valid = (event.reason === 'ack_overdue' && flag.state === 'Raised') || (event.reason === 'resolve_overdue' && flag.state === 'Drafting')
      if (!valid) return fail(`Can't escalate for ${event.reason} while ${flag.state}.`)
      const note = event.reason === 'ack_overdue' ? 'Not acknowledged in time' : 'Resolution deadline passed'
      return move('Escalated', { escalations: [...flag.escalations, event.reason] }, note)
    }
  }
}

/** Apply deadline escalations due at `now`. Returns only the flags that changed. */
export function sweepDeadlines(flags: Flag[], now: Date, users: User[] = []): Flag[] {
  const changed: Flag[] = []
  for (const f of flags) {
    const reason =
      f.state === 'Raised' && now > new Date(f.ackDueAt)
        ? 'ack_overdue'
        : f.state === 'Drafting' && now > new Date(f.resolveDueAt)
          ? 'resolve_overdue'
          : null
    if (!reason || f.escalations.includes(reason)) continue
    const r = transition(f, { type: 'ESCALATE', reason }, { actor: 'system', now, users })
    if (r.ok) changed.push(r.flag)
  }
  return changed
}
