// Sign-off chain rules shared by flag responses and submissions: who may act at
// each step, segregation of duties, and what the final (attesting) step needs.

import { ROLE_LABEL, rolesForStep, STEP_LABEL } from './policy'
import type { Actor, Attestation, ChainAct, ChainStep, User } from './types'

export interface ChainCursor {
  step: ChainStep
  index: number
  isFinal: boolean
  roles: User['role'][]
}

/** The step waiting to be taken, or null when the chain is complete. */
export function chainCursor(steps: ChainStep[], acts: ChainAct[]): ChainCursor | null {
  const index = acts.length
  const step = steps[index]
  if (!step) return null
  const isFinal = index === steps.length - 1
  return { step, index, isFinal, roles: rolesForStep(step, isFinal) }
}

export type ApproveResult =
  | { ok: true; acts: ChainAct[]; complete: boolean; attestation: Attestation | null }
  | { ok: false; error: string }

/**
 * Validate and apply one approval. `mdaId` is the MDA that owns the record;
 * only its officers can act in its chain.
 */
export function approveStep(
  steps: ChainStep[],
  acts: ChainAct[],
  actor: Actor,
  mdaId: string,
  at: string,
  attestation?: { declaration: string; keyVerified: boolean },
): ApproveResult {
  const cur = chainCursor(steps, acts)
  if (!cur) return { ok: false, error: 'The sign-off chain is already complete.' }
  if (actor === 'system' || actor.mdaId !== mdaId || !cur.roles.includes(actor.role))
    return { ok: false, error: `${STEP_LABEL[cur.step]} must be done by: ${cur.roles.map((r) => ROLE_LABEL[r]).join(' or ')}.` }
  if (acts.some((a) => a.userId === actor.id))
    return { ok: false, error: 'Segregation of duties: you have already acted on this, so another officer must take this step.' }
  const next = [...acts, { step: cur.step, userId: actor.id, at }]
  if (!cur.isFinal) return { ok: true, acts: next, complete: false, attestation: null }
  if (!attestation || !attestation.declaration.trim() || !attestation.keyVerified)
    return { ok: false, error: 'Attestation needs the signed declaration and a verified security key.' }
  return {
    ok: true,
    acts: next,
    complete: true,
    attestation: { userId: actor.id, at, declaration: attestation.declaration, keyVerified: true },
  }
}

/** Whether `user` is the officer the chain is waiting on (and hasn't already acted). */
export function isMyStep(steps: ChainStep[], acts: ChainAct[], user: User, mdaId: string): boolean {
  const cur = chainCursor(steps, acts)
  return !!cur && user.mdaId === mdaId && cur.roles.includes(user.role) && !acts.some((a) => a.userId === user.id)
}
