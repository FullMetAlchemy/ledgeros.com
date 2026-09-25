import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { mdaPosition, mdaRating } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { scopeLabel } from '../../domain/periods'
import { scopedMdaIds, useDs, useMe, useScope } from '../../state/store'
import { DataTable } from '../../ui/DataTable'
import { PageHeader, Panel } from '../../ui/Panel'
import { RiskBadge, StatusPill } from '../../ui/Pill'

/** Searchable MDA directory (FR-MDA-001). */
export function MdaDirectory() {
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const ids = scopedMdaIds(ds, me)
  const rows = ds.mdas
    .filter((m) => ids.includes(m.id))
    .filter((m) => !q || `${m.name} ${m.acronym} ${m.code} ${m.sector} ${m.accountingOfficer}`.toLowerCase().includes(q.toLowerCase()))
    .map((m) => ({ m, p: mdaPosition(ds, m.id, scope), rating: mdaRating(ds, m.id) }))

  return (
    <>
      <PageHeader eyebrow={`MDA management · ${scopeLabel(scope)}`} title="MDA directory" />
      <Panel bodyClassName="">
        <div className="border-b border-line px-4 py-3">
          <label className="relative block max-w-96">
            <span className="sr-only">Search MDAs</span>
            <Search size={15} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, code, sector or accounting officer"
              className="h-9 w-full rounded-md border border-line-2 bg-surface pr-3 pl-8 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <DataTable
          caption="MDA directory"
          rows={rows}
          rowKey={(r) => r.m.id}
          onOpen={(r) => navigate(`/mdas/${r.m.id}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={{ title: 'No MDAs match your search' }}
          columns={[
            {
              key: 'name',
              header: 'MDA',
              sort: (r) => r.m.name,
              cell: (r) => (
                <div>
                  <div className="font-medium">{r.m.name}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {r.m.code} · {r.m.acronym}
                  </div>
                </div>
              ),
            },
            { key: 'sector', header: 'Sector', sort: (r) => r.m.sector, cell: (r) => r.m.sector },
            { key: 'ao', header: 'Accounting officer', cell: (r) => <span className="text-ink-2">{r.m.accountingOfficer}</span> },
            { key: 'appr', header: 'Appropriation', align: 'right', sort: (r) => r.m.appropriation, cell: (r) => <span className="font-mono tabular">{naira(r.m.appropriation)}</span> },
            { key: 'util', header: 'Utilization', align: 'right', sort: (r) => r.p.utilizationRate ?? 0, cell: (r) => <span className="font-mono tabular">{pctText(r.p.utilizationRate)}</span> },
            { key: 'status', header: 'Status', cell: (r) => <StatusPill tone={r.m.status === 'Active' ? 'ok' : 'neu'} label={r.m.status} /> },
            { key: 'risk', header: 'Risk', sort: (r) => r.rating, cell: (r) => <RiskBadge rating={r.rating} /> },
          ]}
        />
      </Panel>
    </>
  )
}
