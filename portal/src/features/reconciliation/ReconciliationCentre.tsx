import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { COUNTED, mdaPosition, rate } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { monthsIn, periodId, scopeLabel } from '../../domain/periods'
import { recVariance, REC_STATUSES } from '../../domain/reconciliation'
import { can, inScope } from '../../domain/roles'
import { svcCreateRec } from '../../domain/services'
import type { RecType } from '../../domain/types'
import { store, scopedMdaIds, useDs, useMe, useScope } from '../../state/store'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { Dialog } from '../../ui/Dialog'
import { Field } from '../../ui/Field'
import { InfoTip } from '../../ui/Kpi'
import { PageHeader, Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { useToast } from '../../ui/toast'
import { REC_TONE } from '../../ui/tone'

type Tab = 'records' | 'revenue' | 'allocation'

function NewRecDialog({ onClose }: { onClose: () => void }) {
  const ds = useDs()
  const toast = useToast()
  const navigate = useNavigate()
  const eligible = ds.returns.filter((r) => COUNTED.includes(r.status))
  const [type, setType] = useState<RecType>('TSA')
  const [choice, setChoice] = useState(eligible[0] ? `${eligible[0].mdaId}|${eligible[0].periodId}` : '')
  const [error, setError] = useState<string | null>(null)
  const create = () => {
    const [mdaId, pid] = choice.split('|')
    const r = store.run((d, u, now) => svcCreateRec(d, u, type, mdaId, pid, now))
    if (!r.ok) return setError(r.error)
    toast('success', `${r.value.id} opened`, 'Run matching to compare with the TSA statement.')
    onClose()
    navigate(`/reconciliation/${r.value.id}`)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Reconciliation"
      title="New reconciliation"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} disabled={!choice}>
            Create
          </Button>
        </>
      }
    >
      <fieldset className="flex gap-2">
        <legend className="mb-2 text-[13px] font-medium text-ink-2">Type</legend>
        {(['TSA', 'Vendor'] as RecType[]).map((t) => (
          <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border border-line-2 px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent-soft">
            <input type="radio" name="rec-type" checked={type === t} onChange={() => setType(t)} className="accent-[var(--primary)]" />
            {t === 'TSA' ? 'TSA (transaction level)' : 'Vendor (disbursement by vendor)'}
          </label>
        ))}
      </fieldset>
      <Field id="rec-subject" label="MDA and period" help="Only periods with a submitted return can be reconciled." error={error}>
        <select id="rec-subject" value={choice} onChange={(e) => setChoice(e.target.value)} className="h-10 rounded-md border border-line-2 bg-surface px-2.5 text-sm">
          {eligible.map((r) => (
            <option key={r.id} value={`${r.mdaId}|${r.periodId}`}>
              {ds.mdas.find((m) => m.id === r.mdaId)?.name} · {ds.periods.find((p) => p.id === r.periodId)?.label}
            </option>
          ))}
        </select>
      </Field>
    </Dialog>
  )
}

export function ReconciliationCentre() {
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('records')
  const [creating, setCreating] = useState(false)
  const recs = ds.reconciliations.filter((r) => inScope(me, r.mdaId))
  const ids = scopedMdaIds(ds, me)

  const periods = new Set(monthsIn(scope).map((m) => periodId(m)))
  const bySource = new Map<string, { expected: number; collected: number }>()
  for (const r of ds.revenue.filter((x) => periods.has(x.periodId))) {
    const s = bySource.get(r.source) ?? { expected: 0, collected: 0 }
    s.expected += r.expected
    s.collected += r.collected
    bySource.set(r.source, s)
  }
  const revenueRows = [...bySource].map(([source, v]) => ({ source, ...v, variance: v.expected - v.collected, rate: rate(v.collected, v.expected) }))
  const allocRows = ds.mdas.filter((m) => ids.includes(m.id)).map((m) => ({ m, p: mdaPosition(ds, m.id, scope) }))

  return (
    <>
      <PageHeader eyebrow={`Reconciliation · ${scopeLabel(scope)}`} title="Reconciliation">
        {can(me, 'rec.manage') && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden /> New reconciliation
          </Button>
        )}
      </PageHeader>
      {creating && <NewRecDialog onClose={() => setCreating(false)} />}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Reconciliations by status">
        {REC_STATUSES.map((s) => (
          <div key={s} className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
            <StatusPill tone={REC_TONE[s]} label={s} className="self-start" />
            <span className="font-mono text-lg font-semibold tabular">{recs.filter((r) => r.status === s).length}</span>
          </div>
        ))}
      </section>

      <Panel bodyClassName="">
        <Tabs
          label="Reconciliation views"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'records', label: 'TSA and vendor', count: recs.length },
            ...(me.mdaId ? [] : [{ id: 'revenue' as const, label: 'Revenue: expected vs actual' }]),
            { id: 'allocation', label: 'Allocation vs utilization' },
          ]}
        />
        {tab === 'records' && (
          <DataTable
            caption="Reconciliations"
            rows={recs}
            rowKey={(r) => r.id}
            onOpen={(r) => navigate(`/reconciliation/${r.id}`)}
            initialSort={{ key: 'id', dir: 'desc' }}
            minWidth={900}
            empty={{ title: 'No reconciliations yet', body: can(me, 'rec.manage') ? 'Create one for an MDA and period with a submitted return.' : 'Reconciliations created by the Ministry appear here.' }}
            columns={[
              { key: 'id', header: 'Reconciliation', sort: (r) => r.id, cell: (r) => <span className="font-mono font-medium">{r.id}</span> },
              { key: 'type', header: 'Type', cell: (r) => r.type },
              { key: 'mda', header: 'MDA', sort: (r) => r.mdaId, cell: (r) => ds.mdas.find((m) => m.id === r.mdaId)?.name },
              { key: 'period', header: 'Period', sort: (r) => r.periodId, cell: (r) => ds.periods.find((p) => p.id === r.periodId)?.label },
              { key: 'status', header: 'Status', sort: (r) => REC_STATUSES.indexOf(r.status), cell: (r) => <StatusPill tone={REC_TONE[r.status]} label={r.status} /> },
              { key: 'sys', header: 'System', align: 'right', cell: (r) => <span className="font-mono tabular">{r.status === 'Open' ? '—' : naira(r.systemValue)}</span> },
              { key: 'ext', header: 'TSA', align: 'right', cell: (r) => <span className="font-mono tabular">{r.status === 'Open' ? '—' : naira(r.externalValue)}</span> },
              {
                key: 'var',
                header: 'Variance',
                align: 'right',
                sort: (r) => Math.abs(recVariance(r)),
                cell: (r) => (
                  <span className={`font-mono tabular ${r.status !== 'Open' && Math.abs(recVariance(r)) >= 1 ? 'font-semibold text-warn-fg' : ''}`}>{r.status === 'Open' ? '—' : naira(recVariance(r))}</span>
                ),
              },
            ]}
          />
        )}
        {tab === 'revenue' && (
          <DataTable
            caption="Revenue expected vs actual"
            rows={revenueRows}
            rowKey={(r) => r.source}
            minWidth={640}
            empty={{ title: 'No revenue records in this period' }}
            columns={[
              { key: 'source', header: 'Source', cell: (r) => <span className="font-medium">{r.source}</span> },
              { key: 'exp', header: 'Expected', align: 'right', sort: (r) => r.expected, cell: (r) => <span className="font-mono tabular">{naira(r.expected)}</span> },
              { key: 'col', header: 'Collected', align: 'right', sort: (r) => r.collected, cell: (r) => <span className="font-mono tabular">{naira(r.collected)}</span> },
              {
                key: 'var',
                header: (
                  <span className="inline-flex items-center gap-1">
                    Variance <InfoTip label="revenue variance">Expected − collected. Positive means revenue below expectation. Sign convention pending stakeholder approval (FRD §10).</InfoTip>
                  </span>
                ),
                align: 'right',
                sort: (r) => r.variance,
                cell: (r) => <span className={`font-mono tabular ${r.variance > 0 ? 'text-warn-fg' : ''}`}>{naira(r.variance)}</span>,
              },
              { key: 'rate', header: 'Collection rate', align: 'right', sort: (r) => r.rate ?? 0, cell: (r) => <span className="font-mono tabular">{pctText(r.rate)}</span> },
            ]}
          />
        )}
        {tab === 'allocation' && (
          <DataTable
            caption="Allocation vs utilization"
            rows={allocRows}
            rowKey={(r) => r.m.id}
            onOpen={(r) => navigate(`/mdas/${r.m.id}`)}
            initialSort={{ key: 'rate', dir: 'desc' }}
            minWidth={720}
            empty={{ title: 'No MDAs in scope' }}
            columns={[
              { key: 'mda', header: 'MDA', sort: (r) => r.m.name, cell: (r) => <span className="font-medium">{r.m.name}</span> },
              { key: 'alloc', header: 'Approved allocation', align: 'right', sort: (r) => r.p.appropriation, cell: (r) => <span className="font-mono tabular">{naira(r.p.appropriation)}</span> },
              { key: 'util', header: 'Utilized', align: 'right', sort: (r) => r.p.utilized, cell: (r) => <span className="font-mono tabular">{naira(r.p.utilized)}</span> },
              {
                key: 'var',
                header: 'Allocation variance',
                align: 'right',
                sort: (r) => r.p.allocationVariance,
                cell: (r) => (
                  <span className={`font-mono tabular ${r.p.allocationVariance > 0 ? 'font-semibold text-crit-fg' : ''}`}>
                    {r.p.allocationVariance > 0 ? '+' : ''}
                    {naira(r.p.allocationVariance)}
                  </span>
                ),
              },
              { key: 'rate', header: 'Utilization rate', align: 'right', sort: (r) => r.p.utilizationRate ?? 0, cell: (r) => <span className="font-mono tabular">{pctText(r.p.utilizationRate)}</span> },
            ]}
          />
        )}
      </Panel>
    </>
  )
}
