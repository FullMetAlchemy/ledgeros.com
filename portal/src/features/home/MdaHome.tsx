import { Banknote, FilePlus2, Gauge, Landmark, ShieldAlert, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { isActiveFlag, mdaPosition, mdaRating, returnTotal } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { scopeLabel } from '../../domain/periods'
import { RETURN_NEXT } from '../../domain/returns'
import { can } from '../../domain/roles'
import { RULE_LABEL } from '../../domain/rules'
import { workFor } from '../../domain/work'
import { useDs, useMe, useScope } from '../../state/store'
import { Kpi } from '../../ui/Kpi'
import { EmptyState, PageHeader, Panel } from '../../ui/Panel'
import { DueChip, RiskBadge, SeverityBadge, StatusPill } from '../../ui/Pill'
import { FLAG_TONE, RETURN_TONE } from '../../ui/tone'

/** MDA officer / supervisor landing page (PRD journey B). */
export function MdaHome() {
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const mda = ds.mdas.find((m) => m.id === me.mdaId)!
  const p = mdaPosition(ds, mda.id, scope)
  const work = workFor(ds, me, new Date())
  const flags = ds.flags.filter((f) => f.mdaId === mda.id && isActiveFlag(f))
  const returns = ds.returns.filter((r) => r.mdaId === mda.id).sort((a, b) => b.periodId.localeCompare(a.periodId)).slice(0, 4)
  const openWithout = ds.periods.filter((x) => x.status === 'Open' && !ds.returns.some((r) => r.mdaId === mda.id && r.periodId === x.id))
  const inProgress = ds.returns.filter((r) => r.mdaId === mda.id && (r.status === 'Draft' || r.status === 'Returned'))

  return (
    <>
      <PageHeader eyebrow={`${mda.code} · MDA portal · ${scopeLabel(scope)}`} title={mda.name}>
        <RiskBadge rating={mdaRating(ds, mda.id)} />
      </PageHeader>

      {can(me, 'return.prepare') && (openWithout.length > 0 || inProgress.length > 0) && (
        <section aria-label="Monthly returns due" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-flow-bd bg-flow-bg px-4 py-3.5">
          <div className="flex items-start gap-3">
            <FilePlus2 size={20} aria-hidden className="mt-0.5 text-flow-fg" />
            <div>
              <div className="text-sm font-semibold">
                {inProgress.length ? `${inProgress.length} return${inProgress.length === 1 ? '' : 's'} in progress` : 'Monthly return pending'}
              </div>
              <div className="text-[13px] text-ink-2">
                {inProgress.map((r) => `${r.id} (${r.status})`).join(', ')}
                {inProgress.length && openWithout.length ? ' · ' : ''}
                {openWithout.length ? `Not started: ${openWithout.map((x) => x.label).join(', ')}` : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {inProgress.map((r) => (
              <Link key={r.id} to={`/returns/${r.id}`} className="inline-flex h-9 items-center rounded-md border border-line-2 bg-surface px-4 text-[13px] font-semibold hover:bg-sunk">
                Continue {r.periodId}
              </Link>
            ))}
            {openWithout.map((x) => (
              <Link key={x.id} to={`/returns/new?period=${x.id}`} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-on-primary shadow-sm hover:bg-primary-hover">
                Start {x.label} return
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Financial position" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Approved allocation" value={naira(p.appropriation)} icon={Landmark} context="FY2026" />
        <Kpi label="Released" value={naira(p.released)} icon={Banknote} context={`${pctText(p.releaseRate)} of allocation`} formula="Release rate = released ÷ approved allocation × 100." />
        <Kpi
          label="Utilized"
          value={naira(p.utilized)}
          icon={Gauge}
          formula="Utilization rate = utilized ÷ approved allocation × 100."
          context={(p.utilizationRate ?? 0) > 100 ? <span className="font-semibold text-crit-fg">{pctText(p.utilizationRate)} · over allocation</span> : `${pctText(p.utilizationRate)} of allocation`}
        />
        <Kpi label="Unretired funds" value={naira(p.unretired)} icon={Wallet} context="Advances outstanding" />
        <Kpi label="Active flags" value={String(flags.length)} icon={ShieldAlert} context={flags.length ? 'Need a response or review' : 'None'} />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Needs you" aside={`${work.length} item${work.length === 1 ? '' : 's'}`} bodyClassName="">
          {work.length === 0 ? (
            <EmptyState title="You’re up to date" body="New flags, returns and review requests appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {work.map((w) => (
                <li key={w.key}>
                  <Link to={w.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunk">
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium">{w.action}</span>
                      <span className="block truncate text-xs text-muted">{w.title}</span>
                    </span>
                    {w.due && <DueChip due={w.due} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Active flags" aside={<Link to="/flags" className="text-accent hover:underline">All flags →</Link>} bodyClassName="">
            {flags.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-muted">No active flags for your MDA.</p>
            ) : (
              <ul className="divide-y divide-line">
                {flags.map((f) => (
                  <li key={f.id}>
                    <Link to={`/flags/${f.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-sunk">
                      <span className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-[13px] font-medium">{RULE_LABEL[f.ruleId]}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusPill tone={FLAG_TONE[f.status]} label={f.status} />
                        <DueChip due={f.dueAt} open={['Open', 'Assigned', 'MDA Response'].includes(f.status)} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent returns" aside={<Link to="/returns" className="text-accent hover:underline">All returns →</Link>} bodyClassName="">
            <ul className="divide-y divide-line">
              {returns.map((r) => (
                <li key={r.id}>
                  <Link to={`/returns/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-sunk">
                    <span>
                      <span className="block font-mono text-[13px] font-medium">{r.id}</span>
                      <span className="block text-xs text-muted">{RETURN_NEXT[r.status]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular">{naira(returnTotal(r))}</span>
                      <StatusPill tone={RETURN_TONE[r.status]} label={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
