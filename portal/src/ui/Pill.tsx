import { AlertOctagon, AlertTriangle, ArrowDown, CheckCircle2, ChevronsUp, Circle, Minus, type LucideIcon } from 'lucide-react'
import { shortDate, workingDaysBetween } from '../domain/calendar'
import type { Rating, Severity } from '../domain/types'
import { PILL, RATING_TONE, SEVERITY_TONE, type Tone } from './tone'

/** Status pill: text + dot/icon + restrained colour. */
export function StatusPill({ tone, label, icon: Icon, className = '' }: { tone: Tone; label: string; icon?: LucideIcon; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-px text-xs leading-5 font-semibold whitespace-nowrap ${PILL[tone]} ${className}`}>
      {Icon ? <Icon size={13} aria-hidden /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {label}
    </span>
  )
}

const RATING_ICON: Record<Rating, LucideIcon> = { 'High Risk': AlertOctagon, Warning: AlertTriangle, Clear: CheckCircle2 }

export function RiskBadge({ rating }: { rating: Rating }) {
  return <StatusPill tone={RATING_TONE[rating]} label={rating} icon={RATING_ICON[rating]} />
}

const SEVERITY_ICON: Record<Severity, LucideIcon> = { Critical: ChevronsUp, High: AlertTriangle, Medium: Minus, Low: ArrowDown }

/** Severity: tinted, iconed and labelled; distinct but not aggressive. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEVERITY_ICON[severity]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] leading-5 font-semibold whitespace-nowrap ${PILL[SEVERITY_TONE[severity]]}`}>
      <Icon size={12} aria-hidden />
      {severity}
    </span>
  )
}

/** A due date, amber when close and rose when overdue (text + icon, not colour alone). */
export function DueChip({ due, open = true, closedLabel = '—', now = new Date() }: { due: string | null; open?: boolean; closedLabel?: string; now?: Date }) {
  if (!due || !open) return <span className="font-mono text-[11px] whitespace-nowrap text-muted">{closedLabel}</span>
  const d = new Date(due)
  const days = workingDaysBetween(now, d)
  const over = now > d
  const soon = !over && days <= 2
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium whitespace-nowrap ${over ? 'text-crit-fg' : soon ? 'text-warn-fg' : 'text-muted'}`}
      title={`Due ${d.toLocaleString('en-GB')}`}
    >
      {over ? <AlertTriangle size={12} aria-hidden /> : <Circle size={8} aria-hidden className="fill-current opacity-60" />}
      {over ? `Overdue ${Math.max(1, -days)}d` : days === 0 ? 'Due today' : `Due ${shortDate(d)}`}
    </span>
  )
}
