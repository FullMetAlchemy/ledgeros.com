// Shared domain model for the MDA portal and the oversight console.

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Rating = 'High Risk' | 'Warning' | 'Clear'

export type RoleId =
  | 'finance_officer'
  | 'dfa'
  | 'head_ia'
  | 'accounting_officer'
  | 'auditor'
  | 'treasury'

/** A step in the MDA's internal sign-off chain. */
export type ChainStep = 'prepare' | 'review' | 'check' | 'attest'

export interface User {
  id: string
  name: string
  initials: string
  role: RoleId
  /** null for oversight-side users, who can see every MDA. */
  mdaId: string | null
  title: string
}

export interface Transaction {
  ref: string
  date: string
  payee: string
  amount: number
}

export interface ReleaseRequest {
  ref: string
  vote: string
  amount: number
  requested: string
}

export interface Mda {
  id: string
  code: string
  acronym: string
  name: string
  appropriated: number
  released: number
  utilized: number
  unretired: number
  transactions: Transaction[]
  releaseRequests: ReleaseRequest[]
}

export type FlagType =
  | 'velocity'
  | 'milestone_mismatch'
  | 'unretired_advance'
  | 'capital_vote_depleted'
  | 'duplicate_invoicing'
  | 'procurement_breach'
  | 'threshold_splitting'
  | 'low_absorption'

export type FlagState =
  | 'Raised'
  | 'Acknowledged'
  | 'Drafting'
  | 'InChain'
  | 'OversightReview'
  | 'InfoRequested'
  | 'Resolved'
  | 'Escalated'
  | 'Reopened'

export type ResponseType = 'justify' | 'correct' | 'dispute' | 'extension'

export interface EvidenceFile {
  id: string
  slotId: string
  name: string
  size: number
  mime: string
  /** SHA-256 of the file bytes, hex encoded. Computed in the browser at upload. */
  sha256: string
  uploadedBy: string
  uploadedAt: string
}

export interface ResponseDraft {
  type: ResponseType | null
  answers: Record<string, string>
  narrative: string
  evidence: EvidenceFile[]
  correctiveRef: string
  extensionDate: string
  /** Written justifications for "needs justification" issues, keyed by issue id. */
  justifications: Record<string, string>
  /** Wizard step to resume at. */
  step: number
  updatedAt: string | null
  updatedBy: string | null
}

export interface ChainAct {
  step: ChainStep
  userId: string
  at: string
}

export interface Attestation {
  userId: string
  at: string
  declaration: string
  keyVerified: boolean
}

export type EscalationReason = 'ack_overdue' | 'resolve_overdue' | 'rejected'

export interface HistoryEntry {
  id: string
  at: string
  actorId: string
  event: FlagEvent['type']
  from: FlagState
  to: FlagState
  note?: string
}

export interface Comment {
  id: string
  at: string
  authorId: string
  side: 'mda' | 'oversight'
  body: string
}

export interface Flag {
  id: string
  mdaId: string
  type: FlagType
  severity: Severity
  description: string
  observed: string
  threshold: string
  relatedRefs: string[]
  state: FlagState
  raisedAt: string
  ackDueAt: string
  resolveDueAt: string
  ownerId: string | null
  draft: ResponseDraft
  /** Snapshot of the draft taken on submit; this is what the chain signs. */
  submitted: ResponseDraft | null
  chain: ChainAct[]
  attestation: Attestation | null
  /** True after a reviewer sends the response back; cleared on resubmit. */
  returned: boolean
  extensionUsed: boolean
  escalations: EscalationReason[]
  /** Response cycle; increments whenever drafting restarts after a submission. */
  cycle: number
  history: HistoryEntry[]
  comments: Comment[]
}

export type FlagEvent =
  | { type: 'ACKNOWLEDGE' }
  | { type: 'ASSIGN'; ownerId: string }
  | { type: 'SUBMIT' }
  | { type: 'APPROVE_STEP'; attestation?: { declaration: string; keyVerified: boolean } }
  | { type: 'RETURN'; comment: string }
  | { type: 'ACCEPT'; comment?: string }
  | { type: 'REQUEST_INFO'; comment: string }
  | { type: 'REJECT'; comment: string }
  | { type: 'RESUME' }
  | { type: 'REOPEN'; comment: string }
  | { type: 'ESCALATE'; reason: Exclude<EscalationReason, 'rejected'> }

export type Actor = User | 'system'
