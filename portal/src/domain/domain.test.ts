import { beforeAll, describe, expect, it } from 'vitest'
import { DEMO_PASSWORD, INVALID_LOGIN, login } from './access'
import { append, verifyChain } from './audit'
import type { Dataset } from './dataset'
import { transitionFlag } from './flags'
import { mdaPosition, mdaRating, statePosition } from './metrics'
import { can, inScope } from './roles'
import { evaluate } from './rules'
import { buildDataset } from './seed'
import { importCsv, validateReturn } from './returns'
import { svcCreateReturn, svcEditReturn, svcFlagAction, svcReturnAction } from './services'
import type { Transaction } from './types'

let ds: Dataset
const user = (id: string) => ds.users.find((u) => u.id === id)!
const B = 1e9
const NOW = new Date('2026-09-24T10:00:00+01:00')

beforeAll(() => {
  ds = buildDataset()
})

describe('prototype scenario (FRD §6)', () => {
  it('Ministry of Works: ₦612B appropriation, 97.8% utilization, 3 active flags', () => {
    const p = mdaPosition(ds, 'MWI', { mode: 'ytd', periodId: '2026-09' })
    expect(p.appropriation).toBe(612 * B)
    expect(p.utilizationRate!.toFixed(1)).toBe('97.8')
    const active = ds.flags.filter((f) => f.mdaId === 'MWI' && f.status !== 'Closed')
    expect(active.map((f) => f.ruleId).sort()).toEqual(['duplication', 'milestone', 'velocity'])
  })

  it('Ministry of Health: ₦15B allocation, ₦38B utilization, severe overspend flag', () => {
    const p = mdaPosition(ds, 'MOH', { mode: 'ytd', periodId: '2026-08' })
    expect(p.appropriation).toBe(15 * B)
    expect(Math.round(p.utilized / 1e6)).toBe(38_000)
    const f = ds.flags.find((x) => x.mdaId === 'MOH' && x.ruleId === 'overspend')!
    expect(f.severity).toBe('Critical')
    expect(Math.round(f.amount / 1e6)).toBe(23_000)
    expect(f.evidence.metrics.map((m) => m.label)).toEqual(['Approved allocation', 'Utilization', 'Allocation variance', 'Utilization rate'])
  })

  it('August return carries vendor-level lines including Geotech Survey Limited, with TSA context', () => {
    const r = ds.returns.find((x) => x.id === 'RET-MWI-202608')!
    expect(r.transactions.filter((t) => t.vendorName === 'Geotech Survey Limited')).toHaveLength(2)
    expect(Number(r.tsaClosingBalance)).toBeGreaterThan(0)
    expect(ds.tsaStatements['MWI:2026-08'].length).toBeGreaterThan(0)
  })

  it('dashboard totals reconcile to MDA records', () => {
    const scope = { mode: 'ytd' as const, periodId: '2026-09' }
    const s = statePosition(ds, scope)
    const sum = ds.mdas.reduce((a, m) => a + mdaPosition(ds, m.id, scope).utilized, 0)
    expect(s.utilized).toBe(sum)
    expect(s.expectedRevenue).toBeGreaterThan(s.collectedRevenue)
  })

  it('ratings follow active flags', () => {
    expect(mdaRating(ds, 'MWI')).toBe('High Risk')
    expect(mdaRating(ds, 'MOH')).toBe('High Risk')
    expect(mdaRating(ds, 'MOE')).toBe('Clear') // its flag is closed but still searchable
    expect(ds.flags.find((f) => f.mdaId === 'MOE')!.status).toBe('Closed')
  })
})

describe('anomaly rules (BR-001..006)', () => {
  it('BR-002: utilization equal to allocation is not overspend', () => {
    const tweaked: Dataset = { ...ds, flags: [], mdas: ds.mdas.map((m) => (m.id === 'MOH' ? { ...m, appropriation: mdaPosition(ds, 'MOH', { mode: 'ytd', periodId: '2026-08' }).utilized } : m)) }
    const res = evaluate(tweaked, '2026-08', NOW, ['MOH'])
    expect(res.flags.some((f) => f.ruleId === 'overspend')).toBe(false)
  })

  it('BR-006: an existing flag suppresses the identical condition', () => {
    const res = evaluate(ds, '2026-08', NOW)
    expect(res.flags).toHaveLength(0)
    expect(res.suppressed.length).toBeGreaterThanOrEqual(4)
  })

  it('velocity exposes the observation period, calculated rate and threshold', () => {
    const f = ds.flags.find((x) => x.ruleId === 'velocity')!
    expect(f.evidence.observation).toMatch(/FY2026 to Aug/)
    expect(f.evidence.metrics.find((m) => m.label === 'Calculated pace')!.value).toMatch(/×/)
    expect(f.evidence.threshold).toMatch(/1\.25/)
  })

  it('milestone mismatch shows payment progress and completion, and links the project', () => {
    const f = ds.flags.find((x) => x.ruleId === 'milestone')!
    expect(f.title).toMatch(/70% against 38%/)
    expect(f.evidence.records[0]).toMatchObject({ type: 'project', id: 'PRJ-MWI-01' })
  })

  it('duplication lists matched records and says it is not a finding of fraud', () => {
    const f = ds.flags.find((x) => x.ruleId === 'duplication' && x.mdaId === 'MWI')!
    expect(f.evidence.records.map((r) => r.id)).toEqual(['PV-3830', 'PV-3852'])
    expect(f.evidence.observation).toMatch(/not a finding of fraud/)
  })

  it('a threshold change alters what is flagged', () => {
    const strict: Dataset = { ...ds, flags: [], ruleConfig: { ...ds.ruleConfig, milestone: { enabled: true, tolerancePts: 40 } } }
    expect(evaluate(strict, '2026-08', NOW).flags.some((f) => f.ruleId === 'milestone')).toBe(false)
  })
})

describe('returns workflow and validation (FRD §4.4, §9)', () => {
  it('BR-008: only open periods accept new returns', () => {
    const r = svcCreateReturn(ds, user('U-010'), 'MWI', '2026-07', NOW)
    expect(r.ok).toBe(false)
  })

  it('prevents a second return for the same period', () => {
    expect(svcCreateReturn(ds, user('U-010'), 'MWI', '2026-08', NOW).ok).toBe(false)
  })

  it('validates required fields, formats, dates and negative amounts', () => {
    const created = svcCreateReturn(ds, user('U-010'), 'MWI', '2026-09', NOW)
    if (!created.ok) throw new Error(created.error)
    const bad: Transaction = { id: 'x', date: '2026-08-30', reference: 'bad', vendorName: '', vendorTin: '123', description: '', economicCode: '999', projectId: '', amount: -5, source: 'Manual' }
    const edited = svcEditReturn(created.ds, user('U-010'), created.value.id, { transactions: [bad] }, NOW)
    if (!edited.ok) throw new Error(edited.error)
    const msgs = validateReturn(edited.ds, edited.value).map((i) => i.message).join('\n')
    expect(msgs).toMatch(/within the reporting period/)
    expect(msgs).toMatch(/PV-1234/)
    expect(msgs).toMatch(/12345678-0001/)
    expect(msgs).toMatch(/Negative amounts/)
    expect(msgs).toMatch(/not in the chart of accounts/)
    expect(msgs).toMatch(/TSA sub-account statement/)
  })

  it('CSV import gives row-level feedback', () => {
    const csv = 'date,reference,vendor_name,vendor_tin,description,economic_code,amount,project_id\n2026-09-02,PV-4100,Metro Asphalt Supplies,10778899-0001,Asphalt,23020114,1000000,\n2026-09-03,PV-4101,,bad,,23020114,-1,\n'
    const r = importCsv(csv, { periodId: '2026-09', codes: ds.economicCodes.map((c) => c.code), idPrefix: 'imp' })
    expect(r.transactions).toHaveLength(1)
    expect(r.rowErrors[0].row).toBe(3)
    expect(r.rowErrors[0].messages.length).toBeGreaterThanOrEqual(3)
  })

  it('submission records actor and time, and runs the rules', () => {
    let d = svcCreateReturn(ds, user('U-060'), 'SUBEB', '2026-09', NOW)
    if (!d.ok) throw new Error(d.error)
    const id = d.value.id
    const lines: Transaction[] = [
      { id: 'a', date: '2026-09-02', reference: 'PV-8201', vendorName: 'Learning Materials Ltd', vendorTin: '40223344-0001', description: 'Pupil kits', economicCode: '22021001', projectId: '', amount: 1e9, source: 'Manual' },
      { id: 'b', date: '2026-09-09', reference: 'PV-8202', vendorName: 'Learning Materials Ltd', vendorTin: '40223344-0001', description: 'Pupil kits', economicCode: '22021001', projectId: '', amount: 1e9, source: 'Manual' },
    ]
    const ev = { id: 'e', slotId: 'tsa_statement', name: 'tsa.pdf', size: 1, mime: 'application/pdf', sha256: 'x', uploadedBy: 'U-060', uploadedAt: NOW.toISOString() }
    const e = svcEditReturn(d.ds, user('U-060'), id, { transactions: lines, tsaClosingBalance: '5000000000', evidence: [ev] }, NOW)
    if (!e.ok) throw new Error(e.error)
    const s = svcReturnAction(e.ds, user('U-060'), id, { type: 'SUBMIT' }, NOW)
    if (!s.ok) throw new Error(s.error)
    expect(s.value.status).toBe('Submitted')
    expect(s.value.submittedBy).toBe('U-060')
    expect(s.ds.flags.some((f) => f.mdaId === 'SUBEB' && f.ruleId === 'duplication' && f.status === 'Detected')).toBe(true)
    expect(s.ds.audit.at(-2)?.action).toBe('RULES_EVALUATED')
    d = s
  })

  it('a correction preserves the original version and links the audit events (BR-007)', () => {
    const r = svcReturnAction(ds, user('U-030'), 'RET-MOE-202608', { type: 'CORRECT', reason: 'PV-2230 was posted to the wrong economic code.' }, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.status).toBe('Draft')
    expect(r.value.versions[0].outcome).toBe('Superseded by correction')
    const ev = r.ds.audit.at(-1)!
    expect(ev.action).toBe('RETURN_CORRECTION_OPENED')
    expect(r.ds.audit.find((e) => e.id === ev.correctsEventId)?.action).toBe('RETURN_SUBMITTED')
    // The month's expenditure still counts the last submitted figures.
    expect(mdaPosition(r.ds, 'MOE', { mode: 'month', periodId: '2026-08' }).utilized).toBe(mdaPosition(ds, 'MOE', { mode: 'month', periodId: '2026-08' }).utilized)
  })
})

describe('flag workflow (FRD §8) and roles (FRD §3)', () => {
  it('follows Detected → Open → Assigned → MDA Response → Under Review → Resolved → Closed', () => {
    const f = ds.flags.find((x) => x.ruleId === 'milestone')!
    expect(f.status).toBe('Detected')
    let d = ds
    const step = (actor: string, action: Parameters<typeof svcFlagAction>[3]) => {
      const r = svcFlagAction(d, user(actor), f.id, action, NOW)
      if (!r.ok) throw new Error(r.error)
      d = r.ds
      return r.value.status
    }
    expect(step('U-002', { type: 'OPEN', reviewerId: 'U-002' })).toBe('Open')
    expect(step('U-011', { type: 'ASSIGN', assigneeId: 'U-010' })).toBe('Assigned')
    step('U-010', { type: 'SAVE_DRAFT', explanation: 'Payments include an approved 30% mobilisation advance under clause 14 of the contract.', evidence: [{ id: 'e', slotId: 'response', name: 'contract.pdf', size: 1, mime: 'application/pdf', sha256: 'x', uploadedBy: 'U-010', uploadedAt: '' }] })
    expect(step('U-010', { type: 'SUBMIT_RESPONSE' })).toBe('MDA Response')
    expect(step('U-011', { type: 'APPROVE_RESPONSE', note: 'Verified against the contract.' })).toBe('Under Review')
    expect(step('U-002', { type: 'REVIEW', outcome: 'accept', note: 'Mobilisation advance documented.' })).toBe('Resolved')
    expect(step('U-002', { type: 'CLOSE', note: 'Closed after review.' })).toBe('Closed')
  })

  it('restricts closure and review to oversight (BR-009) and keeps auditors read-only', () => {
    const f = ds.flags.find((x) => x.ruleId === 'velocity')!
    expect(transitionFlag(ds, f, { type: 'REVIEW', outcome: 'accept', note: 'Looks fine to me.' }, user('U-011'), NOW).ok).toBe(false)
    expect(transitionFlag(ds, f, { type: 'REVIEW', outcome: 'accept', note: 'Looks fine to me.' }, user('U-004'), NOW).ok).toBe(false)
    expect(can(user('U-004'), 'audit.view')).toBe(true)
    expect(can(user('U-004'), 'return.review')).toBe(false)
  })

  it('allows escalation only after the response deadline (FR-FLAG-007)', () => {
    const f = ds.flags.find((x) => x.ruleId === 'overspend')!
    expect(transitionFlag(ds, f, { type: 'ESCALATE', note: 'No response after deadline.' }, user('U-002'), new Date('2026-09-10T10:00:00+01:00')).ok).toBe(false)
    expect(transitionFlag(ds, f, { type: 'ESCALATE', note: 'No response after deadline.' }, user('U-002'), NOW).ok).toBe(true)
  })

  it('BR-010: MDA users see only their MDA', () => {
    expect(inScope(user('U-010'), 'MWI')).toBe(true)
    expect(inScope(user('U-010'), 'MOH')).toBe(false)
    const f = ds.flags.find((x) => x.mdaId === 'MOH')!
    expect(transitionFlag(ds, f, { type: 'COMMENT', body: 'hello' }, user('U-010'), NOW).ok).toBe(false)
  })
})

describe('authentication and audit', () => {
  it('rejects bad credentials without revealing whether the account exists, and blocks inactive accounts', () => {
    const bad = login(ds, 'nobody@x.gov.ng', DEMO_PASSWORD)
    const wrong = login(ds, 'chinedu.eze@works.state.gov.ng', 'nope')
    expect(!bad.ok && bad.error).toBe(INVALID_LOGIN)
    expect(!wrong.ok && wrong.error).toBe(INVALID_LOGIN)
    expect(login(ds, 'garba.lawal@health.state.gov.ng', DEMO_PASSWORD).ok).toBe(false)
    const ok = login(ds, 'halima.yusuf@works.state.gov.ng', DEMO_PASSWORD)
    expect(ok.ok && ok.value.mfaRequired).toBe(true)
    const fo = login(ds, 'chinedu.eze@works.state.gov.ng', DEMO_PASSWORD)
    expect(fo.ok && fo.value.mfaRequired).toBe(false)
  })

  it('the seeded ledger chain verifies, and tampering is detected', () => {
    expect(verifyChain(ds.audit)).toBeNull()
    const tampered = ds.audit.map((e, i) => (i === 5 ? { ...e, summary: 'edited' } : e))
    expect(verifyChain(tampered)?.brokenAt.seq).toBe(6)
    const appended = append(ds.audit, [{ action: 'X', entityType: 'Config', entityId: 'x', mdaId: null, summary: 'x' }], 'U-005', NOW.toISOString())
    expect(verifyChain(appended)).toBeNull()
  })

  it('records events in time order', () => {
    const times = ds.audit.map((e) => e.at)
    expect([...times].sort()).toEqual(times)
  })
})
