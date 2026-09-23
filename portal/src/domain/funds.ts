// Monthly allocation (warrant releases) and expenditure (GIFMIS postings) for
// FY2026 to date, in naira. Monthly figures sum to each MDA's prototype totals.

import { B } from './money'
import type { Mda } from './types'

export interface MonthPoint {
  month: string
  allocation: number
  expenditure: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']

const SERIES: Record<string, { allocation: number[]; expenditure: number[] }> = {
  FMW: { allocation: [60, 55, 70, 62, 68, 75, 70, 72, 80], expenditure: [52, 58, 66, 60, 64, 72, 73, 70, 83.4] },
  FMH: { allocation: [50, 48, 52, 55, 54, 58, 56, 57, 58], expenditure: [38, 42, 45, 44, 46, 47, 46, 48, 46.5] },
}

/**
 * Monthly series for an MDA. Releases approved since the ledger snapshot (e.g.
 * by Treasury in this session) are added to the latest month, so the chart
 * always totals to the MDA's current released figure.
 */
export function monthlySeries(mda: Mda): MonthPoint[] {
  const s = SERIES[mda.id]
  if (!s) return []
  const points = MONTHS.map((month, i) => ({ month, allocation: s.allocation[i] * B, expenditure: s.expenditure[i] * B }))
  const allocated = points.reduce((a, p) => a + p.allocation, 0)
  const extra = mda.released - allocated
  if (Math.abs(extra) >= 1) points[points.length - 1] = { ...points[points.length - 1], allocation: points[points.length - 1].allocation + extra }
  return points
}
