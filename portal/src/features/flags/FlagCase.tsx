import { Link, useParams } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { naira } from '../../domain/money'
import { TEMPLATES } from '../../domain/templates'
import { store, useMe, usePortal } from '../../state/store'
import { EmptyState, Panel } from '../../ui/Panel'
import { DeadlineChip, FlagStatePill, SeverityTag } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { CaseThread } from '../../workflow/CaseThread'
import { SignOffRail } from '../../workflow/SignOffRail'
import { StatusHistory } from '../../workflow/StatusHistory'
import { CaseActions } from './CaseActions'
import { flagRail, flagTimeline } from './flagViews'
import { RetirementLink } from './RetirementLink'
import { ResponseComposer } from './ResponseComposer'
import { ResponseView } from './ResponseView'

export function FlagCase({ basePath }: { basePath: string }) {
  const { flagId } = useParams()
  const s = usePortal()
  const me = useMe()
  const toast = useToast()
  const flag = s.flags.find((f) => f.id === flagId)

  const visible = flag && me && (me.role === 'auditor' || me.mdaId === flag.mdaId)
  if (!flag || !me || !visible) {
    return (
      <EmptyState
        title="Case not found"
        body="It may belong to another MDA, or the link is out of date."
        action={
          <Link to={basePath} className="inline-flex h-9 items-center rounded-md border border-line-2 bg-surface px-4 text-[13px] font-semibold hover:bg-sunk">
            Back to flags
          </Link>
        }
      />
    )
  }

  const mda = s.mdas.find((m) => m.id === flag.mdaId)!
  const t = TEMPLATES[flag.type]
  const composing = flag.state === 'Drafting' && flag.ownerId === me.id
  const response = flag.state === 'Drafting' ? flag.draft : (flag.submitted ?? flag.draft)
  const showResponse = !composing && !!response.type
  const related = mda.transactions.filter((tx) => flag.relatedRefs.includes(tx.ref))
  const canPost = me.role === 'auditor' || me.mdaId === flag.mdaId

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <Link
          to={basePath}
          className="inline-flex h-[34px] flex-none items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk"
        >
          ← Flags
        </Link>
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {mda.acronym} · {mda.code} · {flag.id}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{t.label}</h1>
            <SeverityTag severity={flag.severity} />
            <FlagStatePill flag={flag} />
            <DeadlineChip flag={flag} />
          </div>
          <p className="mt-1.5 max-w-[80ch] text-[13.5px] text-ink-2">{flag.description}</p>
        </div>
      </div>

      <CaseActions key={`${flag.id}-${flag.state}`} flag={flag} me={me} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="What fired" aside={`Raised ${dateTime(flag.raisedAt)}`}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-crit-bd bg-crit-bg px-3.5 py-2.5">
                <dt className="text-xs text-crit-fg">Observed</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-semibold">{flag.observed}</dd>
              </div>
              <div className="rounded-md border border-line px-3.5 py-2.5">
                <dt className="text-xs text-muted">Rule threshold</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-semibold">{flag.threshold}</dd>
              </div>
            </dl>
            {related.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="bg-sunk text-left">
                      {['Record', 'Date', 'Payee', 'Amount'].map((h) => (
                        <th key={h} className={`px-3.5 py-2 text-[11px] font-semibold tracking-wider text-muted uppercase ${h === 'Amount' ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {related.map((tx) => (
                      <tr key={tx.ref} className="border-t border-line">
                        <td className="px-3.5 py-2 font-mono font-medium">{tx.ref}</td>
                        <td className="px-3.5 py-2 whitespace-nowrap text-ink-2">{tx.date}</td>
                        <td className="px-3.5 py-2">{tx.payee}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-semibold tabular">{naira(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-line px-3.5 py-1.5 font-mono text-[11px] text-muted">Source: GIFMIS · read-only</div>
              </div>
            )}
          </Panel>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Sign-off chain</h2>
            <SignOffRail {...flagRail(flag)} users={s.users} />
          </section>

          {composing && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">
                Your response {flag.cycle > 1 && <span className="font-mono text-[11px] font-normal text-muted">· cycle {flag.cycle}</span>}
              </h2>
              <ResponseComposer key={`${flag.id}-${flag.cycle}-${flag.returned}`} flag={flag} me={me} />
            </section>
          )}
          {showResponse && (
            <Panel
              title={flag.state === 'Drafting' ? 'Draft response (in progress)' : 'Submitted response'}
              aside={flag.state !== 'Drafting' && flag.submitted?.updatedAt ? `Submitted ${dateTime(flag.submitted.updatedAt)}` : undefined}
            >
              <ResponseView flag={flag} draft={response} users={s.users} />
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {flag.type === 'unretired_advance' && <RetirementLink flag={flag} me={me} />}
          <Panel title="What would resolve it">
            <ul className="flex flex-col gap-2">
              {t.resolves.map((r) => (
                <li key={r} className="flex gap-2.5 text-[13px] text-ink-2">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-line-2" />
                  {r}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Case thread" aside={`${flag.comments.length} message${flag.comments.length === 1 ? '' : 's'}`}>
            <CaseThread
              flag={flag}
              users={s.users}
              canPost={canPost}
              onPost={(body) => {
                const r = store.addComment(flag.id, body)
                if (!r.ok) toast('error', 'Message not posted', r.error)
                return r.ok
              }}
            />
          </Panel>
          <Panel title="History">
            <StatusHistory {...flagTimeline(flag)} users={s.users} />
          </Panel>
        </div>
      </div>
    </>
  )
}
