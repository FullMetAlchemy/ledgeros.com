import type { ReactNode } from 'react'
import { activeDeadline, SEVERITY_RANK } from '../../domain/policy'
import { DEFS } from '../../domain/submissions/defs'
import type { SubmissionTask } from '../../domain/submissions/tasks'
import type { Task } from '../../domain/tasks'
import { flagLabel } from '../../domain/templates'
import type { Severity } from '../../domain/types'
import type { PortalState } from '../../state/store'
import { userName } from '../../state/store'
import { DeadlineChip, DueChip, FlagStatePill, StatusPill } from '../../ui/Pill'
import { submissionDue, submissionStatus } from '../submissions/submissionViews'

export type WorkGroup = 'setup' | 'draft' | 'returned' | 'signoff' | 'oversight'

/** One row in any "needs you" list, whatever it came from. */
export interface WorkItem {
  key: string
  href: string
  action: string
  title: string
  meta: string
  severity?: Severity
  kindLabel?: string
  status: ReactNode
  deadline: ReactNode
  group: WorkGroup
  sortAt: number
}

const FLAG_GROUP: Record<Task['kind'], WorkGroup> = {
  acknowledge: 'setup',
  assign: 'setup',
  draft: 'draft',
  restart: 'draft',
  revise: 'returned',
  signoff: 'signoff',
  oversight: 'oversight',
}

export function flagWork(t: Task, basePath: string, s: PortalState, showMda = false): WorkItem {
  const f = t.flag
  const due = activeDeadline(f, new Date())
  const mda = s.mdas.find((m) => m.id === f.mdaId)
  return {
    key: f.id,
    href: `${basePath}/${f.id}`,
    action: t.action,
    title: flagLabel(f.type),
    meta: [f.id, showMda ? mda?.acronym : null, f.ownerId ? `owner ${userName(s, f.ownerId)}` : null].filter(Boolean).join(' · '),
    severity: f.severity,
    status: <FlagStatePill flag={f} />,
    deadline: <DeadlineChip flag={f} />,
    group: FLAG_GROUP[t.kind],
    sortAt: (due ? new Date(due.due).getTime() : Number.POSITIVE_INFINITY) + SEVERITY_RANK[f.severity],
  }
}

export function submissionWork(t: SubmissionTask, basePath: string, s: PortalState, showMda = false): WorkItem {
  const sub = t.submission
  const st = submissionStatus(sub)
  const mda = s.mdas.find((m) => m.id === sub.mdaId)
  return {
    key: sub.id,
    href: `${basePath}/${sub.id}`,
    action: t.action,
    title: sub.title,
    meta: [sub.id, showMda ? mda?.acronym : null, `prepared by ${userName(s, sub.ownerId)}`].filter(Boolean).join(' · '),
    kindLabel: DEFS[sub.kind].short,
    status: <StatusPill tone={st.tone} label={st.label} />,
    deadline: <DueChip {...submissionDue(sub)} />,
    group: t.group,
    sortAt: new Date(sub.dueAt).getTime(),
  }
}

export const byDue = (a: WorkItem, b: WorkItem) => a.sortAt - b.sortAt
