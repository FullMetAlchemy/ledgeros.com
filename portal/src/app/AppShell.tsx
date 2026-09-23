import {
  Banknote,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileStack,
  FileText,
  FlagTriangleRight,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { clock } from '../domain/calendar'
import { isOpen } from '../domain/flagMachine'
import { submissionTasksFor } from '../domain/submissions/tasks'
import { tasksFor } from '../domain/tasks'
import { store, useMe, usePortal, visibleFlags, visibleSubmissions } from '../state/store'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

interface NavItem {
  to?: string
  label: string
  icon: LucideIcon
  count?: number
  /** Badge colour: red for flags, amber for pending actions. */
  tone?: 'crit' | 'warn'
}

const SWEEP_EVERY_MS = 60_000

const BADGE = { crit: 'bg-crit-bg text-crit-fg border-crit-bd', warn: 'bg-warn-bg text-warn-fg border-warn-bd' }

export function AppShell() {
  const s = usePortal()
  const me = useMe()
  const navigate = useNavigate()

  useEffect(() => {
    store.sweep()
    const t = setInterval(() => store.sweep(), SWEEP_EVERY_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!me) navigate('/', { replace: true })
  }, [me, navigate])
  if (!me) return null

  const flags = visibleFlags(s, me)
  const subs = visibleSubmissions(s, me)
  const flagTasks = tasksFor(flags, me).length
  const subTasks = submissionTasksFor(subs, me).length
  const mda = me.mdaId ? s.mdas.find((m) => m.id === me.mdaId) : null
  const oversight = !me.mdaId
  const consoleName = me.role === 'treasury' ? 'Treasury console' : oversight ? 'Oversight console' : 'MDA portal'

  const primary: NavItem[] =
    me.role === 'treasury'
      ? [
          { to: '/oversight/releases', label: 'Release requests', icon: Banknote, count: subTasks, tone: 'warn' },
          { to: '/profile', label: 'Profile', icon: UserRound },
        ]
      : oversight
        ? [
            { to: '/oversight/queue', label: 'Flag review', icon: ShieldCheck, count: flagTasks, tone: 'warn' },
            { to: '/oversight/submissions', label: 'Submissions', icon: FileStack, count: subTasks, tone: 'warn' },
            { to: '/oversight/flags', label: 'All flags', icon: FlagTriangleRight },
            { to: '/profile', label: 'Profile', icon: UserRound },
          ]
        : [
            { to: '/home', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/tasks', label: 'My tasks', icon: ListChecks, count: flagTasks + subTasks, tone: 'warn' },
            { to: '/submissions', label: 'Submissions', icon: FileText, count: subs.filter((x) => x.state === 'Draft' || x.state === 'Queried').length, tone: 'warn' },
            { to: '/flags', label: 'Flag resolution', icon: FlagTriangleRight, count: flags.filter(isOpen).length, tone: 'crit' },
            { to: '/profile', label: 'Profile', icon: UserRound },
          ]
  const planned: NavItem[] = oversight
    ? [{ label: 'Executive dashboard', icon: ClipboardCheck }]
    : [
        { label: 'Funds', icon: Wallet },
        { label: 'Evidence', icon: FolderOpen },
        { label: 'Calendar', icon: CalendarDays },
        { label: 'Organisation', icon: Building2 },
      ]

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 border-shell-line bg-shell px-3 py-3 text-shell-ink transition-colors duration-200 max-md:border-b md:sticky md:top-0 md:h-screen md:gap-5 md:border-r md:py-4">
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Landmark size={17} aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Oversight Ledger OS</div>
            <div className="font-mono text-[10px] tracking-wider text-shell-muted uppercase">{consoleName}</div>
          </div>
        </div>

        {mda && (
          <div className="mx-1 rounded-lg border border-shell-line bg-sunk px-3 py-2 transition-colors duration-200 max-md:hidden">
            <div className="font-mono text-[10px] tracking-wider text-shell-muted uppercase">{mda.code}</div>
            <div className="text-[13px] leading-snug font-medium">{mda.name}</div>
          </div>
        )}

        <nav aria-label="Main" className="flex flex-wrap gap-0.5 md:flex-col">
          {primary.map(({ to, label, icon: Icon, count, tone }) => (
            <NavLink
              key={to}
              to={to!}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? 'bg-shell-active text-shell-active-ink' : 'text-shell-muted hover:bg-shell-hover hover:text-shell-ink'
                }`
              }
            >
              <Icon size={17} aria-hidden className="flex-none" />
              <span className="flex-1">{label}</span>
              {!!count && <span className={`rounded-full border px-1.5 font-mono text-[11px] font-semibold ${BADGE[tone ?? 'warn']}`}>{count}</span>}
            </NavLink>
          ))}
          <div className="mt-4 px-2.5 pb-1 font-mono text-[10px] tracking-wider text-shell-muted/70 uppercase max-md:hidden">Planned</div>
          {planned.map(({ label, icon: Icon }) => (
            <span key={label} aria-disabled className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-shell-muted/60 max-md:hidden">
              <Icon size={17} aria-hidden className="flex-none" />
              <span className="flex-1">{label}</span>
              <span className="font-mono text-[9.5px] tracking-wider uppercase">Soon</span>
            </span>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-1.5 border-t border-shell-line px-2 pt-3 font-mono text-[11px] text-shell-muted max-md:hidden" title="Deadline checks run every minute">
          <span className="h-1.5 w-1.5 rounded-full bg-ok-dot [animation:ol-pulse_2s_infinite]" />
          Ledger synced {clock(new Date(s.syncedAt))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur transition-colors duration-200 md:px-7">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-muted">{me.role === 'treasury' ? 'Treasury' : oversight ? 'Oversight' : mda?.acronym} · FY2026 · Q3</div>
            <div className="truncate text-[13px] font-medium text-ink">{mda?.name ?? consoleName}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu me={me} mdaName={mda?.name} />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 pt-6 pb-12 md:px-7 [animation:ol-view_.25s_ease-out]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
