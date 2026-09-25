// Roles, permissions and data scope (FRD §3, BR-009, BR-010).
// Every action in the state machines checks `can()`; the UI uses the same table
// to decide what to show, so the two can never disagree.

import type { RoleId, User } from './types'

export const ROLE_LABEL: Record<RoleId, string> = {
  executive: 'Ministry Executive',
  oversight: 'Ministry Oversight Officer',
  mda_officer: 'MDA Finance Officer',
  mda_supervisor: 'MDA Supervisor',
  auditor: 'Auditor / Reviewer',
  admin: 'System Administrator',
}

export const ROLE_SCOPE: Record<RoleId, string> = {
  executive: 'State-wide',
  oversight: 'State-wide',
  mda_officer: 'Assigned MDA',
  mda_supervisor: 'Assigned MDA',
  auditor: 'Authorized scope (read-only)',
  admin: 'System',
}

export type Permission =
  | 'dashboard.view'
  | 'mda.view'
  | 'mda.manage'
  | 'return.view'
  | 'return.prepare'
  | 'return.approve' // MDA supervisor sign-off before it leaves the MDA
  | 'return.review' // oversight accept / return / close
  | 'flag.view'
  | 'flag.open' // publish a detected flag and assign the reviewer queue
  | 'flag.assign' // assign within the MDA
  | 'flag.respond'
  | 'flag.approveResponse'
  | 'flag.review'
  | 'flag.escalate'
  | 'flag.close'
  | 'flag.comment'
  | 'rec.view'
  | 'rec.manage'
  | 'rules.run'
  | 'audit.view'
  | 'report.view'
  | 'report.export'
  | 'admin.users'
  | 'admin.config'
  | 'admin.masterData'

const MATRIX: Record<RoleId, Permission[]> = {
  executive: ['dashboard.view', 'mda.view', 'return.view', 'flag.view', 'flag.escalate', 'flag.comment', 'rec.view', 'report.view', 'report.export'],
  oversight: [
    'dashboard.view',
    'mda.view',
    'return.view',
    'return.review',
    'flag.view',
    'flag.open',
    'flag.review',
    'flag.escalate',
    'flag.close',
    'flag.comment',
    'rec.view',
    'rec.manage',
    'rules.run',
    'audit.view',
    'report.view',
    'report.export',
  ],
  mda_officer: ['mda.view', 'return.view', 'return.prepare', 'flag.view', 'flag.respond', 'flag.comment', 'rec.view', 'report.view', 'report.export'],
  mda_supervisor: [
    'mda.view',
    'return.view',
    'return.prepare',
    'return.approve',
    'flag.view',
    'flag.assign',
    'flag.respond',
    'flag.approveResponse',
    'flag.comment',
    'rec.view',
    'report.view',
    'report.export',
  ],
  auditor: ['dashboard.view', 'mda.view', 'return.view', 'flag.view', 'rec.view', 'audit.view', 'report.view', 'report.export'],
  admin: ['mda.manage', 'audit.view', 'admin.users', 'admin.config', 'admin.masterData'],
}

export function can(user: Pick<User, 'role'> | null | undefined, permission: Permission): boolean {
  return !!user && MATRIX[user.role].includes(permission)
}

export function permissionsOf(role: RoleId): Permission[] {
  return MATRIX[role]
}

/** BR-010: MDA users access only their assigned MDA; state-wide roles see all. */
export function inScope(user: Pick<User, 'role' | 'mdaId'> | null | undefined, mdaId: string | null): boolean {
  if (!user) return false
  if (user.role === 'mda_officer' || user.role === 'mda_supervisor') return !!mdaId && user.mdaId === mdaId
  if (user.role === 'admin') return false
  return true
}

export const isMdaRole = (role: RoleId) => role === 'mda_officer' || role === 'mda_supervisor'
