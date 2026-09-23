import { useState } from 'react'
import { submissionTasksFor } from '../../domain/submissions/tasks'
import type { Submission } from '../../domain/submissions/types'
import { useMe, usePortal, visibleSubmissions } from '../../state/store'
import { PageHeader, Panel } from '../../ui/Panel'
import { Tabs } from '../../ui/Tabs'
import { SubmissionTable } from '../submissions/SubmissionTable'
import { TaskList } from '../tasks/TaskList'
import { submissionWork } from '../tasks/workItems'

type Tab = 'mda' | 'closed' | 'all'

/** Chief Auditor: attested returns, retirements, certificates and reports awaiting a decision. */
export function OversightSubmissions() {
  const s = usePortal()
  const me = useMe()!
  const [tab, setTab] = useState<Tab>('mda')
  const subs = visibleSubmissions(s, me)
    .filter((x) => x.kind !== 'release_request')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const tasks = submissionTasksFor(subs, me)
    .sort((a, b) => (a.submission.attestation?.at ?? '').localeCompare(b.submission.attestation?.at ?? ''))
    .map((t) => submissionWork(t, '/oversight/submissions', s, true))
  const lists: Record<Tab, Submission[]> = {
    mda: subs.filter((x) => x.state !== 'Accepted' && x.state !== 'UnderReview'),
    closed: subs.filter((x) => x.state === 'Accepted'),
    all: subs,
  }
  const overdue = subs.filter((x) => (x.state === 'Draft' || x.state === 'InChain' || x.state === 'Queried') && new Date() > new Date(x.dueAt)).length

  return (
    <>
      <PageHeader eyebrow="Oversight · Submissions" title="Returns & submissions">
        <span className="text-xs text-muted">{overdue ? `${overdue} overdue with MDAs` : 'None overdue with MDAs'}</span>
      </PageHeader>
      <Panel title="Awaiting your decision" aside={`${tasks.length} attested submission${tasks.length === 1 ? '' : 's'}`} bodyClassName="">
        <TaskList items={tasks} emptyBody="Attested monthly returns, retirements, certificates and quarterly reports arrive here." />
      </Panel>
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <Tabs
          label="Submission filter"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'mda', label: 'With MDAs', count: lists.mda.length },
            { id: 'closed', label: 'Accepted', count: lists.closed.length },
            { id: 'all', label: 'All', count: lists.all.length },
          ]}
        />
        <SubmissionTable subs={lists[tab]} basePath="/oversight/submissions" showMda empty={{ title: 'Nothing here', body: 'Submissions from MDAs appear here as they are filed.' }} />
      </section>
    </>
  )
}
