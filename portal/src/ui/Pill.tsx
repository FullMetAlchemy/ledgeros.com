import { shortDate, workingDaysBetween } from '../domain/calendar'
import { activeDeadline, SOON_WITHIN_WORKING_DAYS } from '../domain/policy'
import type { Flag, Rating, Severity } from '../domain/types'
import { DEADLINE_TEXT, DOT, flagStatus, PILL, RATING_TONE, SEVERITY_BG, type Tone } from './tone'

export function StatusPill({ tone, label, className = '' }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-px text-xs font-semibold leading-5 ${PILL[tone]} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  )
}

export function RatingPill({ rating }: { rating: Rating }) {
  return <StatusPill tone={RATING_TONE[rating]} label={rating} />
}

export function FlagStatePill({ flag }: { flag: Flag }) {
  const s = flagStatus(flag)
  return <StatusPill tone={s.tone} label={s.label} />
}

/** Solid square tag, deliberately a different shape from status pills. */
export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-4 tracking-wider text-white ${SEVERITY_BG[severity]}`}
    >
      {severity}
    </span>
  )
}

/** Deadline for anything with a due date; `open` false shows the closed label instead. */
export function DueChip({ due, open = true, closedLabel = 'Closed', now = new Date() }: { due: string; open?: boolean; closedLabel?: string; now?: Date }) {
  if (!open) return <span className="font-mono text-[11px] whitespace-nowrap text-muted">{closedLabel}</span>
  const dueDate = new Date(due)
  const days = workingDaysBetween(now, dueDate)
  const status = now > dueDate ? 'over' : days <= SOON_WITHIN_WORKING_DAYS ? 'soon' : 'ok'
  const text = status === 'over' ? `Overdue ${Math.max(1, -days)}d` : days === 0 ? 'Due today' : `Due ${shortDate(dueDate)}`
  return (
    <span className={`font-mono text-[11px] font-medium whitespace-nowrap ${DEADLINE_TEXT[status]}`} title={`Due ${dueDate.toLocaleString('en-GB')}`}>
      {status === 'over' && <span aria-hidden>▲ </span>}
      {text}
    </span>
  )
}

export function DeadlineChip({ flag, now = new Date() }: { flag: Flag; now?: Date }) {
  const d = activeDeadline(flag, now)
  if (!d) return <span className="font-mono text-[11px] text-muted">Closed</span>
  const what = d.kind === 'ack' ? 'Ack' : 'Due'
  const text =
    d.status === 'over'
      ? `${d.kind === 'ack' ? 'Ack overdue' : 'Overdue'} ${Math.max(1, -d.days)}d`
      : d.days === 0
        ? `${what} today`
        : `${what} ${shortDate(d.due)}`
  return (
    <span className={`whitespace-nowrap font-mono text-[11px] font-medium ${DEADLINE_TEXT[d.status]}`} title={`${d.kind === 'ack' ? 'Acknowledge' : 'Resolve'} by ${new Date(d.due).toLocaleString('en-GB')}`}>
      {d.status === 'over' && <span aria-hidden>▲ </span>}
      {text}
    </span>
  )
}
