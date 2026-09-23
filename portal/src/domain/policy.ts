// Policy tables: response deadlines, sign-off chains and role labels.
// SLA values are the spec's proposed defaults and still need OAGF / OAuGF sign-off;
// they are expected to move into the Anomaly Engine admin as configuration.

import { addWorkingDays, workingDaysBetween } from './calendar'
import type { ChainStep, Flag, RoleId, Severity } from './types'

export const SEVERITY_RANK: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

export const SLA: Record<Severity, { ackDays: number; resolveDays: number }> = {
  Critical: { ackDays: 1, resolveDays: 5 },
  High: { ackDays: 2, resolveDays: 10 },
  Medium: { ackDays: 3, resolveDays: 15 },
  Low: { ackDays: 5, resolveDays: 30 },
}

export function deadlinesFor(severity: Severity, raisedAt: Date) {
  const { ackDays, resolveDays } = SLA[severity]
  return {
    ackDueAt: addWorkingDays(raisedAt, ackDays).toISOString(),
    resolveDueAt: addWorkingDays(raisedAt, resolveDays).toISOString(),
  }
}

/** Critical/High need the full statutory chain; Medium/Low stop at the DFA. */
export function chainFor(severity: Severity): ChainStep[] {
  return severity === 'Critical' || severity === 'High'
    ? ['prepare', 'review', 'check', 'attest']
    : ['prepare', 'review']
}

/** Roles allowed to act at a step. The final step of a chain is the attestation. */
export function rolesForStep(step: ChainStep, isFinal: boolean): RoleId[] {
  switch (step) {
    case 'prepare':
      return ['finance_officer', 'dfa']
    case 'review':
      // On a short (Medium/Low) chain the review step is also the attestation,
      // which the Accounting Officer may perform instead of the DFA.
      return isFinal ? ['dfa', 'accounting_officer'] : ['dfa']
    case 'check':
      return ['head_ia']
    case 'attest':
      return ['accounting_officer']
  }
}

export const STEP_LABEL: Record<ChainStep, string> = {
  prepare: 'Prepare',
  review: 'Review',
  check: 'Internal audit check',
  attest: 'Attest',
}

export const ROLE_LABEL: Record<RoleId, string> = {
  finance_officer: 'Finance Officer',
  dfa: 'Director of Finance & Accounts',
  head_ia: 'Head of Internal Audit',
  accounting_officer: 'Accounting Officer',
  auditor: 'Chief Auditor',
  treasury: 'Treasury Officer',
}

export const ROLE_TAG: Record<RoleId, string> = {
  finance_officer: 'FIN_OFFICER',
  dfa: 'DFA',
  head_ia: 'INTERNAL_AUDIT',
  accounting_officer: 'ACCOUNTING_OFFICER',
  auditor: 'AUDITOR',
  treasury: 'TREASURY',
}

/** Oversight-side roles see every MDA and never act inside an MDA's chain. */
export function isOversightRole(role: RoleId): boolean {
  return role === 'auditor' || role === 'treasury'
}

export function currentStep(flag: Pick<Flag, 'severity' | 'chain' | 'state'>): ChainStep | null {
  if (flag.state !== 'InChain') return null
  return chainFor(flag.severity)[flag.chain.length] ?? null
}

// ---- Deadline status -------------------------------------------------------

export type DeadlineStatus = 'ok' | 'soon' | 'over'

export interface Deadline {
  kind: 'ack' | 'resolve'
  due: string
  status: DeadlineStatus
  /** Working days remaining (negative when overdue). */
  days: number
}

export const SOON_WITHIN_WORKING_DAYS = 2

/** The deadline that currently matters for a flag, or null when closed. */
export function activeDeadline(flag: Flag, now: Date): Deadline | null {
  if (flag.state === 'Resolved') return null
  const kind = flag.state === 'Raised' ? 'ack' : 'resolve'
  const due = kind === 'ack' ? flag.ackDueAt : flag.resolveDueAt
  const dueDate = new Date(due)
  const days = workingDaysBetween(now, dueDate)
  const status: DeadlineStatus =
    now > dueDate ? 'over' : days <= SOON_WITHIN_WORKING_DAYS ? 'soon' : 'ok'
  return { kind, due, status, days }
}
