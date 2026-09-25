// Authentication and administration (FRD §4.1, §4.10, US-013).
// Prototype authentication: every seeded account shares one demo password and
// MFA codes are shown on screen by a simulated authenticator. Production uses
// the government identity provider (FRD §13).

import { fail, ok, type AuditDraft, type Result } from './audit'
import type { Dataset } from './dataset'
import { can, ROLE_LABEL } from './roles'
import type { FinancialPeriod, Mda, RoleId, RuleConfig, SecurityConfig, User, UserStatus } from './types'

export const DEMO_PASSWORD = 'Demo#2026'
export const INVALID_LOGIN = 'Email or password is incorrect.'

export interface LoginOutcome {
  user: User
  mfaRequired: boolean
}

/** FR-AUTH-001/005: never reveal whether an email exists; block inactive accounts. */
export function login(ds: Dataset, email: string, password: string): Result<LoginOutcome> {
  const user = ds.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || password !== DEMO_PASSWORD) {
    return { ok: false, error: INVALID_LOGIN }
  }
  if (user.status === 'Pending') return fail('This account has not been activated yet. Contact your system administrator.')
  if (user.status !== 'Active') return fail('This account cannot sign in. Contact your system administrator.')
  return ok({ user, mfaRequired: ds.securityConfig.mfaRoles.includes(user.role) })
}

export const loginFailedEvent = (email: string): AuditDraft => ({
  action: 'LOGIN_FAILED',
  entityType: 'Session',
  entityId: 'auth',
  mdaId: null,
  summary: `Failed sign-in for ${maskEmail(email)}`,
  source: 'Prototype auth',
  actorId: 'system',
})

export const sessionEvent = (user: User, action: 'LOGIN' | 'MFA_VERIFIED' | 'LOGOUT' | 'SESSION_EXPIRED', detail = ''): AuditDraft => ({
  action,
  entityType: 'Session',
  entityId: user.id,
  mdaId: user.mdaId,
  summary: `${ROLE_LABEL[user.role]} ${user.name}: ${action.toLowerCase().replace('_', ' ')}${detail ? ` (${detail})` : ''}`,
  source: 'Prototype auth',
  actorId: user.id,
})

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return '***'
  return `${name.slice(0, 2)}***@${domain}`
}

export function newMfaCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ---- Users (FR-ADM-001..003) ----------------------------------------------------------

const USER_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  Pending: ['Active', 'Disabled'],
  Active: ['Suspended', 'Disabled'],
  Suspended: ['Active', 'Disabled'],
  Disabled: [],
}

export const allowedUserStatuses = (from: UserStatus) => USER_TRANSITIONS[from]

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function createUser(
  ds: Dataset,
  actor: User,
  input: { name: string; email: string; title: string; role: RoleId; mdaId: string | null },
  now: Date,
): Result<User> {
  if (!can(actor, 'admin.users')) return fail('Only a System Administrator can manage users.')
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (name.length < 3) return fail('Enter the person’s full name.')
  if (!/^[^@\s]+@[^@\s]+\.gov\.ng$/.test(email)) return fail('Use an official .gov.ng email address.')
  if (ds.users.some((u) => u.email.toLowerCase() === email)) return fail('A user with this email already exists.')
  const mdaRole = input.role === 'mda_officer' || input.role === 'mda_supervisor'
  if (mdaRole && !input.mdaId) return fail('MDA roles need an assigned MDA.')
  const n = ds.counters.user + 1
  const user: User = {
    id: `U-${String(n).padStart(3, '0')}`,
    name,
    initials: initials(name),
    email,
    role: input.role,
    mdaId: mdaRole ? input.mdaId : null,
    title: input.title.trim() || ROLE_LABEL[input.role],
    status: 'Pending',
    createdAt: now.toISOString(),
    lastLoginAt: null,
  }
  return ok(user, [
    {
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      mdaId: user.mdaId,
      summary: `Created ${name} as ${ROLE_LABEL[user.role]} (Pending)`,
      after: { role: user.role, mdaId: user.mdaId, status: 'Pending' },
    },
  ])
}

export function changeUser(
  ds: Dataset,
  actor: User,
  target: User,
  change: { status?: UserStatus; role?: RoleId; mdaId?: string | null },
  reason: string,
): Result<User> {
  if (!can(actor, 'admin.users')) return fail('Only a System Administrator can manage users.')
  if (target.id === actor.id && (change.status || change.role)) return fail('You cannot change your own status or role.')
  if (reason.trim().length < 10) return fail('Give a reason of at least 10 characters. Privileged changes are audited.')
  if (change.status && change.status !== target.status && !USER_TRANSITIONS[target.status].includes(change.status))
    return fail(`A ${target.status.toLowerCase()} account can't become ${change.status.toLowerCase()}.`)
  const role = change.role ?? target.role
  const mdaRole = role === 'mda_officer' || role === 'mda_supervisor'
  const mdaId = mdaRole ? (change.mdaId !== undefined ? change.mdaId : target.mdaId) : null
  if (mdaRole && !mdaId) return fail('MDA roles need an assigned MDA.')
  if (mdaId && !ds.mdas.some((m) => m.id === mdaId)) return fail('Unknown MDA.')
  const next: User = { ...target, status: change.status ?? target.status, role, mdaId }
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const k of ['status', 'role', 'mdaId'] as const) {
    if (next[k] !== target[k]) {
      before[k] = target[k]
      after[k] = next[k]
    }
  }
  if (!Object.keys(after).length) return fail('Nothing changed.')
  const action = after.status ? `USER_${String(after.status).toUpperCase()}` : after.role ? 'USER_ROLE_CHANGED' : 'USER_SCOPE_CHANGED'
  return ok(next, [{ action, entityType: 'User', entityId: target.id, mdaId: next.mdaId, summary: `${target.name}: ${describe(after)}. Reason: ${reason.trim()}`, before, after }])
}

function describe(after: Record<string, unknown>): string {
  return Object.entries(after)
    .map(([k, v]) => `${k} → ${k === 'role' ? ROLE_LABEL[v as RoleId] : (v ?? 'none')}`)
    .join(', ')
}

// ---- Configuration and master data (FR-ADM-004/005) ------------------------------------

export function changeRuleConfig(actor: User, before: RuleConfig, after: RuleConfig, reason: string): Result<RuleConfig> {
  if (!can(actor, 'admin.config')) return fail('Only a System Administrator can change thresholds.')
  if (reason.trim().length < 10) return fail('Give a reason of at least 10 characters. Threshold changes are audited.')
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  diff(before, after, '', b, a)
  if (!Object.keys(a).length) return fail('Nothing changed.')
  return ok(after, [{ action: 'THRESHOLDS_CHANGED', entityType: 'Config', entityId: 'rules', mdaId: null, summary: `Anomaly thresholds changed: ${reason.trim()}`, before: b, after: a }])
}

export function changeSecurityConfig(actor: User, before: SecurityConfig, after: SecurityConfig, reason: string): Result<SecurityConfig> {
  if (!can(actor, 'admin.config')) return fail('Only a System Administrator can change security settings.')
  if (reason.trim().length < 10) return fail('Give a reason of at least 10 characters.')
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  diff(before, after, '', b, a)
  if (!Object.keys(a).length) return fail('Nothing changed.')
  return ok(after, [{ action: 'SECURITY_CHANGED', entityType: 'Config', entityId: 'security', mdaId: null, summary: `Security settings changed: ${reason.trim()}`, before: b, after: a }])
}

function diff(b: unknown, a: unknown, path: string, outB: Record<string, unknown>, outA: Record<string, unknown>) {
  if (typeof a === 'object' && a !== null && !Array.isArray(a) && typeof b === 'object' && b !== null) {
    for (const k of Object.keys(a)) diff((b as Record<string, unknown>)[k], (a as Record<string, unknown>)[k], path ? `${path}.${k}` : k, outB, outA)
    return
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    outB[path] = b
    outA[path] = a
  }
}

export function setPeriodStatus(actor: User, period: FinancialPeriod, status: FinancialPeriod['status'], reason: string): Result<FinancialPeriod> {
  if (!can(actor, 'admin.masterData')) return fail('Only a System Administrator can open or close periods.')
  if (period.status === status) return fail('Nothing changed.')
  if (reason.trim().length < 10) return fail('Give a reason of at least 10 characters.')
  return ok({ ...period, status }, [
    {
      action: status === 'Closed' ? 'PERIOD_CLOSED' : status === 'Open' ? 'PERIOD_OPENED' : 'PERIOD_CHANGED',
      entityType: 'Period',
      entityId: period.id,
      mdaId: null,
      summary: `${period.label}: ${period.status} → ${status}. ${reason.trim()}`,
      before: { status: period.status },
      after: { status },
    },
  ])
}

export function updateMda(actor: User, mda: Mda, patch: Partial<Pick<Mda, 'name' | 'sector' | 'accountingOfficer' | 'contactEmail' | 'status' | 'appropriation'>>, reason: string): Result<Mda> {
  if (!can(actor, 'mda.manage')) return fail('Only a System Administrator can edit MDA master data.')
  if (reason.trim().length < 10) return fail('Give a reason of at least 10 characters.')
  const next = { ...mda, ...patch }
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
    if (next[k] !== mda[k]) {
      before[k] = mda[k]
      after[k] = next[k]
    }
  }
  if (!Object.keys(after).length) return fail('Nothing changed.')
  if (patch.appropriation !== undefined && (!Number.isFinite(patch.appropriation) || patch.appropriation < 0)) return fail('Appropriation must be zero or more.')
  return ok(next, [{ action: 'MDA_UPDATED', entityType: 'MDA', entityId: mda.id, mdaId: mda.id, summary: `${mda.name} master data updated: ${reason.trim()}`, before, after }])
}
