// Demo submissions and statutory obligations. Like flags, each seeded
// submission reaches its state by replaying events through the machine.

import { addWorkingDays, subtractWorkingDays } from '../calendar'
import { B } from '../money'
import { ATTEST_TEXT, ev } from '../seed'
import type { Actor, Flag, Mda, User } from '../types'
import { createSubmission, type CreateParams, type Obligation } from './create'
import { transitionSubmission } from './machine'
import { VENDORS } from './reference'
import type { ReturnData, Submission, SubmissionData, SubmissionEvent } from './types'

type Step =
  | [event: SubmissionEvent, actorId: string, hoursAfterCreate: number]
  | ['EDIT', (s: Submission) => Partial<Submission>]

export function buildSubmissions(now: Date, users: User[], mdas: Mda[], flags: Flag[]): { submissions: Submission[]; obligations: Obligation[] } {
  const submissions: Submission[] = []
  const user = (id: string) => users.find((u) => u.id === id)!
  const mda = (id: string) => mdas.find((m) => m.id === id)!
  const ago = (wd: number, hour = 9) => {
    const d = subtractWorkingDays(now, wd)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const due = (wd: number) => addWorkingDays(now, wd).toISOString()

  function make(params: CreateParams, mdaId: string, ownerId: string, created: Date, steps: Step[], opts: { id?: string; dueAt?: string } = {}): Submission {
    const r = createSubmission(params, { mda: mda(mdaId), owner: user(ownerId), now: created, flags, submissions, dueAt: opts.dueAt })
    if (!r.ok) throw new Error(`Seed ${params.kind}: ${r.error}`)
    let s = opts.id ? { ...r.submission, id: opts.id } : r.submission
    let n = 0
    for (const step of steps) {
      if (step[0] === 'EDIT') {
        s = { ...s, ...step[1](s) }
        continue
      }
      const [event, actorId, hours] = step
      const actor: Actor = user(actorId)
      const at = new Date(created.getTime() + hours * 3600_000)
      const res = transitionSubmission(s, event, { actor, now: at, users, vendors: VENDORS, newId: () => `${s.id}-h${++n}` })
      if (!res.ok) throw new Error(`Seed ${s.id}: ${event.type} failed: ${res.error}`)
      s = res.submission
    }
    submissions.push(s)
    return s
  }

  const withData = <T extends SubmissionData>(patch: (d: T) => Partial<T>): Step => ['EDIT', (s) => ({ data: { ...s.data, ...patch(s.data as T) } as SubmissionData })]
  const withEvidence = (files: [slot: string, name: string, by: string][], at: Date): Step => [
    'EDIT',
    (s) => ({ evidence: [...s.evidence, ...files.map(([slot, name, by]) => ev(slot, name, by, at))] }),
  ]
  const confirmLines = (refs: string[] | 'all'): Step =>
    withData<ReturnData>((d) => ({ lines: d.lines.map((l) => (refs === 'all' || refs.includes(l.ref) ? { ...l, status: 'confirmed' as const } : l)) }))
  const chain4 = (k: string, base: number): Step[] => [
    [{ type: 'SUBMIT' }, `u-${k}-fo`, base],
    [{ type: 'APPROVE_STEP' }, `u-${k}-dfa`, base + 4],
    [{ type: 'APPROVE_STEP' }, `u-${k}-ia`, base + 24],
    [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, `u-${k}-ao`, base + 30],
  ]

  // ---- FMW ------------------------------------------------------------------
  const julyRefs = ['PV-3702', 'PV-3714', 'PV-3739']
  const julyAt = ago(40)
  make({ kind: 'monthly_return', period: '2026-07' }, 'FMW', 'u-fmw-fo', julyAt, [
    confirmLines('all'),
    withData<ReturnData>((d) => ({ tsaStatementBalance: String(d.ledgerClosingBalance) })),
    withEvidence([['tsa_statement', 'TSA statement FMW July 2026.pdf', 'u-fmw-fo'], ...julyRefs.map((r) => [`line:${r}`, `${r} voucher pack.pdf`, 'u-fmw-fo'] as [string, string, string])], julyAt),
    ...chain4('fmw', 20),
    [{ type: 'ACCEPT', comment: 'Reconciled to TSA. No exceptions.' }, 'u-auditor', 80],
  ], { dueAt: ago(30).toISOString() })

  const augFmwAt = ago(3)
  const augFmwDone = ['PV-3830', 'PV-3844', 'PV-3861', 'PV-3877', 'PV-3890']
  make({ kind: 'monthly_return', period: '2026-08' }, 'FMW', 'u-fmw-fo', augFmwAt, [
    confirmLines(augFmwDone),
    withEvidence(augFmwDone.map((r) => [`line:${r}`, `${r} voucher pack.pdf`, 'u-fmw-fo']), augFmwAt),
    ['EDIT', () => ({ step: 1, updatedAt: new Date(augFmwAt.getTime() + 5 * 3600_000).toISOString(), updatedBy: 'u-fmw-fo' })],
  ], { dueAt: due(5) })

  const rtmAt = ago(12)
  make({ kind: 'advance_retirement', advanceRef: 'ADV-0712' }, 'FMW', 'u-fmw-fo', rtmAt, [
    withData(() => ({
      items: [
        { id: 'i1', description: 'Site mobilisation, sections 1–2 (Kanu-Doyle)', amount: '1420000000', receiptRef: 'RCT-FCT-0412' },
        { id: 'i2', description: 'Survey and setting-out crews', amount: '200000000', receiptRef: 'RCT-FCT-0419' },
      ],
      remitted: '180000000',
      remittanceRef: 'TSA/RMT/0231/0712',
    })),
    ['EDIT', () => ({ justifications: { 'late-retirement': 'Holder was on site until mid-September; retirement filed on return.' } })],
    withEvidence([['receipts', 'ADV-0712 receipts.pdf', 'u-fmw-fo'], ['remittance', 'TSA remittance 0.18B.pdf', 'u-fmw-fo']], rtmAt),
    [{ type: 'SUBMIT' }, 'u-fmw-fo', 2],
    [{ type: 'APPROVE_STEP' }, 'u-fmw-dfa', 6],
    [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, 'u-fmw-ia', 26],
    [{ type: 'ACCEPT', comment: 'Receipts and remittance verified against TSA.' }, 'u-auditor', 50],
  ], { dueAt: ago(5).toISOString() })

  const mcAt = ago(2)
  make({ kind: 'milestone_certificate', contractRef: 'FMW/HW/221', milestoneNo: 3 }, 'FMW', 'u-fmw-fo', mcAt, [
    withData(() => ({ certDate: '2026-09-14', engineer: 'Engr. Bello Garba (resident engineer)', percentComplete: '100' })),
    ['EDIT', () => ({ justifications: { 'paid-before-cert': 'Payment was released on the Director of Highways’ instruction ahead of the engineer’s visit; the DFA has since stopped the practice.' } })],
    withEvidence([['certificate', 'FMW-HW-221 milestone 3 certificate.pdf', 'u-fmw-fo'], ['site_photos', 'Section 2 pavement 14-09.jpg', 'u-fmw-fo'], ['site_photos', 'Section 3 pavement 14-09.jpg', 'u-fmw-fo']], mcAt),
    [{ type: 'SUBMIT' }, 'u-fmw-fo', 3],
  ], { dueAt: due(8) })

  // ---- FMH ------------------------------------------------------------------
  const augFmhAt = ago(4)
  const augFmhDone = ['PV-6502', 'PV-6511', 'PV-6524']
  make({ kind: 'monthly_return', period: '2026-08' }, 'FMH', 'u-fmh-fo', augFmhAt, [
    confirmLines(augFmhDone),
    withEvidence(augFmhDone.map((r) => [`line:${r}`, `${r} voucher pack.pdf`, 'u-fmh-fo']), augFmhAt),
  ], { dueAt: due(5) })

  const mcFmhAt = ago(5)
  make({ kind: 'milestone_certificate', contractRef: 'FMH/EQ/310', milestoneNo: 1 }, 'FMH', 'u-fmh-fo', mcFmhAt, [
    withData(() => ({ certDate: '2026-09-10', engineer: 'Dr. Amina Yusuf (receiving officer, FMC Owerri)', percentComplete: '100' })),
    withEvidence([['certificate', 'PV-6610 delivery certificate (scan).pdf', 'u-fmh-fo'], ['site_photos', 'FMC Owerri CT scanner install.jpg', 'u-fmh-fo']], mcFmhAt),
    [{ type: 'SUBMIT' }, 'u-fmh-fo', 2],
    [{ type: 'RETURN', comment: 'The certificate scan is unsigned. Attach the copy signed by the receiving officer and the storekeeper.' }, 'u-fmh-dfa', 20],
  ], { dueAt: due(12) })

  // ---- Release requests (the prototype's Treasury queue) -------------------
  const release = (id: string, mdaId: string, vote: string, amount: number, purpose: string, obligations: string, justifications: Record<string, string>, wdAgo: number) => {
    const k = mdaId.toLowerCase()
    const at = ago(wdAgo)
    make({ kind: 'release_request', vote }, mdaId, `u-${k}-dfa`, at, [
      withData(() => ({ amount: String(amount), purpose, obligations })),
      ['EDIT', () => ({ justifications })],
      withEvidence([['cashflow', `${id} cash-flow projection.pdf`, `u-${k}-dfa`]], at),
      [{ type: 'SUBMIT' }, `u-${k}-dfa`, 1],
      [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, `u-${k}-ao`, 3],
    ], { id, dueAt: due(3) })
  }
  release('AW-2026-0412', 'FMH', 'Q3 · Capital', 45 * B,
    'Second tranche for diagnostic equipment Lot 1 commissioning and the cold-chain expansion.',
    'FMH/EQ/310 milestone 2; FMH/CC/044 milestone 2', {}, 4)
  release('AW-2026-0415', 'UBEC', 'Q3 · Overhead', 12.5 * B,
    'Quarterly overhead for state SUBEB monitoring visits and the national learning assessment.',
    'Monitoring contracts in 12 states; NLA field logistics',
    { 'low-absorption': 'Absorption is low because state counterpart funds arrived late; 9 states have now paid in and drawdowns are scheduled.' }, 4)
  release('AW-2026-0418', 'FMW', 'Q4 · Capital', 80 * B,
    'Q4 capital release for ongoing highway rehabilitation contracts with certified milestones due before year end.',
    'FMW/HW/221 milestones 4; FMW/HW/205 section 3; FMW/BR/088 milestone 2',
    { 'open-flags': 'Responses to the open flags are in progress; the funds requested are for contracts with no open anomalies.' }, 3)
  release('AW-2026-0421', 'FMAFS', 'Q3 · Capital', 28 * B,
    'Wet-season input distribution and irrigation rehabilitation in the north-central zone.',
    'Fertiliser supply contracts (6 depots); Kano irrigation rehabilitation',
    { 'open-flags': 'The threshold-splitting flag is under internal review; this release funds unrelated irrigation works.' }, 1)
  release('AW-2026-0423', 'FME', 'Q4 · Capital', 60 * B,
    'Q4 capital for Federal Unity Colleges infrastructure and the TETFund intervention top-up.',
    'Unity Colleges hostels (14 sites); TETFund Q4 tranche', {}, 1)

  const byKey = (mdaId: string, kind: string, period: string) =>
    submissions.find((s) => s.mdaId === mdaId && s.kind === kind && ((s.data.kind === 'monthly_return' && s.data.period === period) || (s.data.kind === 'quarterly_performance' && s.data.quarter === period)))?.id ?? null

  const obligations: Obligation[] = ['FMW', 'FMH'].flatMap((mdaId) => [
    { id: `OB-${mdaId}-RET-2608`, mdaId, kind: 'monthly_return' as const, period: '2026-08', title: 'August 2026 expenditure return', dueAt: due(5), opensAt: null, submissionId: byKey(mdaId, 'monthly_return', '2026-08') },
    { id: `OB-${mdaId}-QPR-26Q3`, mdaId, kind: 'quarterly_performance' as const, period: 'Q3 2026', title: 'Q3 2026 budget performance report', dueAt: due(10), opensAt: null, submissionId: byKey(mdaId, 'quarterly_performance', 'Q3 2026') },
    { id: `OB-${mdaId}-RET-2609`, mdaId, kind: 'monthly_return' as const, period: '2026-09', title: 'September 2026 expenditure return', dueAt: '2026-10-30T17:00:00', opensAt: '2026-10-01T08:00:00', submissionId: null },
  ])

  return { submissions, obligations }
}
