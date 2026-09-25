// "Needs you": the actions each user can take next, across flags, returns,
// reconciliations and administration. Drives notifications and home screens.

import type { Dataset } from './dataset'
import { flagNeedsUser, isOverdue } from './flags'
import { can, inScope } from './roles'
import { RULE_LABEL, SEVERITY_ORDER } from './rules'
import type { User } from './types'

export interface WorkItem {
  key: string
  kind: 'flag' | 'return' | 'rec' | 'user' | 'period'
  href: string
  title: string
  action: string
  mdaId: string | null
  due: string | null
  /** Lower sorts first. */
  priority: number
}

export function workFor(ds: Dataset, u: User, now: Date): WorkItem[] {
  const items: WorkItem[] = []
  const mdaName = (id: string) => ds.mdas.find((m) => m.id === id)?.acronym ?? id

  for (const f of ds.flags) {
    if (!flagNeedsUser(f, u, now)) continue
    const overdue = isOverdue(f, now)
    const action =
      f.status === 'Detected'
        ? 'Open and assign a reviewer'
        : f.status === 'Open'
          ? 'Assign an officer'
          : f.status === 'Assigned'
            ? 'Prepare the response'
            : f.status === 'MDA Response'
              ? 'Approve the response'
              : f.status === 'Under Review'
                ? 'Review the response'
                : f.status === 'Escalated'
                  ? 'Decide the escalated flag'
                  : f.status === 'Resolved' || f.status === 'Rejected'
                    ? 'Close the flag'
                    : overdue
                      ? 'Escalate: response overdue'
                      : 'Act'
    items.push({
      key: f.id,
      kind: 'flag',
      href: `/flags/${f.id}`,
      title: `${f.severity} ${RULE_LABEL[f.ruleId]} · ${mdaName(f.mdaId)}`,
      action,
      mdaId: f.mdaId,
      due: f.dueAt,
      priority: SEVERITY_ORDER.indexOf(f.severity) + (overdue ? -1 : 0),
    })
  }

  // Overdue flags another role is waiting on: oversight/executive can escalate.
  if (can(u, 'flag.escalate')) {
    for (const f of ds.flags) {
      if (!isOverdue(f, now) || !inScope(u, f.mdaId) || items.some((i) => i.key === f.id)) continue
      items.push({ key: `${f.id}:esc`, kind: 'flag', href: `/flags/${f.id}`, title: `${f.severity} ${RULE_LABEL[f.ruleId]} · ${mdaName(f.mdaId)}`, action: 'MDA response overdue: consider escalation', mdaId: f.mdaId, due: f.dueAt, priority: 0 })
    }
  }

  for (const r of ds.returns) {
    if (!inScope(u, r.mdaId)) continue
    const period = ds.periods.find((p) => p.id === r.periodId)?.label ?? r.periodId
    const base = { key: r.id, kind: 'return' as const, href: `/returns/${r.id}`, title: `${period} return · ${mdaName(r.mdaId)}`, mdaId: r.mdaId, due: null }
    if ((r.status === 'Draft' || r.status === 'Returned') && can(u, 'return.prepare') && u.mdaId === r.mdaId)
      items.push({ ...base, action: r.status === 'Returned' ? 'Revise and resubmit' : 'Complete and submit', priority: r.status === 'Returned' ? 1 : 3 })
    else if (r.status === 'Submitted' && can(u, 'return.approve') && u.mdaId === r.mdaId && r.submittedBy !== u.id) items.push({ ...base, action: 'Approve or return', priority: 2 })
    else if (r.status === 'Under Review' && can(u, 'return.review')) items.push({ ...base, action: 'Accept or return', priority: 3 })
    else if (r.status === 'Accepted' && can(u, 'return.review')) items.push({ ...base, action: 'Close', priority: 5 })
  }

  // Open periods without a return yet.
  if (can(u, 'return.prepare') && u.mdaId) {
    for (const p of ds.periods.filter((x) => x.status === 'Open')) {
      if (ds.returns.some((r) => r.mdaId === u.mdaId && r.periodId === p.id)) continue
      items.push({ key: `new:${p.id}`, kind: 'period', href: `/returns/new?period=${p.id}`, title: `${p.label} return · ${mdaName(u.mdaId)}`, action: 'Start the monthly return', mdaId: u.mdaId, due: null, priority: 4 })
    }
  }

  if (can(u, 'rec.manage')) {
    for (const r of ds.reconciliations) {
      if (r.status === 'Closed') continue
      const action = r.status === 'Open' ? 'Run matching' : r.status === 'Variance' ? 'Explain the variance and review' : r.status === 'Matched' ? 'Review' : r.status === 'Reviewed' ? 'Close' : 'Continue'
      items.push({ key: r.id, kind: 'rec', href: `/reconciliation/${r.id}`, title: `${r.type} reconciliation · ${mdaName(r.mdaId)} ${r.periodId}`, action, mdaId: r.mdaId, due: null, priority: 4 })
    }
  }

  if (can(u, 'admin.users')) {
    for (const x of ds.users.filter((y) => y.status === 'Pending'))
      items.push({ key: x.id, kind: 'user', href: '/admin/users', title: `${x.name} (${x.email})`, action: 'Activate or disable the pending account', mdaId: x.mdaId, due: null, priority: 4 })
  }

  return items.sort((a, b) => a.priority - b.priority || (a.due ?? '9').localeCompare(b.due ?? '9'))
}
