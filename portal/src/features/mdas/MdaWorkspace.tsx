import { ArrowLeft, Banknote, Gauge, Landmark, Scale, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { isActiveFlag, mdaPosition, mdaRating, monthExpenditure, monthlySeries, returnTotal } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { monthOf, MONTH_SHORT, periodId, scopeLabel } from '../../domain/periods'
import { recVariance } from '../../domain/reconciliation'
import { can, inScope } from '../../domain/roles'
import { RULE_LABEL } from '../../domain/rules'
import { useDs, useMe, useScope, userName } from '../../state/store'
import { DataTable } from '../../ui/DataTable'
import { Facts } from '../../ui/Facts'
import { Kpi } from '../../ui/Kpi'
import { EmptyState } from '../../ui/Panel'
import { RiskBadge, SeverityBadge, StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { FLAG_TONE, REC_TONE, RETURN_TONE } from '../../ui/tone'
import { ChartCard } from '../shared/Charts'

type Tab = 'expenditure' | 'reconciliation' | 'vendors' | 'flags' | 'audit' | 'profile'

/** MDA investigation workspace (US-003, FR-MDA-002..004). */
export function MdaWorkspace() {
  const { mdaId } = useParams()
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('expenditure')
  const mda = ds.mdas.find((m) => m.id === mdaId)

  if (!mda || !inScope(me, mda.id))
    return (
      <EmptyState
        title="MDA not found"
        body="It may be outside your data scope, or the link is out of date."
        action={
          <Link to="/" className="text-accent hover:underline">
            Go to my home page
          </Link>
        }
      />
    )

  const p = mdaPosition(ds, mda.id, scope)
  const month = monthOf(scope.periodId)
  const rating = mdaRating(ds, mda.id)
  const burn = monthlySeries(ds, [mda.id], month).map((x) => ({ month: MONTH_SHORT[x.month - 1], released: x.cumulativeReleased, utilized: x.cumulativeUtilized }))
  const returns = ds.returns.filter((r) => r.mdaId === mda.id).sort((a, b) => b.periodId.localeCompare(a.periodId))
  const recs = ds.reconciliations.filter((r) => r.mdaId === mda.id)
  const flags = ds.flags.filter((f) => f.mdaId === mda.id)
  const events = ds.audit.filter((e) => e.mdaId === mda.id).reverse()
  const vendorMap = new Map<string, { name: string; tin: string; total: number; count: number; periods: Set<string> }>()
  for (const r of returns)
    for (const t of r.transactions) {
      const k = t.vendorTin || t.vendorName
      const v = vendorMap.get(k) ?? { name: t.vendorName, tin: t.vendorTin, total: 0, count: 0, periods: new Set() }
      v.total += t.amount
      v.count += 1
      v.periods.add(r.periodId)
      vendorMap.set(k, v)
    }
  const vendors = [...vendorMap.values()]
  const months = Array.from({ length: month }, (_, i) => i + 1)

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'expenditure', label: 'Expenditure', count: returns.length },
    { id: 'reconciliation', label: 'Reconciliation', count: recs.length },
    { id: 'vendors', label: 'Vendors', count: vendors.length },
    { id: 'flags', label: 'Flags', count: flags.filter(isActiveFlag).length },
    ...(can(me, 'audit.view') ? [{ id: 'audit' as const, label: 'Audit', count: events.length }] : []),
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        {!me.mdaId && (
          <button type="button" onClick={() => navigate(-1)} className="inline-flex h-[34px] cursor-pointer items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk">
            <ArrowLeft size={15} aria-hidden /> Back
          </button>
        )}
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {mda.code} · {mda.sector} · Investigation workspace
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{mda.name}</h1>
            <RiskBadge rating={rating} />
          </div>
        </div>
        <span className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink-2">
          Reporting period: <b className="text-ink">{scopeLabel(scope)}</b>
        </span>
      </div>

      <section aria-label="Financial position" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Appropriation" value={naira(p.appropriation)} icon={Landmark} context="FY2026 approved allocation" />
        <Kpi label="Released" value={naira(p.released)} icon={Banknote} formula="Release rate = released ÷ approved allocation × 100." context={`${pctText(p.releaseRate)} · variance ${naira(p.releaseVariance)}`} />
        <Kpi label="Utilized" value={naira(p.utilized)} icon={Gauge} formula="Utilization rate = utilized ÷ approved allocation × 100." context={`${pctText(p.utilizationRate)} of allocation`} />
        <Kpi
          label="Allocation variance"
          value={`${p.allocationVariance > 0 ? '+' : ''}${naira(p.allocationVariance)}`}
          icon={Scale}
          formula="Allocation variance = utilized − approved allocation. Positive means spending beyond the approved allocation."
          context={p.allocationVariance > 0 ? <span className="font-semibold text-crit-fg">Over allocation</span> : 'Within allocation'}
        />
        <Kpi label="Unretired funds" value={naira(p.unretired)} icon={Wallet} context="Advances not retired at period end" />
      </section>

      <ChartCard
        title="Release to utilization"
        subtitle={`Cumulative, FY2026 to ${MONTH_SHORT[month - 1]}. Utilization running above releases, or above the allocation line, needs explaining.`}
        kind="lines"
        xKey="month"
        data={burn}
        reference={{ value: p.appropriation, label: `Allocation ${naira(p.appropriation)}` }}
        series={[
          { key: 'released', label: 'Cumulative released', role: 'neutral' },
          { key: 'utilized', label: 'Cumulative utilized', role: 'accent' },
        ]}
        height={260}
      />

      <section className="overflow-hidden rounded-lg border border-line bg-surface transition-colors duration-200">
        <Tabs label="Workspace sections" value={tab} onChange={setTab} tabs={tabs} />
        {tab === 'expenditure' && (
          <div className="flex flex-col gap-4 p-4">
            <DataTable
              caption="Returns"
              rows={returns}
              rowKey={(r) => r.id}
              onOpen={(r) => navigate(`/returns/${r.id}`)}
              minWidth={640}
              empty={{ title: 'No returns yet', body: 'Monthly returns filed by this MDA appear here.' }}
              columns={[
                { key: 'id', header: 'Return', cell: (r) => <span className="font-mono font-medium">{r.id}</span> },
                { key: 'period', header: 'Period', sort: (r) => r.periodId, cell: (r) => ds.periods.find((x) => x.id === r.periodId)?.label },
                { key: 'status', header: 'Status', cell: (r) => <StatusPill tone={RETURN_TONE[r.status]} label={r.status} /> },
                { key: 'lines', header: 'Lines', align: 'right', cell: (r) => r.transactions.length },
                { key: 'total', header: 'Total', align: 'right', sort: (r) => returnTotal(r), cell: (r) => <span className="font-mono tabular">{naira(returnTotal(r))}</span> },
                { key: 'v', header: 'Version', align: 'right', cell: (r) => `v${r.version}` },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Monthly expenditure and its source</h3>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead>
                    <tr className="bg-sunk text-left text-[11px] tracking-wider text-muted uppercase">
                      <th className="px-4 py-2 font-semibold">Month</th>
                      <th className="px-4 py-2 text-right font-semibold">Expenditure</th>
                      <th className="px-4 py-2 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const e = monthExpenditure(ds, mda.id, m)
                      return (
                        <tr key={m} className="border-t border-line">
                          <td className="px-4 py-2">{ds.periods.find((x) => x.id === periodId(m))?.label}</td>
                          <td className="px-4 py-2 text-right font-mono tabular">{e.amount ? naira(e.amount) : '—'}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted">{e.source}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {tab === 'reconciliation' && (
          <DataTable
            caption="Reconciliations"
            rows={recs}
            rowKey={(r) => r.id}
            onOpen={(r) => navigate(`/reconciliation/${r.id}`)}
            minWidth={640}
            empty={{ title: 'No reconciliations yet', body: 'TSA and vendor reconciliations for this MDA appear here.' }}
            columns={[
              { key: 'id', header: 'Reconciliation', cell: (r) => <span className="font-mono font-medium">{r.id}</span> },
              { key: 'type', header: 'Type', cell: (r) => r.type },
              { key: 'period', header: 'Period', cell: (r) => r.periodId },
              { key: 'status', header: 'Status', cell: (r) => <StatusPill tone={REC_TONE[r.status]} label={r.status} /> },
              { key: 'var', header: 'Variance', align: 'right', cell: (r) => <span className="font-mono tabular">{r.status === 'Open' ? '—' : naira(recVariance(r))}</span> },
            ]}
          />
        )}
        {tab === 'vendors' && (
          <DataTable
            caption="Vendors"
            rows={vendors}
            rowKey={(v) => v.tin + v.name}
            initialSort={{ key: 'total', dir: 'desc' }}
            minWidth={560}
            empty={{ title: 'No vendor payments recorded' }}
            columns={[
              { key: 'name', header: 'Vendor', sort: (v) => v.name, cell: (v) => <span className="font-medium">{v.name}</span> },
              { key: 'tin', header: 'TIN', cell: (v) => <span className="font-mono text-xs">{v.tin}</span> },
              { key: 'count', header: 'Payments', align: 'right', sort: (v) => v.count, cell: (v) => v.count },
              { key: 'periods', header: 'Periods', cell: (v) => [...v.periods].sort().join(', ') },
              { key: 'total', header: 'Total paid', align: 'right', sort: (v) => v.total, cell: (v) => <span className="font-mono tabular">{naira(v.total)}</span> },
            ]}
          />
        )}
        {tab === 'flags' && (
          <DataTable
            caption="Flags"
            rows={flags}
            rowKey={(f) => f.id}
            onOpen={(f) => navigate(`/flags/${f.id}`)}
            minWidth={640}
            empty={{ title: 'No flags for this MDA' }}
            columns={[
              { key: 'rule', header: 'Flag', cell: (f) => <span className="font-medium">{RULE_LABEL[f.ruleId]}</span> },
              { key: 'sev', header: 'Severity', cell: (f) => <SeverityBadge severity={f.severity} /> },
              { key: 'amount', header: 'Amount', align: 'right', sort: (f) => f.amount, cell: (f) => <span className="font-mono tabular">{naira(f.amount)}</span> },
              { key: 'status', header: 'Status', cell: (f) => <StatusPill tone={FLAG_TONE[f.status]} label={f.status} /> },
              { key: 'detected', header: 'Detected', sort: (f) => f.detectedAt, cell: (f) => <span className="font-mono text-xs">{dateTime(f.detectedAt)}</span> },
            ]}
          />
        )}
        {tab === 'audit' && (
          <DataTable
            caption="Audit events"
            rows={events}
            rowKey={(e) => e.id}
            pageSize={12}
            minWidth={680}
            empty={{ title: 'No events for this MDA' }}
            columns={[
              { key: 'id', header: 'Event', cell: (e) => <span className="font-mono text-xs">{e.id}</span> },
              { key: 'at', header: 'Time', cell: (e) => <span className="font-mono text-xs">{dateTime(e.at)}</span> },
              { key: 'actor', header: 'Actor', cell: (e) => userName(ds, e.actorId) },
              { key: 'action', header: 'Action', cell: (e) => <span className="font-mono text-[11px]">{e.action}</span> },
              { key: 'summary', header: 'Summary', cell: (e) => <span className="text-ink-2">{e.summary}</span> },
            ]}
          />
        )}
        {tab === 'profile' && (
          <div className="p-4">
            <Facts
              cols={3}
              items={[
                ['Name', mda.name],
                ['Code', mda.code, true],
                ['Acronym', mda.acronym, true],
                ['Sector', mda.sector],
                ['Accounting officer', mda.accountingOfficer],
                ['Finance contact', mda.contactEmail, true],
                ['Status', mda.status],
                ['FY2026 appropriation', naira(mda.appropriation), true],
                ['Advances outstanding', naira(p.unretired), true],
              ]}
              source="MDA master data"
            />
          </div>
        )}
      </section>
    </>
  )
}
