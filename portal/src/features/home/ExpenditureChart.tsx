import { BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { MonthPoint } from '../../domain/funds'
import { naira, pct } from '../../domain/money'

const SERIES = [
  { key: 'allocation', label: 'Allocation (released)', color: 'var(--chart-1)' },
  { key: 'expenditure', label: 'Expenditure (utilised)', color: 'var(--chart-2)' },
] as const

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const alloc = Number(payload.find((p) => p.dataKey === 'allocation')?.value ?? 0)
  const spend = Number(payload.find((p) => p.dataKey === 'expenditure')?.value ?? 0)
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-lg shadow-slate-900/10">
      <div className="mb-1.5 font-semibold text-ink">{label} 2026</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="font-mono font-medium text-ink tabular">{naira(s.key === 'allocation' ? alloc : spend)}</span>
        </div>
      ))}
      <div className="mt-1.5 border-t border-line pt-1.5 text-muted">
        Spent <span className="font-mono text-ink">{pct(spend, alloc, 0)}</span> of the month’s allocation
      </div>
    </div>
  )
}

/** Monthly expenditure vs. allocation, with a table view for screen readers and print. */
export function ExpenditureChart({ data }: { data: MonthPoint[] }) {
  const [asTable, setAsTable] = useState(false)
  const totalA = data.reduce((a, p) => a + p.allocation, 0)
  const totalE = data.reduce((a, p) => a + p.expenditure, 0)

  return (
    <section className="rounded-lg border border-line bg-surface shadow-sm shadow-slate-900/[0.03] transition-colors duration-200">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Monthly expenditure vs. allocation</h2>
          <p className="text-xs text-muted">
            FY2026 to date · {naira(totalE)} spent of {naira(totalA)} released ({pct(totalE, totalA)})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ul className="flex gap-3 text-xs text-ink-2" aria-label="Legend">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setAsTable((t) => !t)}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-sunk"
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>

      {asTable ? (
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[420px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
                <th className="py-1.5 font-semibold">Month</th>
                <th className="py-1.5 text-right font-semibold">Allocation</th>
                <th className="py-1.5 text-right font-semibold">Expenditure</th>
                <th className="py-1.5 text-right font-semibold">Spent</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {data.map((p) => (
                <tr key={p.month} className="border-t border-line">
                  <td className="py-1.5 font-sans">{p.month}</td>
                  <td className="py-1.5 text-right">{naira(p.allocation)}</td>
                  <td className="py-1.5 text-right">{naira(p.expenditure)}</td>
                  <td className="py-1.5 text-right">{pct(p.expenditure, p.allocation, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 px-2 pt-4 pb-2" role="img" aria-label={`Bar chart of monthly allocation and expenditure. ${naira(totalE)} spent of ${naira(totalA)} released.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: 'var(--line-2)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
                tickFormatter={(v: number) => `₦${Math.round(v / 1e9)}B`}
              />
              <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: 'var(--sunk)' }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
