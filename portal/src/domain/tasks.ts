// "Needs you": the actions a given user can take right now, derived from flag
// state and role. Drives My Tasks, Compliance Home and the nav badge.

import { activeDeadline, chainFor, currentStep, rolesForStep, SEVERITY_RANK, STEP_LABEL } from './policy'
import type { Flag, User } from './types'

export type TaskKind = 'acknowledge' | 'assign' | 'draft' | 'revise' | 'signoff' | 'restart' | 'oversight'

export interface Task {
  flag: Flag
  kind: TaskKind
  action: string
}

const LEADS: User['role'][] = ['dfa', 'accounting_officer']

export function taskFor(flag: Flag, user: User): Task | null {
  if (user.role === 'auditor') {
    return flag.state === 'OversightReview' ? { flag, kind: 'oversight', action: 'Review response' } : null
  }
  if (user.mdaId !== flag.mdaId) return null
  const lead = LEADS.includes(user.role)
  const owner = flag.ownerId === user.id

  switch (flag.state) {
    case 'Raised':
      return lead ? { flag, kind: 'acknowledge', action: 'Acknowledge and assign' } : null
    case 'Acknowledged':
      return lead ? { flag, kind: 'assign', action: 'Assign an owner' } : null
    case 'Escalated':
      if (!flag.ownerId) return lead ? { flag, kind: 'assign', action: 'Assign an owner (escalated)' } : null
      return lead || owner ? { flag, kind: 'restart', action: 'Restart drafting (escalated)' } : null
    case 'Drafting':
      if (!owner) return null
      return flag.returned
        ? { flag, kind: 'revise', action: 'Revise returned response' }
        : { flag, kind: 'draft', action: 'Draft response' }
    case 'InChain': {
      const step = currentStep(flag)
      if (!step) return null
      const isFinal = flag.chain.length === chainFor(flag.severity).length - 1
      if (!rolesForStep(step, isFinal).includes(user.role)) return null
      if (flag.chain.some((a) => a.userId === user.id)) return null
      return { flag, kind: 'signoff', action: isFinal ? 'Attest response' : STEP_LABEL[step] }
    }
    case 'InfoRequested':
      return owner || lead ? { flag, kind: 'restart', action: 'Provide more information' } : null
    case 'Reopened':
      return (owner || lead) && flag.ownerId ? { flag, kind: 'restart', action: 'Restart drafting (reopened)' } : null
    default:
      return null
  }
}

/** Sorted by deadline, then severity: what is due soonest and most serious first. */
export function tasksFor(flags: Flag[], user: User, now = new Date()): Task[] {
  const due = (f: Flag) => {
    const d = activeDeadline(f, now)
    return d ? new Date(d.due).getTime() : Number.POSITIVE_INFINITY
  }
  return flags
    .map((f) => taskFor(f, user))
    .filter((t): t is Task => t !== null)
    .sort((a, b) => due(a.flag) - due(b.flag) || SEVERITY_RANK[a.flag.severity] - SEVERITY_RANK[b.flag.severity])
}
