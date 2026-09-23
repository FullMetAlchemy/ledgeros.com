import { Link, useParams } from 'react-router'
import { isOpen } from '../../domain/flagMachine'
import { naira, pct } from '../../domain/money'
import { deriveRating } from '../../domain/rating'
import { DEFS, evidenceSlots } from '../../domain/submissions/defs'
import { VENDORS } from '../../domain/submissions/reference'
import type { Submission, SubmissionContent } from '../../domain/submissions/types'
import { validateSubmission } from '../../domain/submissions/validation'
import type { User } from '../../domain/types'
import { store, useMe, usePortal, visibleSubmissions } from '../../state/store'
import { EmptyState, Panel } from '../../ui/Panel'
import { DueChip, RatingPill, StatusPill } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { CaseThread } from '../../workflow/CaseThread'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { SignOffRail } from '../../workflow/SignOffRail'
import { StatusHistory } from '../../workflow/StatusHistory'
import { KIND_MODULES } from './kinds'
import { SubmissionActions } from './SubmissionActions'
import { SubmissionComposer } from './SubmissionComposer'
import { submissionDue, submissionRail, submissionStatus, submissionTimeline } from './submissionViews'

/** Read-only rendering for reviewers: answers, justifications and evidence. */
function SubmissionView({ sub, content, users }: { sub: Submission; content: SubmissionContent; users: User[] }) {
  const K = KIND_MODULES[sub.kind]
  const justifications = validateSubmission(content, { now: new Date(), vendors: VENDORS }).filter((i) => i.tier === 'justification')
  const slots = evidenceSlots(content.data).filter((s) => sub.kind !== 'monthly_return' || s.id === 'tsa_statement')
  const who = (id: string) => users.find((u) => u.id === id)?.name ?? id
  return (
    <div className="flex flex-col gap-5">
      <K.View sub={sub} data={content.data} content={content} />
      {justifications.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="eyebrow">Justifications</div>
          {justifications.map((j) => (
            <div key={j.id} className="rounded-md border border-warn-bd bg-warn-bg px-3.5 py-2.5">
              <div className="text-xs font-semibold text-warn-fg">{j.message}</div>
              <p className="mt-1 text-[13px] whitespace-pre-wrap text-ink-2">{content.justifications[j.id] || 'Not provided.'}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="eyebrow">
          Evidence · {content.evidence.length} file{content.evidence.length === 1 ? '' : 's'}
        </div>
        {slots.map((slot) => (
          <EvidenceSlot key={slot.id} slot={slot} files={content.evidence.filter((e) => e.slotId === slot.id)} required={slot.required} editable={false} userId="" />
        ))}
        {sub.kind === 'monthly_return' && <p className="text-xs text-muted">Voucher evidence is listed against each line above.</p>}
      </div>
      {sub.submitted && sub.updatedBy && <p className="font-mono text-[11px] text-muted">Prepared by {who(sub.chain[0]?.userId ?? sub.ownerId)}</p>}
    </div>
  )
}

/** What Treasury weighs alongside a release request: the MDA's live compliance position. */
function ComplianceContext({ sub }: { sub: Submission }) {
  const s = usePortal()
  const mda = s.mdas.find((m) => m.id === sub.mdaId)!
  const flags = s.flags.filter((f) => f.mdaId === sub.mdaId)
  const open = flags.filter(isOpen)
  return (
    <Panel title="Compliance position" aside="Live, not as at request">
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Rating</span>
          <RatingPill rating={deriveRating(flags)} />
        </div>
        {[
          ['Open flags', `${open.length} (${open.filter((f) => f.severity === 'Critical' || f.severity === 'High').length} Critical/High)`],
          ['Released', `${naira(mda.released)} of ${naira(mda.appropriated)}`],
          ['Absorption', pct(mda.utilized, mda.released)],
          ['Unretired advances', naira(mda.unretired)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-muted">{k}</span>
            <span className="text-right font-mono font-medium tabular">{v}</span>
          </div>
        ))}
        {open.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-line pt-2 text-xs">
            {open.map((f) => (
              <li key={f.id}>
                <Link to={`/oversight/flags/${f.id}`} className="font-mono text-accent hover:underline">
                  {f.id}
                </Link>{' '}
                <span className="text-muted">
                  {f.severity} · {f.state}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

export function SubmissionPage({ basePath }: { basePath: string }) {
  const { submissionId } = useParams()
  const s = usePortal()
  const me = useMe()
  const toast = useToast()
  const sub = visibleSubmissions(s, me).find((x) => x.id === submissionId)

  if (!sub || !me) {
    return (
      <EmptyState
        title="Submission not found"
        body="It may belong to another MDA, or the link is out of date."
        action={
          <Link to={basePath} className="inline-flex h-9 items-center rounded-md border border-line-2 bg-surface px-4 text-[13px] font-semibold hover:bg-sunk">
            Back to submissions
          </Link>
        }
      />
    )
  }

  const def = DEFS[sub.kind]
  const mda = s.mdas.find((m) => m.id === sub.mdaId)!
  const K = KIND_MODULES[sub.kind]
  const composing = sub.state === 'Draft' && sub.ownerId === me.id
  const content: SubmissionContent = sub.state === 'Draft' || !sub.submitted ? { data: sub.data, evidence: sub.evidence, justifications: sub.justifications } : sub.submitted
  const st = submissionStatus(sub)
  const oversightSide = !me.mdaId

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <Link to={basePath} className="inline-flex h-[34px] flex-none items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk">
          ← Back
        </Link>
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {mda.acronym} · {mda.code} · {sub.id}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{sub.title}</h1>
            <StatusPill tone={st.tone} label={st.label} />
            <DueChip {...submissionDue(sub)} />
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {def.label}
            {oversightSide && ` · ${mda.name}`}
            {sub.cycle > 1 && ` · cycle ${sub.cycle}`}
          </p>
        </div>
      </div>

      <SubmissionActions key={`${sub.id}-${sub.state}`} sub={sub} me={me} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Sign-off chain</h2>
            <SignOffRail {...submissionRail(sub)} users={s.users} />
          </section>

          {composing ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Your submission</h2>
              <SubmissionComposer key={`${sub.id}-${sub.cycle}-${sub.returned}`} sub={sub} me={me} />
            </section>
          ) : (
            <>
              <Panel title="Pre-filled from the ledger">
                <K.Scope sub={sub} data={content.data} content={content} />
              </Panel>
              <Panel title={sub.state === 'Draft' ? 'Draft (in progress)' : 'Submitted'}>
                <SubmissionView sub={sub} content={content} users={s.users} />
              </Panel>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {sub.kind === 'release_request' && oversightSide && <ComplianceContext sub={sub} />}
          <Panel title="What’s required">
            <ul className="flex flex-col gap-2">
              {def.requires.map((r) => (
                <li key={r} className="flex gap-2.5 text-[13px] text-ink-2">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-line-2" />
                  {r}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Thread" aside={`${sub.comments.length} message${sub.comments.length === 1 ? '' : 's'}`}>
            <CaseThread
              flag={sub}
              users={s.users}
              canPost={me.role === def.reviewer || me.mdaId === sub.mdaId}
              onPost={(body) => {
                const r = store.addSubmissionComment(sub.id, body)
                if (!r.ok) toast('error', 'Message not posted', r.error)
                return r.ok
              }}
            />
          </Panel>
          <Panel title="History">
            <StatusHistory {...submissionTimeline(sub)} users={s.users} />
          </Panel>
        </div>
      </div>
    </>
  )
}
