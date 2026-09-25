import { Info, type LucideIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

/** A small "i" that reveals how a figure is calculated (FRD §9, PRD §12.4). */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`How ${label} is calculated`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help rounded-full text-faint hover:text-ink"
      >
        <Info size={13} aria-hidden />
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute top-5 left-1/2 z-50 w-64 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-left text-xs leading-relaxed font-normal text-ink-2 shadow-lg shadow-slate-900/10">
          {children}
        </span>
      )}
    </span>
  )
}

/** KPI card (UI-002): value, period context, restrained semantic indicator. */
export function Kpi({
  label,
  value,
  context,
  icon: Icon,
  formula,
  indicator,
  children,
}: {
  label: string
  value: string
  context?: ReactNode
  icon?: LucideIcon
  formula?: ReactNode
  indicator?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm shadow-slate-900/[0.03] transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
          {label}
          {formula && <InfoTip label={label}>{formula}</InfoTip>}
        </span>
        {Icon && <Icon size={15} aria-hidden className="text-faint" />}
      </div>
      <span className="font-mono text-[22px] leading-tight font-semibold tracking-tight text-ink tabular">{value}</span>
      {children}
      {(context || indicator) && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {indicator}
          {context}
        </span>
      )}
    </div>
  )
}
