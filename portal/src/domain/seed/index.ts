// Builds the prototype dataset by replaying the scenario through the service
// layer, so every seeded return, flag, reconciliation and audit event is one
// the live rules would also produce.

import { append } from '../audit'
import type { Dataset } from '../dataset'
import { key } from '../dataset'
import { buildPeriods, periodId } from '../periods'
import { DEFAULT_RULES } from '../rules'
import { svcCreateRec, svcCreateReturn, svcEditReturn, svcFlagAction, svcPeriod, svcRecAction, svcReturnAction, type Svc } from '../services'
import type { EvidenceFile, Transaction, User } from '../types'
import { advances, ECONOMIC_CODES, GIFMIS_POSTINGS, ledgerBaseline, MDAS, PROJECTS, releases, RETURN_LINES, revenue, tsaStatement, USERS, VENDORS } from './reference'

/** Deterministic stand-in for a SHA-256 digest on seeded (not uploaded) files. */
function seededHash(s: string): string {
  let h = 0x811c9dc5
  let out = ''
  for (let round = 0; out.length < 64; round++) {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i) ^ round, 0x01000193) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

export function seedFile(slotId: string, name: string, userId: string, at: string): EvidenceFile {
  return { id: `ev-${seededHash(name + slotId).slice(0, 10)}`, slotId, name, size: 420_000, mime: 'application/pdf', sha256: seededHash(name), uploadedBy: userId, uploadedAt: at }
}

/** A fixed West Africa Time timestamp. */
const T = (date: string, hour = 10) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+01:00`)

export const SEED_AS_OF = T('2026-09-23', 17)

export function buildDataset(): Dataset {
  const tsaStatements: Dataset['tsaStatements'] = {}
  for (const k of Object.keys(RETURN_LINES)) tsaStatements[k] = tsaStatement(k)
  let ds: Dataset = {
    users: USERS.map((u) => ({ ...u })),
    mdas: MDAS.map((m) => ({ ...m })),
    periods: buildPeriods(() => 'Open'),
    economicCodes: ECONOMIC_CODES,
    releases: releases(),
    ledgerExpenditure: ledgerBaseline(),
    revenue: revenue(),
    advances: advances(),
    vendors: VENDORS,
    projects: PROJECTS,
    returns: [],
    flags: [],
    reconciliations: [],
    tsaStatements,
    gifmisPostings: GIFMIS_POSTINGS,
    audit: [],
    ruleConfig: structuredClone(DEFAULT_RULES),
    securityConfig: { sessionTimeoutMin: 15, mfaRoles: ['executive', 'oversight', 'mda_supervisor', 'auditor', 'admin'] },
    counters: { flag: 0, rec: 0, user: 90 },
  }
  ds.audit = append(
    [],
    [
      {
        action: 'DATASET_LOADED',
        entityType: 'Config',
        entityId: 'prototype',
        mdaId: null,
        summary:
          'Prototype dataset loaded: 8 MDAs, FY2026 budget, releases and revenue from mock GIFMIS; TSA statements from mock TSA. Demonstration data, not verified government records.',
        source: 'Mock GIFMIS',
        actorId: 'system',
      },
    ],
    'system',
    T('2026-07-01', 8).toISOString(),
  )

  const user = (id: string): User => ds.users.find((u) => u.id === id)!
  const run = <V,>(r: Svc<V> | { ok: false; error: string }, label: string): V => {
    if (!r.ok) throw new Error(`Seed step "${label}" failed: ${r.error}`)
    ds = r.ds
    return r.value
  }

  // The scenario is a list of timed steps, run in time order so the audit
  // ledger reads chronologically.
  const steps: [Date, () => void][] = []
  const at = (when: Date, fn: () => void) => steps.push([when, fn])
  const retId = (mdaId: string, month: number) => `RET-${mdaId}-${periodId(month).replace('-', '')}`
  const retAct = (id: string, actor: string, action: Parameters<typeof svcReturnAction>[3], when: Date) =>
    at(when, () => run(svcReturnAction(ds, user(actor), id, action, when), `${action.type} ${id}`))
  const flagAct = (mdaId: string, rule: string, actor: string, action: Parameters<typeof svcFlagAction>[3], when: Date) =>
    at(when, () => {
      const f = ds.flags.find((x) => x.mdaId === mdaId && x.ruleId === rule)
      if (!f) throw new Error(`Seed: no ${rule} flag for ${mdaId} at ${when.toISOString()}`)
      run(svcFlagAction(ds, user(actor), f.id, action, when), `${action.type} ${f.id}`)
    })

  /** Create a return and enter its lines (and evidence when it will be submitted). */
  const draftReturn = (mdaId: string, month: number, officer: string, created: Date, withEvidence: boolean) =>
    at(created, () => {
      const pid = periodId(month)
      const ret = run(svcCreateReturn(ds, user(officer), mdaId, pid, created), `create ${mdaId} ${pid}`)
      const lines = RETURN_LINES[key(mdaId, pid)] ?? []
      const transactions: Transaction[] = lines.map((l, i) => ({ ...l, id: `${ret.id}-t${i + 1}`, source: 'Manual' }))
      const tsa = transactions.reduce((a, t) => a + t.amount, 0) + 3.2e9
      const edited = new Date(created.getTime() + 3600_000)
      const evAt = edited.toISOString()
      const evidence = withEvidence
        ? [seedFile('tsa_statement', `TSA statement ${mdaId} ${pid}.pdf`, officer, evAt), seedFile('vouchers', `Payment vouchers ${mdaId} ${pid}.pdf`, officer, evAt)]
        : []
      run(svcEditReturn(ds, user(officer), ret.id, { transactions, tsaClosingBalance: String(tsa), evidence }, edited), `edit ${ret.id}`)
    })
  const fileReturn = (mdaId: string, month: number, officer: string, created: Date, submitted: Date) => {
    draftReturn(mdaId, month, officer, created, true)
    retAct(retId(mdaId, month), officer, { type: 'SUBMIT' }, submitted)
  }

  // ---- July: Education return with a potential duplicate, resolved and closed ----
  fileReturn('MOE', 7, 'U-030', T('2026-08-03'), T('2026-08-06'))
  retAct(retId('MOE', 7), 'U-031', { type: 'SUPERVISOR_APPROVE' }, T('2026-08-07'))
  flagAct('MOE', 'duplication', 'U-003', { type: 'OPEN', reviewerId: 'U-003', note: 'Two equal payments to one supplier in July.' }, T('2026-08-10'))
  flagAct('MOE', 'duplication', 'U-031', { type: 'ASSIGN', assigneeId: 'U-030' }, T('2026-08-11'))
  retAct(retId('MOE', 7), 'U-003', { type: 'ACCEPT' }, T('2026-08-12'))
  flagAct(
    'MOE',
    'duplication',
    'U-030',
    {
      type: 'SAVE_DRAFT',
      explanation:
        'PV-2101 and PV-2102 pay for two separate deliveries of exercise books under the term 1 supply contract (delivery notes DN-114 and DN-131). Both were received into the central store.',
      correctiveAction: 'Future invoices will quote the delivery note number in the payment description.',
      evidence: [seedFile('response', 'Delivery notes DN-114 and DN-131.pdf', 'U-030', T('2026-08-13').toISOString())],
    },
    T('2026-08-13'),
  )
  flagAct('MOE', 'duplication', 'U-030', { type: 'SUBMIT_RESPONSE' }, T('2026-08-13', 15))
  flagAct('MOE', 'duplication', 'U-031', { type: 'APPROVE_RESPONSE', note: 'Checked against the store receipt vouchers.' }, T('2026-08-14'))
  flagAct('MOE', 'duplication', 'U-003', { type: 'REVIEW', outcome: 'accept', note: 'Delivery notes confirm two separate supplies.' }, T('2026-08-20'))
  flagAct('MOE', 'duplication', 'U-003', { type: 'CLOSE', note: 'Resolved: separate deliveries evidenced.' }, T('2026-08-24'))
  retAct(retId('MOE', 7), 'U-003', { type: 'CLOSE' }, T('2026-08-31'))
  at(T('2026-08-31', 18), () => run(svcPeriod(ds, user('U-005'), '2026-07', 'Closed', 'July returns window ended on 31 August.', T('2026-08-31', 18)), 'close July'))

  // ---- August returns ----------------------------------------------------------
  fileReturn('MOH', 8, 'U-020', T('2026-09-01', 9), T('2026-09-03')) // → overspend
  fileReturn('MWI', 8, 'U-010', T('2026-09-01', 11), T('2026-09-04', 11)) // → velocity, milestone, duplication
  fileReturn('MOF', 8, 'U-070', T('2026-09-02', 9), T('2026-09-04', 9))
  fileReturn('MOE', 8, 'U-030', T('2026-09-02', 11), T('2026-09-07', 9))
  fileReturn('SEMA', 8, 'U-050', T('2026-09-02', 13), T('2026-09-09'))
  fileReturn('MARD', 8, 'U-040', T('2026-09-03', 9), T('2026-09-18'))
  fileReturn('SIRS', 8, 'U-080', T('2026-09-05'), T('2026-09-10'))
  draftReturn('SUBEB', 8, 'U-060', T('2026-09-14'), false)
  draftReturn('MOH', 9, 'U-020', T('2026-09-21'), false)
  retAct(retId('MOH', 8), 'U-021', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-04', 9))
  retAct(retId('MOF', 8), 'U-071', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-05', 9))
  retAct(retId('MWI', 8), 'U-011', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-05', 11))
  retAct(retId('MOE', 8), 'U-031', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-08'))
  retAct(retId('SEMA', 8), 'U-051', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-10', 9))
  retAct(retId('SIRS', 8), 'U-081', { type: 'SUPERVISOR_APPROVE' }, T('2026-09-11', 9))
  retAct(retId('MOF', 8), 'U-002', { type: 'ACCEPT' }, T('2026-09-11', 14))
  retAct(retId('MOE', 8), 'U-003', { type: 'ACCEPT' }, T('2026-09-15'))
  retAct(retId('SEMA', 8), 'U-003', { type: 'RETURN', note: 'Attach the relief distribution lists signed by the LGA coordinators for PV-7201 and PV-7215.' }, T('2026-09-16'))

  // ---- Flags from the August returns ---------------------------------------------
  flagAct('MOH', 'overspend', 'U-002', { type: 'OPEN', reviewerId: 'U-002', note: 'Utilization is more than double the approved allocation.' }, T('2026-09-04', 14))
  flagAct('MOH', 'overspend', 'U-021', { type: 'ASSIGN', assigneeId: 'U-020' }, T('2026-09-07', 11))
  flagAct('MOH', 'overspend', 'U-020', { type: 'SAVE_DRAFT', explanation: 'The Ministry funded the cholera response from', correctiveAction: '' }, T('2026-09-10', 11))
  flagAct('MWI', 'velocity', 'U-002', { type: 'OPEN', reviewerId: 'U-002' }, T('2026-09-07', 14))
  flagAct('MWI', 'velocity', 'U-011', { type: 'ASSIGN', assigneeId: 'U-010' }, T('2026-09-08', 11))
  flagAct('MWI', 'duplication', 'U-003', { type: 'OPEN', reviewerId: 'U-003' }, T('2026-09-08', 14))
  flagAct(
    'MWI',
    'velocity',
    'U-010',
    {
      type: 'SAVE_DRAFT',
      explanation:
        'Capital releases for the Ring Road and Coastal Highway were front-loaded in the approved cash plan so civil works could finish before the rainy season. Payment certificates 4 to 6 were all certified by the resident engineers.',
      correctiveAction: 'Remaining Q4 payments will be released only against certified milestones; a revised cash plan has been sent to the Ministry.',
      evidence: [
        seedFile('response', 'Approved 2026 cash plan (Works).pdf', 'U-010', T('2026-09-15').toISOString()),
        seedFile('response', 'Payment certificates 4-6.pdf', 'U-010', T('2026-09-15').toISOString()),
      ],
    },
    T('2026-09-15'),
  )
  flagAct('MWI', 'velocity', 'U-010', { type: 'SUBMIT_RESPONSE' }, T('2026-09-15', 15))
  flagAct('MWI', 'velocity', 'U-011', { type: 'APPROVE_RESPONSE', note: 'Consistent with the approved cash plan.' }, T('2026-09-16', 11))

  // ---- Reconciliations -----------------------------------------------------------
  const recOf = (mdaId: string, type: 'TSA' | 'Vendor') => ds.reconciliations.find((r) => r.mdaId === mdaId && r.type === type)!.id
  at(T('2026-09-15', 14), () => {
    const id = run(svcCreateRec(ds, user('U-003'), 'TSA', 'MOE', '2026-08', T('2026-09-15', 14)), 'rec MOE').id
    run(svcRecAction(ds, user('U-003'), id, { type: 'RUN_MATCHING' }, T('2026-09-15', 15)), 'match MOE')
  })
  at(T('2026-09-16', 14), () =>
    run(svcRecAction(ds, user('U-003'), recOf('MOE', 'TSA'), { type: 'REVIEW', note: 'All four payments cleared the TSA for the returned amounts.' }, T('2026-09-16', 14)), 'review MOE'),
  )
  at(T('2026-09-17'), () => {
    const id = run(svcCreateRec(ds, user('U-002'), 'TSA', 'MWI', '2026-08', T('2026-09-17')), 'rec MWI').id
    run(svcRecAction(ds, user('U-002'), id, { type: 'RUN_MATCHING' }, T('2026-09-17', 11)), 'match MWI')
    const charge = ds.reconciliations.find((r) => r.id === id)!.lines.find((l) => l.reference === 'TSA-CHG-0831')!
    run(svcRecAction(ds, user('U-002'), id, { type: 'EXPLAIN_LINE', lineId: charge.id, explanation: 'Monthly CBN TSA charges; not an MDA payment.' }, T('2026-09-17', 12)), 'explain MWI')
    const v = run(svcCreateRec(ds, user('U-002'), 'Vendor', 'MWI', '2026-08', T('2026-09-17', 13)), 'vendor rec MWI').id
    run(svcRecAction(ds, user('U-002'), v, { type: 'RUN_MATCHING' }, T('2026-09-17', 14)), 'match MWI vendor')
  })
  at(T('2026-09-18'), () => run(svcRecAction(ds, user('U-003'), recOf('MOE', 'TSA'), { type: 'CLOSE' }, T('2026-09-18')), 'close MOE'))
  at(T('2026-09-22'), () => run(svcCreateRec(ds, user('U-002'), 'TSA', 'MOH', '2026-08', T('2026-09-22')), 'rec MOH'))

  steps.sort((a, b) => a[0].getTime() - b[0].getTime()).forEach(([, fn]) => fn())

  // ---- Period statuses: Jan–Jul closed, Aug–Sep open, Oct–Dec not yet open ----------
  ds = { ...ds, periods: ds.periods.map((p) => (p.month < 7 ? { ...p, status: 'Closed' } : p.month >= 10 ? { ...p, status: 'Future' } : p)) }
  return ds
}
