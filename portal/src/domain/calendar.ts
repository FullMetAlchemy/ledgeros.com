// Working-day arithmetic for response deadlines.
// Weekends are skipped. Public holidays are not yet modelled (needs the
// Federal Government gazetted holiday list as data).

const CLOSE_OF_BUSINESS_HOUR = 17

export function isWorkingDay(d: Date): boolean {
  const day = d.getDay()
  return day !== 0 && day !== 6
}

/** Deadline `n` working days after `from`, at close of business (17:00 local). */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    if (isWorkingDay(d)) added++
  }
  d.setHours(CLOSE_OF_BUSINESS_HOUR, 0, 0, 0)
  return d
}

/** Move a date back by `n` working days, keeping its time of day. */
export function subtractWorkingDays(from: Date, n: number): Date {
  const d = new Date(from)
  let removed = 0
  while (removed < n) {
    d.setDate(d.getDate() - 1)
    if (isWorkingDay(d)) removed++
  }
  return d
}

/** Whole working days from `a` to `b` (calendar-date based, may be negative). */
export function workingDaysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  const sign = end >= start ? 1 : -1
  const cur = new Date(sign > 0 ? start : end)
  const stop = sign > 0 ? end : start
  let n = 0
  while (cur < stop) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur)) n++
  }
  return n * sign
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function dateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

export function clock(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
