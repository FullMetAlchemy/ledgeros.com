import { dateTime } from '../domain/calendar'
import { ROLE_LABEL, rolesForStep, STEP_LABEL } from '../domain/policy'
import type { ChainAct, ChainStep, User } from '../domain/types'

type Status = 'done' | 'current' | 'pending'

/** Where the record is: being prepared, in the MDA chain, with the external reviewer, or finished. */
export type RailPhase = 'drafting' | 'chain' | 'external' | 'done' | 'idle'

const BAR: Record<Status, string> = { done: 'bg-ok-dot', current: 'bg-flow-dot', pending: 'bg-transparent' }

/** An MDA sign-off chain plus the external review step. Used by flags and submissions. */
export function SignOffRail({
  steps,
  acts,
  phase,
  ownerId,
  users,
  externalLabel = 'Oversight review',
  externalWho = 'Chief Auditor',
  attestedAt,
}: {
  steps: ChainStep[]
  acts: ChainAct[]
  phase: RailPhase
  ownerId: string | null
  users: User[]
  externalLabel?: string
  externalWho?: string
  attestedAt?: string | null
}) {
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id

  const cells = steps.map((step, i) => {
    const act = acts[i]
    const isFinal = i === steps.length - 1
    let status: Status = 'pending'
    if (act) status = 'done'
    else if (phase === 'chain' && i === acts.length) status = 'current'
    else if (i === 0 && phase === 'drafting') status = 'current'
    const who = act ? name(act.userId) : i === 0 && ownerId ? name(ownerId) : rolesForStep(step, isFinal).map((r) => ROLE_LABEL[r]).join(' / ')
    return {
      key: step,
      n: `STEP ${i + 1}`,
      label: isFinal && step !== 'attest' ? `${STEP_LABEL[step]} & attest` : STEP_LABEL[step],
      who,
      when: act ? dateTime(act.at) : status === 'current' ? 'In progress' : '',
      status,
    }
  })

  const external: Status = phase === 'done' ? 'done' : phase === 'external' ? 'current' : 'pending'

  return (
    <ol aria-label="Sign-off chain" className="grid overflow-hidden rounded-lg border border-line bg-surface sm:auto-cols-fr sm:grid-flow-col">
      {cells.map((c) => (
        <li key={c.key} className="relative flex flex-col gap-0.5 border-line px-3.5 pt-3.5 pb-3 not-first:border-l max-sm:not-first:border-t max-sm:not-first:border-l-0">
          <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${BAR[c.status]}`} />
          <span className="font-mono text-[10.5px] font-semibold text-muted">
            {c.n}
            <span className="sr-only"> {c.status}</span>
          </span>
          <span className="text-[13px] font-semibold">{c.label}</span>
          <span className="text-xs text-ink-2">{c.who}</span>
          {c.when && <span className="font-mono text-[10.5px] text-muted">{c.when}</span>}
        </li>
      ))}
      <li className="relative flex flex-col gap-0.5 border-line bg-sunk px-3.5 pt-3.5 pb-3 sm:border-l max-sm:border-t">
        <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${BAR[external]}`} />
        <span className="font-mono text-[10.5px] font-semibold text-muted">EXTERNAL</span>
        <span className="text-[13px] font-semibold">{externalLabel}</span>
        <span className="text-xs text-ink-2">{externalWho}</span>
        {attestedAt && <span className="font-mono text-[10.5px] text-muted">Attested {dateTime(attestedAt)}</span>}
      </li>
    </ol>
  )
}
