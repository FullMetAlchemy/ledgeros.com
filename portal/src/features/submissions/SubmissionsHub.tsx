import { useState } from 'react'
import { useNavigate } from 'react-router'
import { shortDate } from '../../domain/calendar'
import { naira } from '../../domain/money'
import { advanceStatus } from '../../domain/submissions/create'
import { DEFS } from '../../domain/submissions/defs'
import type { Submission, SubmissionKind } from '../../domain/submissions/types'
import { RETIREMENT_WINDOW_DAYS } from '../../domain/submissions/validation'
import type { User } from '../../domain/types'
import { store, useMe, usePortal, visibleSubmissions } from '../../state/store'
import { Button } from '../../ui/Button'
import { PageHeader, Panel } from '../../ui/Panel'
import { DueChip, StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { useToast } from '../../ui/toast'
import { NewSubmissionDialog } from './NewSubmissionDialog'
import { SubmissionTable } from './SubmissionTable'
import { submissionStatus } from './submissionViews'

type Tab = 'progress' | 'signoff' | 'review' | 'closed' | 'all'

const canPrepare = (me: User, kind: SubmissionKind) => DEFS[kind].preparers.includes(me.role)
const canCreateAny = (me: User) => (Object.keys(DEFS) as SubmissionKind[]).some((k) => !DEFS[k].scheduled && canPrepare(me, k))
const newestFirst = (a: Submission, b: Submission) => b.createdAt.localeCompare(a.createdAt)

export function SubmissionsHub() {
  const s = usePortal()
  const me = useMe()!
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('progress')
  const [creating, setCreating] = useState(false)
  const subs = visibleSubmissions(s, me).sort(newestFirst)
  const now = new Date()

  const lists: Record<Tab, Submission[]> = {
    progress: subs.filter((x) => x.state === 'Draft' || x.state === 'Queried'),
    signoff: subs.filter((x) => x.state === 'InChain'),
    review: subs.filter((x) => x.state === 'UnderReview'),
    closed: subs.filter((x) => x.state === 'Accepted'),
    all: subs,
  }
  const empty: Record<Tab, { title: string; body: string }> = {
    progress: { title: 'Nothing in progress', body: 'Start a statutory return from the calendar, or create a submission.' },
    signoff: { title: 'Nothing in sign-off', body: 'Submitted drafts appear here while the DFA, internal audit and the Accounting Officer sign them off.' },
    review: { title: 'Nothing with reviewers', body: 'Attested submissions wait here for oversight or Treasury.' },
    closed: { title: 'Nothing closed yet', body: 'Accepted submissions and approved releases are kept here.' },
    all: { title: 'No submissions', body: 'Nothing has been filed yet.' },
  }

  const start = (obligationId: string, kind: SubmissionKind, period: string) => {
    const r = store.createSubmission(kind === 'monthly_return' ? { kind, period } : { kind: 'quarterly_performance', quarter: period }, obligationId)
    if (!r.ok) return toast('error', 'Could not start', r.error)
    toast('success', 'Draft created', 'Pre-filled from the ledger.')
    navigate(`/submissions/${r.id}`)
  }
  const retire = (advanceRef: string) => {
    const r = store.createSubmission({ kind: 'advance_retirement', advanceRef })
    if (!r.ok) return toast('error', 'Could not start', r.error)
    navigate(`/submissions/${r.id}`)
  }

  const obligations = s.obligations.filter((o) => o.mdaId === me.mdaId).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const advances = advanceStatus(me.mdaId!, s.submissions)

  return (
    <>
      <PageHeader eyebrow="Submissions" title="Returns & submissions">
        {canCreateAny(me) && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            + New submission
          </Button>
        )}
      </PageHeader>
      {creating && <NewSubmissionDialog me={me} onClose={() => setCreating(false)} />}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel title="Statutory calendar" aside="Scheduled returns" bodyClassName="">
          <ul className="divide-y divide-line">
            {obligations.map((o) => {
              const sub = o.submissionId ? s.submissions.find((x) => x.id === o.submissionId) : null
              const opens = o.opensAt && new Date(o.opensAt) > now ? o.opensAt : null
              const st = sub ? submissionStatus(sub) : null
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{o.title}</div>
                    <div className="font-mono text-[11px] text-muted">{sub ? sub.id : DEFS[o.kind].label}</div>
                  </div>
                  {st && <StatusPill tone={st.tone} label={st.label} />}
                  {opens ? <span className="font-mono text-[11px] text-muted">Opens {shortDate(opens)}</span> : <DueChip due={o.dueAt} open={!sub || sub.state === 'Draft' || sub.state === 'Queried' || sub.state === 'InChain'} closedLabel="Filed" />}
                  {sub ? (
                    <Button size="sm" onClick={() => navigate(`/submissions/${sub.id}`)}>
                      Open
                    </Button>
                  ) : !opens && canPrepare(me, o.kind) ? (
                    <Button size="sm" variant="primary" onClick={() => start(o.id, o.kind, o.period)}>
                      Start
                    </Button>
                  ) : !opens ? (
                    <span className="text-xs text-muted">Not started</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Advances register" aside={`Retire within ${RETIREMENT_WINDOW_DAYS} days`} bodyClassName="">
          <ul className="divide-y divide-line">
            {advances.map(({ advance: a, submission: sub, retired }) => {
              const days = Math.round((now.getTime() - new Date(`${a.disbursedOn}T12:00:00`).getTime()) / 86_400_000)
              const late = !retired && days > RETIREMENT_WINDOW_DAYS
              const st = sub ? submissionStatus(sub) : null
              return (
                <li key={a.ref} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">
                      <span className="font-mono">{a.ref}</span> · {a.holder}
                    </div>
                    <div className={`font-mono text-[11px] ${late ? 'font-semibold text-crit-fg' : 'text-muted'}`}>
                      {naira(a.amount)} · {days} days{late && ' · past window'}
                    </div>
                  </div>
                  {st ? <StatusPill tone={st.tone} label={retired ? 'Retired' : st.label} /> : <StatusPill tone={late ? 'crit' : 'neu'} label="Outstanding" />}
                  {sub ? (
                    <Button size="sm" onClick={() => navigate(`/submissions/${sub.id}`)}>
                      Open
                    </Button>
                  ) : canPrepare(me, 'advance_retirement') ? (
                    <Button size="sm" variant="primary" onClick={() => retire(a.ref)}>
                      Retire
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <Tabs
          label="Submission filter"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'progress', label: 'In progress', count: lists.progress.length },
            { id: 'signoff', label: 'In sign-off', count: lists.signoff.length },
            { id: 'review', label: 'With reviewers', count: lists.review.length },
            { id: 'closed', label: 'Closed', count: lists.closed.length },
            { id: 'all', label: 'All', count: lists.all.length },
          ]}
        />
        <SubmissionTable subs={lists[tab]} basePath="/submissions" empty={empty[tab]} />
      </section>
    </>
  )
}
