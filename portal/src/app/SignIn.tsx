import { Landmark } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ThemeToggle } from './ThemeToggle'
import { ROLE_LABEL } from '../domain/policy'
import { DEMO_MDAS } from '../domain/seed'
import type { User } from '../domain/types'
import { store, usePortal } from '../state/store'
import { useToast } from '../ui/toast'
import { homeFor } from './routes'

const ROLE_ORDER: User['role'][] = ['finance_officer', 'dfa', 'head_ia', 'accounting_officer']

function RoleButton({ u, onPick }: { u: User; onPick: (u: User) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(u)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-200 hover:border-primary hover:bg-accent-soft"
    >
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-sunk font-mono text-[11px] font-semibold">{u.initials}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold">{ROLE_LABEL[u.role]}</span>
        <span className="truncate text-xs text-muted">
          {u.name} · {u.title}
        </span>
      </span>
      <span aria-hidden className="text-muted">→</span>
    </button>
  )
}

export function SignIn() {
  const s = usePortal()
  const navigate = useNavigate()
  const toast = useToast()

  const signIn = (u: User) => {
    store.signIn(u.id)
    toast('success', `Signed in as ${ROLE_LABEL[u.role]}`, `${u.name} · session verified`)
    navigate(homeFor(u))
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(360px,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col justify-between gap-12 border-line bg-surface px-8 py-10 text-ink transition-colors duration-200 max-lg:border-b lg:border-r lg:px-14">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Landmark size={19} aria-hidden />
          </div>
          <div className="font-semibold">Oversight Ledger OS</div>
        </div>
        <div className="max-w-[460px]">
          <div className="font-mono text-[11px] tracking-widest text-accent uppercase">MDA Compliance Portal</div>
          <h1 className="mt-3 mb-4 font-cond text-[34px] leading-[1.12] font-semibold tracking-tight">
            Answer the ledger, one case at a time, with evidence.
          </h1>
          <p className="text-[15px] leading-relaxed text-shell-muted">
            Every flag the Anomaly Engine raises against your MDA gets an owner, a deadline and a structured response,
            signed off by the officers accountable for it.
          </p>
        </div>
        <ul className="flex flex-col gap-2.5 font-mono text-xs text-shell-muted">
          <li className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-ok-dot" />Hardware key required at attestation</li>
          <li className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-ok-dot" />Every action written to the case history</li>
          <li className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-ok-dot" />Same rating and rules as the oversight console</li>
        </ul>
      </div>

      <div className="relative flex items-center justify-center bg-ground px-6 py-10 transition-colors duration-200">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">Demo sign-in</h2>
            <p className="mt-1 text-sm text-muted">
              Pick a role. Open a second tab as another role to watch a case move through the chain. Tabs stay in sync.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {DEMO_MDAS.map((mdaId) => {
              const mda = s.mdas.find((m) => m.id === mdaId)!
              const team = ROLE_ORDER.map((r) => s.users.find((u) => u.mdaId === mdaId && u.role === r)!)
              return (
                <section key={mdaId} className="flex flex-col gap-2">
                  <div className="eyebrow">
                    {mda.acronym} · {mda.code}
                  </div>
                  <div className="-mt-1 text-[13px] font-medium">{mda.name}</div>
                  {team.map((u) => (
                    <RoleButton key={u.id} u={u} onPick={signIn} />
                  ))}
                </section>
              )
            })}
          </div>

          <section className="flex flex-col gap-2">
            <div className="eyebrow">Oversight</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <RoleButton u={s.users.find((u) => u.role === 'auditor')!} onPick={signIn} />
              <RoleButton u={s.users.find((u) => u.role === 'treasury')!} onPick={signIn} />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-muted">Demo data is stored in this browser only.</p>
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-accent hover:underline"
              onClick={() => {
                store.reset()
                toast('info', 'Demo data reset', 'All cases are back to their starting state.')
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
