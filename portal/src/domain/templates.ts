// Structured response templates, one per Anomaly Engine flag type.
// Each template defines what a complete answer looks like so that responses are
// comparable across MDAs and reviewable without back-and-forth.

import type { FlagType, ResponseType } from './types'

export interface Question {
  id: string
  label: string
  kind: 'yesno' | 'text' | 'longtext'
  help?: string
}

export interface EvidenceSlotDef {
  id: string
  label: string
  help: string
  /** Response types for which at least one file in this slot is required. */
  requiredFor: ResponseType[]
}

export interface JustificationTrigger {
  id: string
  /** Returns true when the answers call for a written justification. */
  when: (answers: Record<string, string>) => boolean
  message: string
}

export interface FlagTemplate {
  label: string
  /** "What would resolve it" checklist shown on the case screen. */
  resolves: string[]
  questions: Question[]
  evidence: EvidenceSlotDef[]
  triggers: JustificationTrigger[]
}

const CORRECTION_SLOT: EvidenceSlotDef = {
  id: 'correction',
  label: 'Proof of correction',
  help: 'Reversal voucher, recovery receipt or TSA remittance advice.',
  requiredFor: ['correct'],
}

const JD: ResponseType[] = ['justify', 'dispute']

export const TEMPLATES: Record<FlagType, FlagTemplate> = {
  velocity: {
    label: 'Velocity flag',
    resolves: [
      'Show that the spend profile was planned in the approved procurement plan',
      'Link each payment to a contract milestone',
      'Or: correct any payment made ahead of schedule',
    ],
    questions: [
      { id: 'planned', label: 'Was this spend profile in the approved procurement plan?', kind: 'yesno' },
      { id: 'milestones', label: 'Which contract milestones do these payments relate to?', kind: 'longtext', help: 'List contract number and milestone for each voucher.' },
    ],
    evidence: [
      { id: 'procurement_plan', label: 'Approved procurement plan', help: 'The page showing this line item and its planned timing.', requiredFor: JD },
      { id: 'payment_schedule', label: 'Contract payment schedule', help: 'Signed schedule from the contract agreement.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [
      {
        id: 'velocity-unplanned',
        when: (a) => a.planned === 'no',
        message: 'You said this spend profile was not in the procurement plan. Explain why payments were accelerated and who approved it.',
      },
    ],
  },
  milestone_mismatch: {
    label: 'Milestone mismatch',
    resolves: [
      "Provide the resident engineer's signed milestone certificate",
      'Explain any payment certified before sign-off',
    ],
    questions: [
      { id: 'cert_date', label: 'Date the resident engineer signed the milestone certificate', kind: 'text', help: 'DD/MM/YYYY' },
      { id: 'paid_before_cert', label: 'Was payment certified before the engineer signed off?', kind: 'yesno' },
    ],
    evidence: [
      { id: 'milestone_cert', label: 'Signed milestone certificate', help: 'Certificate with engineer name, signature and date.', requiredFor: JD },
      { id: 'site_evidence', label: 'Site evidence', help: 'Dated site photographs or inspection report.', requiredFor: ['justify'] },
      CORRECTION_SLOT,
    ],
    triggers: [
      {
        id: 'paid-before-cert',
        when: (a) => a.paid_before_cert === 'yes',
        message: 'Payment was certified before the milestone was signed off. Explain who authorised this and why.',
      },
    ],
  },
  unretired_advance: {
    label: 'Unretired advance',
    resolves: [
      'Retire the advance with itemised receipts',
      'Remit any unspent balance to the TSA',
      'Or: recover the advance from the holder',
    ],
    questions: [
      { id: 'holder_contacted', label: 'Has the advance holder been formally notified?', kind: 'yesno' },
      { id: 'retirement_plan', label: 'Retirement status and plan', kind: 'longtext', help: 'What has been spent, what is outstanding, and by when it will be retired.' },
    ],
    evidence: [
      { id: 'retirement_pack', label: 'Retirement receipts', help: 'Itemised receipts and the retirement voucher.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [
      {
        id: 'holder-not-notified',
        when: (a) => a.holder_contacted === 'no',
        message: 'The advance holder has not been notified. Explain why and when notification will happen.',
      },
    ],
  },
  capital_vote_depleted: {
    label: 'Capital vote depleted',
    resolves: [
      'List outstanding Q4 contractual obligations',
      'Show how they will be funded (virement request or supplementary)',
    ],
    questions: [
      { id: 'obligations', label: 'Outstanding contractual obligations for the rest of the year', kind: 'longtext' },
      { id: 'funding_plan', label: 'How will these obligations be funded?', kind: 'longtext' },
    ],
    evidence: [
      { id: 'commitments', label: 'Commitments register extract', help: 'Open contracts against this capital vote.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [],
  },
  duplicate_invoicing: {
    label: 'Duplicate vendor invoicing',
    resolves: [
      'Confirm whether the vendors are related',
      'Provide delivery evidence for each invoice',
      'Or: reverse the duplicate and recover funds',
    ],
    questions: [
      { id: 'related', label: 'Are the two vendors related (shared directors, BVN or address)?', kind: 'yesno' },
      { id: 'delivery', label: 'Were goods or services delivered separately for each invoice?', kind: 'yesno' },
    ],
    evidence: [
      { id: 'cac_docs', label: 'CAC documents for both vendors', help: 'Certificate of incorporation and status report.', requiredFor: JD },
      { id: 'delivery_notes', label: 'Delivery evidence for each invoice', help: 'Store receipt vouchers or signed delivery notes.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [
      {
        id: 'related-vendors',
        when: (a) => a.related === 'yes',
        message: 'The vendors are related. Explain how the award complied with conflict-of-interest and procurement rules.',
      },
    ],
  },
  procurement_breach: {
    label: 'Procurement breach',
    resolves: [
      'Provide the BPP Certificate of No Objection',
      'Or: provide emergency procurement approval and its ratification',
    ],
    questions: [
      { id: 'emergency', label: 'Was this procured under emergency provisions?', kind: 'yesno' },
      { id: 'approval_ref', label: 'Approval reference', kind: 'text', help: 'Certificate of No Objection or emergency approval number.' },
    ],
    evidence: [
      { id: 'no_objection', label: 'Certificate of No Objection or emergency approval', help: 'Issued document with reference and date.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [],
  },
  threshold_splitting: {
    label: 'Threshold splitting',
    resolves: ['Provide the procurement plan entry', 'Justify the division into lots'],
    questions: [
      { id: 'in_plan', label: 'Were these lots separately listed in the procurement plan?', kind: 'yesno' },
      { id: 'lot_reason', label: 'Reason for dividing the requirement into lots', kind: 'longtext' },
    ],
    evidence: [
      { id: 'procurement_plan', label: 'Procurement plan entry', help: 'Showing the lots and their estimated values.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [
      {
        id: 'lots-not-planned',
        when: (a) => a.in_plan === 'no',
        message: 'The lots were not in the procurement plan. Explain who approved splitting the award and why.',
      },
    ],
  },
  low_absorption: {
    label: 'Low absorption',
    resolves: ['Explain the variance', 'Provide a recovery plan with dates'],
    questions: [
      { id: 'cause', label: 'Main cause of low absorption', kind: 'longtext' },
      { id: 'external', label: 'Does this depend on anything outside the MDA (e.g. state counterpart funds)?', kind: 'yesno' },
    ],
    evidence: [
      { id: 'recovery_plan', label: 'Recovery plan', help: 'Planned disbursements by month for the rest of the year.', requiredFor: JD },
      CORRECTION_SLOT,
    ],
    triggers: [],
  },
}

export const RESPONSE_TYPES: { id: ResponseType; label: string; help: string }[] = [
  { id: 'justify', label: 'Justify', help: 'The transaction was legitimate. Provide the evidence.' },
  { id: 'correct', label: 'Correct', help: 'We are fixing it: reversal, recovery or retirement.' },
  { id: 'dispute', label: 'Dispute', help: 'The rule fired incorrectly. Explain why, with evidence.' },
  { id: 'extension', label: 'Request extension', help: 'Once per case, with a reason and a new date.' },
]

export function flagLabel(type: FlagType): string {
  return TEMPLATES[type].label
}
