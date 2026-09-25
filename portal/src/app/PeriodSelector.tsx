import { CalendarRange } from 'lucide-react'
import { MONTH_SHORT, type ScopeMode } from '../domain/periods'
import { store, useDs, useScope } from '../state/store'

const MODES: { id: ScopeMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'qtd', label: 'Quarter to date' },
  { id: 'ytd', label: 'Year to date' },
]

/** Financial period control (FR-DASH-007, PRD-003). Future months can't be selected. */
export function PeriodSelector() {
  const ds = useDs()
  const scope = useScope()
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 transition-colors duration-200" role="group" aria-label="Financial period">
      <CalendarRange size={15} aria-hidden className="text-muted" />
      <label className="sr-only" htmlFor="scope-mode">
        Period type
      </label>
      <select
        id="scope-mode"
        value={scope.mode}
        onChange={(e) => store.setScope({ ...scope, mode: e.target.value as ScopeMode })}
        className="h-7 cursor-pointer rounded bg-transparent pr-1 text-[12.5px] font-medium text-ink outline-none"
      >
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <label className="sr-only" htmlFor="scope-period">
        Period
      </label>
      <select
        id="scope-period"
        value={scope.periodId}
        onChange={(e) => store.setScope({ ...scope, periodId: e.target.value })}
        className="h-7 cursor-pointer rounded bg-transparent pr-1 font-mono text-[12.5px] text-ink outline-none"
      >
        {ds.periods.map((p) => (
          <option key={p.id} value={p.id} disabled={p.status === 'Future'}>
            {MONTH_SHORT[p.month - 1]} {p.year}
            {p.status === 'Open' ? ' · open' : p.status === 'Future' ? ' · not yet open' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
