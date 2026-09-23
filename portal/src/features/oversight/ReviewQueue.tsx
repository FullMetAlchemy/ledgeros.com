import { isOpen } from '../../domain/flagMachine'
import { activeDeadline } from '../../domain/policy'
import { deriveRating } from '../../domain/rating'
import { tasksFor } from '../../domain/tasks'
import { useMe, usePortal } from '../../state/store'
import { PageHeader, Panel } from '../../ui/Panel'
import { RatingPill } from '../../ui/Pill'
import { FlagTable } from '../flags/FlagTable'
import { TaskList } from '../tasks/TaskList'
import { flagWork } from '../tasks/workItems'

/** Oversight-side counterpart to the MDA portal: responses awaiting a decision. */
export function ReviewQueue() {
  const s = usePortal()
  const me = useMe()!
  const now = new Date()
  const tasks = tasksFor(s.flags, me)
  const escalated = s.flags.filter((f) => f.state === 'Escalated')
  const overdueAck = s.flags.filter((f) => f.state === 'Raised' && activeDeadline(f, now)?.status === 'over').length
  const withMdas = s.flags.filter((f) => isOpen(f) && f.state !== 'OversightReview').length

  return (
    <>
      <PageHeader eyebrow="Oversight · Flag review" title="Review queue">
        <span className="text-xs text-muted">Oldest attestation first</span>
      </PageHeader>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {[
          ['Awaiting your decision', tasks.length, ''],
          ['Escalated', escalated.length, escalated.length ? 'text-crit-fg' : ''],
          ['Acknowledgements overdue', overdueAck, overdueAck ? 'text-crit-fg' : ''],
          ['Open with MDAs', withMdas, ''],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-lg border border-line bg-surface px-4 py-3.5">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className={`mt-1 font-mono text-[22px] font-semibold tabular ${cls}`}>{n}</div>
          </div>
        ))}
      </section>

      <Panel title="Awaiting your decision" aside={`${tasks.length} attested response${tasks.length === 1 ? '' : 's'}`} bodyClassName="">
        <TaskList
          items={[...tasks]
            .sort((a, b) => (a.flag.attestation?.at ?? '').localeCompare(b.flag.attestation?.at ?? ''))
            .map((t) => flagWork(t, '/oversight/flags', s, true))}
          emptyBody="Attested MDA responses arrive here for acceptance, a request for information, or escalation."
        />
      </Panel>

      <Panel title="Escalated" aside="Needs follow-up with the Accounting Officer" bodyClassName="">
        <FlagTable flags={escalated} basePath="/oversight/flags" showMda empty={{ title: 'No escalations', body: 'Flags escalate automatically when a deadline is missed, or when you reject a response.' }} />
      </Panel>

      <Panel title="MDA ratings" aside="Derived from open flags, identical in the MDA portal">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
          {s.mdas.map((m) => {
            const fl = s.flags.filter((f) => f.mdaId === m.id)
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{m.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {m.acronym} · {fl.filter(isOpen).length} open
                  </span>
                </span>
                <RatingPill rating={deriveRating(fl)} />
              </li>
            )
          })}
        </ul>
      </Panel>
    </>
  )
}
