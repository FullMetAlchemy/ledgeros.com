import { Link, useNavigate } from 'react-router'
import { naira } from '../../domain/money'
import { advanceStatus } from '../../domain/submissions/create'
import { DEFS } from '../../domain/submissions/defs'
import type { Flag, User } from '../../domain/types'
import { store, usePortal } from '../../state/store'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { submissionStatus } from '../submissions/submissionViews'

/** Unretired-advance flags are answered by retiring the advance; link the two. */
export function RetirementLink({ flag, me }: { flag: Flag; me: User }) {
  const s = usePortal()
  const toast = useToast()
  const navigate = useNavigate()
  const advances = advanceStatus(flag.mdaId, s.submissions).filter((a) => flag.relatedRefs.includes(a.advance.ref))
  if (!advances.length) return null
  const base = me.mdaId ? '/submissions' : '/oversight/submissions'
  const canStart = me.mdaId === flag.mdaId && DEFS.advance_retirement.preparers.includes(me.role)

  return (
    <Panel title="Advance retirement">
      <ul className="flex flex-col gap-3">
        {advances.map(({ advance: a, submission: sub }) => {
          const st = sub ? submissionStatus(sub) : null
          return (
            <li key={a.ref} className="flex flex-col gap-2 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-mono font-semibold">{a.ref}</span> · {naira(a.amount)}
                </span>
                {st && <StatusPill tone={st.tone} label={st.label} />}
              </div>
              {sub ? (
                <Link to={`${base}/${sub.id}`} className="text-accent hover:underline">
                  Open retirement {sub.id} →
                </Link>
              ) : canStart ? (
                <div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const r = store.createSubmission({ kind: 'advance_retirement', advanceRef: a.ref, linkedFlagId: flag.id })
                      if (!r.ok) return toast('error', 'Could not start', r.error)
                      navigate(`/submissions/${r.id}`)
                    }}
                  >
                    Start retirement of {a.ref}
                  </Button>
                </div>
              ) : (
                <span className="text-muted">No retirement filed yet.</span>
              )}
              <p className="text-xs text-muted">An accepted retirement is the strongest evidence for a “Correct” response. Quote its ID as the corrective record.</p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
