import { useNavigate } from 'react-router'
import { naira } from '../../domain/money'
import { DEFS, parseAmount } from '../../domain/submissions/defs'
import type { Submission } from '../../domain/submissions/types'
import { userName, usePortal } from '../../state/store'
import { EmptyState } from '../../ui/Panel'
import { DueChip, StatusPill } from '../../ui/Pill'
import { submissionDue, submissionStatus } from './submissionViews'

export function SubmissionTable({
  subs,
  basePath,
  showMda = false,
  empty,
}: {
  subs: Submission[]
  basePath: string
  showMda?: boolean
  empty: { title: string; body?: string }
}) {
  const s = usePortal()
  const navigate = useNavigate()
  if (!subs.length) return <EmptyState {...empty} />
  const open = (x: Submission) => navigate(`${basePath}/${x.id}`)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-sunk text-left">
            {['Submission', ...(showMda ? ['MDA'] : []), 'Type', 'Status', 'Prepared by', 'Deadline'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map((x) => {
            const st = submissionStatus(x)
            const mda = s.mdas.find((m) => m.id === x.mdaId)
            const amount = x.data.kind === 'release_request' ? parseAmount(x.data.amount) : 0
            return (
              <tr
                key={x.id}
                tabIndex={0}
                onClick={() => open(x)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open(x)
                  }
                }}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-sunk focus:bg-accent-soft focus:outline-none"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {x.data.kind === 'vendor_exception' && x.data.vendorName ? `Vendor exception: ${x.data.vendorName}` : x.title}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {x.id}
                    {amount > 0 && ` · ${naira(amount)}`}
                  </div>
                </td>
                {showMda && <td className="px-4 py-3 font-medium whitespace-nowrap">{mda?.acronym}</td>}
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">{DEFS[x.kind].short}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={st.tone} label={st.label} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">{userName(s, x.ownerId)}</td>
                <td className="px-4 py-3">
                  <DueChip {...submissionDue(x)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
