// The whole prototype dataset. In production each collection is a service
// behind an API; here it is one object held by the client store.

import type {
  Advance,
  AuditEvent,
  EconomicCode,
  ExpenditureReturn,
  FinancialPeriod,
  Flag,
  FundRelease,
  LedgerExpenditure,
  Mda,
  Project,
  Reconciliation,
  RevenueRecord,
  RuleConfig,
  SecurityConfig,
  Transaction,
  TsaLine,
  User,
  Vendor,
} from './types'

export interface Dataset {
  users: User[]
  mdas: Mda[]
  periods: FinancialPeriod[]
  economicCodes: EconomicCode[]
  releases: FundRelease[]
  ledgerExpenditure: LedgerExpenditure[]
  revenue: RevenueRecord[]
  advances: Advance[]
  vendors: Vendor[]
  projects: Project[]
  returns: ExpenditureReturn[]
  flags: Flag[]
  reconciliations: Reconciliation[]
  /** Mock TSA statements keyed `${mdaId}:${periodId}`. */
  tsaStatements: Record<string, TsaLine[]>
  /** Mock GIFMIS postings available for import, keyed `${mdaId}:${periodId}`. */
  gifmisPostings: Record<string, Omit<Transaction, 'id' | 'source'>[]>
  audit: AuditEvent[]
  ruleConfig: RuleConfig
  securityConfig: SecurityConfig
  counters: { flag: number; rec: number; user: number }
}

export const key = (mdaId: string, periodId: string) => `${mdaId}:${periodId}`
