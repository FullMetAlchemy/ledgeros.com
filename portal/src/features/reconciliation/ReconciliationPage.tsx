import { AlertTriangle, ArrowLeft, CheckCircle2, CloudDownload, MinusCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { naira, nairaExact } from '../../domain/money'
import { recVariance, type RecAction } from '../../domain/reconciliation'
import { can, inScope } from '../../domain/roles'
import { svcRecAction } from '../../domain/services'
import type { RecLine } from '../../domain/types'
import { store, useDs, useMe, userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextInput } from '../../ui/Field'
import { InfoTip } from '../../ui/Kpi'
import { EmptyState, Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { REC_TONE } from '../../ui/tone'
import { Banner } from '../../workflow/CaseBits'
import { StatusHistory } from '../../workflow/StatusHistory'
import { Stepper } from '../shared/Stepper'

const LINE_ICON: Record<RecLine['status'], ReactNode> = {
  Matched: <CheckCircle2 size={14} aria-hidden className="text-ok-fg" />,
  'System only': <MinusCircle size={14} aria-hidden className="text-warn-fg" />,
  'External only': <MinusCircle size={14} aria-hidden className="text-warn-fg" />,
  'Amount differs': <AlertTriangle size={14} aria-hidden className="text-warn-fg" />,
}

export function ReconciliationPage() {
  const { recId } = useParams()
  const ds = useDs()
  const me = useMe()!
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'review' | 'close' | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const rec = ds.reconciliations.find((r) => r.id === recId)
  if (!rec || !inScope(me, rec.mdaId))
    return <EmptyState title="Reconciliation not found" action={<Link to="/reconciliation" className="text-accent hover:underline">Back to reconciliation</Link>} />

  const mda = ds.mdas.find((m) => m.id === rec.mdaId)!
  const period = ds.periods.find((p) => p.id === rec.periodId)!
  const manage = can(me, 'rec.manage')
  const variance = recVariance(rec)
  const act = (action: RecAction, success?: string) => {
    const r = store.run((d, u, now) => svcRecAction(d, u, rec.id, action, now))
    if (!r.ok) {
      toast('error', 'Not done', r.error)
      return r.error
    }
    if (success) toast('success', success)
    return null
  }
  const runMatching = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 700)) // mock TSA adapter latency
    act({ type: 'RUN_MATCHING' }, 'Matched against the mock TSA statement')
    setBusy(false)
  }
  const unexplained = rec.lines.filter((l) => l.status !== 'Matched' && l.explanation.trim().length < 5).length

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <button type="button" onClick={() => navigate('/reconciliation')} className="inline-flex h-[34px] cursor-pointer items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk">
          <ArrowLeft size={15} aria-hidden /> Reconciliation
        </button>
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {rec.id} · {rec.type} reconciliation
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {mda.name} · {period.label}
            </h1>
            <StatusPill tone={REC_TONE[rec.status]} label={rec.status} />
          </div>
        </div>
      </div>

      <Stepper
        steps={['Open', 'In Progress', 'Matched', 'Reviewed', 'Closed']}
        current={rec.status}
        branch={rec.status === 'Variance' || rec.history.some((h) => h.to === 'Variance') ? { at: 'Matched', label: 'Variance', tone: 'warn' } : undefined}
      />

      <Banner
        tone={rec.status === 'Variance' ? 'warn' : rec.status === 'Matched' || rec.status === 'Closed' ? 'ok' : 'flow'}
        title={
          rec.status === 'Open'
            ? 'Run matching to compare the return with the TSA statement'
            : rec.status === 'Variance'
              ? `Variance of ${naira(variance)}: explain each unmatched line, then review`
              : rec.status === 'Matched'
                ? 'All lines matched: review to confirm'
                : rec.status === 'Reviewed'
                  ? `Reviewed: ${rec.reviewNote}`
                  : 'Closed'
        }
      >
        {manage && rec.status !== 'Closed' && (
          <div className="flex flex-wrap gap-2">
            {['Open', 'In Progress', 'Matched', 'Variance'].includes(rec.status) && (
              <Button variant={rec.status === 'Open' ? 'primary' : 'secondary'} onClick={runMatching} disabled={busy}>
                <CloudDownload size={14} aria-hidden /> {busy ? 'Fetching TSA statement (mock)…' : rec.status === 'Open' ? 'Run matching' : 'Re-run matching'}
              </Button>
            )}
            {(rec.status === 'Matched' || rec.status === 'Variance') && (
              <Button variant="primary" onClick={() => setDialog('review')} disabled={unexplained > 0}>
                Mark reviewed…
              </Button>
            )}
            {rec.status === 'Reviewed' && (
              <Button variant="primary" onClick={() => setDialog('close')}>
                Close reconciliation…
              </Button>
            )}
            {unexplained > 0 && rec.status === 'Variance' && <span className="self-center text-xs text-warn-fg">{unexplained === 1 ? '1 unmatched line still needs' : `${unexplained} unmatched lines still need`} an explanation.</span>}
          </div>
        )}
        {!manage && <p className="text-[13px] text-ink-2">Reconciliations are worked by the Ministry’s oversight officers. You can view the result.</p>}
      </Banner>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Reconciliation figures">
        {[
          ['System value', rec.status === 'Open' ? '—' : nairaExact(rec.systemValue), `Return ${rec.periodId}, submitted lines`],
          ['External (TSA) value', rec.status === 'Open' ? '—' : nairaExact(rec.externalValue), 'Mock TSA statement'],
          ['Variance', rec.status === 'Open' ? '—' : nairaExact(variance), null],
        ].map(([k, v, note]) => (
          <div key={k as string} className="rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors duration-200">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
              {k}
              {k === 'Variance' && <InfoTip label="reconciliation variance">Variance = system (return) amount − external (TSA) amount. The sign convention is a draft pending stakeholder approval (FRD §10).</InfoTip>}
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold tabular ${k === 'Variance' && rec.status !== 'Open' && Math.abs(variance) >= 1 ? 'text-warn-fg' : ''}`}>{v}</div>
            {note && <div className="text-xs text-muted">{note}</div>}
          </div>
        ))}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={rec.type === 'TSA' ? 'Line matching' : 'Vendor comparison'} aside={`${rec.lines.filter((l) => l.status !== 'Matched').length} unmatched of ${rec.lines.length}`} bodyClassName="">
          {rec.lines.length === 0 ? (
            <EmptyState title="Not matched yet" body="Run matching to load the TSA statement and compare it line by line." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-sunk text-left text-[11px] tracking-wider text-muted uppercase">
                    <th className="px-4 py-2.5 font-semibold">{rec.type === 'TSA' ? 'Reference' : 'Vendor'}</th>
                    {rec.type === 'TSA' && <th className="px-4 py-2.5 font-semibold">Payee</th>}
                    <th className="px-4 py-2.5 text-right font-semibold">System</th>
                    <th className="px-4 py-2.5 text-right font-semibold">TSA</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.lines.map((l) => (
                    <tr key={l.id} className={`border-b border-line last:border-b-0 ${l.status !== 'Matched' ? 'bg-warn-bg/40' : ''}`}>
                      <td className="px-4 py-2.5 font-mono font-medium">{l.reference}</td>
                      {rec.type === 'TSA' && <td className="px-4 py-2.5">{l.vendor}</td>}
                      <td className="px-4 py-2.5 text-right font-mono tabular">{l.systemAmount === null ? '—' : naira(l.systemAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular">{l.externalAmount === null ? '—' : naira(l.externalAmount)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          {LINE_ICON[l.status]}
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {l.status === 'Matched' ? (
                          <span className="text-xs text-muted">—</span>
                        ) : rec.status === 'Variance' && manage ? (
                          <TextInput
                            aria-label={`Explanation for ${l.reference}`}
                            className="h-8 min-w-56 text-[13px]"
                            placeholder="Why does this differ?"
                            value={drafts[l.id] ?? l.explanation}
                            onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                            onBlur={() => drafts[l.id] !== undefined && drafts[l.id] !== l.explanation && act({ type: 'EXPLAIN_LINE', lineId: l.id, explanation: drafts[l.id] })}
                          />
                        ) : (
                          <span className="text-xs text-ink-2">{l.explanation || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="History">
          <StatusHistory
            entries={rec.history.slice(1).map((h) => ({ id: h.id, at: h.at, actorId: h.actorId, label: `${h.from} → ${h.to}`, note: h.note }))}
            origin={{ label: `Created by ${userName(ds, rec.createdBy)}`, at: rec.createdAt, actorId: rec.createdBy }}
            users={ds.users}
          />
          <p className="mt-3 font-mono text-[11px] text-muted">Created {dateTime(rec.createdAt)}</p>
        </Panel>
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog === 'review' ? 'Mark reconciliation reviewed' : 'Close reconciliation'}
          eyebrow={rec.id}
          confirmLabel={dialog === 'review' ? 'Mark reviewed' : 'Close'}
          reasonLabel={dialog === 'review' ? 'Review note (recorded)' : 'Closing note (optional)'}
          minReason={dialog === 'review' ? 10 : 0}
          onClose={() => setDialog(null)}
          onConfirm={(note) => (dialog === 'review' ? act({ type: 'REVIEW', note }, 'Reviewed') : act({ type: 'CLOSE', note }, 'Closed'))}
        />
      )}
    </>
  )
}
