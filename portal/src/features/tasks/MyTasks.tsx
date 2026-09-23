import { useState } from 'react'
import { submissionTasksFor } from '../../domain/submissions/tasks'
import { tasksFor } from '../../domain/tasks'
import { useMe, usePortal, visibleFlags, visibleSubmissions } from '../../state/store'
import { PageHeader } from '../../ui/Panel'
import { Tabs } from '../../ui/Tabs'
import { TaskList } from './TaskList'
import { byDue, flagWork, submissionWork, type WorkGroup } from './workItems'

type Filter = 'all' | Exclude<WorkGroup, 'oversight'>

export function MyTasks() {
  const s = usePortal()
  const me = useMe()!
  const [filter, setFilter] = useState<Filter>('all')
  const items = [
    ...tasksFor(visibleFlags(s, me), me).map((t) => flagWork(t, '/flags', s)),
    ...submissionTasksFor(visibleSubmissions(s, me), me).map((t) => submissionWork(t, '/submissions', s)),
  ].sort(byDue)
  const shown = filter === 'all' ? items : items.filter((w) => w.group === filter)
  const count = (g: WorkGroup) => items.filter((w) => w.group === g).length

  return (
    <>
      <PageHeader eyebrow="My tasks" title="What needs you">
        <span className="text-xs text-muted">Flags and submissions, soonest deadline first</span>
      </PageHeader>
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <Tabs
          label="Task filter"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'all', label: 'All', count: items.length },
            { id: 'setup', label: 'Acknowledge & assign', count: count('setup') },
            { id: 'draft', label: 'To prepare', count: count('draft') },
            { id: 'returned', label: 'Returned or queried', count: count('returned') },
            { id: 'signoff', label: 'Awaiting my sign-off', count: count('signoff') },
          ]}
        />
        <TaskList items={shown} emptyBody="When a flag or submission needs your action, whether preparing, revising or signing off, it appears here with its deadline." />
      </section>
    </>
  )
}
