import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface SummaryIssue {
  id: string
  tier: 'blocking' | 'warning'
  message: string
  /** Where to fix it, e.g. a wizard section label. */
  where?: string
}

/** Issues grouped by tier. Blocking issues stop submission; warnings do not. */
export function ValidationSummary({ issues, onJump }: { issues: SummaryIssue[]; onJump?: (issue: SummaryIssue) => void }) {
  const blocking = issues.filter((i) => i.tier === 'blocking')
  const warnings = issues.filter((i) => i.tier === 'warning')
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ok-bd bg-ok-bg px-4 py-3 text-sm text-ok-fg" role="status">
        <CheckCircle2 size={16} aria-hidden /> All checks passed. Nothing prevents submission.
      </div>
    )
  }
  const group = (list: SummaryIssue[], tier: 'blocking' | 'warning') =>
    list.length > 0 && (
      <div className={`rounded-lg border px-4 py-3 ${tier === 'blocking' ? 'border-crit-bd bg-crit-bg' : 'border-warn-bd bg-warn-bg'}`}>
        <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${tier === 'blocking' ? 'text-crit-fg' : 'text-warn-fg'}`}>
          {tier === 'blocking' ? <AlertCircle size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
          {tier === 'blocking' ? `Fix before submitting · ${list.length}` : `Warnings (won’t block) · ${list.length}`}
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {list.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 text-[13px] text-ink-2">
              <span>{i.message}</span>
              {onJump && i.where && (
                <button type="button" className="shrink-0 cursor-pointer font-mono text-[11px] text-accent hover:underline" onClick={() => onJump(i)}>
                  Go to {i.where} →
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="flex flex-col gap-3" role="status">
      {group(blocking, 'blocking')}
      {group(warnings, 'warning')}
    </div>
  )
}
