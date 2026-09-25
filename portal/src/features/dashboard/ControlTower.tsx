import { AlertOctagon, Banknote, CheckCircle2, Coins, Gauge, Landmark, PiggyBank, Search, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { isActiveFlag, mdaPosition, mdaRating, monthlySeries, statePosition } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { monthOf, MONTH_SHORT, scopeLabel } from '../../domain/periods'
import { inScope } from '../../domain/roles'
import { RULE_LABEL, SEVERITY_ORDER } from '../../domain/rules'
import type { Rating } from '../../domain/types'
import { scopedMdaIds, useDs, useMe, useScope, userName } from '../../state/store'
import { DataTable } from '../../ui/DataTable'
import { Kpi } from '../../ui/Kpi'
import { PageHeader, Panel } from '../../ui/Panel'
import { RiskBadge, SeverityBadge, StatusPill } from '../../ui/Pill'
import { FLAG_TONE } from '../../ui/tone'
import { ChartCard } from '../shared/Charts'

const RISK_FILTERS: ('All' | Rating)[] = ['All', 'High Risk', 'Warning', 'Clear']

export function ControlTower() {
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState<'All' | Rating>('All')

  const ids = scopedMdaIds(ds, me)
  const s = statePosition(ds, scope, ids)
  const flags = ds.flags.filter((f) => inScope(me, f.mdaId))
  const active = flags.filter(isActiveFlag)
  const exposure = active.reduce((a, f) => a + Math.max(0, f.amount), 0)
  const bySeverity = SEVERITY_ORDER.map((sev) => [sev, active.filter((f) => f.severity === sev).length] as const)
  const month = monthOf(scope.periodId)

  const rows = ds.mdas
    .filter((m) => ids.includes(m.id))
    .map((m) => ({ mda: m, p: mdaPosition(ds, m.id, scope), rating: mdaRating(ds, m.id), flags: active.filter((f) => f.mdaId === m.id).length }))
    .filter((r) => (risk === 'All' || r.rating === risk) && (!query || `${r.mda.name} ${r.mda.acronym} ${r.mda.code}`.toLowerCase().includes(query.toLowerCase())))

  const series = monthlySeries(ds, ids, month).map((p) => ({
    month: MONTH_SHORT[p.month - 1],
    expected: p.expectedRevenue,
    collected: p.collectedRevenue,
    released: p.released,
    utilized: p.utilized,
  }))

  const activity = ds.audit
    .filter((e) => e.entityType !== 'Session' && e.entityType !== 'Config' && (!e.mdaId || inScope(me, e.mdaId)) && e.action !== 'RULES_EVALUATED')
    .slice(-8)
    .reverse()

  const RANK: Record<Rating, number> = { 'High Risk': 0, Warning: 1, Clear: 2 }

  return (
    <>
      <PageHeader eyebrow={`Executive control tower · ${scopeLabel(scope)}`} title="State financial position" />

      <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Appropriated budget" value={naira(s.appropriation)} icon={Landmark} context={`FY2026 approved allocation · ${ids.length} MDAs`} />
        <Kpi label="Expected revenue" value={naira(s.expectedRevenue)} icon={Coins} context={scopeLabel(scope)} />
        <Kpi
          label="Actual revenue"
          value={naira(s.collectedRevenue)}
          icon={PiggyBank}
          formula="Revenue collection rate = actual (collected) revenue ÷ expected revenue × 100."
          context={`${pctText(s.collectionRate)} of expected`}
        />
        <Kpi
          label="Funds released"
          value={naira(s.released)}
          icon={Banknote}
          formula="Release rate = released amount ÷ approved allocation × 100. Release variance = released − approved allocation."
          context={`${pctText(s.releaseRate)} of appropriation`}
        />
        <Kpi
          label="Funds utilized"
          value={naira(s.utilized)}
          icon={Gauge}
          formula="Utilization rate = utilized amount ÷ approved allocation × 100. Utilization comes from submitted returns, or the mock GIFMIS ledger for months before the portal."
          context={`${pctText(s.utilizationRate)} of appropriation`}
        >
          <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, s.utilizationRate ?? 0)}%` }} />
          </span>
        </Kpi>
        <Kpi label="Risk exposure" value={String(active.length)} icon={ShieldAlert} context={`active flags · ${naira(exposure)} affected`}>
          <span className="flex flex-wrap gap-1">
            {bySeverity
              .filter(([, n]) => n)
              .map(([sev, n]) => (
                <span key={sev} className="flex items-center gap-1 text-xs">
                  <SeverityBadge severity={sev} /> <span className="font-mono text-ink-2">{n}</span>
                </span>
              ))}
          </span>
        </Kpi>
      </section>

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="MDA oversight grid"
          aside={<span>{rows.length} of {ids.length} MDAs · {scopeLabel(scope)}</span>}
          bodyClassName=""
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <label className="relative min-w-56 flex-1 sm:max-w-80">
              <span className="sr-only">Search MDAs</span>
              <Search size={15} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MDA name or code"
                className="h-9 w-full rounded-md border border-line-2 bg-surface pr-3 pl-8 text-sm outline-none focus:border-accent"
              />
            </label>
            <div role="group" aria-label="Filter by risk status" className="flex flex-wrap gap-1">
              {RISK_FILTERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={risk === r}
                  onClick={() => setRisk(r)}
                  className={`h-8 cursor-pointer rounded-md border px-3 text-xs font-medium transition-colors duration-200 ${risk === r ? 'border-primary bg-accent-soft text-ink' : 'border-line text-ink-2 hover:bg-sunk'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            caption="MDA oversight grid"
            rows={rows}
            rowKey={(r) => r.mda.id}
            onOpen={(r) => navigate(`/mdas/${r.mda.id}`)}
            initialSort={{ key: 'risk', dir: 'asc' }}
            minWidth={980}
            empty={{ title: 'No MDAs match these filters', body: 'Try a different search or risk status.' }}
            columns={[
              {
                key: 'mda',
                header: 'MDA',
                sort: (r) => r.mda.name,
                cell: (r) => (
                  <div>
                    <div className="font-medium">{r.mda.name}</div>
                    <div className="font-mono text-[11px] text-muted">{r.mda.code}</div>
                  </div>
                ),
              },
              { key: 'appr', header: 'Appropriation', align: 'right', sort: (r) => r.p.appropriation, cell: (r) => <span className="font-mono tabular">{naira(r.p.appropriation)}</span> },
              {
                key: 'rel',
                header: 'Released',
                align: 'right',
                sort: (r) => r.p.released,
                cell: (r) => (
                  <div className="font-mono tabular">
                    {naira(r.p.released)}
                    <div className="text-[11px] text-muted">{pctText(r.p.releaseRate, 0)}</div>
                  </div>
                ),
              },
              {
                key: 'util',
                header: 'Utilized',
                align: 'right',
                sort: (r) => r.p.utilizationRate ?? 0,
                cell: (r) => (
                  <div className="font-mono tabular">
                    {naira(r.p.utilized)}
                    <div className={`text-[11px] ${(r.p.utilizationRate ?? 0) > 100 ? 'font-semibold text-crit-fg' : 'text-muted'}`}>{pctText(r.p.utilizationRate)}</div>
                  </div>
                ),
              },
              { key: 'unret', header: 'Unretired', align: 'right', sort: (r) => r.p.unretired, cell: (r) => <span className="font-mono tabular">{naira(r.p.unretired)}</span> },
              {
                key: 'month',
                header: `${MONTH_SHORT[month - 1]} expenditure`,
                align: 'right',
                sort: (r) => r.p.monthExpenditure,
                cell: (r) => <span className="font-mono tabular">{r.p.monthExpenditure ? naira(r.p.monthExpenditure) : '—'}</span>,
              },
              { key: 'risk', header: 'Risk status', sort: (r) => RANK[r.rating] * 100 - r.flags, cell: (r) => <RiskBadge rating={r.rating} /> },
              { key: 'flags', header: 'Active flags', align: 'right', sort: (r) => r.flags, cell: (r) => <span className="font-mono tabular">{r.flags || '—'}</span> },
            ]}
          />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Unresolved exceptions" aside={<Link to="/flags" className="text-accent hover:underline">Compliance centre →</Link>} bodyClassName="">
            {active.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-ok-fg">
                <CheckCircle2 size={16} aria-hidden /> No unresolved exceptions.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {[...active]
                  .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.amount - a.amount)
                  .slice(0, 6)
                  .map((f) => (
                    <li key={f.id}>
                      <Link to={`/flags/${f.id}`} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-sunk">
                        <span className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={f.severity} />
                          <span className="text-[13px] font-medium">{RULE_LABEL[f.ruleId]}</span>
                          <span className="font-mono text-[11px] text-muted">{f.mdaId}</span>
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                          <span className="font-mono tabular">{naira(f.amount)} affected</span>
                          <StatusPill tone={FLAG_TONE[f.status]} label={f.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent activity" aside={<span>From the audit ledger</span>} bodyClassName="">
            <ul className="divide-y divide-line">
              {activity.map((e) => (
                <li key={e.id} className="px-4 py-2.5">
                  <div className="text-[12.5px] text-ink-2">{e.summary}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-muted">
                    {userName(ds, e.actorId)} · {dateTime(e.at)}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Revenue: expected vs collected"
          subtitle={`FY2026 to ${MONTH_SHORT[month - 1]} · all sources`}
          kind="bars"
          xKey="month"
          data={series}
          series={[
            { key: 'expected', label: 'Expected', role: 'neutral' },
            { key: 'collected', label: 'Collected', role: 'accent' },
          ]}
          footer={(r) => `Collection rate ${pctText(r.expected ? (r.collected / r.expected) * 100 : null)}`}
        />
        <ChartCard
          title="Releases vs expenditure"
          subtitle={`FY2026 to ${MONTH_SHORT[month - 1]} · MDAs in scope`}
          kind="bars"
          xKey="month"
          data={series}
          series={[
            { key: 'released', label: 'Released', role: 'neutral' },
            { key: 'utilized', label: 'Utilized', role: 'accent' },
          ]}
        />
      </div>

      <section aria-label="Status legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 text-xs text-muted transition-colors duration-200">
        <span className="font-semibold text-ink-2">Legend</span>
        <span className="flex items-center gap-2">
          <RiskBadge rating="High Risk" /> active Critical or High flag
        </span>
        <span className="flex items-center gap-2">
          <RiskBadge rating="Warning" /> active Medium or Low flag
        </span>
        <span className="flex items-center gap-2">
          <RiskBadge rating="Clear" /> no active flags
        </span>
        <span className="flex items-center gap-1.5">
          <AlertOctagon size={13} aria-hidden /> Flags are decision support; every one is reviewed by an authorized officer.
        </span>
      </section>
    </>
  )
}
