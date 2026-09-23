import { dateTime } from '../domain/calendar'
import type { User } from '../domain/types'

export interface TimelineEntry {
  id: string
  at: string
  actorId: string
  label: string
  note?: string
  tone?: 'bad' | 'good'
}

/** Append-only history of every state change, newest first, ending at the origin event. */
export function StatusHistory({ entries, origin, users }: { entries: TimelineEntry[]; origin: { label: string; at: string; actorId?: string }; users: User[] }) {
  const name = (id: string) => (id === 'system' ? 'System' : (users.find((u) => u.id === id)?.name ?? id))
  return (
    <ol className="flex flex-col">
      {[...entries].reverse().map((h) => (
        <li key={h.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3 pb-3.5">
          <span aria-hidden className="flex justify-center">
            <span className={`mt-1.5 h-2 w-2 rounded-full ${h.tone === 'bad' ? 'bg-crit-dot' : h.tone === 'good' ? 'bg-ok-dot' : 'bg-line-2'}`} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px]">
              <span className="font-semibold">{h.label}</span>
              {h.note && <span className="text-ink-2">: {h.note}</span>}
            </div>
            <div className="font-mono text-[11px] text-muted">
              {name(h.actorId)} · {dateTime(h.at)}
            </div>
          </div>
        </li>
      ))}
      <li className="grid grid-cols-[14px_minmax(0,1fr)] gap-3">
        <span aria-hidden className="flex justify-center">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-line-2" />
        </span>
        <div>
          <div className="text-[13px] font-semibold">{origin.label}</div>
          <div className="font-mono text-[11px] text-muted">
            {name(origin.actorId ?? 'system')} · {dateTime(origin.at)}
          </div>
        </div>
      </li>
    </ol>
  )
}
