// Per-kind policy: sign-off chain, who prepares, who reviews on the oversight
// side, and which evidence slots are required. Chains follow spec §2 M3.

import type { ChainStep, RoleId } from '../types'
import type { SubmissionData, SubmissionKind } from './types'

export interface SubmissionDef {
  kind: SubmissionKind
  label: string
  /** Tag used in dense lists. */
  short: string
  /** ID prefix, e.g. RET-0231-2608. */
  prefix: string
  chain: ChainStep[]
  preparers: RoleId[]
  reviewer: 'auditor' | 'treasury'
  /** One-line purpose shown when choosing what to create. */
  blurb: string
  /** "What's required" checklist on the submission page. */
  requires: string[]
  /** Created from the statutory calendar rather than on demand. */
  scheduled: boolean
}

export const SUBMISSION_STEPS = ['Scope', 'Details', 'Evidence', 'Checks', 'Declaration'] as const

export const DEFS: Record<SubmissionKind, SubmissionDef> = {
  monthly_return: {
    kind: 'monthly_return',
    label: 'Monthly expenditure return',
    short: 'Return',
    prefix: 'RET',
    chain: ['prepare', 'review', 'check', 'attest'],
    preparers: ['finance_officer', 'dfa'],
    reviewer: 'auditor',
    blurb: 'Reconcile the month’s GIFMIS postings and TSA balance, with evidence per voucher.',
    requires: [
      'Confirm or query every GIFMIS posting for the month',
      'Evidence for every confirmed voucher',
      'TSA sub-account statement, reconciled to the ledger',
    ],
    scheduled: true,
  },
  advance_retirement: {
    kind: 'advance_retirement',
    label: 'Advance retirement',
    short: 'Retirement',
    prefix: 'RTM',
    chain: ['prepare', 'review', 'check'],
    preparers: ['finance_officer', 'dfa'],
    reviewer: 'auditor',
    blurb: 'Account for a cash advance: itemised spend, receipts, and remittance of any unspent cash.',
    requires: ['Itemised spend with receipt references', 'Receipts', 'TSA remittance for unspent cash', 'Spend + remittance equals the advance'],
    scheduled: false,
  },
  milestone_certificate: {
    kind: 'milestone_certificate',
    label: 'Milestone / delivery certificate',
    short: 'Certificate',
    prefix: 'MC',
    chain: ['prepare', 'review', 'check'],
    preparers: ['finance_officer', 'dfa'],
    reviewer: 'auditor',
    blurb: 'Certify a contract milestone or delivery, with the engineer’s signed certificate and site evidence.',
    requires: ['Signed certificate with engineer and date', 'Dated site or delivery photographs', 'Explanation if any payment preceded certification'],
    scheduled: false,
  },
  release_request: {
    kind: 'release_request',
    label: 'Release (warrant) request',
    short: 'Release',
    prefix: 'AW',
    chain: ['prepare', 'attest'],
    preparers: ['dfa'],
    reviewer: 'treasury',
    blurb: 'Request a release against a vote. Treasury sees your compliance position alongside it.',
    requires: ['Amount within unreleased appropriation', 'Purpose and obligations being funded', 'Cash-flow projection'],
    scheduled: false,
  },
  quarterly_performance: {
    kind: 'quarterly_performance',
    label: 'Quarterly budget performance',
    short: 'Quarterly',
    prefix: 'QPR',
    chain: ['prepare', 'review', 'attest'],
    preparers: ['finance_officer', 'dfa'],
    reviewer: 'auditor',
    blurb: 'Figures are calculated for you; explain variances and corrective actions.',
    requires: ['Commentary on every category below 75% absorption', 'Corrective actions with dates'],
    scheduled: true,
  },
  vendor_exception: {
    kind: 'vendor_exception',
    label: 'Vendor exception',
    short: 'Vendor',
    prefix: 'VEX',
    chain: ['prepare', 'review'],
    preparers: ['finance_officer', 'dfa'],
    reviewer: 'auditor',
    blurb: 'Register a vendor that failed an automatic BPP, CAC or TIN lookup.',
    requires: ['Registration number and TIN in the official format', 'CAC and TIN certificates', 'Reason the lookup failed'],
    scheduled: false,
  },
}

export const REVIEWER_LABEL: Record<SubmissionDef['reviewer'], string> = {
  auditor: 'Oversight review',
  treasury: 'Treasury decision',
}

export interface SubmissionSlot {
  id: string
  label: string
  help: string
  required: boolean
}

/** Evidence slots for a submission, which can depend on its data. */
export function evidenceSlots(data: SubmissionData): SubmissionSlot[] {
  switch (data.kind) {
    case 'monthly_return':
      return [
        { id: 'tsa_statement', label: 'TSA sub-account statement', help: 'Bank statement for the month from the CBN TSA portal.', required: true },
        ...data.lines.map((l) => ({
          id: `line:${l.ref}`,
          label: `${l.ref} · ${l.payee}`,
          help: 'Payment voucher and its supporting documents.',
          required: l.status === 'confirmed',
        })),
      ]
    case 'advance_retirement':
      return [
        { id: 'receipts', label: 'Receipts', help: 'Itemised receipts and the retirement voucher.', required: true },
        { id: 'remittance', label: 'TSA remittance advice', help: 'Proof that unspent cash was paid back.', required: parseAmount(data.remitted) > 0 },
      ]
    case 'milestone_certificate':
      return [
        { id: 'certificate', label: 'Signed certificate', help: 'Milestone or delivery certificate with engineer name, signature and date.', required: true },
        { id: 'site_photos', label: 'Site or delivery photographs', help: 'JPG photos keep their timestamp and location for reviewers.', required: true },
      ]
    case 'release_request':
      return [{ id: 'cashflow', label: 'Cash-flow projection', help: 'Monthly cash needs for the obligations being funded.', required: true }]
    case 'quarterly_performance':
      return [{ id: 'supporting', label: 'Supporting schedules', help: 'Optional: project-level breakdowns.', required: false }]
    case 'vendor_exception':
      return [
        { id: 'cac_cert', label: 'CAC certificate', help: 'Certificate of incorporation and status report.', required: true },
        { id: 'tin_cert', label: 'TIN certificate', help: 'FIRS TIN certificate.', required: true },
      ]
  }
}

/** Parse a user-typed naira amount: "1,620,000,000" or "1620000000". NaN if invalid. */
export function parseAmount(s: string): number {
  const clean = s.replace(/[₦,\s]/g, '')
  if (!clean) return 0
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : Number.NaN
}
