// Demo data. MDA figures, flags and vouchers come from the Oversight Ledger OS
// prototype. People are fictional. Seeded flags reach their state by replaying
// real events through the state machine, so seed data obeys the same rules as
// live use. Dates are relative to `now` so deadlines stay meaningful.

import { subtractWorkingDays } from './calendar'
import { emptyDraft, transition } from './flagMachine'
import { B } from './money'
import { deadlinesFor } from './policy'
import type { Actor, EvidenceFile, Flag, FlagEvent, FlagType, Mda, ResponseDraft, Severity, User } from './types'

export const MDAS: Mda[] = [
  {
    id: 'FMW', code: 'MDA-0231', acronym: 'FMW', name: 'Federal Ministry of Works',
    appropriated: 1020 * B, released: 612 * B, utilized: 598.4 * B, unretired: 41.2 * B,
    transactions: [
      { ref: 'PV-4029', date: '12 Sep 2026', payee: 'Kanu-Doyle Construction Ltd', amount: 2.5 * B },
      { ref: 'PV-4031', date: '12 Sep 2026', payee: 'Kanu-Doyle Construction Ltd', amount: 2.5 * B },
      { ref: 'PV-3988', date: '04 Sep 2026', payee: 'Arewa Civil Works', amount: 6.1 * B },
      { ref: 'PV-3950', date: '29 Aug 2026', payee: 'Lagos–Ibadan Corridor JV', amount: 14.2 * B },
      { ref: 'ADV-0712', date: '28 Aug 2026', payee: 'Project Director, FCT Zone', amount: 1.8 * B },
    ],
    releaseRequests: [{ ref: 'AW-2026-0418', vote: 'Q4 · Capital', amount: 80 * B, requested: '20 Sep' }],
  },
  {
    id: 'MOP', code: 'MDA-0517', acronym: 'MOP', name: 'Ministry of Power',
    appropriated: 485 * B, released: 350 * B, utilized: 347.2 * B, unretired: 27.9 * B,
    transactions: [
      { ref: 'INV-8814', date: '18 Sep 2026', payee: 'Voltline Energy Services', amount: 1.9 * B },
      { ref: 'INV-8815', date: '18 Sep 2026', payee: 'Voltline Nigeria Ltd', amount: 1.9 * B },
      { ref: 'PV-5102', date: '10 Sep 2026', payee: 'Transmission Co. Contractors', amount: 4.4 * B },
      { ref: 'PV-5060', date: '01 Sep 2026', payee: 'Mambilla Hydro Consortium', amount: 9.6 * B },
    ],
    releaseRequests: [],
  },
  {
    id: 'NEMA', code: 'MDA-0880', acronym: 'NEMA', name: 'National Emergency Management Agency',
    appropriated: 66 * B, released: 58 * B, utilized: 57.6 * B, unretired: 14.7 * B,
    transactions: [
      { ref: 'ADV-1190', date: '02 Sep 2026', payee: 'Zonal Coordinator, North-East', amount: 3.2 * B },
      { ref: 'PV-2207', date: '21 Aug 2026', payee: 'Relief Logistics Partners', amount: 2.8 * B },
      { ref: 'PV-2190', date: '14 Aug 2026', payee: 'Sahel Relief Supplies', amount: 0.95 * B },
    ],
    releaseRequests: [],
  },
  {
    id: 'FMH', code: 'MDA-0102', acronym: 'FMH', name: 'Federal Ministry of Health',
    appropriated: 740 * B, released: 488 * B, utilized: 402.5 * B, unretired: 18.6 * B,
    transactions: [
      { ref: 'ADV-3301', date: '30 Jun 2026', payee: 'Director, Hospital Services', amount: 2.1 * B },
      { ref: 'PV-6610', date: '11 Sep 2026', payee: 'MedEquip West Africa', amount: 5.4 * B },
      { ref: 'PV-6588', date: '03 Sep 2026', payee: 'National Cold Chain Ltd', amount: 3.3 * B },
    ],
    releaseRequests: [{ ref: 'AW-2026-0412', vote: 'Q3 · Capital', amount: 45 * B, requested: '19 Sep' }],
  },
  {
    id: 'FMAFS', code: 'MDA-0344', acronym: 'FMAFS', name: 'Ministry of Agriculture & Food Security',
    appropriated: 410 * B, released: 205 * B, utilized: 150.3 * B, unretired: 9.8 * B,
    transactions: [
      { ref: 'LPO-7741', date: '15 Sep 2026', payee: 'Agro-Input Supplies Ltd', amount: 0.249 * B },
      { ref: 'LPO-7742', date: '15 Sep 2026', payee: 'Agro-Input Supplies Ltd', amount: 0.248 * B },
      { ref: 'PV-7702', date: '08 Sep 2026', payee: 'Fertiliser Blending Co.', amount: 3.9 * B },
    ],
    releaseRequests: [{ ref: 'AW-2026-0421', vote: 'Q3 · Capital', amount: 28 * B, requested: '22 Sep' }],
  },
  {
    id: 'UBEC', code: 'MDA-0411', acronym: 'UBEC', name: 'Universal Basic Education Commission',
    appropriated: 256 * B, released: 170 * B, utilized: 96.2 * B, unretired: 4.1 * B,
    transactions: [
      { ref: 'PV-1412', date: '09 Sep 2026', payee: 'Kano SUBEB', amount: 4.2 * B },
      { ref: 'PV-1398', date: '26 Aug 2026', payee: 'Enugu SUBEB', amount: 3.1 * B },
    ],
    releaseRequests: [{ ref: 'AW-2026-0415', vote: 'Q3 · Overhead', amount: 12.5 * B, requested: '19 Sep' }],
  },
  {
    id: 'FME', code: 'MDA-0120', acronym: 'FME', name: 'Federal Ministry of Education',
    appropriated: 1100 * B, released: 790 * B, utilized: 701 * B, unretired: 3.2 * B,
    transactions: [
      { ref: 'PV-0921', date: '16 Sep 2026', payee: 'TETFund Disbursement', amount: 22 * B },
      { ref: 'PV-0907', date: '02 Sep 2026', payee: 'Federal Unity Colleges', amount: 6.8 * B },
    ],
    releaseRequests: [{ ref: 'AW-2026-0423', vote: 'Q4 · Capital', amount: 60 * B, requested: '22 Sep' }],
  },
]

type Team = [fo: string, dfa: string, ia: string, ao: string, aoTitle: string]

const TEAMS: Record<string, Team> = {
  FMW: ['Chinedu Eze', 'Halima Yusuf', 'Emeka Nwosu', 'Olumide Bakare', 'Permanent Secretary'],
  FMH: ['Ngozi Adeleke', 'Ibrahim Sani', 'Funmilayo Ajayi', 'Musa Abdullahi', 'Permanent Secretary'],
  MOP: ['Kelechi Obi', 'Yetunde Salami', 'Garba Lawal', 'Rotimi Adeyinka', 'Permanent Secretary'],
  NEMA: ['Zainab Idris', 'Bala Usman', 'Chioma Okafor', 'Suleiman Dikko', 'Director-General'],
  FMAFS: ['Tolu Ogunleye', 'Hauwa Abubakar', 'Ifeanyi Mba', 'Kabiru Tanko', 'Permanent Secretary'],
  FME: ['Amaka Nnaji', 'Segun Afolabi', 'Rukayat Bello', 'Danjuma Musa', 'Permanent Secretary'],
  UBEC: ['Aminu Garba', 'Grace Okoye', 'Yakubu Sambo', 'Nkechi Eze', 'Executive Secretary'],
}

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export function buildUsers(): User[] {
  const users: User[] = [
    { id: 'u-auditor', name: 'Adaeze Okonkwo', initials: 'AO', role: 'auditor', mdaId: null, title: 'Chief Auditor · Oversight' },
    { id: 'u-treasury', name: 'Fatima Bello', initials: 'FB', role: 'treasury', mdaId: null, title: 'Treasury Officer · OAGF' },
  ]
  for (const [mdaId, [fo, dfa, ia, ao, aoTitle]] of Object.entries(TEAMS)) {
    const k = mdaId.toLowerCase()
    users.push(
      { id: `u-${k}-fo`, name: fo, initials: initials(fo), role: 'finance_officer', mdaId, title: 'Principal Accountant' },
      { id: `u-${k}-dfa`, name: dfa, initials: initials(dfa), role: 'dfa', mdaId, title: 'Director of Finance & Accounts' },
      { id: `u-${k}-ia`, name: ia, initials: initials(ia), role: 'head_ia', mdaId, title: 'Head of Internal Audit' },
      { id: `u-${k}-ao`, name: ao, initials: initials(ao), role: 'accounting_officer', mdaId, title: aoTitle },
    )
  }
  return users
}

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

export function ev(slotId: string, name: string, userId: string, at: Date, size = 480_000): EvidenceFile {
  return {
    id: `ev-${seededHash(name).slice(0, 10)}`,
    slotId,
    name,
    size,
    mime: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    sha256: seededHash(name),
    uploadedBy: userId,
    uploadedAt: at.toISOString(),
  }
}

interface FlagSpec {
  id: string
  mdaId: string
  type: FlagType
  severity: Severity
  description: string
  observed: string
  threshold: string
  relatedRefs: string[]
  raised: Date
}

function newFlag(s: FlagSpec): Flag {
  return {
    id: s.id, mdaId: s.mdaId, type: s.type, severity: s.severity, description: s.description,
    observed: s.observed, threshold: s.threshold, relatedRefs: s.relatedRefs,
    state: 'Raised', raisedAt: s.raised.toISOString(), ...deadlinesFor(s.severity, s.raised),
    ownerId: null, draft: emptyDraft(), submitted: null, chain: [], attestation: null,
    returned: false, extensionUsed: false, escalations: [], cycle: 1, history: [], comments: [],
  }
}

type Step = [event: FlagEvent, actorId: string | 'system', hoursAfterRaise: number] | ['DRAFT', Partial<ResponseDraft>]

function play(flag: Flag, steps: Step[], users: User[]): Flag {
  let f = flag
  let n = 0
  for (const step of steps) {
    if (step[0] === 'DRAFT') {
      f = { ...f, draft: { ...f.draft, ...step[1] } }
      continue
    }
    const [event, actorId, hours] = step
    const actor: Actor = actorId === 'system' ? 'system' : users.find((u) => u.id === actorId)!
    const now = new Date(new Date(f.raisedAt).getTime() + hours * 3600_000)
    const r = transition(f, event, { actor, now, users, newId: () => `${f.id}-h${++n}` })
    if (!r.ok) throw new Error(`Seed ${f.id}: ${event.type} failed: ${r.error}`)
    f = r.flag
  }
  return f
}

export const ATTEST_TEXT =
  'I attest that this response is accurate and complete, and that the evidence attached is authentic.'

export function buildFlags(now: Date, users: User[]): Flag[] {
  const ago = (workingDays: number, hour = 9) => {
    const d = subtractWorkingDays(now, workingDays)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const at = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000)
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)
  const flags: Flag[] = []

  // FMW: Journey A starts here: a fresh Critical velocity flag.
  flags.push(newFlag({
    id: 'FLG-0231-009', mdaId: 'FMW', type: 'velocity', severity: 'Critical',
    description: '80% of Q3 capital release depleted in 12 days, against a 45-day expected burn profile.',
    observed: '80% of Q3 capital release spent in 12 days', threshold: 'More than 75% within 14 days',
    relatedRefs: ['PV-4029'], raised: hoursAgo(2),
  }))

  const r8 = ago(2)
  flags.push(play(newFlag({
    id: 'FLG-0231-008', mdaId: 'FMW', type: 'milestone_mismatch', severity: 'High',
    description: 'Payment certified before the resident engineer signed off milestone 3 on the Abuja–Kaduna rehabilitation contract.',
    observed: 'PV-4031 certified 12 Sep; milestone 3 signed 14 Sep', threshold: 'Payment after milestone certification',
    relatedRefs: ['PV-4031'], raised: r8,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-fmw-dfa', 1],
    [{ type: 'ASSIGN', ownerId: 'u-fmw-fo' }, 'u-fmw-dfa', 1.2],
    ['DRAFT', {
      type: 'justify', step: 1, answers: { cert_date: '14/09/2026', paid_before_cert: 'yes' },
      narrative: 'Milestone 3 works were complete on 10 Sep. ',
      updatedAt: at(r8, 5).toISOString(), updatedBy: 'u-fmw-fo',
    }],
  ], users))

  const r6 = ago(6)
  flags.push(play(newFlag({
    id: 'FLG-0231-006', mdaId: 'FMW', type: 'unretired_advance', severity: 'High',
    description: 'Imprest of ₦1.8B to a project director remains unretired after 60 days.',
    observed: '₦1.8B unretired for 60 days', threshold: 'Retire within 90 days; flagged at 60 for capital imprest',
    relatedRefs: ['ADV-0712'], raised: r6,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-fmw-dfa', 2],
    [{ type: 'ASSIGN', ownerId: 'u-fmw-fo' }, 'u-fmw-dfa', 2.1],
    ['DRAFT', {
      type: 'correct', correctiveRef: 'RET-0231-0712',
      narrative: 'ADV-0712 has been retired in full: ₦1.62B receipted against FCT Zone works and ₦0.18B remitted to the TSA.',
      evidence: [ev('correction', 'RET-0231-0712 retirement voucher.pdf', 'u-fmw-fo', at(r6, 20)), ev('correction', 'TSA remittance 0.18B.pdf', 'u-fmw-fo', at(r6, 20.5))],
    }],
    [{ type: 'SUBMIT' }, 'u-fmw-fo', 26],
    [{ type: 'APPROVE_STEP' }, 'u-fmw-dfa', 30],
    [{ type: 'APPROVE_STEP' }, 'u-fmw-ia', 50],
    [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, 'u-fmw-ao', 74],
  ], users))

  flags.push(play(newFlag({
    id: 'FLG-0231-004', mdaId: 'FMW', type: 'capital_vote_depleted', severity: 'Medium',
    description: 'Capital vote at 97% utilisation with Q4 contractual obligations still outstanding.',
    observed: 'Capital vote 97% utilised at end of Q3', threshold: 'Above 90% with open Q4 commitments',
    relatedRefs: ['PV-3988'], raised: ago(1),
  }), [[{ type: 'ACKNOWLEDGE' }, 'u-fmw-dfa', 3]], users))

  // MOP: Critical duplicate invoicing, with oversight for review.
  const r12 = ago(3)
  flags.push(play(newFlag({
    id: 'FLG-0517-012', mdaId: 'MOP', type: 'duplicate_invoicing', severity: 'Critical',
    description: 'Two vendors sharing one BVN billed identical ₦1.9B invoices on the same day.',
    observed: 'INV-8814 and INV-8815: ₦1.9B each, 18 Sep, shared BVN', threshold: 'Identical amounts across linked vendors within 7 days',
    relatedRefs: ['INV-8814', 'INV-8815'], raised: r12,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-mop-dfa', 1],
    [{ type: 'ASSIGN', ownerId: 'u-mop-fo' }, 'u-mop-dfa', 1.5],
    ['DRAFT', {
      type: 'justify', answers: { related: 'yes', delivery: 'yes' },
      narrative: 'INV-8814 and INV-8815 are for two separate transformer lots (Lot A Jos, Lot B Makurdi) delivered under separate contracts. Both vendors belong to the Voltline group.',
      justifications: { 'related-vendors': 'Both lots were competitively tendered separately in May; the group relationship was declared at bid stage and cleared by the tenders board.' },
      evidence: [
        ev('cac_docs', 'CAC Voltline Energy Services.pdf', 'u-mop-fo', at(r12, 4)),
        ev('cac_docs', 'CAC Voltline Nigeria Ltd.pdf', 'u-mop-fo', at(r12, 4.1)),
        ev('delivery_notes', 'SRV Lot A Jos.pdf', 'u-mop-fo', at(r12, 4.3)),
        ev('delivery_notes', 'SRV Lot B Makurdi.pdf', 'u-mop-fo', at(r12, 4.4)),
      ],
    }],
    [{ type: 'SUBMIT' }, 'u-mop-fo', 6],
    [{ type: 'APPROVE_STEP' }, 'u-mop-dfa', 8],
    [{ type: 'APPROVE_STEP' }, 'u-mop-ia', 24],
    [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, 'u-mop-ao', 28],
  ], users))

  flags.push(play(newFlag({
    id: 'FLG-0517-011', mdaId: 'MOP', type: 'velocity', severity: 'High',
    description: 'Q3 release fully utilised in 11 days.',
    observed: '100% of Q3 release spent in 11 days', threshold: 'More than 75% within 14 days',
    relatedRefs: ['PV-5102'], raised: ago(2),
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-mop-dfa', 2],
    [{ type: 'ASSIGN', ownerId: 'u-mop-fo' }, 'u-mop-dfa', 2.5],
  ], users))

  // NEMA: Critical flag never acknowledged; the deadline sweep escalates it on load.
  flags.push(newFlag({
    id: 'FLG-0880-005', mdaId: 'NEMA', type: 'procurement_breach', severity: 'Critical',
    description: 'Emergency procurement executed without a BPP Certificate of No Objection.',
    observed: 'PV-2207 ₦2.8B paid with no No Objection on file', threshold: 'No Objection required above the prior-review threshold',
    relatedRefs: ['PV-2207'], raised: ago(3),
  }))
  flags.push(play(newFlag({
    id: 'FLG-0880-004', mdaId: 'NEMA', type: 'unretired_advance', severity: 'High',
    description: 'Unretired advances stand at 25% of released funds.',
    observed: 'Unretired / released = 25.3%', threshold: 'Above 5% of released funds',
    relatedRefs: ['ADV-1190'], raised: ago(1),
  }), [[{ type: 'ACKNOWLEDGE' }, 'u-nema-dfa', 1]], users))

  // FMH: the Compliance Home example from the spec.
  const r14 = ago(9)
  flags.push(play(newFlag({
    id: 'FLG-0102-014', mdaId: 'FMH', type: 'unretired_advance', severity: 'Medium',
    description: '₦3.0B in cash advances older than the 90-day retirement window.',
    observed: '₦3.0B of advances older than 90 days', threshold: 'Retire within 90 days of disbursement',
    relatedRefs: ['ADV-3301'], raised: r14,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-fmh-dfa', 3],
    [{ type: 'ASSIGN', ownerId: 'u-fmh-fo' }, 'u-fmh-dfa', 3.5],
    ['DRAFT', {
      type: 'correct', step: 1,
      narrative: 'Retirement of ADV-3301 is in progress.',
      updatedAt: at(r14, 30).toISOString(), updatedBy: 'u-fmh-fo',
    }],
  ], users))

  // FMAFS: response waiting at the DFA review step.
  const r3 = ago(4)
  flags.push(play(newFlag({
    id: 'FLG-0344-003', mdaId: 'FMAFS', type: 'threshold_splitting', severity: 'High',
    description: 'Six awards to one vendor within 48 hours, each just under the ₦250M approval limit.',
    observed: '6 awards to Agro-Input Supplies in 48h, ₦248M–₦249M each', threshold: 'Repeat awards within 2% below a ₦250M limit',
    relatedRefs: ['LPO-7741', 'LPO-7742'], raised: r3,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-fmafs-dfa', 2],
    [{ type: 'ASSIGN', ownerId: 'u-fmafs-fo' }, 'u-fmafs-dfa', 2.2],
    ['DRAFT', {
      type: 'justify', answers: { in_plan: 'no', lot_reason: 'Inputs were needed at six state depots before planting; each depot was treated as a separate delivery lot.' },
      narrative: 'LPO-7741, LPO-7742 and four further LPOs supplied fertiliser to six state depots ahead of the wet-season planting window.',
      justifications: { 'lots-not-planned': 'The depot-level split was approved by the Permanent Secretary on 12 Sep as a planting-season emergency measure.' },
      evidence: [ev('procurement_plan', 'FMAFS procurement plan 2026 p14.pdf', 'u-fmafs-fo', at(r3, 20))],
    }],
    [{ type: 'SUBMIT' }, 'u-fmafs-fo', 24],
  ], users))

  flags.push(newFlag({
    id: 'FLG-0411-002', mdaId: 'UBEC', type: 'low_absorption', severity: 'Low',
    description: 'Only 57% of released funds utilised at end of Q3; state counterpart funding outstanding.',
    observed: '57% absorption of release', threshold: 'Below 65% at quarter end',
    relatedRefs: [], raised: ago(1),
  }))

  // FME: a resolved case, so history and "Resolved" views are not empty.
  const r0 = ago(25)
  flags.push(play(newFlag({
    id: 'FLG-0120-003', mdaId: 'FME', type: 'velocity', severity: 'Medium',
    description: 'TETFund disbursement front-loaded in the first two weeks of Q3.',
    observed: '78% of Q3 release spent in 13 days', threshold: 'More than 75% within 14 days',
    relatedRefs: ['PV-0921'], raised: r0,
  }), [
    [{ type: 'ACKNOWLEDGE' }, 'u-fme-dfa', 2],
    [{ type: 'ASSIGN', ownerId: 'u-fme-fo' }, 'u-fme-dfa', 2.5],
    ['DRAFT', {
      type: 'justify', answers: { planned: 'yes', milestones: 'Statutory TETFund transfer, single annual tranche.' },
      narrative: 'PV-0921 is the statutory annual TETFund transfer, scheduled in the approved plan as a single Q3 tranche.',
      evidence: [ev('procurement_plan', 'FME disbursement plan 2026.pdf', 'u-fme-fo', at(r0, 20)), ev('payment_schedule', 'TETFund schedule 2026.pdf', 'u-fme-fo', at(r0, 20.2))],
    }],
    [{ type: 'SUBMIT' }, 'u-fme-fo', 24],
    [{ type: 'APPROVE_STEP', attestation: { declaration: ATTEST_TEXT, keyVerified: true } }, 'u-fme-dfa', 28],
    [{ type: 'ACCEPT', comment: 'Confirmed against the TETFund statutory schedule.' }, 'u-auditor', 72],
  ], users))

  return flags
}

/** Roles offered on the demo sign-in screen. */
export const DEMO_MDAS = ['FMW', 'FMH'] as const
