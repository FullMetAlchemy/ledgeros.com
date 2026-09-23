// Creating submissions: every kind starts pre-filled from what the ledger
// already knows, so the MDA supplies only what only the MDA knows.

import { addWorkingDays } from '../calendar'
import { isOpen } from '../flagMachine'
import type { Flag, Mda, User } from '../types'
import { DEFS } from './defs'
import { ADVANCES, CONTRACTS, LEDGER_CLOSING, PERIOD_LABEL, POSTINGS, QUARTER_ROWS } from './reference'
import type { Submission, SubmissionData, SubmissionKind } from './types'

export type CreateParams =
  | { kind: 'monthly_return'; period: string }
  | { kind: 'advance_retirement'; advanceRef: string; linkedFlagId?: string | null }
  | { kind: 'milestone_certificate'; contractRef: string; milestoneNo: number }
  | { kind: 'release_request'; vote: string }
  | { kind: 'quarterly_performance'; quarter: string }
  | { kind: 'vendor_exception' }

export const VOTES = ['Q4 · Capital', 'Q4 · Overhead', 'Q4 · Personnel'] as const

export interface Obligation {
  id: string
  mdaId: string
  kind: Extract<SubmissionKind, 'monthly_return' | 'quarterly_performance'>
  period: string
  title: string
  dueAt: string
  /** When the obligation can be started (null = now). */
  opensAt: string | null
  submissionId: string | null
}

const code = (mda: Mda) => mda.code.slice(4)

/** An existing submission that already covers these params (open or accepted). */
export function findExisting(subs: Submission[], mdaId: string, params: CreateParams): Submission | undefined {
  return subs.find((s) => {
    if (s.mdaId !== mdaId || s.kind !== params.kind) return false
    const d = s.data
    switch (params.kind) {
      case 'monthly_return':
        return d.kind === 'monthly_return' && d.period === params.period
      case 'advance_retirement':
        return d.kind === 'advance_retirement' && d.advanceRef === params.advanceRef
      case 'milestone_certificate':
        return d.kind === 'milestone_certificate' && d.contractRef === params.contractRef && d.milestoneNo === params.milestoneNo
      case 'quarterly_performance':
        return d.kind === 'quarterly_performance' && d.quarter === params.quarter
      case 'release_request':
        return d.kind === 'release_request' && d.vote === params.vote && s.state !== 'Accepted'
      case 'vendor_exception':
        return false
    }
  })
}

function nextSeq(subs: Submission[], prefix: string, width: number, start: number): string {
  const nums = subs.map((s) => s.id).filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length)))
  return String(Math.max(start - 1, ...nums.filter((n) => !Number.isNaN(n))) + 1).padStart(width, '0')
}

export type CreateResult = { ok: true; submission: Submission } | { ok: false; error: string }

export function createSubmission(
  params: CreateParams,
  ctx: { mda: Mda; owner: User; now: Date; flags: Flag[]; submissions: Submission[]; dueAt?: string; newId?: () => string },
): CreateResult {
  const { mda, owner, now } = ctx
  const def = DEFS[params.kind]
  if (owner.mdaId !== mda.id || !def.preparers.includes(owner.role)) return { ok: false, error: `Your role cannot prepare a ${def.label.toLowerCase()}.` }
  const dup = findExisting(ctx.submissions, mda.id, params)
  if (dup) return { ok: false, error: `${dup.id} already covers this (${dup.state === 'Accepted' ? 'accepted' : 'in progress'}).` }

  let id: string
  let title: string
  let data: SubmissionData
  let dueAt = ctx.dueAt ?? addWorkingDays(now, 10).toISOString()

  switch (params.kind) {
    case 'monthly_return': {
      const postings = POSTINGS[mda.id]?.[params.period]
      if (!postings) return { ok: false, error: `No GIFMIS postings are available for ${PERIOD_LABEL(params.period)} yet.` }
      id = `RET-${code(mda)}-${params.period.slice(2, 4)}${params.period.slice(5, 7)}`
      title = `${PERIOD_LABEL(params.period)} expenditure return`
      data = {
        kind: 'monthly_return',
        period: params.period,
        lines: postings.map((p) => ({ ...p, status: 'pending', note: '' })),
        ledgerClosingBalance: LEDGER_CLOSING[mda.id]?.[params.period] ?? 0,
        tsaStatementBalance: '',
      }
      break
    }
    case 'advance_retirement': {
      const adv = ADVANCES[mda.id]?.find((a) => a.ref === params.advanceRef)
      if (!adv) return { ok: false, error: `Advance ${params.advanceRef} is not in this MDA’s register.` }
      id = `RTM-${code(mda)}-${adv.ref.replace(/\D/g, '')}`
      title = `Retirement of ${adv.ref} · ${adv.holder}`
      data = {
        kind: 'advance_retirement',
        advanceRef: adv.ref,
        holder: adv.holder,
        advanceAmount: adv.amount,
        disbursedOn: adv.disbursedOn,
        purpose: adv.purpose,
        items: [{ id: 'i1', description: '', amount: '', receiptRef: '' }],
        remitted: '',
        remittanceRef: '',
        linkedFlagId: params.linkedFlagId ?? null,
      }
      break
    }
    case 'milestone_certificate': {
      const c = CONTRACTS.find((x) => x.ref === params.contractRef && x.mdaId === mda.id)
      const m = c?.milestones.find((x) => x.no === params.milestoneNo)
      if (!c || !m) return { ok: false, error: 'That contract milestone was not found.' }
      id = `MC-${code(mda)}-${c.ref.split('/').pop()}-${m.no}`
      title = `${c.ref} milestone ${m.no}: ${m.title}`
      data = {
        kind: 'milestone_certificate',
        contractRef: c.ref,
        contractTitle: c.title,
        contractor: c.contractor,
        milestoneNo: m.no,
        milestoneTitle: m.title,
        milestoneValue: m.value,
        vouchers: m.vouchers,
        certDate: '',
        engineer: '',
        percentComplete: '',
      }
      break
    }
    case 'release_request': {
      const open = ctx.flags.filter((f) => f.mdaId === mda.id && isOpen(f))
      id = `AW-2026-${nextSeq(ctx.submissions, 'AW-2026-', 4, 430)}`
      title = `${params.vote} release request`
      dueAt = ctx.dueAt ?? addWorkingDays(now, 5).toISOString()
      data = {
        kind: 'release_request',
        vote: params.vote,
        amount: '',
        purpose: '',
        obligations: '',
        snapshot: {
          appropriated: mda.appropriated,
          released: mda.released,
          utilized: mda.utilized,
          openFlags: open.length,
          openCriticalHigh: open.filter((f) => f.severity === 'Critical' || f.severity === 'High').length,
        },
      }
      break
    }
    case 'quarterly_performance': {
      const rows = QUARTER_ROWS[mda.id]
      if (!rows) return { ok: false, error: 'Quarterly figures are not available for this MDA yet.' }
      id = `QPR-${code(mda)}-${params.quarter.replace(/\D/g, '').slice(-2) || '26'}${params.quarter.slice(0, 2)}`
      title = `${params.quarter} budget performance`
      data = { kind: 'quarterly_performance', quarter: params.quarter, rows: rows.map((r) => ({ ...r, commentary: '' })), correctiveActions: '' }
      break
    }
    case 'vendor_exception': {
      const prefix = `VEX-${code(mda)}-`
      id = `${prefix}${nextSeq(ctx.submissions, prefix, 3, 1)}`
      title = 'Vendor exception'
      data = { kind: 'vendor_exception', vendorName: '', rcNumber: '', tin: '', failedLookup: '', reason: '' }
      break
    }
  }

  const at = now.toISOString()
  return {
    ok: true,
    submission: {
      id,
      mdaId: mda.id,
      kind: params.kind,
      title,
      state: 'Draft',
      ownerId: owner.id,
      createdAt: at,
      dueAt,
      step: 0,
      updatedAt: null,
      updatedBy: null,
      data,
      evidence: [],
      justifications: {},
      submitted: null,
      chain: [],
      attestation: null,
      returned: false,
      cycle: 1,
      history: [{ id: (ctx.newId ?? (() => `${id}-h0`))(), at, actorId: owner.id, event: 'CREATE', from: null, to: 'Draft', note: 'Created, pre-filled from the ledger' }],
      comments: [],
    },
  }
}

/** Retirement status of each advance, from accepted/in-progress retirements. */
export function advanceStatus(mdaId: string, subs: Submission[]) {
  return (ADVANCES[mdaId] ?? []).map((a) => {
    const sub = subs.find((s) => s.mdaId === mdaId && s.data.kind === 'advance_retirement' && s.data.advanceRef === a.ref)
    return { advance: a, submission: sub ?? null, retired: sub?.state === 'Accepted' }
  })
}
