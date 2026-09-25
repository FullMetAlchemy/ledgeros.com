import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { naira } from '../../domain/money'

// FRD §17: neutral series with one restrained accent. Colours validated with the
// dataviz palette checker; the light neutral sits below 3:1, so every chart has
// a legend and a table view.
const NEUTRAL = 'var(--chart-neutral)'
const ACCENT = 'var(--chart-accent)'

export interface SeriesDef<K extends string> {
  key: K
  label: string
  role: 'neutral' | 'accent'
}

const axisTick = { fill: 'var(--muted)', fontSize: 11 }
const moneyTick = (v: number) => (Math.abs(v) >= 1e12 ? `₦${(v / 1e12).toFixed(1)}T` : `₦${Math.round(v / 1e9)}B`)

function Legend<K extends string>({ series }: { series: SeriesDef<K>[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-ink-2" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: s.role === 'accent' ? ACCENT : NEUTRAL }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

function Tip<K extends string>({ active, payload, label, series, footer }: TooltipContentProps<ValueType, NameType> & { series: SeriesDef<K>[]; footer?: (row: Record<string, number>) => ReactNode }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Record<string, number>
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-lg shadow-slate-900/10">
      <div className="mb-1.5 font-semibold text-ink">{label}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: s.role === 'accent' ? ACCENT : NEUTRAL }} />
            {s.label}
          </span>
          <span className="font-mono font-medium text-ink tabular">{naira(row[s.key] ?? 0)}</span>
        </div>
      ))}
      {footer && <div className="mt-1.5 border-t border-line pt-1.5 text-muted">{footer(row)}</div>}
    </div>
  )
}

/** Chart card with a legend and a chart/table toggle (UI-005). */
export function ChartCard<K extends string>({
  title,
  subtitle,
  series,
  data,
  xKey,
  kind,
  reference,
  footer,
  height = 240,
}: {
  title: string
  subtitle?: ReactNode
  series: SeriesDef<K>[]
  data: (Record<K, number> & Record<string, string | number>)[]
  xKey: string
  kind: 'bars' | 'lines'
  reference?: { value: number; label: string }
  footer?: (row: Record<string, number>) => ReactNode
  height?: number
}) {
  const [table, setTable] = useState(false)
  const described = `${title}. ${series.map((s) => s.label).join(' and ')} by ${xKey}.`
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-line bg-surface shadow-sm shadow-slate-900/[0.03] transition-colors duration-200">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Legend series={series} />
          <button
            type="button"
            aria-pressed={table}
            onClick={() => setTable((t) => !t)}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-sunk"
          >
            {table ? <BarChart3 size={13} aria-hidden /> : <Table2 size={13} aria-hidden />}
            {table ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>
      {table ? (
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[360px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
                <th className="py-1.5 font-semibold capitalize">{xKey}</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1.5 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {data.map((row) => (
                <tr key={String(row[xKey])} className="border-t border-line">
                  <td className="py-1.5 font-sans">{row[xKey]}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 text-right">
                      {naira(Number(row[s.key]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pt-4 pb-2" style={{ height }} role="img" aria-label={described}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'bars' ? (
              <BarChart data={data} barGap={2} barCategoryGap="26%" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-2)' }} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} width={54} tick={{ ...axisTick, fontFamily: 'IBM Plex Mono, monospace' }} tickFormatter={moneyTick} />
                <Tooltip content={(p) => <Tip {...p} series={series} footer={footer} />} cursor={{ fill: 'var(--sunk)' }} />
                {series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.role === 'accent' ? ACCENT : NEUTRAL} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-2)' }} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} width={58} tick={{ ...axisTick, fontFamily: 'IBM Plex Mono, monospace' }} tickFormatter={moneyTick} />
                <Tooltip content={(p) => <Tip {...p} series={series} footer={footer} />} />
                {reference && (
                  <ReferenceLine y={reference.value} stroke="var(--chart-ref)" strokeDasharray="4 4" label={{ value: reference.label, position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }} />
                )}
                {series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.role === 'accent' ? ACCENT : NEUTRAL}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
