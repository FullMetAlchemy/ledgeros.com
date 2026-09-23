import { Link } from 'react-router'
import { EmptyState } from '../../ui/Panel'
import { SeverityTag } from '../../ui/Pill'
import type { WorkItem } from './workItems'

export function TaskList({ items, emptyBody }: { items: WorkItem[]; emptyBody: string }) {
  if (!items.length) return <EmptyState title="Nothing needs you right now" body={emptyBody} />
  return (
    <ul className="divide-y divide-line">
      {items.map((w) => (
        <li key={w.key}>
          <Link
            to={w.href}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-sunk sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-medium">
                {w.action}: {w.title}
              </span>
              <span className="truncate font-mono text-[11px] text-muted">{w.meta}</span>
            </span>
            <span className="max-sm:hidden">
              {w.severity ? (
                <SeverityTag severity={w.severity} />
              ) : (
                <span className="rounded border border-line-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase">
                  {w.kindLabel ?? 'Submission'}
                </span>
              )}
            </span>
            <span className="max-sm:order-last max-sm:col-span-2">{w.status}</span>
            {w.deadline}
          </Link>
        </li>
      ))}
    </ul>
  )
}
