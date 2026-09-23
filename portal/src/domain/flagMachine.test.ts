import { describe, expect, it } from 'vitest'
import { emptyDraft, sweepDeadlines, transition } from './flagMachine'
import { deadlinesFor } from './policy'
import { buildUsers } from './seed'
import type { Actor, Flag, FlagEvent, ResponseDraft, Severity, User } from './types'

const users = buildUsers()
const u = (id: string) => users.find((x) => x.id === id)!
const FO = u('u-fmw-fo')
const DFA = u('u-fmw-dfa')
const IA = u('u-fmw-ia')
const AO = u('u-fmw-ao')
const AUD = u('u-auditor')
const OTHER_DFA = u('u-fmh-dfa')

const RAISED = new Date('2026-09-21T09:00:00') // Monday
const NOW = new Date('2026-09-21T12:00:00')
const ATTEST = { declaration: 'I attest.', keyVerified: true }

function flag(severity: Severity = 'Critical', patch: Partial<Flag> = {}): Flag {
  return {
    id: 'FLG-T', mdaId: 'FMW', type: 'velocity', severity, description: 'd', observed: 'o', threshold: 't',
    relatedRefs: ['PV-4029'], state: 'Raised', raisedAt: RAISED.toISOString(), ...deadlinesFor(severity, RAISED),
    ownerId: null, draft: emptyDraft(), submitted: null, chain: [], attestation: null, returned: false,
    extensionUsed: false, escalations: [], cycle: 1, history: [], comments: [], ...patch,
  }
}

const completeDraft: ResponseDraft = {
  ...emptyDraft(),
  type: 'justify',
  answers: { planned: 'yes', milestones: 'Contract FMW/HW/221 milestones 2 and 3.' },
  narrative: 'PV-4029 paid milestone 2 of the Abuja–Kaduna contract, which the approved procurement plan scheduled for early Q3.',
  evidence: [
    { id: 'e1', slotId: 'procurement_plan', name: 'plan.pdf', size: 1, mime: 'application/pdf', sha256: 'a', uploadedBy: FO.id, uploadedAt: NOW.toISOString() },
    { id: 'e2', slotId: 'payment_schedule', name: 'sched.pdf', size: 1, mime: 'application/pdf', sha256: 'b', uploadedBy: FO.id, uploadedAt: NOW.toISOString() },
  ],
}

function run(f: Flag, event: FlagEvent, actor: Actor, now = NOW) {
  return transition(f, event, { actor, now, users })
}

function ok(f: Flag, event: FlagEvent, actor: Actor, now = NOW): Flag {
  const r = run(f, event, actor, now)
  if (!r.ok) throw new Error(r.error)
  return r.flag
}

function drafting(severity: Severity = 'Critical'): Flag {
  let f = ok(flag(severity), { type: 'ACKNOWLEDGE' }, DFA)
  f = ok(f, { type: 'ASSIGN', ownerId: FO.id }, DFA)
  return { ...f, draft: completeDraft }
}

describe('acknowledge and assign', () => {
  it('lets the DFA acknowledge and assign an owner', () => {
    let f = ok(flag(), { type: 'ACKNOWLEDGE' }, DFA)
    expect(f.state).toBe('Acknowledged')
    f = ok(f, { type: 'ASSIGN', ownerId: FO.id }, DFA)
    expect(f.state).toBe('Drafting')
    expect(f.ownerId).toBe(FO.id)
    expect(f.history.map((h) => h.event)).toEqual(['ACKNOWLEDGE', 'ASSIGN'])
  })

  it('refuses acknowledgement from a Finance Officer', () => {
    const r = run(flag(), { type: 'ACKNOWLEDGE' }, FO)
    expect(r.ok).toBe(false)
  })

  it('refuses acknowledgement from another MDA', () => {
    expect(run(flag(), { type: 'ACKNOWLEDGE' }, OTHER_DFA).ok).toBe(false)
  })

  it('refuses an owner from another MDA or an ineligible role', () => {
    const f = ok(flag(), { type: 'ACKNOWLEDGE' }, DFA)
    expect(run(f, { type: 'ASSIGN', ownerId: 'u-fmh-fo' }, DFA).ok).toBe(false)
    expect(run(f, { type: 'ASSIGN', ownerId: IA.id }, DFA).ok).toBe(false)
  })
})

describe('submission', () => {
  it('blocks submission of an incomplete draft', () => {
    const f = { ...drafting(), draft: { ...completeDraft, narrative: 'too short' } }
    const r = run(f, { type: 'SUBMIT' }, FO)
    expect(r.ok).toBe(false)
  })

  it('only the owner can submit', () => {
    expect(run(drafting(), { type: 'SUBMIT' }, DFA).ok).toBe(false)
  })

  it('snapshots the draft and starts the chain', () => {
    const f = ok(drafting(), { type: 'SUBMIT' }, FO)
    expect(f.state).toBe('InChain')
    expect(f.submitted?.narrative).toBe(completeDraft.narrative)
    expect(f.chain).toEqual([{ step: 'prepare', userId: FO.id, at: NOW.toISOString() }])
  })

  it('requires a written justification when a trigger fires', () => {
    const base = drafting()
    const f = { ...base, draft: { ...completeDraft, answers: { ...completeDraft.answers, planned: 'no' } } }
    expect(run(f, { type: 'SUBMIT' }, FO).ok).toBe(false)
    const justified = { ...f, draft: { ...f.draft, justifications: { 'velocity-unplanned': 'Accelerated on the Minister’s directive of 2 Sep to beat the rains.' } } }
    expect(run(justified, { type: 'SUBMIT' }, FO).ok).toBe(true)
  })
})

describe('sign-off chain', () => {
  it('runs the full 4-step chain for Critical and sends to oversight', () => {
    let f = ok(drafting('Critical'), { type: 'SUBMIT' }, FO)
    f = ok(f, { type: 'APPROVE_STEP' }, DFA)
    expect(f.state).toBe('InChain')
    f = ok(f, { type: 'APPROVE_STEP' }, IA)
    f = ok(f, { type: 'APPROVE_STEP', attestation: ATTEST }, AO)
    expect(f.state).toBe('OversightReview')
    expect(f.chain.map((c) => c.step)).toEqual(['prepare', 'review', 'check', 'attest'])
    expect(f.attestation?.userId).toBe(AO.id)
  })

  it('enforces step order by role', () => {
    const f = ok(drafting('Critical'), { type: 'SUBMIT' }, FO)
    expect(run(f, { type: 'APPROVE_STEP' }, IA).ok).toBe(false)
    expect(run(f, { type: 'APPROVE_STEP', attestation: ATTEST }, AO).ok).toBe(false)
  })

  it('requires a verified key and declaration at attestation', () => {
    let f = ok(drafting('Critical'), { type: 'SUBMIT' }, FO)
    f = ok(f, { type: 'APPROVE_STEP' }, DFA)
    f = ok(f, { type: 'APPROVE_STEP' }, IA)
    expect(run(f, { type: 'APPROVE_STEP' }, AO).ok).toBe(false)
    expect(run(f, { type: 'APPROVE_STEP', attestation: { declaration: 'x', keyVerified: false } }, AO).ok).toBe(false)
  })

  it('uses a 2-step chain for Medium, attested by the DFA', () => {
    let f = ok(drafting('Medium'), { type: 'SUBMIT' }, FO)
    expect(run(f, { type: 'APPROVE_STEP' }, DFA).ok).toBe(false) // final step needs attestation
    f = ok(f, { type: 'APPROVE_STEP', attestation: ATTEST }, DFA)
    expect(f.state).toBe('OversightReview')
  })

  it('segregation of duties: the preparer can never attest their own response', () => {
    // DFA drafts a Medium response, so the DFA cannot also be the attester.
    let f = ok(flag('Medium'), { type: 'ACKNOWLEDGE' }, DFA)
    f = ok(f, { type: 'ASSIGN', ownerId: DFA.id }, DFA)
    f = ok({ ...f, draft: completeDraft }, { type: 'SUBMIT' }, DFA)
    const r = run(f, { type: 'APPROVE_STEP', attestation: ATTEST }, DFA)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Segregation of duties/)
    // The Accounting Officer can attest instead.
    expect(run(f, { type: 'APPROVE_STEP', attestation: ATTEST }, AO).ok).toBe(true)
  })

  it('return sends it back to drafting, clears the chain and records the comment', () => {
    let f = ok(drafting(), { type: 'SUBMIT' }, FO)
    f = ok(f, { type: 'APPROVE_STEP' }, DFA)
    expect(run(f, { type: 'RETURN', comment: 'no' }, IA).ok).toBe(false)
    f = ok(f, { type: 'RETURN', comment: 'Payment schedule is unsigned. Attach the signed copy.' }, IA)
    expect(f.state).toBe('Drafting')
    expect(f.returned).toBe(true)
    expect(f.chain).toEqual([])
    expect(f.comments.at(-1)?.authorId).toBe(IA.id)
    // After resubmission the DFA may review again: new cycle, new chain.
    f = ok(f, { type: 'SUBMIT' }, FO)
    expect(f.returned).toBe(false)
    expect(run(f, { type: 'APPROVE_STEP' }, DFA).ok).toBe(true)
  })
})

describe('oversight review', () => {
  function atOversight(): Flag {
    let f = ok(drafting(), { type: 'SUBMIT' }, FO)
    f = ok(f, { type: 'APPROVE_STEP' }, DFA)
    f = ok(f, { type: 'APPROVE_STEP' }, IA)
    return ok(f, { type: 'APPROVE_STEP', attestation: ATTEST }, AO)
  }

  it('only oversight can accept', () => {
    expect(run(atOversight(), { type: 'ACCEPT' }, AO).ok).toBe(false)
    expect(ok(atOversight(), { type: 'ACCEPT' }, AUD).state).toBe('Resolved')
  })

  it('request info → resume drafting from the submitted response, next cycle', () => {
    let f = ok(atOversight(), { type: 'REQUEST_INFO', comment: 'Attach the signed contract page 4.' }, AUD)
    expect(f.state).toBe('InfoRequested')
    expect(f.comments.at(-1)?.side).toBe('oversight')
    f = ok(f, { type: 'RESUME' }, FO)
    expect(f.state).toBe('Drafting')
    expect(f.cycle).toBe(2)
    expect(f.draft.narrative).toBe(completeDraft.narrative)
  })

  it('reject escalates', () => {
    const f = ok(atOversight(), { type: 'REJECT', comment: 'Evidence does not support the claim.' }, AUD)
    expect(f.state).toBe('Escalated')
    expect(f.escalations).toContain('rejected')
  })

  it('accepting an extension moves the deadline and returns to drafting once', () => {
    let f = drafting()
    const due = new Date(f.resolveDueAt)
    const newDate = new Date(due)
    newDate.setDate(newDate.getDate() + 10)
    const iso = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`
    f = { ...f, draft: { ...emptyDraft(), type: 'extension', extensionDate: iso, narrative: 'Contractor records are with the EFCC until 5 Oct; PV-4029 file will be returned then.' } }
    f = ok(f, { type: 'SUBMIT' }, FO)
    f = ok(f, { type: 'APPROVE_STEP' }, DFA)
    f = ok(f, { type: 'APPROVE_STEP' }, IA)
    f = ok(f, { type: 'APPROVE_STEP', attestation: ATTEST }, AO)
    f = ok(f, { type: 'ACCEPT' }, AUD)
    expect(f.state).toBe('Drafting')
    expect(f.extensionUsed).toBe(true)
    expect(new Date(f.resolveDueAt).getDate()).toBe(newDate.getDate())
    // A second extension is blocked.
    const again = { ...f, draft: { ...f.draft, type: 'extension' as const, extensionDate: iso } }
    expect(run(again, { type: 'SUBMIT' }, FO).ok).toBe(false)
  })

  it('reopen then resume', () => {
    let f = ok(atOversight(), { type: 'ACCEPT' }, AUD)
    f = ok(f, { type: 'REOPEN', comment: 'Same vendor paid again on 30 Sep.' }, AUD)
    expect(f.state).toBe('Reopened')
    expect(ok(f, { type: 'RESUME' }, DFA).state).toBe('Drafting')
  })
})

describe('deadline sweep', () => {
  it('escalates an unacknowledged Critical flag after 1 working day, once', () => {
    const f = flag('Critical')
    const later = new Date('2026-09-23T09:00:00') // Wednesday; ack was due Tue 17:00
    const changed = sweepDeadlines([f], later)
    expect(changed).toHaveLength(1)
    expect(changed[0].state).toBe('Escalated')
    expect(sweepDeadlines(changed, later)).toHaveLength(0)
  })

  it('does not escalate before the deadline', () => {
    expect(sweepDeadlines([flag('Critical')], new Date('2026-09-22T16:59:00'))).toHaveLength(0)
  })

  it('escalates an overdue draft, and an escalated case can be resumed', () => {
    const d = drafting('Critical')
    const late = new Date('2026-10-05T09:00:00')
    const [esc] = sweepDeadlines([d], late)
    expect(esc.state).toBe('Escalated')
    const resumed = ok(esc, { type: 'RESUME' }, AO, late)
    expect(resumed.state).toBe('Drafting')
    expect(sweepDeadlines([resumed], late)).toHaveLength(0)
  })

  it('only the system can raise deadline escalations', () => {
    expect(run(flag(), { type: 'ESCALATE', reason: 'ack_overdue' }, AO as User).ok).toBe(false)
  })
})
