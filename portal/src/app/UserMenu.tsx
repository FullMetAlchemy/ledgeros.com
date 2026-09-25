import { ChevronDown, LogOut, Palette, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ROLE_LABEL } from '../domain/roles'
import type { User } from '../domain/types'
import { store } from '../state/store'

/** Header profile dropdown: who you are, profile, switch role, sign out. */
export function UserMenu({ me, mdaName }: { me: User; mdaName?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  const item = 'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 transition-colors duration-200 hover:bg-sunk hover:text-ink'
  const signOut = () => {
    setOpen(false)
    store.logout()
    navigate('/login')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface pr-2 pl-1 transition-colors duration-200 hover:bg-sunk"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent">{me.initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-ink">{me.name}</span>
          <span className="block text-[11px] text-muted">{ROLE_LABEL[me.role]}</span>
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg shadow-slate-900/10 [animation:ol-view_.15s_ease-out]">
          <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
            <div className="text-[13px] font-semibold text-ink">{me.name}</div>
            <div className="text-xs text-muted">{me.title}</div>
            {mdaName && <div className="mt-0.5 truncate text-xs text-muted">{mdaName}</div>}
          </div>
          <div className="flex flex-col pt-1.5">
            <Link role="menuitem" to="/profile" className={item} onClick={() => setOpen(false)}>
              <UserRound size={16} aria-hidden /> Profile
            </Link>
            <Link role="menuitem" to="/design" className={item} onClick={() => setOpen(false)}>
              <Palette size={16} aria-hidden /> Design system
            </Link>
            <button role="menuitem" type="button" className={`${item} text-crit-fg hover:text-crit-fg`} onClick={signOut}>
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
