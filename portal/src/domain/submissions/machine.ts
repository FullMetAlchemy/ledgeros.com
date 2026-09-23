// Submission lifecycle, shared by the MDA portal and the oversight/Treasury consoles.
//
//   Draft ──SUBMIT──▶ InChain ──APPROVE_STEP×n (final = attest)──▶ UnderReview ──ACCEPT──▶ Accepted
//     ▲                  │                                              │
//     └──────RETURN──────┘                                              └──QUERY──▶ Queried ──REVISE──▶ Draft
//
// Pure: returns a new Submission or an error naming the rule that blocked it.

import { approveStep, chainCursor } from '../chain'
import { isOversightRole, STEP_LABEL } from '../policy'
import { canSubmit } from '../validation'
import type { Actor, Comment, User } from '../types'
import { DEFS } from './defs'
import type { Submission, SubmissionEvent, SubmissionHistoryEntry, SubmissionState } from './types'
import { validateSubmission, type CheckContext } from './validation'

export type SubmissionResult = { ok: true; submission: Submission } | { ok: false; error: string }

export interface SubmissionContext extends CheckContext {
  actor: Actor
  users: User[]
  newId?: () => string
}

let seq = 0
const defaultId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sid-${Date.now()}-${++seq}`

const fail = (error: string): SubmissionResult => ({ ok: false, error })

export function isOpenSubmission(s: Pick<Submission, 'state'>): boolean {
  return s.state !== 'Accepted'
}

/** MDA clock is running while the submission is in the MDA's hands. */
export function isWithMda(s: Pick<Submission, 'state'>): boolean {
  return s.state === 'Draft' || s.state === 'InChain' || s.state === 'Queried'
}

export function transitionSubmission(sub: Submission, event: SubmissionEvent, ctx: SubmissionContext): SubmissionResult {
  const { actor, now } = ctx
  const newId = ctx.newId ?? defaultId
  const at = now.toISOString()
  const actorId = actor === 'system' ? 'system' : actor.id
  const def = DEFS[sub.kind]
  const inMda = actor !== 'system' && actor.mdaId === sub.mdaId
  const lead = inMda && (actor.role === 'dfa' || actor.role === 'accounting_officer')
  const isReviewer = actor !== 'system' && actor.role === def.reviewer

  const move = (to: SubmissionState, patch: Partial<Submission> = {}, note?: string, comment?: string): SubmissionResult => {
    const entry: SubmissionHistoryEntry = { id: newId(), at, actorId, event: event.type, from: sub.state, to, note }
    const comments: Comment[] = comment
      ? [
          ...sub.comments,
          {
            id: newId(),
            at,
            authorId: actorId,
            side: actor !== 'system' && isOversightRole(actor.role) ? 'oversight' : 'mda',
            body: comment,
          },
        ]
      : sub.comments
    return { ok: true, submission: { ...sub, ...patch, state: to, history: [...sub.history, entry], comments } }
  }
  const needComment = (c: string | undefined) => (c && c.trim().length >= 10 ? null : 'Add a comment of at least 10 characters explaining why.')

  switch (event.type) {
    case 'SUBMIT': {
      if (sub.state !== 'Draft') return fail('Only a draft can be submitted.')
      if (actor === 'system' || actor.id !== sub.ownerId) return fail('Only the preparer can submit this.')
      if (!def.preparers.includes(actor.role)) return fail('Your role cannot prepare this kind of submission.')
      const content = { data: sub.data, evidence: sub.evidence, justifications: sub.justifications }
      if (!canSubmit(validateSubmission(content, ctx))) return fail('The submission has unresolved issues. Fix them before submitting.')
      return move('InChain', {
        submitted: content,
        chain: [{ step: 'prepare', userId: actor.id, at }],
        returned: false,
        attestation: null,
        updatedAt: at,
        updatedBy: actor.id,
      })
    }

    case 'APPROVE_STEP': {
      if (sub.state !== 'InChain') return fail('This submission is not in the sign-off chain.')
      const cur = chainCursor(def.chain, sub.chain)
      const r = approveStep(def.chain, sub.chain, actor, sub.mdaId, at, event.attestation)
      if (!r.ok) return fail(r.error)
      if (!r.complete) return move('InChain', { chain: r.acts }, cur ? STEP_LABEL[cur.step] : undefined)
      return move('UnderReview', { chain: r.acts, attestation: r.attestation }, `Attested and sent for ${def.reviewer === 'treasury' ? 'Treasury decision' : 'oversight review'}`)
    }

    case 'RETURN': {
      if (sub.state !== 'InChain') return fail('Only a submission in the sign-off chain can be returned.')
      const cur = chainCursor(def.chain, sub.chain)
      if (!cur || !inMda || !cur.roles.includes((actor as User).role)) return fail('Only the officer at the current step can return this.')
      const err = needComment(event.comment)
      if (err) return fail(err)
      return move('Draft', { chain: [], returned: true, step: 0 }, `Returned at ${STEP_LABEL[cur.step]}`, event.comment)
    }

    case 'ACCEPT': {
      if (sub.state !== 'UnderReview') return fail('Only a submission under review can be accepted.')
      if (!isReviewer) return fail(`Only the ${def.reviewer === 'treasury' ? 'Treasury Officer' : 'Chief Auditor'} can decide this.`)
      return move('Accepted', {}, def.reviewer === 'treasury' ? 'Release approved' : 'Accepted', event.comment)
    }

    case 'QUERY': {
      if (sub.state !== 'UnderReview') return fail('Only a submission under review can be queried.')
      if (!isReviewer) return fail(`Only the ${def.reviewer === 'treasury' ? 'Treasury Officer' : 'Chief Auditor'} can query this.`)
      const err = needComment(event.comment)
      if (err) return fail(err)
      return move('Queried', {}, undefined, event.comment)
    }

    case 'REVISE': {
      if (sub.state !== 'Queried') return fail('Only a queried submission can be revised.')
      if (!(inMda && (actor as User).id === sub.ownerId) && !lead) return fail('Only the preparer, the DFA or the Accounting Officer can start a revision.')
      // Start from what was submitted so nothing is retyped.
      const base = sub.submitted ?? { data: sub.data, evidence: sub.evidence, justifications: sub.justifications }
      return move('Draft', { ...base, chain: [], attestation: null, cycle: sub.cycle + 1, step: 0, returned: false })
    }
  }
}
