// Oversight Ledger OS domain model (PRD §13, FRD §8).
// Pure data types; no React. Every monetary value is in naira.

export type RoleId = 'executive' | 'oversight' | 'mda_officer' | 'mda_supervisor' | 'auditor' | 'admin'
export type UserStatus = 'Pending' | 'Active' | 'Suspended' | 'Disabled'

export interface User {
  id: string
  name: string
  initials: string
  email: string
  role: RoleId
  /** MDA scope for MDA roles; null = state-wide (or system for admin). */
  mdaId: string | null
  title: string
  status: UserStatus
  createdAt: string
  lastLoginAt: string | null
}

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'
export type Rating = 'High Risk' | 'Warning' | 'Clear'

// ---- Master data --------------------------------------------------------------

export interface Mda {
  id: string
  code: string
  acronym: string
  name: string
  sector: string
  accountingOfficer: string
  contactEmail: string
  status: 'Active' | 'Inactive'
  /** Approved allocation (appropriation) for FY2026. */
  appropriation: number
}

export type PeriodStatus = 'Future' | 'Open' | 'Closed'

export interface FinancialPeriod {
  /** YYYY-MM */
  id: string
  label: string
  year: number
  month: number
  quarter: number
  status: PeriodStatus
}

export interface EconomicCode {
  code: string
  label: string
  category: 'Personnel' | 'Overhead' | 'Capital'
}

// ---- Financial records ------------------------------------------------------------

export interface FundRelease {
  id: string
  mdaId: string
  periodId: string
  amount: number
  reference: string
}

/** Pre-system monthly expenditure carried from the (mock) GIFMIS ledger for closed months. */
export interface LedgerExpenditure {
  mdaId: string
  periodId: string
  amount: number
  source: string
}

export interface RevenueRecord {
  id: string
  periodId: string
  source: string
  expected: number
  collected: number
}

export interface Advance {
  id: string
  mdaId: string
  holder: string
  amount: number
  disbursedOn: string
  retiredOn: string | null
}

export interface Vendor {
  id: string
  name: string
  tin: string
  category: string
}

export interface Project {
  id: string
  mdaId: string
  name: string
  vendorId: string
  contractValue: number
  paidToDate: number
  /** Documented physical completion, 0–100. */
  completionPct: number
  lastInspection: string
  paymentRefs: string[]
}

// ---- Evidence ---------------------------------------------------------------------

export interface EvidenceFile {
  id: string
  slotId: string
  name: string
  size: number
  mime: string
  sha256: string
  uploadedBy: string
  uploadedAt: string
}

export interface Comment {
  id: string
  at: string
  authorId: string
  body: string
}

// ---- Expenditure returns (FRD §4.4, §8) -------------------------------------------

export type ReturnStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Returned' | 'Accepted' | 'Closed'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  reference: string
  vendorName: string
  vendorTin: string
  description: string
  economicCode: string
  projectId: string
  amount: number
  /** Where the line came from. */
  source: 'Manual' | 'CSV import' | 'Mock GIFMIS'
}

export interface ReturnVersion {
  version: number
  submittedAt: string
  submittedBy: string
  total: number
  transactions: Transaction[]
  outcome: string
}

export interface ExpenditureReturn {
  id: string
  mdaId: string
  periodId: string
  status: ReturnStatus
  version: number
  transactions: Transaction[]
  tsaClosingBalance: string
  evidence: EvidenceFile[]
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
  submittedBy: string | null
  submittedAt: string | null
  /** Earlier submitted versions, preserved on correction (FR-EXP-007, BR-007). */
  versions: ReturnVersion[]
  comments: Comment[]
}

// ---- Compliance flags (FRD §4.6–4.7, §8) --------------------------------------------

export type RuleId = 'overspend' | 'velocity' | 'milestone' | 'duplication'

export type FlagStatus =
  | 'Detected'
  | 'Open'
  | 'Assigned'
  | 'MDA Response'
  | 'Under Review'
  | 'Resolved'
  | 'Rejected'
  | 'Escalated'
  | 'Closed'

export interface FlagRecordRef {
  type: 'transaction' | 'project' | 'return' | 'mda'
  id: string
  label: string
  amount?: number
}

export interface FlagEvidence {
  /** Observed values, e.g. allocation / utilization / variance. */
  metrics: { label: string; value: string }[]
  threshold: string
  observation: string
  records: FlagRecordRef[]
}

export interface FlagResponse {
  id: string
  explanation: string
  correctiveAction: string
  evidence: EvidenceFile[]
  submittedBy: string
  submittedAt: string
  supervisorDecision: { by: string; at: string; approved: boolean; note: string } | null
  review: { by: string; at: string; outcome: 'accept' | 'reject' | 'return' | 'escalate'; note: string } | null
}

export interface FlagHistoryEntry {
  id: string
  at: string
  actorId: string
  from: FlagStatus | null
  to: FlagStatus
  note?: string
}

export interface Flag {
  id: string
  ruleId: RuleId
  /** Rule + subject; prevents identical repeated flags (BR-006). */
  dedupeKey: string
  mdaId: string
  periodId: string
  severity: Severity
  title: string
  amount: number
  detectedAt: string
  evidence: FlagEvidence
  status: FlagStatus
  reviewerId: string | null
  assigneeId: string | null
  dueAt: string | null
  /** Draft response being prepared by the MDA (not yet submitted). */
  draft: { explanation: string; correctiveAction: string; evidence: EvidenceFile[] }
  responses: FlagResponse[]
  history: FlagHistoryEntry[]
  comments: Comment[]
  closedOutcome: 'Resolved' | 'Rejected' | null
}

// ---- Reconciliation (FRD §4.5) ------------------------------------------------------

export type RecStatus = 'Open' | 'In Progress' | 'Matched' | 'Variance' | 'Reviewed' | 'Closed'
export type RecType = 'TSA' | 'Vendor'
export type RecLineStatus = 'Matched' | 'System only' | 'External only' | 'Amount differs'

export interface RecLine {
  id: string
  reference: string
  vendor: string
  systemAmount: number | null
  externalAmount: number | null
  status: RecLineStatus
  explanation: string
}

export interface TsaLine {
  reference: string
  date: string
  payee: string
  amount: number
}

export interface Reconciliation {
  id: string
  type: RecType
  mdaId: string
  periodId: string
  status: RecStatus
  systemValue: number
  externalValue: number
  lines: RecLine[]
  reviewNote: string
  createdBy: string
  createdAt: string
  history: { id: string; at: string; actorId: string; from: RecStatus | null; to: RecStatus; note?: string }[]
}

// ---- Audit ledger (FRD §4.8, §14) ---------------------------------------------------

export type AuditEntity = 'Session' | 'User' | 'Return' | 'Flag' | 'Reconciliation' | 'Config' | 'Period' | 'MDA' | 'Report' | 'Rules'

export interface AuditEvent {
  id: string
  seq: number
  at: string
  actorId: string
  action: string
  entityType: AuditEntity
  entityId: string
  mdaId: string | null
  summary: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  /** For correction/reversal events: the event being corrected (BR-007). */
  correctsEventId?: string
  source: 'Portal' | 'Rule engine' | 'Mock GIFMIS' | 'Mock TSA' | 'Prototype auth'
  /** Chained checksum of the previous event (demonstration only, not cryptographic). */
  prevHash: string
  hash: string
}

// ---- Configuration (FRD §4.10) ------------------------------------------------------

export interface RuleConfig {
  overspend: { enabled: boolean; criticalAbovePct: number }
  velocity: { enabled: boolean; paceMultiple: number; minUtilizationPct: number }
  milestone: { enabled: boolean; tolerancePts: number }
  duplication: {
    enabled: boolean
    matchVendor: boolean
    matchAmount: boolean
    amountTolerancePct: number
    samePeriod: boolean
    matchService: boolean
  }
  responseSlaDays: Record<Severity, number>
}

export interface SecurityConfig {
  sessionTimeoutMin: number
  mfaRoles: RoleId[]
}
