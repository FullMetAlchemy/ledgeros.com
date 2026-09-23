// Submissions: structured returns an MDA files with oversight (spec §2, M3).
// Every kind shares one lifecycle and chain model; only its data differs.

import type { Attestation, ChainAct, Comment, EvidenceFile } from '../types'

export type SubmissionKind =
  | 'monthly_return'
  | 'advance_retirement'
  | 'milestone_certificate'
  | 'release_request'
  | 'quarterly_performance'
  | 'vendor_exception'

export type SubmissionState = 'Draft' | 'InChain' | 'UnderReview' | 'Queried' | 'Accepted'

// ---- Reference data the ledger already holds (pre-fill sources) ------------

export interface Posting {
  ref: string
  date: string // ISO date
  payee: string
  amount: number
  economicCode: string
  appropriationLine: string
}

export interface Advance {
  ref: string
  holder: string
  amount: number
  disbursedOn: string // ISO date
  purpose: string
}

export interface ContractMilestone {
  no: number
  title: string
  value: number
  vouchers: { ref: string; date: string; amount: number }[]
}

export interface Contract {
  ref: string
  mdaId: string
  title: string
  contractor: string
  value: number
  milestones: ContractMilestone[]
}

export interface Vendor {
  name: string
  rc: string
  tin: string
}

// ---- Per-kind data ----------------------------------------------------------

export type LineStatus = 'pending' | 'confirmed' | 'queried'

export interface ReturnLine extends Posting {
  status: LineStatus
  note: string
}

export interface ReturnData {
  kind: 'monthly_return'
  period: string // YYYY-MM
  lines: ReturnLine[]
  ledgerClosingBalance: number
  tsaStatementBalance: string
}

export interface RetirementItem {
  id: string
  description: string
  amount: string
  receiptRef: string
}

export interface RetirementData {
  kind: 'advance_retirement'
  advanceRef: string
  holder: string
  advanceAmount: number
  disbursedOn: string
  purpose: string
  items: RetirementItem[]
  remitted: string
  remittanceRef: string
  linkedFlagId: string | null
}

export interface MilestoneData {
  kind: 'milestone_certificate'
  contractRef: string
  contractTitle: string
  contractor: string
  milestoneNo: number
  milestoneTitle: string
  milestoneValue: number
  vouchers: { ref: string; date: string; amount: number }[]
  certDate: string // YYYY-MM-DD
  engineer: string
  percentComplete: string
}

export interface ReleaseSnapshot {
  appropriated: number
  released: number
  utilized: number
  openFlags: number
  openCriticalHigh: number
}

export interface ReleaseData {
  kind: 'release_request'
  vote: string
  amount: string
  purpose: string
  obligations: string
  snapshot: ReleaseSnapshot
}

export interface QuarterRow {
  category: 'Personnel' | 'Overhead' | 'Capital'
  appropriated: number
  released: number
  utilized: number
  commentary: string
}

export interface QuarterlyData {
  kind: 'quarterly_performance'
  quarter: string
  rows: QuarterRow[]
  correctiveActions: string
}

export interface VendorData {
  kind: 'vendor_exception'
  vendorName: string
  rcNumber: string
  tin: string
  failedLookup: '' | 'BPP registry' | 'CAC' | 'FIRS TIN'
  reason: string
}

export type SubmissionData = ReturnData | RetirementData | MilestoneData | ReleaseData | QuarterlyData | VendorData

// ---- The record --------------------------------------------------------------

export interface SubmissionContent {
  data: SubmissionData
  evidence: EvidenceFile[]
  justifications: Record<string, string>
}

export type SubmissionEvent =
  | { type: 'SUBMIT' }
  | { type: 'APPROVE_STEP'; attestation?: { declaration: string; keyVerified: boolean } }
  | { type: 'RETURN'; comment: string }
  | { type: 'ACCEPT'; comment?: string }
  | { type: 'QUERY'; comment: string }
  | { type: 'REVISE' }

export interface SubmissionHistoryEntry {
  id: string
  at: string
  actorId: string
  event: SubmissionEvent['type'] | 'CREATE'
  from: SubmissionState | null
  to: SubmissionState
  note?: string
}

export interface Submission extends SubmissionContent {
  id: string
  mdaId: string
  kind: SubmissionKind
  title: string
  state: SubmissionState
  ownerId: string
  createdAt: string
  dueAt: string
  step: number
  updatedAt: string | null
  updatedBy: string | null
  /** Snapshot taken on submit; this is what the chain signs and oversight reviews. */
  submitted: SubmissionContent | null
  chain: ChainAct[]
  attestation: Attestation | null
  returned: boolean
  cycle: number
  history: SubmissionHistoryEntry[]
  comments: Comment[]
}
