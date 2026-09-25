import { KeyRound, Landmark, ShieldCheck, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { DEMO_PASSWORD } from '../domain/access'
import { ROLE_LABEL } from '../domain/roles'
import type { RoleId, User } from '../domain/types'
import { store, useMe, usePortal } from '../state/store'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/Field'
import { StatusPill } from '../ui/Pill'
import { USER_TONE } from '../ui/tone'
import { homeFor } from './routes'
import { ThemeToggle } from './ThemeToggle'

const ROLE_ORDER: RoleId[] = ['executive', 'oversight', 'mda_officer', 'mda_supervisor', 'auditor', 'admin']

function DemoAccounts({ users, onPick }: { users: User[]; onPick: (u: User) => void }) {
  const featured = users.filter((u) => !u.mdaId || u.mdaId === 'MWI' || u.mdaId === 'MOH')
  return (
    <section aria-label="Demo accounts" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Prototype accounts</h3>
        <span className="font-mono text-[11px] text-muted">
          Password for all: <span className="text-ink">{DEMO_PASSWORD}</span>
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {featured
          .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
          .map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onPick(u)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors duration-200 hover:border-primary hover:bg-accent-soft"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunk font-mono text-[10.5px] font-semibold">{u.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{ROLE_LABEL[u.role]}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {u.name}
                    {u.mdaId ? ` · ${u.mdaId}` : ''}
                  </span>
                </span>
                {u.status !== 'Active' && <StatusPill tone={USER_TONE[u.status]} label={u.status} />}
              </button>
            </li>
          ))}
      </ul>
      <p className="text-[11.5px] text-muted">
        Changes you make are kept in this browser.{' '}
        <button
          type="button"
          className="cursor-pointer font-medium text-accent hover:underline"
          onClick={() => window.confirm('Restore the original demo data? Everything changed in this browser will be discarded.') && store.reset()}
        >
          Reset demo data
        </button>
      </p>
    </section>
  )
}

export function Login() {
  const s = usePortal()
  const me = useMe()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (me) return <Navigate to={homeFor(me)} replace />
  const challenge = s.challenge
  const challengeUser = challenge ? s.ds.users.find((u) => u.id === challenge.userId) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = store.login(email, password)
    if (!r.ok) return setError(r.error)
    if (!r.value.mfaRequired) navigate(homeFor(store.me()!))
  }
  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = store.verifyMfa(code)
    if (!r.ok) return setError(r.error)
    setCode('')
    navigate(homeFor(store.me()!))
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col justify-between gap-10 border-line bg-surface px-8 py-10 transition-colors duration-200 max-lg:border-b lg:border-r lg:px-12">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Landmark size={19} aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Oversight Ledger OS</div>
            <div className="text-xs text-muted">State Ministry of Budget and Economic Planning</div>
          </div>
        </div>
        <div className="max-w-[440px]">
          <h1 className="text-[30px] leading-[1.15] font-semibold tracking-tight">State-wide financial oversight, in one ledger.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Budget, revenue, releases and expenditure across every MDA, with exceptions surfaced by rule, answered with evidence and traceable from detection to closure.
          </p>
        </div>
        <div className="rounded-lg border border-warn-bd bg-warn-bg px-4 py-3 text-xs leading-relaxed text-ink-2">
          <b className="text-warn-fg">Prototype.</b> Figures are demonstration data, not verified government financial records. Sign-in, MFA and the GIFMIS/TSA feeds are simulated.
        </div>
      </div>

      <div className="relative flex items-center justify-center bg-ground px-6 py-10 transition-colors duration-200">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[560px] flex-col gap-7">
          {s.expired && !challenge && (
            <div role="status" className="rounded-lg border border-flow-bd bg-flow-bg px-4 py-3 text-[13px] text-ink-2">
              You were signed out after {s.ds.securityConfig.sessionTimeoutMin} minutes without activity. Sign in again to continue.
            </div>
          )}

          {!challenge ? (
            <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-sm shadow-slate-900/[0.04]" noValidate>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
                <p className="mt-1 text-sm text-muted">Use your official email address.</p>
              </div>
              <Field id="email" label="Official email">
                <TextInput id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mda.state.gov.ng" />
              </Field>
              <Field id="password" label="Password">
                <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {error && (
                <p role="alert" className="text-[13px] font-medium text-crit-fg">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={!email || !password}>
                <KeyRound size={15} aria-hidden /> Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-sm shadow-slate-900/[0.04]" noValidate>
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <ShieldCheck size={20} aria-hidden className="text-accent" /> Verify it’s you
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {challengeUser ? `${ROLE_LABEL[challengeUser.role]} accounts` : 'This account'} require a second factor. Enter the 6-digit code from your authenticator.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-2 bg-sunk px-4 py-3">
                <Smartphone size={18} aria-hidden className="text-muted" />
                <div className="flex-1 text-xs text-muted">
                  Simulated authenticator (prototype only)
                  <div className="font-mono text-lg tracking-[0.3em] text-ink">{challenge.code}</div>
                </div>
                <button type="button" onClick={() => store.resendMfa()} className="cursor-pointer text-xs font-medium text-accent hover:underline">
                  New code
                </button>
              </div>
              <Field id="mfa" label="Verification code">
                <TextInput
                  id="mfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="font-mono tracking-[0.3em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </Field>
              {error && (
                <p role="alert" className="text-[13px] font-medium text-crit-fg">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={code.length !== 6}>
                  Verify
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    store.cancelMfa()
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {!challenge && (
            <DemoAccounts
              users={s.ds.users}
              onPick={(u) => {
                setEmail(u.email)
                setPassword(DEMO_PASSWORD)
                setError(null)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
