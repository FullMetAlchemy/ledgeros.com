import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../flagMachine'
import { buildFlags, buildUsers, MDAS } from '../seed'
import type { Actor, EvidenceFile } from '../types'
import { canSubmit } from '../validation'
import { advanceStatus, createSubmission } from './create'
import { transitionSubmission } from './machine'
import { VENDORS } from './reference'
import { buildSubmissions } from './seed'
import { submissionTaskFor } from './tasks'
import type { Submission, SubmissionEvent } from './types'
import { validateSubmission } from './validation'

const now = new Date()
const users = buildUsers()
const flags = buildFlags(now, users)
const { submissions, obligations } = buildSubmissions(now, users, MDAS, flags)
const u = (id: string) => users.find((x) => x.id === id)!
const sub = (id: string) => submissions.find((s) => s.id === id)!
const mda = (id: string) => MDAS.find((m) => m.id === id)!
const ctx = (actor: Actor) => ({ actor, now, users, vendors: VENDORS })
const run = (s: Submission, e: SubmissionEvent, actor: Actor) => transitionSubmission(s, e, ctx(actor))
const ok = (s: Submission, e: SubmissionEvent, actor: Actor) => {
  const r = run(s, e, actor)
  if (!r.ok) throw new Error(r.error)
  return r.submission
}
const file = (slotId: string, name = `${slotId}.pdf`, mime = 'application/pdf'): EvidenceFile => ({
  id: name, slotId, name, size: 1, mime, sha256: 'x', uploadedBy: 'u', uploadedAt: now.toISOString(),
})
const issuesOf = (s: Submission) => validateSubmission({ data: s.data, evidence: s.evidence, justifications: s.justifications }, { now, vendors: VENDORS })

describe('seed', () => {
  it('builds every seeded submission through the machine', () => {
    expect(new Set(submissions.map((s) => s.id)).size).toBe(submissions.length)
    expect(sub('RET-0231-2607').state).toBe('Accepted')
    expect(sub('RET-0231-2608').state).toBe('Draft')
    expect(sub('MC-0231-221-3').state).toBe('InChain')
    expect(sub('MC-0102-310-1').returned).toBe(true)
    expect(submissions.filter((s) => s.kind === 'release_request' && s.state === 'UnderReview')).toHaveLength(5)
    expect(obligations.find((o) => o.id === 'OB-FMW-RET-2608')?.submissionId).toBe('RET-0231-2608')
  })

  it('marks ADV-0712 retired and the others outstanding', () => {
    const st = advanceStatus('FMW', submissions)
    expect(st.find((a) => a.advance.ref === 'ADV-0712')?.retired).toBe(true)
    expect(st.filter((a) => !a.retired)).toHaveLength(2)
  })
})

describe('create', () => {
  it('pre-fills a monthly return from GIFMIS postings', () => {
    const r = createSubmission({ kind: 'monthly_return', period: '2026-08' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions: [] })
    expect(r.ok).toBe(true)
    if (r.ok && r.submission.data.kind === 'monthly_return') {
      expect(r.submission.id).toBe('RET-0231-2608')
      expect(r.submission.data.lines).toHaveLength(10)
      expect(r.submission.data.lines.every((l) => l.status === 'pending')).toBe(true)
    }
  })

  it('refuses duplicates and ineligible preparers', () => {
    expect(createSubmission({ kind: 'monthly_return', period: '2026-08' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions }).ok).toBe(false)
    expect(createSubmission({ kind: 'release_request', vote: 'Q4 · Overhead' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions }).ok).toBe(false)
    expect(createSubmission({ kind: 'vendor_exception' }, { mda: mda('FMW'), owner: u('u-fmh-fo'), now, flags, submissions }).ok).toBe(false)
  })

  it('snapshots compliance position on a release request', () => {
    const r = createSubmission({ kind: 'release_request', vote: 'Q4 · Overhead' }, { mda: mda('FMW'), owner: u('u-fmw-dfa'), now, flags, submissions })
    expect(r.ok && r.submission.data.kind === 'release_request' && r.submission.data.snapshot.openCriticalHigh).toBe(3)
    expect(r.ok && r.submission.id).toBe('AW-2026-0430')
  })
})

describe('checks', () => {
  it('detects threshold splitting in the FMW August return', () => {
    const issues = issuesOf(sub('RET-0231-2608'))
    const split = issues.find((i) => i.id === 'split:Arewa Civil Works')
    expect(split?.tier).toBe('justification')
    expect(split?.message).toMatch(/PV-3912 and PV-3913/)
    expect(issues.find((i) => i.id === 'lines-pending')?.tier).toBe('blocking')
  })

  it('requires a TSA reconciliation explanation when balances differ', () => {
    const s = sub('RET-0231-2608')
    const d = s.data.kind === 'monthly_return' ? s.data : null!
    const issues = issuesOf({ ...s, data: { ...d, tsaStatementBalance: String(d.ledgerClosingBalance + 5_000_000) } })
    expect(issues.find((i) => i.id === 'recon-diff')?.satisfied).toBe(false)
  })

  it('blocks a retirement whose totals do not match the advance', () => {
    const r = createSubmission({ kind: 'advance_retirement', advanceRef: 'ADV-0744' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions })
    if (!r.ok || r.submission.data.kind !== 'advance_retirement') throw new Error('create failed')
    const s = { ...r.submission, data: { ...r.submission.data, items: [{ id: 'a', description: 'Culvert works', amount: '400000000', receiptRef: 'R1' }], remitted: '0' } }
    expect(issuesOf(s).find((i) => i.id === 'totals')?.message).toMatch(/must equal the advance/)
    const balanced = { ...s, data: { ...s.data, remitted: '20000000', remittanceRef: 'TSA/RMT/1' }, evidence: [file('receipts'), file('remittance')] }
    expect(issuesOf(balanced).some((i) => i.id === 'totals')).toBe(false)
  })

  it('flags payment before certification on a milestone', () => {
    const r = createSubmission({ kind: 'milestone_certificate', contractRef: 'FMW/HW/221', milestoneNo: 2 }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions })
    if (!r.ok || r.submission.data.kind !== 'milestone_certificate') throw new Error('create failed')
    const s = { ...r.submission, data: { ...r.submission.data, certDate: '2026-09-15', engineer: 'Engr. X', percentComplete: '100' } }
    expect(issuesOf(s).find((i) => i.id === 'paid-before-cert')?.message).toMatch(/PV-4029/)
  })

  it('blocks a release above headroom', () => {
    const s = sub('AW-2026-0418')
    const d = s.data.kind === 'release_request' ? s.data : null!
    expect(issuesOf({ ...s, data: { ...d, amount: String(500e9) } }).find((i) => i.id === 'amount')?.tier).toBe('blocking')
  })

  it('catches a TIN already registered to another vendor', () => {
    const r = createSubmission({ kind: 'vendor_exception' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions })
    if (!r.ok || r.submission.data.kind !== 'vendor_exception') throw new Error('create failed')
    const s = { ...r.submission, data: { ...r.submission.data, vendorName: 'Arewa Roads Ltd', rcNumber: 'RC 1777001', tin: '10987654-0001', failedLookup: 'BPP registry' as const, reason: 'New vendor not yet on the BPP registry; CAC and FIRS lookups passed.' } }
    expect(issuesOf(s).find((i) => i.id === 'tin-duplicate')?.message).toMatch(/Arewa Civil Works/)
  })

  it('requires commentary for FMH capital absorption below 75%', () => {
    const r = createSubmission({ kind: 'quarterly_performance', quarter: 'Q3 2026' }, { mda: mda('FMH'), owner: u('u-fmh-fo'), now, flags, submissions })
    if (!r.ok) throw new Error(r.error)
    const ids = issuesOf(r.submission).filter((i) => i.tier === 'blocking').map((i) => i.id)
    expect(ids).toEqual(['row:Capital', 'correctiveActions'])
  })
})

describe('lifecycle', () => {
  it('runs a milestone certificate through review and an attesting internal-audit check', () => {
    let s = ok(sub('MC-0231-221-3'), { type: 'APPROVE_STEP' }, u('u-fmw-dfa'))
    expect(run(s, { type: 'APPROVE_STEP' }, u('u-fmw-ia')).ok).toBe(false) // final step needs attestation
    s = ok(s, { type: 'APPROVE_STEP', attestation: { declaration: 'x', keyVerified: true } }, u('u-fmw-ia'))
    expect(s.state).toBe('UnderReview')
    expect(run(s, { type: 'ACCEPT' }, u('u-treasury')).ok).toBe(false)
    expect(ok(s, { type: 'ACCEPT' }, u('u-auditor')).state).toBe('Accepted')
  })

  it('only Treasury decides release requests', () => {
    const s = sub('AW-2026-0418')
    expect(run(s, { type: 'ACCEPT' }, u('u-auditor')).ok).toBe(false)
    expect(ok(s, { type: 'ACCEPT' }, u('u-treasury')).state).toBe('Accepted')
  })

  it('query then revise restores the submitted content for a new cycle', () => {
    let s = ok(sub('AW-2026-0412'), { type: 'QUERY', comment: 'Attach the commissioning schedule for Lot 1.' }, u('u-treasury'))
    expect(s.state).toBe('Queried')
    expect(submissionTaskFor(s, u('u-fmh-dfa'))?.action).toBe('Answer query')
    s = ok(s, { type: 'REVISE' }, u('u-fmh-dfa'))
    expect(s.state).toBe('Draft')
    expect(s.cycle).toBe(2)
    expect(s.data.kind === 'release_request' && s.data.amount).toBe(String(45e9))
  })

  it('refuses to submit with unresolved issues, and enforces segregation of duties', () => {
    const draft = sub('RET-0231-2608')
    expect(run(draft, { type: 'SUBMIT' }, u('u-fmw-fo')).ok).toBe(false)
    const mc = sub('MC-0231-221-3')
    // The preparer cannot also review.
    expect(run(mc, { type: 'APPROVE_STEP' }, u('u-fmw-fo')).ok).toBe(false)
  })

  it('returned submissions go back to the preparer', () => {
    const s = sub('MC-0102-310-1')
    expect(submissionTaskFor(s, u('u-fmh-fo'))?.group).toBe('returned')
    expect(s.comments.at(-1)?.body).toMatch(/unsigned/)
  })

  it('canSubmit accepts a complete vendor exception once justified', () => {
    const r = createSubmission({ kind: 'vendor_exception' }, { mda: mda('FMW'), owner: u('u-fmw-fo'), now, flags, submissions })
    if (!r.ok || r.submission.data.kind !== 'vendor_exception') throw new Error('create failed')
    const s = {
      ...r.submission,
      data: { ...r.submission.data, vendorName: 'Sahel Bitumen Ltd', rcNumber: 'RC 1888123', tin: '11122233-0001', failedLookup: 'BPP registry' as const, reason: 'Registered with BPP last week; the registry sync has not picked it up yet.' },
      evidence: [file('cac_cert'), file('tin_cert')],
    }
    expect(canSubmit(issuesOf(s))).toBe(true)
    expect(emptyDraft().type).toBeNull() // sanity: flag drafts untouched
  })
})
