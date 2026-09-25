import {
  Building2,
  FileText,
  FlagTriangleRight,
  Landmark,
  LayoutDashboard,
  Scale,
  ScrollText,
  Settings,
  TableProperties,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { isActiveFlag } from '../domain/metrics'
import { can, inScope, isMdaRole, ROLE_LABEL, type Permission } from '../domain/roles'
import { useDs, useMe } from '../state/store'
import { Notifications } from './Notifications'
import { PeriodSelector } from './PeriodSelector'
import { SessionWatcher } from './SessionWatcher'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission?: Permission
  count?: number
}

export function AppShell() {
  const ds = useDs()
  const me = useMe()
  const navigate = useNavigate()

  useEffect(() => {
    if (!me) navigate('/login', { replace: true })
  }, [me, navigate])
  if (!me) return null

  const mda = me.mdaId ? ds.mdas.find((m) => m.id === me.mdaId) : null
  const activeFlags = ds.flags.filter((f) => isActiveFlag(f) && inScope(me, f.mdaId)).length
  const mdaUser = isMdaRole(me.role)

  const items: NavItem[] = [
    mdaUser ? { to: '/home', label: 'Home', icon: LayoutDashboard } : { to: '/dashboard', label: 'Control tower', icon: LayoutDashboard, permission: 'dashboard.view' },
    mdaUser && mda ? { to: `/mdas/${mda.id}`, label: 'My MDA', icon: Building2, permission: 'mda.view' } : { to: '/mdas', label: 'MDAs', icon: Building2, permission: 'mda.view' },
    { to: '/returns', label: 'Expenditure returns', icon: FileText, permission: 'return.view' },
    { to: '/flags', label: 'Compliance centre', icon: FlagTriangleRight, permission: 'flag.view', count: activeFlags },
    { to: '/reconciliation', label: 'Reconciliation', icon: Scale, permission: 'rec.view' },
    { to: '/audit', label: 'Audit ledger', icon: ScrollText, permission: 'audit.view' },
    { to: '/reports', label: 'Reports', icon: TableProperties, permission: 'report.view' },
    { to: '/admin', label: 'Administration', icon: Settings, permission: 'admin.users' },
    { to: '/profile', label: 'Profile', icon: UserRound },
  ]
  const nav = items.filter((n) => !n.permission || can(me, n.permission))

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
      <SessionWatcher />
      <aside className="flex flex-col gap-3 border-shell-line bg-shell px-3 py-3 text-shell-ink transition-colors duration-200 max-md:border-b md:sticky md:top-0 md:h-screen md:gap-5 md:border-r md:py-4">
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Landmark size={17} aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Oversight Ledger OS</div>
            <div className="text-[11px] text-shell-muted">Budget and Economic Planning</div>
          </div>
        </div>
        {mda && (
          <div className="mx-1 rounded-lg border border-shell-line bg-sunk px-3 py-2 transition-colors duration-200 max-md:hidden">
            <div className="font-mono text-[10px] tracking-wider text-shell-muted uppercase">{mda.code}</div>
            <div className="text-[13px] leading-snug font-medium">{mda.name}</div>
          </div>
        )}
        <nav aria-label="Main" className="flex flex-wrap gap-0.5 md:flex-col">
          {nav.map(({ to, label, icon: Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? 'bg-shell-active text-shell-active-ink' : 'text-shell-muted hover:bg-shell-hover hover:text-shell-ink'
                }`
              }
            >
              <Icon size={17} aria-hidden className="flex-none" />
              <span className="flex-1">{label}</span>
              {!!count && (
                <span className="rounded-full border border-line px-1.5 font-mono text-[11px] font-semibold text-ink-2" aria-label={`${count} active`}>
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-shell-line px-2 pt-3 text-[11px] text-shell-muted max-md:hidden">
          <span className="font-medium text-shell-ink">{ROLE_LABEL[me.role]}</span>
          <span>Data sources: mock GIFMIS · mock TSA</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur transition-colors duration-200 md:px-7">
          {me.role !== 'admin' && <PeriodSelector />}
          <span className="rounded-full border border-warn-bd bg-warn-bg px-2.5 py-0.5 text-[11px] font-semibold text-warn-fg" title="Demonstration data, not verified government financial records">
            Prototype data
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Notifications me={me} />
            <ThemeToggle />
            <UserMenu me={me} mdaName={mda?.name} />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 pt-6 pb-12 md:px-7 [animation:ol-view_.25s_ease-out]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
