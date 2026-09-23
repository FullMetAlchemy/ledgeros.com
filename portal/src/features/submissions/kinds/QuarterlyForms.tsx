import { naira, pct } from '../../../domain/money'
import type { QuarterlyData, QuarterRow } from '../../../domain/submissions/types'
import { QUARTER_COMMENT_BELOW } from '../../../domain/submissions/validation'
import { Field, TextArea } from '../../../ui/Field'
import type { DetailsProps, ViewProps } from './types'

const flagged = (r: QuarterRow) => (r.released ? r.utilized / r.released : 1) < QUARTER_COMMENT_BELOW

function Figures({ data }: { data: QuarterlyData }) {
  const sum = (k: 'appropriated' | 'released' | 'utilized') => data.rows.reduce((a, r) => a + r[k], 0)
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="bg-sunk text-right">
            {['Category', 'Appropriated', 'Released', 'Utilised', 'Absorption'].map((h, i) => (
              <th key={h} className={`px-3.5 py-2 text-[11px] font-semibold tracking-wider text-muted uppercase ${i === 0 ? 'text-left' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular">
          {data.rows.map((r) => (
            <tr key={r.category} className="border-t border-line text-right">
              <td className="px-3.5 py-2 text-left font-sans font-medium">{r.category}</td>
              <td className="px-3.5 py-2">{naira(r.appropriated)}</td>
              <td className="px-3.5 py-2">{naira(r.released)}</td>
              <td className="px-3.5 py-2">{naira(r.utilized)}</td>
              <td className={`px-3.5 py-2 font-semibold ${flagged(r) ? 'text-warn-fg' : ''}`}>
                {flagged(r) && <span aria-hidden>▲ </span>}
                {pct(r.utilized, r.released)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-line-2 text-right font-semibold">
            <td className="px-3.5 py-2 text-left font-sans">Total</td>
            <td className="px-3.5 py-2">{naira(sum('appropriated'))}</td>
            <td className="px-3.5 py-2">{naira(sum('released'))}</td>
            <td className="px-3.5 py-2">{naira(sum('utilized'))}</td>
            <td className="px-3.5 py-2">{pct(sum('utilized'), sum('released'))}</td>
          </tr>
        </tbody>
      </table>
      <div className="border-t border-line px-3.5 py-1.5 font-mono text-[11px] text-muted">
        Calculated from GIFMIS · ▲ below {QUARTER_COMMENT_BELOW * 100}% absorption needs commentary
      </div>
    </div>
  )
}

export function QuarterlyScope({ data }: ViewProps<QuarterlyData>) {
  return <Figures data={data} />
}

export function QuarterlyDetails({ data, update, error }: DetailsProps<QuarterlyData>) {
  const setRow = (category: QuarterRow['category'], commentary: string) =>
    update({ rows: data.rows.map((r) => (r.category === category ? { ...r, commentary } : r)) })
  const anyFlagged = data.rows.some(flagged)
  return (
    <div className="flex flex-col gap-5">
      <Figures data={data} />
      {data.rows.map((r) => (
        <Field
          key={r.category}
          id={`row:${r.category}`}
          label={`${r.category}: commentary ${flagged(r) ? '(required)' : '(optional)'}`}
          help={flagged(r) ? `Absorption is ${pct(r.utilized, r.released, 0)}. Explain the causes of the variance.` : undefined}
          error={error(`row:${r.category}`)}
        >
          <TextArea id={`row:${r.category}`} className="min-h-20" value={r.commentary} invalid={!!error(`row:${r.category}`)} onChange={(e) => setRow(r.category, e.target.value)} />
        </Field>
      ))}
      <Field
        id="correctiveActions"
        label={`Corrective actions ${anyFlagged ? '(required)' : '(optional)'}`}
        help="What will change, who owns it, and by when."
        error={error('correctiveActions')}
      >
        <TextArea id="correctiveActions" className="min-h-24" value={data.correctiveActions} invalid={!!error('correctiveActions')} onChange={(e) => update({ correctiveActions: e.target.value })} />
      </Field>
    </div>
  )
}

export function QuarterlyView({ data }: ViewProps<QuarterlyData>) {
  return (
    <div className="flex flex-col gap-4">
      {data.rows
        .filter((r) => r.commentary.trim())
        .map((r) => (
          <div key={r.category}>
            <div className="text-xs text-muted">{r.category} commentary</div>
            <p className="mt-0.5 max-w-[70ch] text-[13.5px] whitespace-pre-wrap">{r.commentary}</p>
          </div>
        ))}
      <div>
        <div className="text-xs text-muted">Corrective actions</div>
        <p className="mt-0.5 max-w-[70ch] text-[13.5px] whitespace-pre-wrap">{data.correctiveActions || '—'}</p>
      </div>
    </div>
  )
}

