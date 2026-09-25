// Service layer: applies a domain action to the dataset, appends its audit
// events and runs any follow-on work (rule evaluation after a return is
// submitted). The client store and the seed both go through here, so seeded
// data obeys exactly the same rules as live use.

import {
  changeRuleConfig,
  changeSecurityConfig,
  changeUser,
  createUser,
  loginFailedEvent,
  sessionEvent,
  setPeriodStatus,
  updateMda,
} from './access'
import { append, type AuditDraft, type Result } from './audit'
import type { Dataset } from './dataset'
import { transitionFlag, type FlagAction } from './flags'
import { createReconciliation, transitionRec, type RecAction } from './reconciliation'
import { createReturn, editReturn, transitionReturn, type ReturnAction } from './returns'
import { can } from './roles'
import { evaluate, latestPeriodWithData, RULE_LABEL } from './rules'
import type { ExpenditureReturn, FinancialPeriod, Mda, RecType, RoleId, RuleConfig, SecurityConfig, User, UserStatus } from './types'

export type Svc<T = undefined> = { ok: true; ds: Dataset; value: T; message?: string } | { ok: false; error: string }

function commit<T>(ds: Dataset, r: Result<T>, actorId: string, now: Date, apply: (ds: Dataset, v: T) => Dataset): Svc<T> {
  if (!r.ok) return r
  const next = apply(ds, r.value)
  return { ok: true, ds: { ...next, audit: append(next.audit, r.events, actorId, now.toISOString()) }, value: r.value }
}

const replace = <T extends { id: string }>(list: T[], item: T) => list.map((x) => (x.id === item.id ? item : x))

// ---- Rules ------------------------------------------------------------------------

export function runRules(ds: Dataset, actorId: string, now: Date, asOf?: string, mdaIds?: string[]): Svc<{ created: number; suppressed: number }> {
  const period = asOf ?? latestPeriodWithData(ds)
  try {
    const res = evaluate(ds, period, now, mdaIds)
    const next: Dataset = { ...ds, flags: [...ds.flags, ...res.flags], counters: { ...ds.counters, flag: ds.counters.flag + res.flags.length } }
    return {
      ok: true,
      ds: { ...next, audit: append(next.audit, res.events, actorId, now.toISOString()) },
      value: { created: res.flags.length, suppressed: res.suppressed.length },
      message: res.flags.length
        ? `${res.flags.length} new flag${res.flags.length === 1 ? '' : 's'}: ${res.flags.map((f) => RULE_LABEL[f.ruleId]).join(', ')}`
        : 'No new exceptions found',
    }
  } catch (e) {
    // FRD §15: record the failure and do not claim a successful evaluation.
    const ev: AuditDraft = {
      action: 'RULES_FAILED',
      entityType: 'Rules',
      entityId: `RUN-${period}`,
      mdaId: null,
      summary: `Rule evaluation failed: ${e instanceof Error ? e.message : String(e)}`,
      source: 'Rule engine',
      actorId: 'system',
    }
    return { ok: true, ds: { ...ds, audit: append(ds.audit, [ev], actorId, now.toISOString()) }, value: { created: 0, suppressed: 0 }, message: 'Rule evaluation failed; no flags were created.' }
  }
}

export function svcRunRules(ds: Dataset, actor: User, now: Date, asOf?: string): Svc<{ created: number; suppressed: number }> {
  if (!can(actor, 'rules.run')) return { ok: false, error: 'Only a Ministry Oversight Officer can run the rules.' }
  return runRules(ds, actor.id, now, asOf)
}

// ---- Returns ----------------------------------------------------------------------

export function svcCreateReturn(ds: Dataset, actor: User, mdaId: string, periodId: string, now: Date): Svc<ExpenditureReturn> {
  return commit(ds, createReturn(ds, actor, mdaId, periodId, now), actor.id, now, (d, r) => ({ ...d, returns: [...d.returns, r] }))
}

export function svcEditReturn(ds: Dataset, actor: User, id: string, patch: Parameters<typeof editReturn>[1], now: Date): Svc<ExpenditureReturn> {
  const r = ds.returns.find((x) => x.id === id)
  if (!r) return { ok: false, error: 'Return not found.' }
  return commit(ds, editReturn(r, patch, actor, now), actor.id, now, (d, v) => ({ ...d, returns: replace(d.returns, v) }))
}

export function svcReturnAction(ds: Dataset, actor: User, id: string, action: ReturnAction, now: Date): Svc<ExpenditureReturn> {
  const r = ds.returns.find((x) => x.id === id)
  if (!r) return { ok: false, error: 'Return not found.' }
  const res = commit(ds, transitionReturn(ds, r, action, actor, now), actor.id, now, (d, v) => ({ ...d, returns: replace(d.returns, v) }))
  if (!res.ok || action.type !== 'SUBMIT') return res
  // US-004: eligible records are evaluated by the anomaly rules on submission.
  const rules = runRules(res.ds, 'system', now, r.periodId, [r.mdaId])
  if (!rules.ok) return res
  return { ok: true, ds: rules.ds, value: res.value, message: rules.message }
}

// ---- Flags ------------------------------------------------------------------------

export function svcFlagAction(ds: Dataset, actor: User, id: string, action: FlagAction, now: Date) {
  const f = ds.flags.find((x) => x.id === id)
  if (!f) return { ok: false as const, error: 'Flag not found.' }
  return commit(ds, transitionFlag(ds, f, action, actor, now), actor.id, now, (d, v) => ({ ...d, flags: replace(d.flags, v) }))
}

// ---- Reconciliation ---------------------------------------------------------------

export function svcCreateRec(ds: Dataset, actor: User, type: RecType, mdaId: string, periodId: string, now: Date) {
  return commit(ds, createReconciliation(ds, actor, type, mdaId, periodId, now), actor.id, now, (d, v) => ({
    ...d,
    reconciliations: [...d.reconciliations, v],
    counters: { ...d.counters, rec: d.counters.rec + 1 },
  }))
}

export function svcRecAction(ds: Dataset, actor: User, id: string, action: RecAction, now: Date) {
  const r = ds.reconciliations.find((x) => x.id === id)
  if (!r) return { ok: false as const, error: 'Reconciliation not found.' }
  return commit(ds, transitionRec(ds, r, action, actor, now), actor.id, now, (d, v) => ({ ...d, reconciliations: replace(d.reconciliations, v) }))
}

// ---- Access and administration ------------------------------------------------------

export function svcAuthEvent(ds: Dataset, draft: AuditDraft, now: Date): Dataset {
  return { ...ds, audit: append(ds.audit, [draft], draft.actorId ?? 'system', now.toISOString()) }
}

export function svcLogin(ds: Dataset, user: User, now: Date, event: 'LOGIN' | 'MFA_VERIFIED'): Dataset {
  const next = svcAuthEvent(ds, sessionEvent(user, event), now)
  return event === 'LOGIN' ? next : { ...next, users: next.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: now.toISOString() } : u)) }
}

export const svcLoginFailed = (ds: Dataset, email: string, now: Date) => svcAuthEvent(ds, loginFailedEvent(email), now)
export const svcSessionEnd = (ds: Dataset, user: User, now: Date, expired: boolean) =>
  svcAuthEvent(ds, sessionEvent(user, expired ? 'SESSION_EXPIRED' : 'LOGOUT'), now)

export function svcCreateUser(ds: Dataset, actor: User, input: { name: string; email: string; title: string; role: RoleId; mdaId: string | null }, now: Date) {
  return commit(ds, createUser(ds, actor, input, now), actor.id, now, (d, u) => ({ ...d, users: [...d.users, u], counters: { ...d.counters, user: d.counters.user + 1 } }))
}

export function svcChangeUser(ds: Dataset, actor: User, id: string, change: { status?: UserStatus; role?: RoleId; mdaId?: string | null }, reason: string, now: Date) {
  const u = ds.users.find((x) => x.id === id)
  if (!u) return { ok: false as const, error: 'User not found.' }
  return commit(ds, changeUser(ds, actor, u, change, reason), actor.id, now, (d, v) => ({ ...d, users: replace(d.users, v) }))
}

export function svcRuleConfig(ds: Dataset, actor: User, next: RuleConfig, reason: string, now: Date) {
  return commit(ds, changeRuleConfig(actor, ds.ruleConfig, next, reason), actor.id, now, (d, v) => ({ ...d, ruleConfig: v }))
}

export function svcSecurityConfig(ds: Dataset, actor: User, next: SecurityConfig, reason: string, now: Date) {
  return commit(ds, changeSecurityConfig(actor, ds.securityConfig, next, reason), actor.id, now, (d, v) => ({ ...d, securityConfig: v }))
}

export function svcPeriod(ds: Dataset, actor: User, id: string, status: FinancialPeriod['status'], reason: string, now: Date) {
  const p = ds.periods.find((x) => x.id === id)
  if (!p) return { ok: false as const, error: 'Period not found.' }
  return commit(ds, setPeriodStatus(actor, p, status, reason), actor.id, now, (d, v) => ({ ...d, periods: replace(d.periods, v) }))
}

export function svcUpdateMda(ds: Dataset, actor: User, id: string, patch: Parameters<typeof updateMda>[2], reason: string, now: Date) {
  const m = ds.mdas.find((x) => x.id === id)
  if (!m) return { ok: false as const, error: 'MDA not found.' }
  return commit<Mda>(ds, updateMda(actor, m, patch, reason), actor.id, now, (d, v) => ({ ...d, mdas: replace(d.mdas, v) }))
}

export function svcExportEvent(ds: Dataset, actor: User, report: string, rows: number, now: Date): Dataset {
  return {
    ...ds,
    audit: append(ds.audit, [{ action: 'REPORT_EXPORTED', entityType: 'Report', entityId: report, mdaId: actor.mdaId, summary: `Exported ${report} (${rows} rows, CSV)` }], actor.id, now.toISOString()),
  }
}
