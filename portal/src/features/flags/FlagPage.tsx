import { ArrowLeft, FileText, Gavel } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { flagNextStep, isOverdue, MIN_EXPLANATION, type FlagAction } from '../../domain/flags'
import { naira } from '../../domain/money'
import { can, inScope, ROLE_LABEL } from '../../domain/roles'
import { RULE_DEFINITION, RULE_LABEL } from '../../domain/rules'
import { svcFlagAction } from '../../domain/services'
import type { Flag, FlagResponse, User } from '../../domain/types'
import { store, useDs, useMe, userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Field, TextArea } from '../../ui/Field'
import { EmptyState, Panel } from '../../ui/Panel'
import { DueChip, SeverityBadge, StatusPill } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { FLAG_TONE } from '../../ui/tone'
import { Banner } from '../../workflow/CaseBits'
import { CaseThread } from '../../workflow/CaseThread'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { StatusHistory } from '../../workflow/StatusHistory'
import { Stepper } from '../shared/Stepper'

const PATH = ['Detected', 'Open', 'Assigned', 'MDA Response', 'Under Review', 'Resolved', 'Closed']

type Decision = { action: FlagAction['type']; outcome?: 'accept' | 'reject' | 'return' | 'escalate'; title: string; confirm: string; danger?: boolean } | null

function useAct(flag: Flag) {
  const toast = useToast()
  return (action: FlagAction, success?: string): string | null => {
    const r = store.run((d, u, now) => svcFlagAction(d, u, flag.id, action, now))
    if (!r.ok) {
      toast('error', 'Action not allowed', r.error)
      return r.error
    }
    if (success) toast('success', success)
    return null
  }
}

function ResponseCard({ r, ds, index }: { r: FlagResponse; ds: ReturnType<typeof useDs>; index: number }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">Response {index + 1}</span>
        <span className="font-mono text-[11px] text-muted">
          {userName(ds, r.submittedBy)} · {dateTime(r.submittedAt)}
        </span>
      </header>
      <div>
        <div className="text-xs text-muted">Explanation</div>
        <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">{r.explanation}</p>
      </div>
      {r.correctiveAction && (
        <div>
          <div className="text-xs text-muted">Corrective action</div>
          <p className="mt-0.5 text-[13.5px] whitespace-pre-wrap">{r.correctiveAction}</p>
        </div>
      )}
      <EvidenceSlot slot={{ id: 'response', label: 'Supporting evidence', help: '' }} files={r.evidence} required={false} editable={false} userId="" />
      {r.supervisorDecision && (
        <p className="text-xs text-ink-2">
          <b>MDA Supervisor:</b> {r.supervisorDecision.approved ? 'approved' : 'returned'} by {userName(ds, r.supervisorDecision.by)} · {r.supervisorDecision.note}
        </p>
      )}
      {r.review && (
        <p className="text-xs text-ink-2">
          <b>Oversight review:</b> {r.review.outcome} by {userName(ds, r.review.by)} · {r.review.note}
        </p>
      )}
    </article>
  )
}

function ResponseEditor({ flag, me }: { flag: Flag; me: User }) {
  const act = useAct(flag)
  const [explanation, setExplanation] = useState(flag.draft.explanation)
  const [corrective, setCorrective] = useState(flag.draft.correctiveAction)
  const save = (patch: Partial<Flag['draft']>) => act({ type: 'SAVE_DRAFT', ...patch })
  const supervisor = me.role === 'mda_supervisor'
  return (
    <Panel title="Your response" aside="Saved as you type">
      <div className="flex flex-col gap-4">
        <Field id="explanation" label="Explanation" help="Explain the circumstances with reference to the records the rule identified." counter={`${explanation.trim().length} / ${MIN_EXPLANATION} min`}>
          <TextArea
            id="explanation"
            className="min-h-32"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            onBlur={() => explanation !== flag.draft.explanation && save({ explanation })}
          />
        </Field>
        <Field id="corrective" label="Corrective action (optional)" help="What will change, who owns it, and by when.">
          <TextArea id="corrective" className="min-h-20" value={corrective} onChange={(e) => setCorrective(e.target.value)} onBlur={() => corrective !== flag.draft.correctiveAction && save({ correctiveAction: corrective })} />
        </Field>
        <EvidenceSlot
          slot={{ id: 'response', label: 'Supporting evidence', help: 'At least one document is required: contracts, certificates, delivery notes, approvals.' }}
          files={flag.draft.evidence}
          required
          editable
          userId={me.id}
          onAdd={(files) => save({ evidence: [...flag.draft.evidence, ...files] })}
          onDetach={(id) => save({ evidence: flag.draft.evidence.filter((e) => e.id !== id) })}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={explanation.trim().length < MIN_EXPLANATION || !flag.draft.evidence.length}
            onClick={() => {
              if (explanation !== flag.draft.explanation || corrective !== flag.draft.correctiveAction) save({ explanation, correctiveAction: corrective })
              act({ type: 'SUBMIT_RESPONSE' }, supervisor ? 'Response sent for oversight review' : 'Response sent to your supervisor')
            }}
          >
            {supervisor ? 'Submit to oversight' : 'Submit to supervisor'}
          </Button>
          <span className="text-xs text-muted">Your name and the time are recorded with the response.</span>
        </div>
      </div>
    </Panel>
  )
}

export function FlagPage() {
  const { flagId } = useParams()
  const ds = useDs()
  const me = useMe()!
  const toast = useToast()
  const navigate = useNavigate()
  const flag = ds.flags.find((f) => f.id === flagId)
  const act = useAct(flag ?? ({ id: '' } as Flag))
  const [decision, setDecision] = useState<Decision>(null)
  const [reviewerId, setReviewerId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const now = new Date()

  if (!flag || !inScope(me, flag.mdaId))
    return <EmptyState title="Flag not found" body="It may be outside your data scope, or the link is out of date." action={<Link to="/flags" className="text-accent hover:underline">Back to flags</Link>} />

  const mda = ds.mdas.find((m) => m.id === flag.mdaId)!
  const reviewers = ds.users.filter((u) => can(u, 'flag.review') && u.status === 'Active')
  const officers = ds.users.filter((u) => u.mdaId === flag.mdaId && can(u, 'flag.respond') && u.status === 'Active')
  const overdue = isOverdue(flag, now)
  const latest = flag.responses.at(-1)
  const canRespond = flag.status === 'Assigned' && can(me, 'flag.respond') && me.mdaId === flag.mdaId && (me.role === 'mda_supervisor' || flag.assigneeId === me.id)

  // ---- Next-step banner --------------------------------------------------------
  const controls: ReactNode[] = []
  if (flag.status === 'Detected' && can(me, 'flag.open')) {
    const chosen = reviewerId || me.id
    controls.push(
      <div key="open" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="reviewer">
          Reviewer
          <select id="reviewer" value={chosen} onChange={(e) => setReviewerId(e.target.value)} className="h-9 rounded-md border border-line-2 bg-surface px-2 text-sm text-ink">
            {reviewers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" onClick={() => act({ type: 'OPEN', reviewerId: chosen }, 'Flag opened; the MDA has been notified')}>
          Open flag to MDA
        </Button>
      </div>,
    )
  }
  if ((flag.status === 'Open' || flag.status === 'Assigned') && can(me, 'flag.assign') && me.mdaId === flag.mdaId) {
    const chosen = assigneeId || flag.assigneeId || officers[0]?.id || ''
    controls.push(
      <div key="assign" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="assignee">
          Assign to
          <select id="assignee" value={chosen} onChange={(e) => setAssigneeId(e.target.value)} className="h-9 rounded-md border border-line-2 bg-surface px-2 text-sm text-ink">
            {officers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABEL[u.role]}
              </option>
            ))}
          </select>
        </label>
        <Button variant={flag.status === 'Open' ? 'primary' : 'secondary'} onClick={() => act({ type: 'ASSIGN', assigneeId: chosen }, 'Assigned')}>
          {flag.status === 'Open' ? 'Assign' : 'Reassign'}
        </Button>
      </div>,
    )
  }
  if (flag.status === 'MDA Response' && can(me, 'flag.approveResponse') && me.mdaId === flag.mdaId && latest?.submittedBy !== me.id) {
    controls.push(
      <Button key="ap" variant="primary" onClick={() => setDecision({ action: 'APPROVE_RESPONSE', title: 'Approve the response for oversight review', confirm: 'Approve' })}>
        Approve response…
      </Button>,
      <Button key="rt" onClick={() => setDecision({ action: 'RETURN_RESPONSE', title: 'Return the response to the officer', confirm: 'Return', danger: true })}>
        Return to officer…
      </Button>,
    )
  }
  if ((flag.status === 'Under Review' || flag.status === 'Escalated') && can(me, 'flag.review')) {
    controls.push(
      <Button key="acc" variant="primary" onClick={() => setDecision({ action: 'REVIEW', outcome: 'accept', title: 'Accept the response and resolve the flag', confirm: 'Resolve' })}>
        Accept (resolve)…
      </Button>,
      <Button key="rej" variant="danger" onClick={() => setDecision({ action: 'REVIEW', outcome: 'reject', title: 'Reject the response', confirm: 'Reject', danger: true })}>
        Reject…
      </Button>,
      <Button key="ret" onClick={() => setDecision({ action: 'REVIEW', outcome: 'return', title: 'Return to the MDA for more information', confirm: 'Return' })}>
        Return to MDA…
      </Button>,
    )
    if (flag.status === 'Under Review')
      controls.push(
        <Button key="esc" onClick={() => setDecision({ action: 'REVIEW', outcome: 'escalate', title: 'Escalate this flag', confirm: 'Escalate', danger: true })}>
          Escalate…
        </Button>,
      )
  }
  if (overdue && can(me, 'flag.escalate'))
    controls.push(
      <Button key="esc2" variant="danger" onClick={() => setDecision({ action: 'ESCALATE', title: 'Escalate: MDA response overdue', confirm: 'Escalate', danger: true })}>
        Escalate (overdue)…
      </Button>,
    )
  if ((flag.status === 'Resolved' || flag.status === 'Rejected') && can(me, 'flag.close'))
    controls.push(
      <Button key="close" variant="primary" onClick={() => setDecision({ action: 'CLOSE', title: `Close as ${flag.status}`, confirm: 'Close flag' })}>
        Close flag…
      </Button>,
    )

  const bannerTone = flag.status === 'Escalated' ? 'crit' : flag.status === 'Closed' ? 'neu' : flag.status === 'Resolved' ? 'ok' : overdue ? 'warn' : 'flow'

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <button type="button" onClick={() => navigate('/flags')} className="inline-flex h-[34px] cursor-pointer items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk">
          <ArrowLeft size={15} aria-hidden /> Flags
        </button>
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {flag.id} · {mda.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{RULE_LABEL[flag.ruleId]}</h1>
            <SeverityBadge severity={flag.severity} />
            <StatusPill tone={FLAG_TONE[flag.status]} label={flag.status} />
            <DueChip due={flag.dueAt} open={['Open', 'Assigned', 'MDA Response'].includes(flag.status)} />
          </div>
          <p className="mt-1.5 max-w-[90ch] text-[13.5px] text-ink-2">{flag.title}</p>
        </div>
      </div>

      <Stepper
        steps={PATH}
        current={flag.status === 'Closed' && flag.closedOutcome === 'Rejected' ? 'Closed' : flag.status}
        branch={
          flag.status === 'Escalated'
            ? { at: 'Resolved', label: 'Escalated', tone: 'crit' }
            : flag.status === 'Rejected' || flag.closedOutcome === 'Rejected'
              ? { at: 'Resolved', label: 'Rejected', tone: 'warn' }
              : undefined
        }
      />

      <Banner tone={bannerTone} title={overdue ? `Response overdue · ${flagNextStep(flag)}` : flagNextStep(flag)}>
        {controls.length > 0 && <div className="flex flex-wrap items-end gap-2">{controls}</div>}
        {!controls.length && flag.status !== 'Closed' && <p className="text-[13px] text-ink-2">No action needed from you at this step.</p>}
      </Banner>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Detection" aside={`Detected ${dateTime(flag.detectedAt)} by the rule engine`}>
            <div className="flex flex-col gap-4">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {flag.evidence.metrics.map((m) => (
                  <div key={m.label} className="rounded-md border border-line px-3 py-2.5">
                    <dt className="text-xs text-muted">{m.label}</dt>
                    <dd className="mt-0.5 font-mono text-[13px] font-semibold break-words">{m.value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Rule</dt>
                  <dd className="mt-0.5">{RULE_DEFINITION[flag.ruleId]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Threshold applied</dt>
                  <dd className="mt-0.5 font-mono text-[12.5px]">{flag.evidence.threshold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Observation</dt>
                  <dd className="mt-0.5">{flag.evidence.observation}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Affected amount</dt>
                  <dd className="mt-0.5 font-mono font-semibold">{naira(flag.amount)}</dd>
                </div>
              </dl>
              <div>
                <div className="mb-1.5 text-xs text-muted">Records that generated this flag</div>
                <ul className="divide-y divide-line rounded-md border border-line text-[13px]">
                  {flag.evidence.records.map((r) => {
                    const ret = r.type === 'transaction' ? ds.returns.find((x) => x.transactions.some((t) => t.reference === r.id) && x.mdaId === flag.mdaId) : null
                    const href = r.type === 'return' ? `/returns/${r.id}` : r.type === 'mda' ? `/mdas/${r.id}` : ret ? `/returns/${ret.id}` : null
                    return (
                      <li key={`${r.type}:${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <FileText size={14} aria-hidden className="text-faint" />
                          <span className="text-[11px] tracking-wide text-muted uppercase">{r.type}</span>
                          {href ? (
                            <Link to={href} className="font-medium text-accent hover:underline">
                              {r.label}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.label}</span>
                          )}
                        </span>
                        {r.amount !== undefined && <span className="font-mono text-xs tabular">{naira(r.amount)}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </Panel>

          {canRespond && <ResponseEditor key={`${flag.id}-${flag.responses.length}-${flag.status}`} flag={flag} me={me} />}

          <Panel title="Responses" aside={flag.responses.length ? `${flag.responses.length}` : undefined}>
            {flag.responses.length === 0 ? (
              <p className="text-[13px] text-muted">
                {flag.status === 'Assigned' && flag.draft.explanation ? `A response is being drafted by ${userName(ds, flag.assigneeId)}.` : 'No response submitted yet.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {flag.responses.map((r, i) => (
                  <ResponseCard key={r.id} r={r} ds={ds} index={i} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Ownership">
            <dl className="flex flex-col gap-2 text-[13px]">
              {[
                ['MDA', mda.name],
                ['Reviewer', userName(ds, flag.reviewerId)],
                ['MDA officer', userName(ds, flag.assigneeId)],
                ['Response due', flag.dueAt ? dateTime(flag.dueAt) : '—'],
                ['Period', ds.periods.find((p) => p.id === flag.periodId)?.label ?? flag.periodId],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-b-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Thread" aside={`${flag.comments.length}`}>
            <CaseThread
              flag={flag}
              users={ds.users}
              canPost={can(me, 'flag.comment')}
              onPost={(body) => {
                const err = act({ type: 'COMMENT', body })
                if (err) toast('error', 'Not posted', err)
                return !err
              }}
            />
          </Panel>
          <Panel title="Status history" aside={can(me, 'audit.view') ? <Link to={`/audit?entity=${flag.id}`} className="text-accent hover:underline">Open in ledger →</Link> : undefined}>
            <StatusHistory
              entries={flag.history.slice(1).map((h) => ({
                id: h.id,
                at: h.at,
                actorId: h.actorId,
                label: `${h.from} → ${h.to}`,
                note: h.note,
                tone: h.to === 'Escalated' || h.to === 'Rejected' ? 'bad' : h.to === 'Resolved' ? 'good' : undefined,
              }))}
              origin={{ label: `Detected by the ${RULE_LABEL[flag.ruleId]} rule`, at: flag.detectedAt }}
              users={ds.users}
            />
          </Panel>
        </div>
      </div>

      {decision && (
        <ConfirmDialog
          title={decision.title}
          eyebrow={flag.id}
          confirmLabel={decision.confirm}
          danger={decision.danger}
          reasonLabel={decision.action === 'APPROVE_RESPONSE' ? 'Approval note (recorded)' : 'Reason (recorded in the audit ledger)'}
          onClose={() => setDecision(null)}
          onConfirm={(note) => {
            const a: FlagAction =
              decision.action === 'REVIEW'
                ? { type: 'REVIEW', outcome: decision.outcome!, note }
                : decision.action === 'APPROVE_RESPONSE'
                  ? { type: 'APPROVE_RESPONSE', note }
                  : decision.action === 'RETURN_RESPONSE'
                    ? { type: 'RETURN_RESPONSE', note }
                    : decision.action === 'ESCALATE'
                      ? { type: 'ESCALATE', note }
                      : { type: 'CLOSE', note }
            return act(a, 'Recorded')
          }}
        >
          {decision.action === 'REVIEW' && latest && (
            <div className="rounded-md border border-line bg-sunk px-3 py-2 text-xs text-ink-2">
              <Gavel size={13} aria-hidden className="mr-1 inline" />
              Deciding on response {flag.responses.length} from {userName(ds, latest.submittedBy)}. Your decision and reason are added to the flag history and the audit ledger.
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
