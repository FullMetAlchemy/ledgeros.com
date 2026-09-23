import { useState } from 'react'
import { isOpen } from '../../domain/flagMachine'
import { SEVERITY_RANK } from '../../domain/policy'
import type { Flag } from '../../domain/types'
import { useMe, usePortal, visibleFlags } from '../../state/store'
import { PageHeader } from '../../ui/Panel'
import { Tabs } from '../../ui/Tabs'
import { FlagTable } from './FlagTable'

type Tab = 'open' | 'oversight' | 'resolved' | 'all'

const bySeverity = (a: Flag, b: Flag) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.raisedAt.localeCompare(a.raisedAt)

export function FlagsList({ oversight = false }: { oversight?: boolean }) {
  const s = usePortal()
  const me = useMe()
  const [tab, setTab] = useState<Tab>('open')
  const flags = visibleFlags(s, me).sort(bySeverity)

  const lists: Record<Tab, Flag[]> = {
    open: flags.filter((f) => isOpen(f) && f.state !== 'OversightReview'),
    oversight: flags.filter((f) => f.state === 'OversightReview'),
    resolved: flags.filter((f) => f.state === 'Resolved'),
    all: flags,
  }
  const empty: Record<Tab, { title: string; body: string }> = {
    open: { title: 'No open flags', body: 'Nothing is waiting on this MDA. New flags appear here as soon as the Anomaly Engine raises them.' },
    oversight: { title: 'Nothing with oversight', body: 'Attested responses appear here while the Chief Auditor reviews them.' },
    resolved: { title: 'No resolved flags yet', body: 'Flags move here once oversight accepts the response.' },
    all: { title: 'No flags', body: 'No flags have been raised.' },
  }

  return (
    <>
      <PageHeader eyebrow={oversight ? 'Oversight · All MDAs' : 'Flags'} title={oversight ? 'All flags' : 'Exception & flag resolution'} />
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <Tabs
          label="Flag filter"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'open', label: oversight ? 'With MDAs' : 'Open', count: lists.open.length },
            { id: 'oversight', label: oversight ? 'Awaiting review' : 'With oversight', count: lists.oversight.length },
            { id: 'resolved', label: 'Resolved', count: lists.resolved.length },
            { id: 'all', label: 'All', count: lists.all.length },
          ]}
        />
        <FlagTable flags={lists[tab]} basePath={oversight ? '/oversight/flags' : '/flags'} showMda={oversight} empty={empty[tab]} />
      </section>
    </>
  )
}
