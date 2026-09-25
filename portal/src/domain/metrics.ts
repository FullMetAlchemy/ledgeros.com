// Calculation rules (FRD §10). Every figure is derived from records, so the
// dashboard always reconciles to the returns, releases and ledger behind it
// ("one financial picture"). Rates return null when the denominator is zero,
// and the UI shows "not calculable" rather than a misleading 0 or ∞.

import type { Dataset } from './dataset'
import { FY, monthOf, monthsIn, periodEnd, periodId, type PeriodScope } from './periods'
import type { ExpenditureReturn, Flag, Rating } from './types'

/** Return statuses whose figures count toward utilization. */
export const COUNTED: ExpenditureReturn['status'][] = ['Submitted', 'Under Review', 'Accepted', 'Closed']

export const returnTotal = (r: Pick<ExpenditureReturn, 'transactions'>) => r.transactions.reduce((a, t) => a + t.amount, 0)

export function rate(numerator: number, denominator: number): number | null {
  return denominator ? (numerator / denominator) * 100 : null
}

/** Expenditure recognised for an MDA in one month, and where it came from. */
export function monthExpenditure(ds: Dataset, mdaId: string, month: number): { amount: number; source: string } {
  const pid = periodId(month)
  const ret = ds.returns.find((r) => r.mdaId === mdaId && r.periodId === pid)
  if (ret) {
    if (COUNTED.includes(ret.status)) return { amount: returnTotal(ret), source: ret.id }
    // A correction or revision in progress keeps the last submitted figures.
    const last = ret.versions.at(-1)
    if (last) return { amount: last.total, source: `${ret.id} v${last.version}` }
  }
  const ledger = ds.ledgerExpenditure.find((l) => l.mdaId === mdaId && l.periodId === pid)
  return ledger ? { amount: ledger.amount, source: ledger.source } : { amount: 0, source: 'No return' }
}

export interface Position {
  appropriation: number
  released: number
  utilized: number
  unretired: number
  /** Expenditure in the scope's last month. */
  monthExpenditure: number
  releaseRate: number | null
  utilizationRate: number | null
  /** Utilized − approved allocation (positive = overspent). */
  allocationVariance: number
  /** Released − approved allocation. */
  releaseVariance: number
}

export function mdaPosition(ds: Dataset, mdaId: string, scope: PeriodScope): Position {
  const mda = ds.mdas.find((m) => m.id === mdaId)
  const appropriation = mda?.appropriation ?? 0
  const months = monthsIn(scope)
  const ids = new Set(months.map((m) => periodId(m)))
  const released = ds.releases.filter((r) => r.mdaId === mdaId && ids.has(r.periodId)).reduce((a, r) => a + r.amount, 0)
  const utilized = months.reduce((a, m) => a + monthExpenditure(ds, mdaId, m).amount, 0)
  const end = periodEnd(scope.periodId)
  const unretired = ds.advances
    .filter((a) => a.mdaId === mdaId && a.disbursedOn <= end && (!a.retiredOn || a.retiredOn > end))
    .reduce((a, x) => a + x.amount, 0)
  return {
    appropriation,
    released,
    utilized,
    unretired,
    monthExpenditure: monthExpenditure(ds, mdaId, monthOf(scope.periodId)).amount,
    releaseRate: rate(released, appropriation),
    utilizationRate: rate(utilized, appropriation),
    allocationVariance: utilized - appropriation,
    releaseVariance: released - appropriation,
  }
}

export interface StatePosition extends Position {
  expectedRevenue: number
  collectedRevenue: number
  collectionRate: number | null
}

export function statePosition(ds: Dataset, scope: PeriodScope, mdaIds?: string[]): StatePosition {
  const ids = mdaIds ?? ds.mdas.filter((m) => m.status === 'Active').map((m) => m.id)
  const parts = ids.map((id) => mdaPosition(ds, id, scope))
  const sum = (k: keyof Position) => parts.reduce((a, p) => a + ((p[k] as number) ?? 0), 0)
  const periods = new Set(monthsIn(scope).map((m) => periodId(m)))
  const rev = ds.revenue.filter((r) => periods.has(r.periodId))
  const expectedRevenue = rev.reduce((a, r) => a + r.expected, 0)
  const collectedRevenue = rev.reduce((a, r) => a + r.collected, 0)
  const appropriation = sum('appropriation')
  const released = sum('released')
  const utilized = sum('utilized')
  return {
    appropriation,
    released,
    utilized,
    unretired: sum('unretired'),
    monthExpenditure: sum('monthExpenditure'),
    releaseRate: rate(released, appropriation),
    utilizationRate: rate(utilized, appropriation),
    allocationVariance: utilized - appropriation,
    releaseVariance: released - appropriation,
    expectedRevenue,
    collectedRevenue,
    collectionRate: rate(collectedRevenue, expectedRevenue),
  }
}

/** Monthly series for charts: released and utilized per month, plus cumulative. */
export function monthlySeries(ds: Dataset, mdaIds: string[], toMonth: number) {
  let cumRel = 0
  let cumUtil = 0
  return Array.from({ length: toMonth }, (_, i) => {
    const m = i + 1
    const pid = periodId(m)
    const released = ds.releases.filter((r) => mdaIds.includes(r.mdaId) && r.periodId === pid).reduce((a, r) => a + r.amount, 0)
    const utilized = mdaIds.reduce((a, id) => a + monthExpenditure(ds, id, m).amount, 0)
    const rev = ds.revenue.filter((r) => r.periodId === pid)
    cumRel += released
    cumUtil += utilized
    return {
      month: m,
      periodId: pid,
      released,
      utilized,
      cumulativeReleased: cumRel,
      cumulativeUtilized: cumUtil,
      expectedRevenue: rev.reduce((a, r) => a + r.expected, 0),
      collectedRevenue: rev.reduce((a, r) => a + r.collected, 0),
    }
  })
}

// ---- Risk status (derived from active flags) ------------------------------------

export const isActiveFlag = (f: Pick<Flag, 'status'>) => f.status !== 'Closed'

export function ratingFor(flags: Flag[]): Rating {
  const active = flags.filter(isActiveFlag)
  if (active.some((f) => f.severity === 'Critical' || f.severity === 'High')) return 'High Risk'
  if (active.length) return 'Warning'
  return 'Clear'
}

export const mdaRating = (ds: Dataset, mdaId: string) => ratingFor(ds.flags.filter((f) => f.mdaId === mdaId))

export const FISCAL_YEAR = FY
