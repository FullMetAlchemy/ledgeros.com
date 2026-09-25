import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { returnTotal } from '../../domain/metrics'
import { naira } from '../../domain/money'
import { RETURN_NEXT } from '../../domain/returns'
import { can, inScope } from '../../domain/roles'
import type { ReturnStatus } from '../../domain/types'
import { useDs, useMe, userName } from '../../state/store'
import { DataTable } from '../../ui/DataTable'
import { PageHeader, Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { RETURN_TONE } from '../../ui/tone'

type Filter = 'all' | 'action' | ReturnStatus

export function ReturnsList() {
  const ds = useDs()
  const me = useMe()!
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const all = ds.returns.filter((r) => inScope(me, r.mdaId)).sort((a, b) => b.periodId.localeCompare(a.periodId) || a.mdaId.localeCompare(b.mdaId))
  const needsMe = (s: ReturnStatus) =>
    (can(me, 'return.prepare') && (s === 'Draft' || s === 'Returned')) || (can(me, 'return.approve') && s === 'Submitted') || (can(me, 'return.review') && (s === 'Under Review' || s === 'Accepted'))
  const rows = filter === 'all' ? all : filter === 'action' ? all.filter((r) => needsMe(r.status)) : all.filter((r) => r.status === filter)
  const count = (f: Filter) => (f === 'all' ? all.length : f === 'action' ? all.filter((r) => needsMe(r.status)).length : all.filter((r) => r.status === f).length)
  const statuses: ReturnStatus[] = ['Draft', 'Submitted', 'Under Review', 'Returned', 'Accepted', 'Closed']

  return (
    <>
      <PageHeader eyebrow="Expenditure returns" title="Monthly expenditure returns">
        {can(me, 'return.prepare') && (
          <Link to="/returns/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-semibold text-on-primary shadow-sm hover:bg-primary-hover">
            <FilePlus2 size={15} aria-hidden /> New return
          </Link>
        )}
      </PageHeader>
      <Panel bodyClassName="">
        <Tabs
          label="Filter returns"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'all', label: 'All', count: count('all') },
            { id: 'action', label: 'Needs my action', count: count('action') },
            ...statuses.map((s) => ({ id: s, label: s, count: count(s) })),
          ]}
        />
        <DataTable
          caption="Expenditure returns"
          rows={rows}
          rowKey={(r) => r.id}
          onOpen={(r) => navigate(`/returns/${r.id}`)}
          initialSort={{ key: 'period', dir: 'desc' }}
          minWidth={960}
          empty={{ title: 'No returns here', body: filter === 'action' ? 'Nothing is waiting on you.' : 'Returns appear here once an MDA starts one.' }}
          columns={[
            { key: 'id', header: 'Return', cell: (r) => <span className="font-mono font-medium">{r.id}</span> },
            { key: 'mda', header: 'MDA', sort: (r) => r.mdaId, cell: (r) => ds.mdas.find((m) => m.id === r.mdaId)?.name },
            { key: 'period', header: 'Period', sort: (r) => r.periodId, cell: (r) => ds.periods.find((p) => p.id === r.periodId)?.label },
            { key: 'status', header: 'Status', sort: (r) => r.status, cell: (r) => <StatusPill tone={RETURN_TONE[r.status]} label={r.status} /> },
            { key: 'next', header: 'Next step', cell: (r) => <span className="text-xs text-muted">{RETURN_NEXT[r.status]}</span> },
            { key: 'lines', header: 'Lines', align: 'right', sort: (r) => r.transactions.length, cell: (r) => r.transactions.length },
            { key: 'total', header: 'Total', align: 'right', sort: (r) => returnTotal(r), cell: (r) => <span className="font-mono tabular">{naira(returnTotal(r))}</span> },
            {
              key: 'submitted',
              header: 'Submitted',
              sort: (r) => r.submittedAt ?? '',
              cell: (r) =>
                r.submittedAt ? (
                  <span className="text-xs">
                    {userName(ds, r.submittedBy)}
                    <span className="block font-mono text-[11px] text-muted">{dateTime(r.submittedAt)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted">Not yet</span>
                ),
            },
          ]}
        />
      </Panel>
    </>
  )
}
