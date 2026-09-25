import { AlertTriangle, CheckCircle2, Download, FileUp, Info } from 'lucide-react'
import { useState } from 'react'
import { dateTime } from '../../domain/calendar'
import type { Dataset } from '../../domain/dataset'
import { naira, nairaExact } from '../../domain/money'
import { csvTemplate, importCsv, type ImportResult } from '../../domain/returns'
import type { ExpenditureReturn, Transaction } from '../../domain/types'
import { userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { download } from '../../ui/csv'
import { DataTable } from '../../ui/DataTable'
import { Dialog } from '../../ui/Dialog'
import { TextArea } from '../../ui/Field'

/** Vendor-level summary with registry checks (FR-EXP-003). */
export function vendorSummary(ds: Dataset, txns: Transaction[]) {
  const map = new Map<string, { name: string; tin: string; count: number; total: number; refs: string[] }>()
  for (const t of txns) {
    const k = `${t.vendorTin}|${t.vendorName.trim().toLowerCase()}`
    const v = map.get(k) ?? { name: t.vendorName, tin: t.vendorTin, count: 0, total: 0, refs: [] }
    v.count += 1
    v.total += Number.isFinite(t.amount) ? t.amount : 0
    v.refs.push(t.reference)
    map.set(k, v)
  }
  return [...map.values()].map((v) => {
    const reg = ds.vendors.find((x) => x.tin === v.tin.trim())
    const status: 'Registered' | 'TIN mismatch' | 'Not in registry' = !reg ? 'Not in registry' : reg.name.toLowerCase() === v.name.trim().toLowerCase() ? 'Registered' : 'TIN mismatch'
    return { ...v, status, registeredName: reg?.name }
  })
}

export function VendorTable({ ds, txns }: { ds: Dataset; txns: Transaction[] }) {
  const rows = vendorSummary(ds, txns)
  return (
    <DataTable
      caption="Vendors on this return"
      rows={rows}
      rowKey={(v) => v.tin + v.name}
      initialSort={{ key: 'total', dir: 'desc' }}
      minWidth={620}
      empty={{ title: 'No vendors yet', body: 'Vendors appear once transactions are added.' }}
      columns={[
        { key: 'name', header: 'Vendor', sort: (v) => v.name, cell: (v) => <span className="font-medium">{v.name || '—'}</span> },
        { key: 'tin', header: 'TIN', cell: (v) => <span className="font-mono text-xs">{v.tin || '—'}</span> },
        {
          key: 'status',
          header: 'Registry',
          cell: (v) => (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${v.status === 'Registered' ? 'text-ok-fg' : v.status === 'TIN mismatch' ? 'text-warn-fg' : 'text-muted'}`}>
              {v.status === 'Registered' ? <CheckCircle2 size={13} aria-hidden /> : v.status === 'TIN mismatch' ? <AlertTriangle size={13} aria-hidden /> : <Info size={13} aria-hidden />}
              {v.status}
              {v.status === 'TIN mismatch' && ` (${v.registeredName})`}
            </span>
          ),
        },
        { key: 'refs', header: 'References', cell: (v) => <span className="font-mono text-[11px] text-muted">{v.refs.join(', ')}</span> },
        { key: 'count', header: 'Payments', align: 'right', sort: (v) => v.count, cell: (v) => v.count },
        { key: 'total', header: 'Total', align: 'right', sort: (v) => v.total, cell: (v) => <span className="font-mono tabular">{naira(v.total)}</span> },
      ]}
    />
  )
}

export function TransactionTable({ ds, txns }: { ds: Dataset; txns: Transaction[] }) {
  return (
    <DataTable
      caption="Transactions"
      rows={txns}
      rowKey={(t) => t.id}
      initialSort={{ key: 'date', dir: 'asc' }}
      pageSize={12}
      minWidth={980}
      empty={{ title: 'No transactions' }}
      columns={[
        { key: 'date', header: 'Date', sort: (t) => t.date, cell: (t) => <span className="font-mono text-xs">{t.date}</span> },
        { key: 'ref', header: 'Reference', sort: (t) => t.reference, cell: (t) => <span className="font-mono font-medium">{t.reference}</span> },
        {
          key: 'vendor',
          header: 'Vendor',
          sort: (t) => t.vendorName,
          cell: (t) => (
            <div>
              {t.vendorName}
              <div className="font-mono text-[11px] text-muted">{t.vendorTin}</div>
            </div>
          ),
        },
        { key: 'desc', header: 'Description', cell: (t) => <span className="text-ink-2">{t.description}</span> },
        {
          key: 'code',
          header: 'Economic code',
          cell: (t) => (
            <span className="text-xs">
              <span className="font-mono">{t.economicCode}</span>
              <span className="block text-muted">{ds.economicCodes.find((c) => c.code === t.economicCode)?.label}</span>
            </span>
          ),
        },
        { key: 'project', header: 'Project', cell: (t) => <span className="font-mono text-[11px] text-muted">{t.projectId || '—'}</span> },
        { key: 'source', header: 'Source', cell: (t) => <span className="text-[11px] text-muted">{t.source}</span> },
        { key: 'amount', header: 'Amount', align: 'right', sort: (t) => t.amount, cell: (t) => <span className="font-mono tabular">{nairaExact(t.amount)}</span> },
      ]}
    />
  )
}

/** Earlier submitted versions, preserved on correction (FR-EXP-007). */
export function VersionsTable({ ds, ret }: { ds: Dataset; ret: ExpenditureReturn }) {
  if (!ret.versions.length) return <p className="text-[13px] text-muted">Not submitted yet.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="bg-sunk text-left text-[11px] tracking-wider text-muted uppercase">
            <th className="px-3.5 py-2 font-semibold">Version</th>
            <th className="px-3.5 py-2 font-semibold">Submitted</th>
            <th className="px-3.5 py-2 text-right font-semibold">Lines</th>
            <th className="px-3.5 py-2 text-right font-semibold">Total</th>
            <th className="px-3.5 py-2 font-semibold">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {[...ret.versions].reverse().map((v) => (
            <tr key={v.version} className="border-t border-line">
              <td className="px-3.5 py-2 font-mono">v{v.version}</td>
              <td className="px-3.5 py-2 text-xs">
                {userName(ds, v.submittedBy)}
                <span className="block font-mono text-[11px] text-muted">{dateTime(v.submittedAt)}</span>
              </td>
              <td className="px-3.5 py-2 text-right">{v.transactions.length}</td>
              <td className="px-3.5 py-2 text-right font-mono tabular">{naira(v.total)}</td>
              <td className="px-3.5 py-2 text-xs text-ink-2">{v.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** CSV import with row-level validation feedback (FRD §9). Mount only while open. */
export function ImportCsvDialog({ periodId, codes, onImport, onClose }: { periodId: string; codes: string[]; onImport: (t: Transaction[]) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const parse = (t: string) => {
    setText(t)
    setResult(t.trim() ? importCsv(t, { periodId, codes, idPrefix: `csv-${Date.now().toString(36)}` }) : null)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Import"
      title="Import transactions from CSV"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!result?.transactions.length} onClick={() => onImport(result!.transactions)}>
            Add {result?.transactions.length ?? 0} valid row{result?.transactions.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-2 bg-surface px-3 text-[13px] font-semibold hover:bg-sunk">
          <FileUp size={15} aria-hidden /> Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) parse(await f.text())
              e.target.value = ''
            }}
          />
        </label>
        <Button size="sm" variant="ghost" onClick={() => download('return-template.csv', csvTemplate())}>
          <Download size={14} aria-hidden /> Download template
        </Button>
      </div>
      <label htmlFor="csv-paste" className="text-[13px] font-medium text-ink-2">
        …or paste CSV text
      </label>
      <TextArea id="csv-paste" className="min-h-28 font-mono text-xs" value={text} onChange={(e) => parse(e.target.value)} placeholder="date,reference,vendor_name,vendor_tin,description,economic_code,amount,project_id" />
      {result?.headerError && (
        <p role="alert" className="text-[13px] font-medium text-crit-fg">
          {result.headerError}
        </p>
      )}
      {result && !result.headerError && (
        <div className="flex flex-col gap-2 text-[13px]" role="status">
          <span className="flex items-center gap-1.5 text-ok-fg">
            <CheckCircle2 size={14} aria-hidden /> {result.transactions.length} valid row{result.transactions.length === 1 ? '' : 's'}
          </span>
          {result.rowErrors.length > 0 && (
            <div className="rounded-md border border-crit-bd bg-crit-bg px-3 py-2">
              <div className="font-semibold text-crit-fg">
                {result.rowErrors.length} row{result.rowErrors.length === 1 ? '' : 's'} not imported
              </div>
              <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-ink-2">
                {result.rowErrors.map((r) => (
                  <li key={r.row}>
                    <b>Row {r.row}:</b> {r.messages.join(' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
