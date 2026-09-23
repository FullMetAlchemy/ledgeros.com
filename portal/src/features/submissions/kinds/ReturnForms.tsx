import { useId, useState } from 'react'
import { shortDate } from '../../../domain/calendar'
import { naira, nairaExact } from '../../../domain/money'
import { parseAmount } from '../../../domain/submissions/defs'
import { PERIOD_LABEL } from '../../../domain/submissions/reference'
import type { LineStatus, ReturnData, ReturnLine } from '../../../domain/submissions/types'
import type { EvidenceFile } from '../../../domain/types'
import { Button } from '../../../ui/Button'
import { Facts } from '../../../ui/Facts'
import { Field, TextInput } from '../../../ui/Field'
import { ACCEPTED_TYPES, sha256Hex } from '../../../workflow/evidence'
import { EvidenceSlot } from '../../../workflow/EvidenceSlot'
import type { DetailsProps, EvidenceProps, ViewProps } from './types'

const total = (lines: ReturnLine[]) => lines.reduce((a, l) => a + l.amount, 0)
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function ReturnScope({ data }: ViewProps<ReturnData>) {
  return (
    <Facts
      source="GIFMIS postings and TSA ledger"
      items={[
        ['Period', PERIOD_LABEL(data.period)],
        ['Postings', `${data.lines.length} vouchers`],
        ['Total posted', naira(total(data.lines)), true],
        ['Ledger closing balance', nairaExact(data.ledgerClosingBalance), true],
      ]}
      cols={4}
    />
  )
}

function Reconciliation({ data }: { data: ReturnData }) {
  const tsa = parseAmount(data.tsaStatementBalance)
  const diff = Number.isNaN(tsa) || !data.tsaStatementBalance.trim() ? null : tsa - data.ledgerClosingBalance
  return (
    <dl className="grid gap-3 rounded-md border border-line px-4 py-3 text-[13px] sm:grid-cols-3">
      <div>
        <dt className="text-xs text-muted">Ledger closing balance</dt>
        <dd className="font-mono font-medium tabular">{nairaExact(data.ledgerClosingBalance)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">TSA statement balance</dt>
        <dd className="font-mono font-medium tabular">{Number.isNaN(tsa) || !data.tsaStatementBalance.trim() ? '—' : nairaExact(tsa)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Difference</dt>
        <dd className={`font-mono font-semibold tabular ${diff === null ? '' : diff === 0 ? 'text-ok-fg' : 'text-warn-fg'}`}>
          {diff === null ? '—' : diff === 0 ? '₦0 · reconciled' : nairaExact(diff)}
        </dd>
      </div>
    </dl>
  )
}

function StatusToggle({ value, onChange, label }: { value: LineStatus; onChange: (v: LineStatus) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line-2">
      {(['confirmed', 'queried'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(value === v ? 'pending' : v)}
          className={`h-8 cursor-pointer px-3 text-xs font-semibold not-first:border-l not-first:border-line-2 ${
            value === v ? (v === 'confirmed' ? 'bg-ok-bg text-ok-fg' : 'bg-flow-bg text-flow-fg') : 'bg-surface text-ink-2 hover:bg-sunk'
          }`}
        >
          {v === 'confirmed' ? 'Confirm' : 'Query'}
        </button>
      ))}
    </div>
  )
}

export function ReturnDetails({ data, update, error }: DetailsProps<ReturnData>) {
  const setLine = (ref: string, patch: Partial<ReturnLine>) => update({ lines: data.lines.map((l) => (l.ref === ref ? { ...l, ...patch } : l)) })
  const counts = { confirmed: 0, queried: 0, pending: 0 }
  data.lines.forEach((l) => counts[l.status]++)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3" data-field="lines">
        <p className="text-[13px] text-ink-2">
          Confirm each posting you can support with evidence. Query anything that looks wrong; your note goes to oversight. Figures come from GIFMIS and cannot be edited here.
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted">
            {counts.confirmed} confirmed · {counts.queried} queried · {counts.pending} pending
          </span>
          <Button size="sm" disabled={!counts.pending} onClick={() => update({ lines: data.lines.map((l) => (l.status === 'pending' ? { ...l, status: 'confirmed' } : l)) })}>
            Confirm all pending
          </Button>
        </div>
      </div>
      {error('lines') && <p className="-mt-3 text-xs font-medium text-crit-fg">{error('lines')}</p>}

      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {data.lines.map((l) => (
          <li key={l.ref} data-field={`line:${l.ref}`} className={`flex flex-col gap-2 px-4 py-3 ${l.status === 'pending' ? '' : 'bg-sunk/60'}`}>
            <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)_auto_auto]">
              <div className="font-mono text-[12.5px] font-semibold">
                {l.ref}
                <div className="font-normal text-muted">{shortDate(`${l.date}T12:00:00`)}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{l.payee}</div>
                <div className="truncate text-xs text-muted">
                  {l.appropriationLine} · {l.economicCode}
                </div>
              </div>
              <div className="font-mono text-[13px] font-semibold tabular sm:text-right">{naira(l.amount)}</div>
              <StatusToggle label={`${l.ref} status`} value={l.status} onChange={(status) => setLine(l.ref, { status })} />
            </div>
            {l.status === 'queried' && (
              <div className="sm:pl-[126px]">
                <TextInput
                  aria-label={`Query note for ${l.ref}`}
                  placeholder="What looks wrong? e.g. posted to the wrong economic code"
                  value={l.note}
                  invalid={!!error(`line:${l.ref}`)}
                  onChange={(e) => setLine(l.ref, { note: e.target.value })}
                />
                {error(`line:${l.ref}`) && <p className="mt-1 text-xs font-medium text-crit-fg">{error(`line:${l.ref}`)}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">TSA reconciliation</h3>
        <Field
          id="tsaStatementBalance"
          label="Closing balance on the TSA statement (₦)"
          help="Copy it exactly from the statement for the last day of the month."
          error={error('tsaStatementBalance')}
        >
          <TextInput
            id="tsaStatementBalance"
            inputMode="decimal"
            className="max-w-xs font-mono"
            placeholder="12,480,650,000"
            value={data.tsaStatementBalance}
            invalid={!!error('tsaStatementBalance')}
            onChange={(e) => update({ tsaStatementBalance: e.target.value })}
          />
        </Field>
        <Reconciliation data={data} />
      </section>
    </div>
  )
}

/** Bulk drop matched by voucher number in the filename, plus per-line attach. */
export function ReturnEvidence({ data, me, evidence, addFiles, detach }: EvidenceProps<ReturnData>) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ matched: string[]; unmatched: string[] } | null>(null)

  const hash = async (f: File, slotId: string): Promise<EvidenceFile> => ({
    id: crypto.randomUUID(),
    slotId,
    name: f.name,
    size: f.size,
    mime: f.type,
    sha256: await sha256Hex(f),
    uploadedBy: me.id,
    uploadedAt: new Date().toISOString(),
  })

  async function bulk(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    const refs = [...data.lines].sort((a, b) => b.ref.length - a.ref.length)
    const matched: EvidenceFile[] = []
    const unmatched: string[] = []
    for (const f of [...list]) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        unmatched.push(`${f.name} (not PDF/JPG/PNG)`)
        continue
      }
      const line = refs.find((l) => norm(f.name).includes(norm(l.ref)))
      if (line) matched.push(await hash(f, `line:${line.ref}`))
      else unmatched.push(f.name)
    }
    if (matched.length) addFiles(matched)
    setResult({ matched: matched.map((m) => `${m.name} → ${m.slotId.slice(5)}`), unmatched })
    setBusy(false)
  }

  const needs = data.lines.filter((l) => l.status === 'confirmed' && !evidence.some((e) => e.slotId === `line:${l.ref}`))

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void bulk(e.dataTransfer.files)
        }}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-line-2 px-4 py-6 text-center hover:bg-sunk"
        data-field="evidence:lines"
      >
        <span className="text-sm font-semibold">{busy ? 'Matching and fingerprinting…' : 'Drop a folder of voucher packs here'}</span>
        <span className="max-w-md text-xs text-muted">
          Files are matched to postings by the voucher number in the filename, e.g. <span className="font-mono">PV-3912 voucher.pdf</span>. Unmatched files are listed so you can attach them by hand.
        </span>
        <input id={inputId} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="sr-only" onChange={(e) => { void bulk(e.target.files); e.target.value = '' }} />
      </label>

      {result && (
        <div className="flex flex-col gap-1.5 rounded-md border border-line px-4 py-3 text-[13px]" role="status">
          <span>
            <b>{result.matched.length}</b> matched{result.matched.length > 0 && <span className="text-muted">: {result.matched.join(', ')}</span>}
          </span>
          {result.unmatched.length > 0 && (
            <span className="text-warn-fg">
              <b>{result.unmatched.length}</b> not matched: {result.unmatched.join(', ')}. Rename with the voucher number or attach on its line below.
            </span>
          )}
        </div>
      )}

      <EvidenceSlot
        slot={{ id: 'tsa_statement', label: 'TSA sub-account statement', help: 'Bank statement for the month from the CBN TSA portal.' }}
        files={evidence.filter((e) => e.slotId === 'tsa_statement')}
        required
        editable
        userId={me.id}
        onAdd={addFiles}
        onDetach={detach}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Evidence per voucher</h3>
          <span className={`font-mono text-[11px] ${needs.length ? 'text-warn-fg' : 'text-ok-fg'}`}>
            {needs.length ? `${needs.length} confirmed voucher${needs.length === 1 ? '' : 's'} still need evidence` : 'Every confirmed voucher has evidence'}
          </span>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {data.lines.map((l) => {
            const files = evidence.filter((e) => e.slotId === `line:${l.ref}`)
            const missing = l.status === 'confirmed' && !files.length
            return (
              <li key={l.ref} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="w-20 font-mono font-semibold">{l.ref}</span>
                <span className="min-w-0 flex-1 truncate">{l.payee}</span>
                <span className="font-mono text-[11px] text-muted">{l.status}</span>
                <span className={`font-mono text-[11px] ${missing ? 'font-semibold text-warn-fg' : 'text-muted'}`}>
                  {files.length ? files.map((f) => f.sha256.slice(0, 8)).join(' ') : missing ? 'needs evidence' : '—'}
                </span>
                <LineAttach refId={l.ref} onFiles={async (fs) => addFiles(await Promise.all([...fs].map((f) => hash(f, `line:${l.ref}`))))} />
                {files.map((f) => (
                  <button key={f.id} type="button" className="cursor-pointer text-xs text-accent hover:underline" onClick={() => detach(f.id)} title={f.name}>
                    Detach {f.name.length > 18 ? `${f.name.slice(0, 16)}…` : f.name}
                  </button>
                ))}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function LineAttach({ refId, onFiles }: { refId: string; onFiles: (files: FileList) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="cursor-pointer text-xs font-medium text-accent hover:underline">
      Attach
      <span className="sr-only"> evidence for {refId}</span>
      <input
        id={id}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

export function ReturnView({ data, content }: ViewProps<ReturnData>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="bg-sunk text-left">
              {['Voucher', 'Payee', 'Amount', 'Status', 'Evidence'].map((h) => (
                <th key={h} className={`px-3.5 py-2 text-[11px] font-semibold tracking-wider text-muted uppercase ${h === 'Amount' ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => {
              const files = content.evidence.filter((e) => e.slotId === `line:${l.ref}`)
              return (
                <tr key={l.ref} className="border-t border-line align-top">
                  <td className="px-3.5 py-2 font-mono font-medium">{l.ref}</td>
                  <td className="px-3.5 py-2">
                    {l.payee}
                    {l.status === 'queried' && <div className="mt-0.5 text-xs text-flow-fg">Query: {l.note}</div>}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono tabular">{naira(l.amount)}</td>
                  <td className={`px-3.5 py-2 text-xs font-semibold ${l.status === 'confirmed' ? 'text-ok-fg' : l.status === 'queried' ? 'text-flow-fg' : 'text-muted'}`}>{l.status}</td>
                  <td className="px-3.5 py-2 font-mono text-[11px] text-muted">{files.length ? files.map((f) => f.sha256.slice(0, 8)).join(' ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Reconciliation data={data} />
    </div>
  )
}

