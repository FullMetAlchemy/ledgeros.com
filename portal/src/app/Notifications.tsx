import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { User } from '../domain/types'
import { workFor } from '../domain/work'
import { useDs } from '../state/store'
import { DueChip } from '../ui/Pill'

/** In-app notifications (prototype channel, FRD §13): what needs this user next. */
export function Notifications({ me }: { me: User }) {
  const ds = useDs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const items = workFor(ds, me, new Date())

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications: ${items.length} item${items.length === 1 ? '' : 's'} need your action`}
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-muted transition-colors duration-200 hover:bg-sunk hover:text-ink"
      >
        <Bell size={17} aria-hidden />
        {items.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full border-2 border-surface bg-primary px-1 font-mono text-[10px] leading-4 font-semibold text-on-primary">{items.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(380px,calc(100vw-32px))] rounded-lg border border-line bg-surface shadow-lg shadow-slate-900/10 [animation:ol-view_.15s_ease-out]">
          <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">Needs your action</div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">You’re all caught up.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.slice(0, 12).map((w) => (
                <li key={w.key}>
                  <Link to={w.href} onClick={() => setOpen(false)} className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-sunk">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{w.action}</span>
                      <span className="block truncate text-xs text-muted">{w.title}</span>
                    </span>
                    {w.due && <DueChip due={w.due} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
