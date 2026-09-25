import { Download } from 'lucide-react'
import { useState } from 'react'
import { dateTime } from '../../domain/calendar'
import { COUNTED, isActiveFlag, mdaPosition, mdaRating, statePosition } from '../../domain/metrics'
import { naira, pctText } from '../../domain/money'
import { monthsIn, periodId, scopeLabel } from '../../domain/periods'
import { recVariance } from '../../domain/reconciliation'
import { can, inScope } from '../../domain/roles'
import { RULE_LABEL } from '../../domain/rules'
import { svcExportEvent } from '../../domain/services'
import { key } from '../../domain/dataset'
import { store, scopedMdaIds, useDs, useMe, useScope, userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { download, toCsv, type CsvColumn } from '../../ui/csv'
import { DataTable, type Column } from '../../ui/DataTable'
import { PageHeader, Panel } from '../../ui/Panel'
import { RiskBadge, SeverityBadge, StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { useToast } from '../../ui/toast'
import { FLAG_TONE, REC_TONE } from '../../ui/tone'

type Tab = 'executive' | 'mda' | 'exceptions' | 'reconciliation' | 'vendors'

interface ReportDef<T> {
  title: string
  rows: T[]
  columns: Column<T>[]
  csv: CsvColumn<T>[]
  rowKey: (r: T) => string
}

function ReportView<T>({ def, scopeText }: { def: ReportDef<T>; scopeText: string }) {
  const toast = useToast()
  const exportCsv = () => {
    download(`${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, toCsv(def.rows, def.csv, `Oversight Ledger OS: ${def.title} (${scopeText})`))
    store.record((d, u, now) => svcExportEvent(d, u, def.title, def.rows.length, now))
    toast('success', 'Report exported', `${def.rows.length} rows. The export is recorded in the audit ledger.`)
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="text-xs text-muted">
          {def.title} · {scopeText} · {def.rows.length} rows
        </span>
        {can(store.me(), 'report.export') && (
          <Button size="sm" onClick={exportCsv} disabled={!def.rows.length}>
            <Download size={14} aria-hidden /> Export CSV
          </Button>
        )}
      </div>
      <DataTable caption={def.title} rows={def.rows} rowKey={def.rowKey} columns={def.columns} pageSize={15} minWidth={900} empty={{ title: 'Nothing to report for this period and scope' }} />
    </div>
  )
}

export function Reports() {
  const ds = useDs()
  const me = useMe()!
  const scope = useScope()
  const [tab, setTab] = useState<Tab>(me.mdaId ? 'mda' : 'executive')
  const ids = scopedMdaIds(ds, me)
  const scopeText = scopeLabel(scope)
  const periods = new Set(monthsIn(scope).map((m) => periodId(m)))

  // Executive: consolidated overview by MDA, with state totals row.
  const s = statePosition(ds, scope, ids)
  const execRows = [
    ...ds.mdas.filter((m) => ids.includes(m.id)).map((m) => ({ key: m.id, name: m.name, p: mdaPosition(ds, m.id, scope), rating: mdaRating(ds, m.id) as string })),
    { key: 'TOTAL', name: 'State total', p: s, rating: '' },
  ]
  const executive: ReportDef<(typeof execRows)[number]> = {
    title: 'Executive financial overview',
    rows: execRows,
    rowKey: (r) => r.key,
    columns: [
      { key: 'name', header: 'MDA', cell: (r) => <span className={r.key === 'TOTAL' ? 'font-semibold' : 'font-medium'}>{r.name}</span> },
      { key: 'a', header: 'Appropriation', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(r.p.appropriation)}</span> },
      { key: 'r', header: 'Released', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(r.p.released)}</span> },
      { key: 'u', header: 'Utilized', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(r.p.utilized)}</span> },
      { key: 'ur', header: 'Utilization', align: 'right', cell: (r) => <span className="font-mono tabular">{pctText(r.p.utilizationRate)}</span> },
      { key: 'un', header: 'Unretired', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(r.p.unretired)}</span> },
      { key: 'risk', header: 'Risk', cell: (r) => (r.rating ? <RiskBadge rating={r.rating as 'Clear'} /> : '') },
    ],
    csv: [
      { header: 'MDA', value: (r) => r.name },
      { header: 'Appropriation (NGN)', value: (r) => r.p.appropriation },
      { header: 'Released (NGN)', value: (r) => r.p.released },
      { header: 'Release rate %', value: (r) => r.p.releaseRate?.toFixed(1) },
      { header: 'Utilized (NGN)', value: (r) => r.p.utilized },
      { header: 'Utilization rate %', value: (r) => r.p.utilizationRate?.toFixed(1) },
      { header: 'Allocation variance (NGN)', value: (r) => r.p.allocationVariance },
      { header: 'Unretired (NGN)', value: (r) => r.p.unretired },
      { header: 'Risk status', value: (r) => r.rating },
    ],
  }

  // MDA report: financial and compliance position per MDA in scope.
  const mdaRows = ds.mdas
    .filter((m) => ids.includes(m.id))
    .map((m) => {
      const flags = ds.flags.filter((f) => f.mdaId === m.id)
      const returns = ds.returns.filter((r) => r.mdaId === m.id && periods.has(r.periodId))
      return { m, p: mdaPosition(ds, m.id, scope), rating: mdaRating(ds, m.id), active: flags.filter(isActiveFlag).length, closed: flags.filter((f) => f.status === 'Closed').length, returns }
    })
  const mdaReport: ReportDef<(typeof mdaRows)[number]> = {
    title: 'MDA financial and compliance report',
    rows: mdaRows,
    rowKey: (r) => r.m.id,
    columns: [
      { key: 'm', header: 'MDA', cell: (r) => <span className="font-medium">{r.m.name}</span> },
      { key: 'u', header: 'Utilized', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(r.p.utilized)}</span> },
      { key: 'v', header: 'Allocation variance', align: 'right', cell: (r) => <span className={`font-mono tabular ${r.p.allocationVariance > 0 ? 'text-crit-fg' : ''}`}>{naira(r.p.allocationVariance)}</span> },
      { key: 'ret', header: 'Returns in period', cell: (r) => <span className="text-xs">{r.returns.map((x) => `${x.periodId.slice(5)}: ${x.status}`).join(' · ') || 'None'}</span> },
      { key: 'fa', header: 'Active flags', align: 'right', cell: (r) => r.active },
      { key: 'fc', header: 'Closed flags', align: 'right', cell: (r) => r.closed },
      { key: 'risk', header: 'Risk', cell: (r) => <RiskBadge rating={r.rating} /> },
    ],
    csv: [
      { header: 'MDA', value: (r) => r.m.name },
      { header: 'Code', value: (r) => r.m.code },
      { header: 'Appropriation (NGN)', value: (r) => r.p.appropriation },
      { header: 'Released (NGN)', value: (r) => r.p.released },
      { header: 'Utilized (NGN)', value: (r) => r.p.utilized },
      { header: 'Allocation variance (NGN)', value: (r) => r.p.allocationVariance },
      { header: 'Unretired (NGN)', value: (r) => r.p.unretired },
      { header: 'Returns in period', value: (r) => r.returns.map((x) => `${x.id} ${x.status}`).join('; ') },
      { header: 'Active flags', value: (r) => r.active },
      { header: 'Closed flags', value: (r) => r.closed },
      { header: 'Risk status', value: (r) => r.rating },
    ],
  }

  // Exceptions: active and historical flags.
  const flagRows = ds.flags.filter((f) => inScope(me, f.mdaId))
  const exceptions: ReportDef<(typeof flagRows)[number]> = {
    title: 'Exception report',
    rows: flagRows,
    rowKey: (f) => f.id,
    columns: [
      { key: 'id', header: 'Flag', cell: (f) => <span className="font-mono text-xs">{f.id}</span> },
      { key: 'rule', header: 'Rule', cell: (f) => RULE_LABEL[f.ruleId] },
      { key: 'mda', header: 'MDA', cell: (f) => f.mdaId },
      { key: 'sev', header: 'Severity', cell: (f) => <SeverityBadge severity={f.severity} /> },
      { key: 'amt', header: 'Amount', align: 'right', cell: (f) => <span className="font-mono tabular">{naira(f.amount)}</span> },
      { key: 'st', header: 'Status', cell: (f) => <StatusPill tone={FLAG_TONE[f.status]} label={f.status} /> },
      { key: 'det', header: 'Detected', cell: (f) => <span className="font-mono text-xs">{dateTime(f.detectedAt)}</span> },
    ],
    csv: [
      { header: 'Flag', value: (f) => f.id },
      { header: 'Rule', value: (f) => RULE_LABEL[f.ruleId] },
      { header: 'MDA', value: (f) => f.mdaId },
      { header: 'Severity', value: (f) => f.severity },
      { header: 'Affected amount (NGN)', value: (f) => Math.round(f.amount) },
      { header: 'Status', value: (f) => f.status },
      { header: 'Outcome', value: (f) => f.closedOutcome },
      { header: 'Detected', value: (f) => f.detectedAt },
      { header: 'Reviewer', value: (f) => userName(ds, f.reviewerId) },
      { header: 'MDA officer', value: (f) => userName(ds, f.assigneeId) },
      { header: 'Threshold', value: (f) => f.evidence.threshold },
      { header: 'Title', value: (f) => f.title },
    ],
  }

  const recRows = ds.reconciliations.filter((r) => inScope(me, r.mdaId))
  const reconciliation: ReportDef<(typeof recRows)[number]> = {
    title: 'Reconciliation status and variance report',
    rows: recRows,
    rowKey: (r) => r.id,
    columns: [
      { key: 'id', header: 'Reconciliation', cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
      { key: 't', header: 'Type', cell: (r) => r.type },
      { key: 'm', header: 'MDA', cell: (r) => r.mdaId },
      { key: 'p', header: 'Period', cell: (r) => r.periodId },
      { key: 's', header: 'Status', cell: (r) => <StatusPill tone={REC_TONE[r.status]} label={r.status} /> },
      { key: 'v', header: 'Variance', align: 'right', cell: (r) => <span className="font-mono tabular">{naira(recVariance(r))}</span> },
      { key: 'u', header: 'Unmatched lines', align: 'right', cell: (r) => r.lines.filter((l) => l.status !== 'Matched').length },
    ],
    csv: [
      { header: 'Reconciliation', value: (r) => r.id },
      { header: 'Type', value: (r) => r.type },
      { header: 'MDA', value: (r) => r.mdaId },
      { header: 'Period', value: (r) => r.periodId },
      { header: 'Status', value: (r) => r.status },
      { header: 'System value (NGN)', value: (r) => r.systemValue },
      { header: 'External value (NGN)', value: (r) => r.externalValue },
      { header: 'Variance (NGN, system − external)', value: (r) => recVariance(r) },
      { header: 'Unmatched lines', value: (r) => r.lines.filter((l) => l.status !== 'Matched').length },
      { header: 'Review note', value: (r) => r.reviewNote },
    ],
  }

  // Vendors: disbursement by vendor from counted returns in the period, with TSA clearance.
  const vmap = new Map<string, { name: string; tin: string; mdas: Set<string>; count: number; total: number; cleared: number }>()
  for (const r of ds.returns.filter((x) => inScope(me, x.mdaId) && periods.has(x.periodId) && COUNTED.includes(x.status))) {
    const tsa = ds.tsaStatements[key(r.mdaId, r.periodId)] ?? []
    for (const t of r.transactions) {
      const k = t.vendorTin || t.vendorName
      const v = vmap.get(k) ?? { name: t.vendorName, tin: t.vendorTin, mdas: new Set(), count: 0, total: 0, cleared: 0 }
      v.mdas.add(r.mdaId)
      v.count += 1
      v.total += t.amount
      v.cleared += tsa.find((x) => x.reference === t.reference)?.amount ?? 0
      vmap.set(k, v)
    }
  }
  const vendorRows = [...vmap.values()].sort((a, b) => b.total - a.total)
  const vendors: ReportDef<(typeof vendorRows)[number]> = {
    title: 'Vendor disbursement report',
    rows: vendorRows,
    rowKey: (v) => v.tin + v.name,
    columns: [
      { key: 'n', header: 'Vendor', cell: (v) => <span className="font-medium">{v.name}</span> },
      { key: 't', header: 'TIN', cell: (v) => <span className="font-mono text-xs">{v.tin}</span> },
      { key: 'm', header: 'MDAs', cell: (v) => [...v.mdas].join(', ') },
      { key: 'c', header: 'Payments', align: 'right', cell: (v) => v.count },
      { key: 'tot', header: 'Disbursed (returns)', align: 'right', cell: (v) => <span className="font-mono tabular">{naira(v.total)}</span> },
      { key: 'cl', header: 'Cleared (TSA)', align: 'right', cell: (v) => <span className={`font-mono tabular ${Math.abs(v.total - v.cleared) >= 1 ? 'text-warn-fg' : ''}`}>{naira(v.cleared)}</span> },
    ],
    csv: [
      { header: 'Vendor', value: (v) => v.name },
      { header: 'TIN', value: (v) => v.tin },
      { header: 'MDAs', value: (v) => [...v.mdas].join('; ') },
      { header: 'Payments', value: (v) => v.count },
      { header: 'Disbursed per returns (NGN)', value: (v) => v.total },
      { header: 'Cleared per TSA (NGN)', value: (v) => v.cleared },
      { header: 'Difference (NGN)', value: (v) => v.total - v.cleared },
    ],
  }

  const tabs: { id: Tab; label: string }[] = [
    ...(me.mdaId ? [] : [{ id: 'executive' as const, label: 'Executive overview' }]),
    { id: 'mda', label: 'MDA report' },
    { id: 'exceptions', label: 'Exceptions' },
    { id: 'reconciliation', label: 'Reconciliation' },
    { id: 'vendors', label: 'Vendors' },
  ]

  return (
    <>
      <PageHeader eyebrow={`Reporting · ${scopeText}`} title="Reports" />
      <p className="-mt-2 max-w-[90ch] text-[13px] text-ink-2">
        Reports use the reporting period in the header and your data scope. CSV exports include a prototype-data notice and are recorded in the audit ledger.
      </p>
      <Panel bodyClassName="">
        <Tabs label="Reports" value={tab} onChange={setTab} tabs={tabs} />
        {tab === 'executive' && <ReportView def={executive} scopeText={scopeText} />}
        {tab === 'mda' && <ReportView def={mdaReport} scopeText={scopeText} />}
        {tab === 'exceptions' && <ReportView def={exceptions} scopeText="all periods" />}
        {tab === 'reconciliation' && <ReportView def={reconciliation} scopeText="all periods" />}
        {tab === 'vendors' && <ReportView def={vendors} scopeText={scopeText} />}
      </Panel>
    </>
  )
}
