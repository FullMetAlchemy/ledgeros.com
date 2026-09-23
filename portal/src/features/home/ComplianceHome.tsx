import { AlertTriangle, Clock, Gauge, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { monthlySeries } from '../../domain/funds'
import { ExpenditureChart } from './ExpenditureChart'
import { isOpen } from '../../domain/flagMachine'
import { naira, pct } from '../../domain/money'
import { activeDeadline, SEVERITY_RANK } from '../../domain/policy'
import { explainRating } from '../../domain/rating'
import { workingDaysBetween } from '../../domain/calendar'
import { parseAmount } from '../../domain/submissions/defs'
import { isWithMda } from '../../domain/submissions/machine'
import { submissionTasksFor } from '../../domain/submissions/tasks'
import { tasksFor } from '../../domain/tasks'
import type { Severity } from '../../domain/types'
import { useMe, usePortal, visibleFlags, visibleSubmissions } from '../../state/store'
import { PageHeader, Panel } from '../../ui/Panel'
import { SeverityTag } from '../../ui/Pill'
import { DOT, PANEL, RATING_TONE, TEXT } from '../../ui/tone'
import { submissionStatus } from '../submissions/submissionViews'
import { TaskList } from '../tasks/TaskList'
import { byDue, flagWork, submissionWork } from '../tasks/workItems'

const KPI_TONE = {
  neutral: { icon: 'bg-accent-soft text-accent', value: 'text-ink' },
  warn: { icon: 'bg-warn-bg text-warn-fg', value: 'text-warn-fg' },
  crit: { icon: 'bg-crit-bg text-crit-fg', value: 'text-crit-fg' },
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
  children,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: ReactNode
  tone?: keyof typeof KPI_TONE
  children?: ReactNode
}) {
  const t = KPI_TONE[tone]
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-4 py-4 shadow-sm shadow-slate-900/[0.03] transition-colors duration-200">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${t.icon}`}>
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <span className={`font-mono text-[26px] leading-tight font-semibold tracking-tight tabular ${t.value}`}>{value}</span>
      {children}
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  )
}

export function ComplianceHome() {
  const s = usePortal()
  const me = useMe()!
  const mda = s.mdas.find((m) => m.id === me.mdaId)!
  const flags = visibleFlags(s, me)
  const subs = visibleSubmissions(s, me)
  const open = flags.filter(isOpen)
  const r = explainRating(flags)
  const tone = RATING_TONE[r.rating]
  const now = new Date()
  const work = [
    ...tasksFor(flags, me).map((t) => flagWork(t, '/flags', s)),
    ...submissionTasksFor(subs, me).map((t) => submissionWork(t, '/submissions', s)),
  ].sort(byDue)
  const nearest = work[0] && Number.isFinite(work[0].sortAt) ? workingDaysBetween(now, new Date(work[0].sortAt)) : null
  const overdue = open.filter((f) => activeDeadline(f, now)?.status === 'over').length
  const bySev = (['Critical', 'High', 'Medium', 'Low'] as Severity[])
    .map((sev) => [sev, open.filter((f) => f.severity === sev).length] as const)
    .filter(([, n]) => n > 0)
  const absorption = mda.utilized / mda.released
  const release = subs.filter((x) => x.kind === 'release_request' && x.state !== 'Accepted').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const releaseAmount = release?.data.kind === 'release_request' ? parseAmount(release.data.amount) : 0
  const dueSubs = subs.filter(isWithMda)
  const overdueSubs = dueSubs.filter((x) => now > new Date(x.dueAt)).length
  const series = monthlySeries(mda)
  const notStarted = s.obligations.filter((o) => o.mdaId === mda.id && !o.submissionId && (!o.opensAt || new Date(o.opensAt) <= now)).length

  return (
    <>
      <PageHeader eyebrow={`${mda.acronym} · ${mda.code} · Dashboard`} title={mda.name} />

      <section className={`grid items-center gap-x-6 gap-y-3 rounded-lg border px-5 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] ${PANEL[tone]}`} aria-label="Compliance rating">
        <div className="flex flex-col">
          <span className="eyebrow">Compliance rating</span>
          <span className={`mt-1 flex items-center gap-2 font-cond text-[26px] font-semibold ${TEXT[tone]}`}>
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT[tone]}`} />
            {r.rating}
          </span>
        </div>
        <div className="text-[13px] leading-relaxed text-ink-2">
          {r.rating === 'Clear' ? (
            <>No open flags. This is the same rating the oversight console and Treasury see.</>
          ) : (
            <>
              Set by <b className="text-ink">{r.drivers.length} open {r.rating === 'High Risk' ? 'Critical/High' : ''} flag{r.drivers.length === 1 ? '' : 's'}</b>. The same rating is shown to oversight and to Treasury next to release requests.
              <div className="mt-1.5">
                <b className="text-ink">Path to {r.next}:</b> resolve{' '}
                {r.path.map((p, i) => (
                  <span key={p.flagId}>
                    {i > 0 && (i === r.path.length - 1 ? ' and ' : ', ')}
                    <Link to={`/flags/${p.flagId}`} className="font-medium text-accent underline-offset-2 hover:underline">
                      {p.label} ({p.flagId})
                    </Link>
                  </span>
                ))}
                .
              </div>
            </>
          )}
        </div>
        {r.path[0] && (
          <Link to={`/flags/${r.path[0].flagId}`} className="inline-flex h-9 items-center justify-center justify-self-start rounded-md bg-primary px-4 text-[13px] font-semibold whitespace-nowrap text-on-primary shadow-sm transition-colors duration-200 hover:bg-primary-hover">
            Open most serious flag
          </Link>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
        <Kpi icon={Wallet} label="Total funds received" value={naira(mda.released)} sub={`${pct(mda.released, mda.appropriated, 0)} of ${naira(mda.appropriated)} appropriated`} />
        <Kpi icon={Gauge} label="Current utilization" value={pct(mda.utilized, mda.released)} sub={`${naira(mda.utilized)} spent of funds received`}>
          <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, absorption * 100)}%` }} />
          </span>
        </Kpi>
        <Kpi
          icon={Clock}
          tone="warn"
          label="Pending actions"
          value={String(work.length)}
          sub={nearest === null ? 'Nothing due' : nearest < 0 ? 'Nearest is overdue' : `Nearest due in ${nearest} working day${nearest === 1 ? '' : 's'}`}
        />
        <Kpi icon={AlertTriangle} tone="crit" label="Active system flags" value={String(open.length)} sub={overdue ? `${overdue} overdue` : 'None overdue'}>
          <span className="flex flex-wrap gap-1.5">
            {bySev
              .sort(([a], [b]) => SEVERITY_RANK[a] - SEVERITY_RANK[b])
              .map(([sev, n]) => (
                <span key={sev} className="flex items-center gap-1 text-xs">
                  <SeverityTag severity={sev} /> <span className="font-mono text-ink-2">×{n}</span>
                </span>
              ))}
          </span>
        </Kpi>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Needs you" aside={<Link to="/tasks" className="text-accent hover:underline">All tasks →</Link>} bodyClassName="">
          <TaskList items={work.slice(0, 6)} emptyBody="You are up to date. New flags, submissions and sign-off requests will appear here." />
        </Panel>
        <Panel title="Fund position" aside="FY2026 · GIFMIS">
          <dl className="flex flex-col gap-2 text-[13px]">
            {[
              ['Appropriated', naira(mda.appropriated), ''],
              ['Released (funds received)', naira(mda.released), ''],
              ['Utilised', naira(mda.utilized), ''],
              ['Unretired advances', `${naira(mda.unretired)} · ${pct(mda.unretired, mda.released)}`, mda.unretired / mda.released >= 0.05 ? 'text-crit-fg' : 'text-warn-fg'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2 last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className={`text-right font-mono font-medium tabular ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Link to="/submissions" className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-[13px] transition-colors duration-200 hover:bg-sunk">
              <span>
                <span className="font-medium">Submissions due</span>
                <span className="block text-xs text-muted">{notStarted ? `${notStarted} not started` : 'All started'}</span>
              </span>
              <span className={`font-mono text-[15px] font-semibold ${overdueSubs ? 'text-crit-fg' : ''}`}>
                {dueSubs.length + notStarted}
                {overdueSubs > 0 && <span className="ml-1 text-xs">({overdueSubs} overdue)</span>}
              </span>
            </Link>
            {release && (
              <Link to={`/submissions/${release.id}`} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-[13px] transition-colors duration-200 hover:bg-sunk">
                <span>
                  <span className="font-medium">Release request</span>
                  <span className="block text-xs text-muted">
                    {release.id} · {submissionStatus(release).label} · Treasury sees {open.length} open flag{open.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="font-mono text-[15px] font-semibold">{releaseAmount ? naira(releaseAmount) : '—'}</span>
              </Link>
            )}
          </div>
        </Panel>
      </div>

      {series.length > 0 && <ExpenditureChart data={series} />}
    </>
  )
}