export const B = 1e9

/** Compact naira, matching the oversight console: ₦1.02T, ₦612.0B, ₦250M. */
export function naira(v: number): string {
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e12) return `${sign}₦${(a / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `${sign}₦${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}₦${(a / 1e6).toFixed(0)}M`
  return `${sign}₦${Math.round(a).toLocaleString('en-NG')}`
}

/** Exact naira with thousands separators, for amounts people check line by line. */
export function nairaExact(v: number): string {
  const sign = v < 0 ? '−' : ''
  return `${sign}₦${Math.abs(v).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`
}

export function pct(part: number, whole: number, digits = 1): string {
  if (!whole) return '0%'
  return `${((part / whole) * 100).toFixed(digits)}%`
}
