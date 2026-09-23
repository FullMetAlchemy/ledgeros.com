import { useNavigate } from 'react-router'
import { flagLabel } from '../../domain/templates'
import type { Flag } from '../../domain/types'
import { userName, usePortal } from '../../state/store'
import { EmptyState } from '../../ui/Panel'
import { DeadlineChip, FlagStatePill, SeverityTag } from '../../ui/Pill'

export function FlagTable({
  flags,
  basePath,
  showMda = false,
  empty,
}: {
  flags: Flag[]
  basePath: string
  showMda?: boolean
  empty: { title: string; body?: string }
}) {
  const s = usePortal()
  const navigate = useNavigate()
  const now = new Date()

  if (!flags.length) return <EmptyState {...empty} />

  const open = (f: Flag) => navigate(`${basePath}/${f.id}`)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-sunk text-left">
            {['Flag', ...(showMda ? ['MDA'] : []), 'Severity', 'Status', 'Owner', 'Deadline'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => {
            const mda = s.mdas.find((m) => m.id === f.mdaId)
            return (
              <tr
                key={f.id}
                tabIndex={0}
                onClick={() => open(f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open(f)
                  }
                }}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-sunk focus:bg-accent-soft focus:outline-none"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{flagLabel(f.type)}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {f.id}
                    {f.relatedRefs.length > 0 && ` · ${f.relatedRefs.join(', ')}`}
                  </div>
                </td>
                {showMda && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium">{mda?.acronym}</span>
                    <span className="ml-1.5 font-mono text-[11px] text-muted">{mda?.code}</span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <SeverityTag severity={f.severity} />
                </td>
                <td className="px-4 py-3">
                  <FlagStatePill flag={f} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">{userName(s, f.ownerId)}</td>
                <td className="px-4 py-3">
                  <DeadlineChip flag={f} now={now} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
