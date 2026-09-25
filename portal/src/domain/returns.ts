// Monthly expenditure returns (FRD §4.4, §8, §9):
//   Draft → Submitted → Under Review → Returned / Accepted → Closed
//
// - An MDA officer or supervisor prepares the return for an open period (BR-008).
// - Submitting records the actor and time (FR-EXP-005) and triggers rule evaluation.
// - The MDA Supervisor approves it to Under Review (or returns it); a return
//   submitted by the Supervisor goes straight to Under Review.
// - Oversight accepts it or returns it, and closes accepted returns.
// - A correction to an accepted/closed return opens a new version; earlier
//   versions are preserved and the correction is linked in the audit ledger.

import { fail, ok, type Result } from './audit'
import type { Dataset } from './dataset'
import { COUNTED, returnTotal } from './metrics'
import { naira } from './money'
import { periodEnd, periodStart } from './periods'
import { can, inScope } from './roles'
import type { ExpenditureReturn, ReturnStatus, Transaction, User } from './types'

export const TIN_PATTERN = /^\d{8}-\d{4}$/
export const REF_PATTERN = /^[A-Z]{2,4}-\d{3,6}$/
export const REQUIRED_EVIDENCE = [{ id: 'tsa_statement', label: 'TSA sub-account statement for the month' }]

export type Tier = 'blocking' | 'warning'
export interface ReturnIssue {
  id: string
  tier: Tier
  /** Wizard section to fix it in. */
  section: 'period' | 'transactions' | 'vendors' | 'evidence' | 'submission'
  field: string
  message: string
}

// ---- Validation --------------------------------------------------------------

export function validateTransaction(t: Omit<Transaction, 'id' | 'source'>, ctx: { periodId: string; codes: string[] }): string[] {
  const errs: string[] = []
  if (!t.date) errs.push('Date is required.')
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || Number.isNaN(Date.parse(t.date))) errs.push('Date must be YYYY-MM-DD.')
  else if (t.date < periodStart(ctx.periodId) || t.date > periodEnd(ctx.periodId)) errs.push(`Date must fall within the reporting period (${periodStart(ctx.periodId)} to ${periodEnd(ctx.periodId)}).`)
  if (!t.reference.trim()) errs.push('Reference is required.')
  else if (!REF_PATTERN.test(t.reference.trim())) errs.push('Reference must look like PV-1234.')
  if (!t.vendorName.trim()) errs.push('Vendor name is required.')
  if (!t.vendorTin.trim()) errs.push('Vendor TIN is required.')
  else if (!TIN_PATTERN.test(t.vendorTin.trim())) errs.push('Vendor TIN must look like 12345678-0001.')
  if (!t.description.trim()) errs.push('Description of the goods or service is required.')
  if (!t.economicCode) errs.push('Economic code is required.')
  else if (!ctx.codes.includes(t.economicCode)) errs.push(`Economic code ${t.economicCode} is not in the chart of accounts.`)
  if (!Number.isFinite(t.amount)) errs.push('Amount must be a number.')
  else if (t.amount <= 0) errs.push('Amount must be greater than zero. Negative amounts are not accepted on a payment line.')
  return errs
}

export function validateReturn(ds: Dataset, r: ExpenditureReturn): ReturnIssue[] {
  const issues: ReturnIssue[] = []
  const codes = ds.economicCodes.map((c) => c.code)
  const period = ds.periods.find((p) => p.id === r.periodId)
  if (!period) issues.push({ id: 'period', tier: 'blocking', section: 'period', field: 'period', message: 'The reporting period does not exist.' })
  else if (period.status !== 'Open' && r.versions.length === 0)
    issues.push({ id: 'period', tier: 'blocking', section: 'period', field: 'period', message: `${period.label} is ${period.status.toLowerCase()}; only open periods accept new returns.` })

  if (!r.transactions.length) issues.push({ id: 'no-lines', tier: 'blocking', section: 'transactions', field: 'transactions', message: 'Add at least one transaction.' })
  const refs = new Map<string, number>()
  r.transactions.forEach((t, i) => {
    for (const msg of validateTransaction(t, { periodId: r.periodId, codes }))
      issues.push({ id: `t${i}:${msg}`, tier: 'blocking', section: 'transactions', field: `txn:${t.id}`, message: `Line ${i + 1} (${t.reference || 'no reference'}): ${msg}` })
    const ref = t.reference.trim().toUpperCase()
    if (ref) refs.set(ref, (refs.get(ref) ?? 0) + 1)
  })
  for (const [ref, n] of refs)
    if (n > 1) issues.push({ id: `dup-ref:${ref}`, tier: 'blocking', section: 'transactions', field: 'transactions', message: `Reference ${ref} is used on ${n} lines. Each payment needs its own reference.` })

  // Vendor checks against the registry.
  for (const t of r.transactions) {
    const byTin = ds.vendors.find((v) => v.tin === t.vendorTin.trim())
    if (byTin && byTin.name.toLowerCase() !== t.vendorName.trim().toLowerCase())
      issues.push({ id: `vendor:${t.id}`, tier: 'warning', section: 'vendors', field: `txn:${t.id}`, message: `${t.reference}: TIN ${t.vendorTin} is registered to ${byTin.name}, not ${t.vendorName}.` })
    if (t.vendorTin && TIN_PATTERN.test(t.vendorTin.trim()) && !byTin)
      issues.push({ id: `newvendor:${t.id}`, tier: 'warning', section: 'vendors', field: `txn:${t.id}`, message: `${t.reference}: ${t.vendorName} (${t.vendorTin}) is not in the vendor registry yet.` })
    if (t.projectId && !ds.projects.some((p) => p.id === t.projectId && p.mdaId === r.mdaId))
      issues.push({ id: `project:${t.id}`, tier: 'blocking', section: 'transactions', field: `txn:${t.id}`, message: `${t.reference}: project ${t.projectId} is not a project of this MDA.` })
  }

  // TSA context.
  const tsa = parseMoney(r.tsaClosingBalance)
  if (!r.tsaClosingBalance.trim()) issues.push({ id: 'tsa', tier: 'blocking', section: 'evidence', field: 'tsaClosingBalance', message: 'Enter the TSA sub-account closing balance for the month.' })
  else if (Number.isNaN(tsa) || tsa < 0) issues.push({ id: 'tsa', tier: 'blocking', section: 'evidence', field: 'tsaClosingBalance', message: 'TSA closing balance must be a number of naira, zero or more.' })

  for (const ev of REQUIRED_EVIDENCE)
    if (!r.evidence.some((e) => e.slotId === ev.id))
      issues.push({ id: `evidence:${ev.id}`, tier: 'blocking', section: 'evidence', field: `evidence:${ev.id}`, message: `Attach: ${ev.label}.` })

  // Financial consistency: spending beyond funds released to date.
  const released = ds.releases.filter((x) => x.mdaId === r.mdaId && x.periodId <= r.periodId).reduce((a, x) => a + x.amount, 0)
  const spentBefore = ds.returns
    .filter((x) => x.mdaId === r.mdaId && x.id !== r.id && x.periodId < r.periodId && COUNTED.includes(x.status))
    .reduce((a, x) => a + returnTotal(x), 0)
  const ledgerBefore = ds.ledgerExpenditure.filter((l) => l.mdaId === r.mdaId && l.periodId < r.periodId).reduce((a, l) => a + l.amount, 0)
  const total = returnTotal(r)
  if (total && spentBefore + ledgerBefore + total > released)
    issues.push({
      id: 'beyond-release',
      tier: 'warning',
      section: 'submission',
      field: 'total',
      message: `Cumulative expenditure (${naira(spentBefore + ledgerBefore + total)}) would exceed funds released to date (${naira(released)}). The overspend rule may flag this.`,
    })
  return issues
}

export const canSubmitReturn = (issues: ReturnIssue[]) => !issues.some((i) => i.tier === 'blocking')

export function parseMoney(s: string): number {
  const clean = s.replace(/[₦,\s]/g, '')
  if (!clean) return Number.NaN
  return /^-?\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : Number.NaN
}

// ---- CSV import (row-level feedback, FRD §9) ------------------------------------------

export const CSV_HEADERS = ['date', 'reference', 'vendor_name', 'vendor_tin', 'description', 'economic_code', 'amount', 'project_id'] as const

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

export interface ImportResult {
  transactions: Transaction[]
  rowErrors: { row: number; messages: string[] }[]
  headerError: string | null
}

export function importCsv(text: string, ctx: { periodId: string; codes: string[]; idPrefix: string }): ImportResult {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  if (!rows.length) return { transactions: [], rowErrors: [], headerError: 'The file is empty.' }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const missing = CSV_HEADERS.filter((h) => h !== 'project_id' && !header.includes(h))
  if (missing.length) return { transactions: [], rowErrors: [], headerError: `Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Use the template.` }
  const col = (r: string[], name: string) => (r[header.indexOf(name)] ?? '').trim()
  const transactions: Transaction[] = []
  const rowErrors: ImportResult['rowErrors'] = []
  rows.slice(1).forEach((r, i) => {
    const amount = parseMoney(col(r, 'amount'))
    const t = {
      date: col(r, 'date'),
      reference: col(r, 'reference').toUpperCase(),
      vendorName: col(r, 'vendor_name'),
      vendorTin: col(r, 'vendor_tin'),
      description: col(r, 'description'),
      economicCode: col(r, 'economic_code'),
      projectId: col(r, 'project_id'),
      amount,
    }
    const errs = validateTransaction(t, ctx)
    if (errs.length) rowErrors.push({ row: i + 2, messages: errs })
    else transactions.push({ ...t, id: `${ctx.idPrefix}-${i + 1}`, source: 'CSV import' })
  })
  return { transactions, rowErrors, headerError: null }
}

export function csvTemplate(): string {
  return `${CSV_HEADERS.join(',')}\n2026-09-04,PV-4102,Geotech Survey Limited,10667788-0001,Topographic survey - Ring Road Phase II,23050103,312000000,PRJ-MWI-01\n`
}

// ---- Workflow ----------------------------------------------------------------------

export type ReturnAction =
  | { type: 'SUBMIT' }
  | { type: 'SUPERVISOR_APPROVE'; note?: string }
  | { type: 'SUPERVISOR_RETURN'; note: string }
  | { type: 'ACCEPT'; note?: string }
  | { type: 'RETURN'; note: string }
  | { type: 'CLOSE'; note?: string }
  | { type: 'CORRECT'; reason: string }
  | { type: 'COMMENT'; body: string }

export function createReturn(ds: Dataset, actor: User, mdaId: string, periodId: string, now: Date): Result<ExpenditureReturn> {
  if (!can(actor, 'return.prepare') || !inScope(actor, mdaId)) return fail('Only officers of this MDA can prepare its returns.')
  const period = ds.periods.find((p) => p.id === periodId)
  if (!period) return fail('Unknown reporting period.')
  if (period.status !== 'Open') return fail(`${period.label} is ${period.status.toLowerCase()}. Only open periods accept new returns (BR-008).`)
  const existing = ds.returns.find((r) => r.mdaId === mdaId && r.periodId === periodId)
  if (existing) return fail(`${existing.id} already covers ${period.label}. Open it, or request a correction if it has been accepted.`)
  const mda = ds.mdas.find((m) => m.id === mdaId)!
  const at = now.toISOString()
  const id = `RET-${mda.acronym}-${periodId.replace('-', '')}`
  const r: ExpenditureReturn = {
    id,
    mdaId,
    periodId,
    status: 'Draft',
    version: 1,
    transactions: [],
    tsaClosingBalance: '',
    evidence: [],
    notes: '',
    createdBy: actor.id,
    createdAt: at,
    updatedAt: at,
    submittedBy: null,
    submittedAt: null,
    versions: [],
    comments: [],
  }
  return ok(r, [{ action: 'RETURN_CREATED', entityType: 'Return', entityId: id, mdaId, summary: `Draft return created for ${period.label}` }])
}

/** Edit a draft or returned return. Edits are not individually audited; the submitted version is. */
export function editReturn(r: ExpenditureReturn, patch: Partial<Pick<ExpenditureReturn, 'transactions' | 'tsaClosingBalance' | 'evidence' | 'notes'>>, actor: User, now: Date): Result<ExpenditureReturn> {
  if (r.status !== 'Draft' && r.status !== 'Returned') return fail(`A return can't be edited while ${r.status}.`)
  if (!can(actor, 'return.prepare') || actor.mdaId !== r.mdaId) return fail('Only officers of this MDA can edit the return.')
  return ok({ ...r, ...patch, updatedAt: now.toISOString() })
}

export function transitionReturn(ds: Dataset, r: ExpenditureReturn, action: ReturnAction, actor: User, now: Date): Result<ExpenditureReturn> {
  const at = now.toISOString()
  if (!inScope(actor, r.mdaId)) return fail('This return is outside your data scope.')
  const noteErr = (n: string | undefined) => (n && n.trim().length >= 10 ? null : 'Give a reason of at least 10 characters for the record.')
  const withOutcome = (outcome: string) => r.versions.map((v, i) => (i === r.versions.length - 1 ? { ...v, outcome } : v))
  const move = (to: ReturnStatus, patch: Partial<ExpenditureReturn>, action: string, summary: string, extra: Partial<import('./audit').AuditDraft> = {}): Result<ExpenditureReturn> =>
    ok({ ...r, ...patch, status: to, updatedAt: at }, [
      { action, entityType: 'Return', entityId: r.id, mdaId: r.mdaId, summary, before: { status: r.status }, after: { status: to }, ...extra },
    ])

  switch (action.type) {
    case 'SUBMIT': {
      if (r.status !== 'Draft' && r.status !== 'Returned') return fail('Only a draft or returned return can be submitted.')
      if (!can(actor, 'return.prepare') || actor.mdaId !== r.mdaId) return fail('Only officers of this MDA can submit its return.')
      const issues = validateReturn(ds, r)
      if (!canSubmitReturn(issues)) return fail(`The return has ${issues.filter((i) => i.tier === 'blocking').length} issue(s) to fix before submission.`)
      const version = r.versions.length + 1
      const total = returnTotal(r)
      const supervisor = actor.role === 'mda_supervisor'
      const snapshot = { version, submittedAt: at, submittedBy: actor.id, total, transactions: r.transactions, outcome: supervisor ? 'With oversight' : 'Awaiting supervisor' }
      return move(
        supervisor ? 'Under Review' : 'Submitted',
        { version, submittedBy: actor.id, submittedAt: at, versions: [...r.versions, snapshot] },
        'RETURN_SUBMITTED',
        `Version ${version} submitted: ${r.transactions.length} transactions, ${naira(total)}${supervisor ? '; approved by submitting supervisor' : ''}`,
        { after: { status: supervisor ? 'Under Review' : 'Submitted', version, total, transactions: r.transactions.length } },
      )
    }
    case 'SUPERVISOR_APPROVE': {
      if (r.status !== 'Submitted') return fail('Only a submitted return awaits the Supervisor.')
      if (!can(actor, 'return.approve') || actor.mdaId !== r.mdaId) return fail('Only the MDA Supervisor can approve the return.')
      if (r.submittedBy === actor.id) return fail('You submitted this return, so another supervisor must approve it.')
      return move('Under Review', { versions: withOutcome('With oversight') }, 'RETURN_APPROVED', 'Approved by the MDA Supervisor and sent for oversight review')
    }
    case 'SUPERVISOR_RETURN': {
      if (r.status !== 'Submitted') return fail('Only a submitted return awaits the Supervisor.')
      if (!can(actor, 'return.approve') || actor.mdaId !== r.mdaId) return fail('Only the MDA Supervisor can return the return.')
      const err = noteErr(action.note)
      if (err) return fail(err)
      return move('Returned', { versions: withOutcome('Returned by supervisor') }, 'RETURN_RETURNED', `Returned by the MDA Supervisor: ${action.note}`)
    }
    case 'ACCEPT': {
      if (r.status !== 'Under Review') return fail('Only a return under review can be accepted.')
      if (!can(actor, 'return.review')) return fail('Only a Ministry Oversight Officer can accept returns.')
      return move('Accepted', { versions: withOutcome('Accepted') }, 'RETURN_ACCEPTED', 'Accepted by oversight')
    }
    case 'RETURN': {
      if (r.status !== 'Under Review') return fail('Only a return under review can be returned.')
      if (!can(actor, 'return.review')) return fail('Only a Ministry Oversight Officer can return returns.')
      const err = noteErr(action.note)
      if (err) return fail(err)
      return move('Returned', { versions: withOutcome('Returned by oversight') }, 'RETURN_RETURNED', `Returned by oversight: ${action.note}`)
    }
    case 'CLOSE': {
      if (r.status !== 'Accepted') return fail('Only an accepted return can be closed.')
      if (!can(actor, 'return.review')) return fail('Only a Ministry Oversight Officer can close returns.')
      return move('Closed', {}, 'RETURN_CLOSED', 'Closed')
    }
    case 'CORRECT': {
      if (r.status !== 'Accepted' && r.status !== 'Closed') return fail('Corrections apply to accepted or closed returns. Returned drafts can be edited directly.')
      if (!can(actor, 'return.prepare') || actor.mdaId !== r.mdaId) return fail('Only officers of this MDA can open a correction.')
      if (action.reason.trim().length < 10) return fail('Give a reason of at least 10 characters for the correction.')
      const original = [...ds.audit].reverse().find((e) => e.entityId === r.id && e.action === 'RETURN_SUBMITTED')
      return move(
        'Draft',
        { versions: withOutcome('Superseded by correction'), version: r.versions.length + 1 },
        'RETURN_CORRECTION_OPENED',
        `Correction opened on version ${r.versions.length}: ${action.reason}`,
        { correctsEventId: original?.id, before: { status: r.status, version: r.versions.length, total: returnTotal(r) } },
      )
    }
    case 'COMMENT': {
      const body = action.body.trim()
      if (!body) return fail('Write a message first.')
      if (!can(actor, 'return.view')) return fail('Your role cannot comment on returns.')
      return ok({ ...r, comments: [...r.comments, { id: `${r.id}-c${r.comments.length + 1}`, at, authorId: actor.id, body }] }, [
        { action: 'RETURN_COMMENTED', entityType: 'Return', entityId: r.id, mdaId: r.mdaId, summary: 'Comment added' },
      ])
    }
  }
}

export const RETURN_NEXT: Record<ReturnStatus, string> = {
  Draft: 'MDA to complete and submit',
  Submitted: 'MDA Supervisor to approve',
  'Under Review': 'Oversight to accept or return',
  Returned: 'MDA to revise and resubmit',
  Accepted: 'Oversight to close',
  Closed: 'Closed',
}
