// Financial periods: FY2026, monthly. A reporting scope is a month, the quarter
// to date, or the year to date ending at a selected month.

import type { FinancialPeriod, PeriodStatus } from './types'

export const FY = 2026
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const periodId = (month: number, year = FY) => `${year}-${String(month).padStart(2, '0')}`
export const monthOf = (id: string) => Number(id.slice(5, 7))

export function buildPeriods(statusFor: (month: number) => PeriodStatus): FinancialPeriod[] {
  return MONTH_NAMES.map((name, i) => ({
    id: periodId(i + 1),
    label: `${name} ${FY}`,
    year: FY,
    month: i + 1,
    quarter: Math.floor(i / 3) + 1,
    status: statusFor(i + 1),
  }))
}

export type ScopeMode = 'month' | 'qtd' | 'ytd'

export interface PeriodScope {
  mode: ScopeMode
  /** The period the scope ends at. */
  periodId: string
}

/** Months (1-12) covered by a scope. */
export function monthsIn(scope: PeriodScope): number[] {
  const m = monthOf(scope.periodId)
  const start = scope.mode === 'month' ? m : scope.mode === 'qtd' ? Math.floor((m - 1) / 3) * 3 + 1 : 1
  return Array.from({ length: m - start + 1 }, (_, i) => start + i)
}

export function scopeLabel(scope: PeriodScope): string {
  const m = monthOf(scope.periodId)
  const name = MONTH_SHORT[m - 1]
  if (scope.mode === 'month') return `${MONTH_NAMES[m - 1]} ${FY}`
  if (scope.mode === 'qtd') return `Q${Math.floor((m - 1) / 3) + 1} ${FY} to ${name}`
  return `FY${FY} to ${name}`
}

/** Last calendar day of a period, as YYYY-MM-DD. */
export function periodEnd(id: string): string {
  const [y, m] = id.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

export function periodStart(id: string): string {
  return `${id}-01`
}

/** Share of the fiscal year elapsed at the end of a month. */
export const elapsedShare = (month: number) => month / 12
