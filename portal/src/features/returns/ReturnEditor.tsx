import { CloudDownload, FileUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clock } from '../../domain/calendar'
import { key } from '../../domain/dataset'
import { returnTotal } from '../../domain/metrics'
import { naira, nairaExact } from '../../domain/money'
import { canSubmitReturn, parseMoney, validateReturn, validateTransaction, type ReturnIssue } from '../../domain/returns'
import { evaluate, RULE_LABEL } from '../../domain/rules'
import { svcEditReturn, svcReturnAction } from '../../domain/services'
import type { EvidenceFile, ExpenditureReturn, Transaction, User } from '../../domain/types'
import { store, useDs } from '../../state/store'
import { Button } from '../../ui/Button'
import { Field, TextInput } from '../../ui/Field'
import { useToast } from '../../ui/toast'
import { ValidationSummary } from '../../ui/ValidationSummary'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { Wizard, type StepStatus } from '../../workflow/Wizard'
import { ImportCsvDialog, VendorTable } from './ReturnParts'

const SECTIONS = ['Period', 'Transactions', 'Vendors', 'Evidence', 'Submission'] as const
const SECTION_OF: Record<ReturnIssue['section'], number> = { period: 0, transactions: 1, vendors: 2, evidence: 3, submission: 4 }
const EVIDENCE = [
  { id: 'tsa_statement', label: 'TSA sub-account statement', help: 'Bank statement for the month from the CBN TSA portal. Required.', required: true },
  { id: 'vouchers', label: 'Payment vouchers', help: 'Signed vouchers with supporting invoices. Recommended.', required: false },
  { id: 'other', label: 'Other supporting documents', help: 'Contracts, certificates or correspondence.', required: false },
]
const SAVE_DELAY_MS = 500

const blankLine = (n: number): Transaction => ({
  id: `m-${Date.now().toString(36)}-${n}`,
  date: '',
  reference: '',
  vendorName: '',
  vendorTin: '',
  description: '',
  economicCode: '',
  projectId: '',
  amount: Number.NaN,
  source: 'Manual',
})

export function ReturnEditor({ ret, me }: { ret: ExpenditureReturn; me: User }) {
  const ds = useDs()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [reviewed, setReviewed] = useState(false)
  const [txns, setTxns] = useState<Transaction[]>(ret.transactions)
  const [amountText, setAmountText] = useState<Record<string, string>>(() => Object.fromEntries(ret.transactions.map((t) => [t.id, Number.isFinite(t.amount) ? String(t.amount) : ''])))
  const [tsa, setTsa] = useState(ret.tsaClosingBalance)
  const [csvOpen, setCsvOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const dirty = useRef(false)

  // Debounced autosave of the lines and TSA balance.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      const r = store.run((d, u, now) => svcEditReturn(d, u, ret.id, { transactions: txns, tsaClosingBalance: tsa }, now))
      if (r.ok) setSavedAt(new Date())
      else toast('error', 'Draft not saved', r.error)
      dirty.current = false
    }, SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [txns, tsa, ret.id, toast])

  const current: ExpenditureReturn = { ...ret, transactions: txns, tsaClosingBalance: tsa }
  const issues = validateReturn(ds, current)
  const ready = canSubmitReturn(issues)
  const codes = ds.economicCodes.map((c) => c.code)
  const projects = ds.projects.filter((p) => p.mdaId === ret.mdaId)
  const period = ds.periods.find((p) => p.id === ret.periodId)!
  const lastNote = [...ds.audit].reverse().find((e) => e.entityId === ret.id && e.action === 'RETURN_RETURNED')

  const update = (next: Transaction[]) => {
    dirty.current = true
    setTxns(next)
  }
  const setLine = (id: string, patch: Partial<Transaction>) => update(txns.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const addLines = (lines: Transaction[]) => {
    const existing = new Set(txns.map((t) => t.reference.toUpperCase()))
    const fresh = lines.filter((l) => !existing.has(l.reference.toUpperCase()))
    setAmountText((a) => ({ ...a, ...Object.fromEntries(fresh.map((t) => [t.id, String(t.amount)])) }))
    update([...txns, ...fresh])
    return { added: fresh.length, skipped: lines.length - fresh.length }
  }
  const saveEvidence = (evidence: EvidenceFile[]) => {
    const r = store.run((d, u, now) => svcEditReturn(d, u, ret.id, { evidence }, now))
    if (!r.ok) toast('error', 'Evidence not saved', r.error)
  }
  const latestEvidence = () => ds.returns.find((r) => r.id === ret.id)?.evidence ?? ret.evidence

  const importGifmis = async () => {
    setFetching(true)
    await new Promise((r) => setTimeout(r, 700)) // mock adapter latency
    const postings = ds.gifmisPostings[key(ret.mdaId, ret.periodId)] ?? []
    setFetching(false)
    if (!postings.length) return toast('info', 'No postings found', 'The mock GIFMIS adapter has no postings for this MDA and period.')
    const { added, skipped } = addLines(postings.map((p, i) => ({ ...p, id: `g-${Date.now().toString(36)}-${i}`, source: 'Mock GIFMIS' as const })))
    toast('success', `${added} posting${added === 1 ? '' : 's'} imported from mock GIFMIS`, skipped ? `${skipped} already on the return were skipped.` : 'Review each line before submitting.')
  }

  // Rules preview: what the anomaly engine would flag if this were submitted now.
  const preview = useMemo(() => {
    if (!ready) return []
    try {
      const hypothetical = { ...ds, returns: ds.returns.map((r) => (r.id === ret.id ? { ...current, status: 'Submitted' as const } : r)) }
      return evaluate(hypothetical, ret.periodId, new Date(), [ret.mdaId]).flags
    } catch {
      return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ds, txns, tsa])

  const go = (i: number) => {
    setStep(i)
    if (i >= 4) setReviewed(true)
  }
  const blockingIn = (s: number) => issues.some((i) => i.tier === 'blocking' && SECTION_OF[i.section] === s)
  const status = (s: number): StepStatus => (s === 4 || s >= step ? 'todo' : blockingIn(s) ? 'issue' : 'done')

  const submit = () => {
    const r = store.run((d, u, now) => svcReturnAction(d, u, ret.id, { type: 'SUBMIT' }, now))
    if (!r.ok) return toast('error', 'Not submitted', r.error)
    toast('success', me.role === 'mda_supervisor' ? 'Submitted for oversight review' : 'Submitted for supervisor approval', r.message ? `Rules evaluated: ${r.message}.` : undefined)
  }

  return (
    <Wizard
      steps={SECTIONS.map((label, i) => ({ label, status: status(i) }))}
      current={step}
      onStep={go}
      saved={savedAt ? `Draft saved ${clock(savedAt)}` : `Version ${ret.versions.length + 1} · draft`}
      footer={
        <>
          <Button variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
            ← Back
          </Button>
          {step < 4 ? (
            <Button variant="primary" onClick={() => go(step + 1)}>
              Continue to {SECTIONS[step + 1]} →
            </Button>
          ) : (
            <Button variant="primary" disabled={!ready || !confirmed} onClick={submit}>
              Submit return
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Reporting period', period.label],
              ['Period status', period.status === 'Open' ? 'Open: accepts returns' : `${period.status}: correction only`],
              ['Version', `v${ret.versions.length + 1}${ret.versions.length ? ' (revision)' : ''}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-line px-3.5 py-2.5">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-0.5 text-[13.5px] font-medium">{v}</div>
              </div>
            ))}
          </div>
          {lastNote && ret.status === 'Returned' && (
            <div className="rounded-lg border border-warn-bd bg-warn-bg px-4 py-3 text-[13px] text-ink-2">
              <b className="text-warn-fg">Returned for changes.</b> {lastNote.summary}
            </div>
          )}
          <p className="max-w-[72ch] text-[13.5px] text-ink-2">
            Record every payment made in {period.label} as a vendor-level line: add lines by hand, import a CSV, or import postings from GIFMIS (mock). The return is checked before submission and evaluated by the anomaly rules when you submit.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[12px] text-muted">
              {txns.length} line{txns.length === 1 ? '' : 's'} · {naira(returnTotal({ transactions: txns.filter((t) => Number.isFinite(t.amount)) }))}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setCsvOpen(true)}>
                <FileUp size={14} aria-hidden /> Import CSV
              </Button>
              <Button size="sm" onClick={importGifmis} disabled={fetching}>
                <CloudDownload size={14} aria-hidden /> {fetching ? 'Fetching from GIFMIS (mock)…' : 'Import from GIFMIS (mock)'}
              </Button>
              <Button size="sm" variant="primary" onClick={() => update([...txns, blankLine(txns.length)])}>
                <Plus size={14} aria-hidden /> Add line
              </Button>
            </div>
          </div>
          {txns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-2 px-4 py-8 text-center text-[13px] text-muted">No lines yet. Add a line, import a CSV, or import from GIFMIS (mock).</div>
          ) : (
            <ul className="flex flex-col gap-3" data-field="transactions">
              {txns.map((t, i) => {
                const errs = reviewed ? validateTransaction(t, { periodId: ret.periodId, codes }) : []
                return (
                  <li key={t.id} className={`rounded-lg border p-3 ${errs.length ? 'border-crit-bd' : 'border-line'}`} data-field={`txn:${t.id}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted">
                        Line {i + 1} · {t.source}
                      </span>
                      <button
                        type="button"
                        onClick={() => update(txns.filter((x) => x.id !== t.id))}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-crit-fg"
                        aria-label={`Remove line ${i + 1}`}
                      >
                        <Trash2 size={13} aria-hidden /> Remove
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[130px_110px_minmax(0,1fr)_150px]">
                      <Field id={`d-${t.id}`} label="Date">
                        <TextInput id={`d-${t.id}`} type="date" value={t.date} onChange={(e) => setLine(t.id, { date: e.target.value })} />
                      </Field>
                      <Field id={`r-${t.id}`} label="Reference">
                        <TextInput id={`r-${t.id}`} className="font-mono uppercase" placeholder="PV-1234" value={t.reference} onChange={(e) => setLine(t.id, { reference: e.target.value.toUpperCase() })} />
                      </Field>
                      <Field id={`v-${t.id}`} label="Vendor">
                        <TextInput
                          id={`v-${t.id}`}
                          list="vendor-registry"
                          value={t.vendorName}
                          onChange={(e) => {
                            const v = ds.vendors.find((x) => x.name === e.target.value)
                            setLine(t.id, v ? { vendorName: v.name, vendorTin: v.tin } : { vendorName: e.target.value })
                          }}
                        />
                      </Field>
                      <Field id={`t-${t.id}`} label="Vendor TIN">
                        <TextInput id={`t-${t.id}`} className="font-mono" placeholder="12345678-0001" value={t.vendorTin} onChange={(e) => setLine(t.id, { vendorTin: e.target.value })} />
                      </Field>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_170px_170px]">
                      <Field id={`s-${t.id}`} label="Description of goods or service">
                        <TextInput id={`s-${t.id}`} value={t.description} onChange={(e) => setLine(t.id, { description: e.target.value })} />
                      </Field>
                      <Field id={`c-${t.id}`} label="Economic code">
                        <select id={`c-${t.id}`} value={t.economicCode} onChange={(e) => setLine(t.id, { economicCode: e.target.value })} className="h-10 w-full rounded-md border border-line-2 bg-surface px-2 text-sm">
                          <option value="">Choose…</option>
                          {ds.economicCodes.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} · {c.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id={`p-${t.id}`} label="Project (optional)">
                        <select id={`p-${t.id}`} value={t.projectId} onChange={(e) => setLine(t.id, { projectId: e.target.value })} className="h-10 w-full rounded-md border border-line-2 bg-surface px-2 text-sm">
                          <option value="">None</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field id={`a-${t.id}`} label="Amount (₦)">
                        <TextInput
                          id={`a-${t.id}`}
                          inputMode="decimal"
                          className="text-right font-mono"
                          value={amountText[t.id] ?? ''}
                          onChange={(e) => {
                            setAmountText((a) => ({ ...a, [t.id]: e.target.value }))
                            setLine(t.id, { amount: parseMoney(e.target.value) })
                          }}
                        />
                      </Field>
                    </div>
                    {errs.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-crit-fg">
                        {errs.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <datalist id="vendor-registry">
            {ds.vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
          {csvOpen && (
            <ImportCsvDialog
              periodId={ret.periodId}
              codes={codes}
              onClose={() => setCsvOpen(false)}
              onImport={(lines) => {
                const { added, skipped } = addLines(lines)
                setCsvOpen(false)
                toast('success', `${added} line${added === 1 ? '' : 's'} imported`, skipped ? `${skipped} duplicate reference${skipped === 1 ? '' : 's'} skipped.` : undefined)
              }}
            />
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-2">Vendors are checked against the state vendor registry. Mismatched TINs and unregistered vendors are warnings; they don’t block submission but are visible to reviewers.</p>
          <div className="overflow-hidden rounded-lg border border-line">
            <VendorTable ds={ds} txns={txns} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Field
            id="tsaClosingBalance"
            label="TSA sub-account closing balance (₦)"
            help={`Balance on the last day of ${period.label}, from the TSA statement.`}
            error={reviewed ? issues.find((i) => i.field === 'tsaClosingBalance')?.message : undefined}
          >
            <TextInput
              id="tsaClosingBalance"
              inputMode="decimal"
              className="max-w-xs font-mono"
              value={tsa}
              onChange={(e) => {
                dirty.current = true
                setTsa(e.target.value)
              }}
            />
          </Field>
          {Number.isFinite(parseMoney(tsa)) && <p className="-mt-2 font-mono text-xs text-muted">= {nairaExact(parseMoney(tsa))}</p>}
          {EVIDENCE.map((slot) => (
            <EvidenceSlot
              key={slot.id}
              slot={slot}
              files={ret.evidence.filter((e) => e.slotId === slot.id)}
              required={slot.required}
              editable
              userId={me.id}
              onAdd={(files) => saveEvidence([...latestEvidence(), ...files])}
              onDetach={(id) => saveEvidence(latestEvidence().filter((e) => e.id !== id))}
            />
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <ValidationSummary
            issues={issues.map((i) => ({ id: i.id, tier: i.tier, message: i.message, where: SECTIONS[SECTION_OF[i.section]] }))}
            onJump={(i) => go(SECTIONS.indexOf(i.where as (typeof SECTIONS)[number]))}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Lines', String(txns.length)],
              ['Total', naira(returnTotal({ transactions: txns.filter((t) => Number.isFinite(t.amount)) }))],
              ['Next', me.role === 'mda_supervisor' ? 'Oversight review' : 'Your supervisor, then oversight'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-line px-3.5 py-2.5">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-0.5 font-medium">{v}</div>
              </div>
            ))}
          </div>
          {ready && (
            <div className="rounded-lg border border-line bg-sunk px-4 py-3 text-[13px]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Sparkles size={14} aria-hidden className="text-accent" /> Rules preview
              </div>
              {preview.length ? (
                <ul className="mt-1.5 flex flex-col gap-1 text-ink-2">
                  {preview.map((f) => (
                    <li key={f.dedupeKey}>
                      <b>{f.severity} {RULE_LABEL[f.ruleId]}:</b> {f.title}
                    </li>
                  ))}
                  <li className="text-xs text-muted">Flags are raised for review, not as findings. If a line is wrong, correct it before submitting.</li>
                </ul>
              ) : (
                <p className="mt-1 text-ink-2">No new exceptions expected from this return.</p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input id={`confirm-${ret.id}`} type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            I confirm this return is complete and accurate for {period.label}. My name and the time of submission will be recorded.
          </label>
        </div>
      )}
    </Wizard>
  )
}
