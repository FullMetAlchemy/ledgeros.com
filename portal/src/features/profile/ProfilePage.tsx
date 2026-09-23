import { BellRing, KeyRound, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ThemeToggle } from '../../app/ThemeToggle'
import { chainFor, ROLE_LABEL, rolesForStep, STEP_LABEL } from '../../domain/policy'
import { DEFS } from '../../domain/submissions/defs'
import type { SubmissionKind } from '../../domain/submissions/types'
import type { RoleId, Severity } from '../../domain/types'
import { useMe, usePortal } from '../../state/store'
import { PageHeader, Panel } from '../../ui/Panel'

type Prefs = { email: boolean; sms: boolean; digest: boolean }
const DEFAULT_PREFS: Prefs = { email: true, sms: true, digest: true }

function readPrefs(userId: string): Prefs {
  try {
    const raw = localStorage.getItem(`olos.prefs.${userId}`)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

/** What a role can do, derived from the same policy tables the state machines enforce. */
function capabilities(role: RoleId): string[] {
  const out: string[] = []
  if (role === 'auditor') return ['Accept, query or reject attested flag responses', 'Accept or query returns, retirements, certificates, quarterly reports and vendor exceptions', 'Reopen resolved flags']
  if (role === 'treasury') return ['Approve or query release (warrant) requests', 'See each MDA’s live rating and open flags beside every request']
  if (role === 'dfa' || role === 'accounting_officer') out.push('Acknowledge flags and assign owners')
  for (const sev of ['Critical', 'Medium'] as Severity[]) {
    const steps = chainFor(sev)
    steps.forEach((step, i) => {
      const final = i === steps.length - 1
      if (rolesForStep(step, final).includes(role)) out.push(`${final ? 'Attest' : STEP_LABEL[step]} ${sev === 'Critical' ? 'Critical/High' : 'Medium/Low'} flag responses`)
    })
  }
  const prepares = (Object.keys(DEFS) as SubmissionKind[]).filter((k) => DEFS[k].preparers.includes(role))
  if (prepares.length) out.push(`Prepare: ${prepares.map((k) => DEFS[k].short.toLowerCase()).join(', ')}`)
  for (const k of Object.keys(DEFS) as SubmissionKind[]) {
    const chain = DEFS[k].chain
    chain.forEach((step, i) => {
      if (i === 0) return
      const final = i === chain.length - 1
      if (rolesForStep(step, final).includes(role)) out.push(`${final ? 'Attest' : STEP_LABEL[step]} ${DEFS[k].short.toLowerCase()} submissions`)
    })
  }
  return [...new Set(out)]
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-0.5 text-[13.5px] text-ink">{children}</div>
      </div>
    </div>
  )
}

function Toggle({ id, label, help, checked, locked, onChange }: { id: string; label: string; help: string; checked: boolean; locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={`flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0 ${locked ? '' : 'cursor-pointer'}`}>
      <span>
        <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
          {label}
          {locked && <Lock size={12} className="text-muted" aria-label="Required" />}
        </span>
        <span className="block text-xs text-muted">{help}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-5 w-9 flex-none rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${checked ? 'bg-primary' : 'bg-line-2'} ${locked ? 'opacity-60' : ''}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </span>
    </label>
  )
}

export function ProfilePage() {
  const s = usePortal()
  const me = useMe()!
  const mda = me.mdaId ? s.mdas.find((m) => m.id === me.mdaId) : null
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(me.id))
  const setPref = (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    try {
      localStorage.setItem(`olos.prefs.${me.id}`, JSON.stringify(next))
    } catch {
      /* preference lasts for this session */
    }
  }
  const domain = mda ? `${mda.acronym.toLowerCase()}.gov.ng` : 'oagf.gov.ng'
  const email = `${me.name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('.')}@${domain}`
  const leads = me.role === 'dfa' || me.role === 'accounting_officer'

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" />

      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-5 py-5 shadow-sm shadow-slate-900/[0.03] transition-colors duration-200">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft font-mono text-lg font-semibold text-accent">{me.initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{me.name}</h2>
          <p className="text-[13px] text-muted">
            {me.title}
            {mda && ` · ${mda.name}`}
          </p>
        </div>
        <span className="rounded-full border border-flow-bd bg-flow-bg px-3 py-1 text-xs font-semibold text-flow-fg">{ROLE_LABEL[me.role]}</span>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel title="Account">
          <Row icon={<UserRound size={16} />} label="Name">
            {me.name}
          </Row>
          <Row icon={<Mail size={16} />} label="Official email">
            <span className="font-mono text-[13px]">{email}</span>
          </Row>
          <Row icon={<ShieldCheck size={16} />} label={mda ? 'MDA' : 'Office'}>
            {mda ? `${mda.name} (${mda.code})` : me.role === 'treasury' ? 'Office of the Accountant-General · Treasury' : 'Oversight · Office of the Auditor-General'}
          </Row>
          <Row icon={<KeyRound size={16} />} label="Security key">
            {me.role === 'finance_officer' || me.role === 'head_ia' ? 'Passkey for sign-in. A hardware key is only required at attestation steps.' : 'Hardware key registered · required for attestation (simulated in this demo)'}
          </Row>
        </Panel>

        <Panel title="What your role can do" aside="From the portal’s sign-off rules">
          <ul className="flex flex-col gap-2">
            {capabilities(me.role).map((c) => (
              <li key={c} className="flex gap-2.5 text-[13px] text-ink-2">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Segregation of duties applies: you can never act at two steps of the same record.</p>
        </Panel>

        <Panel title="Notifications" aside={<BellRing size={14} aria-hidden />}>
          <Toggle id="pref-statutory" label="Statutory deadline alerts" help="Flags, returns and escalations. Always on." checked locked />
          <Toggle id="pref-email" label="Email" help="Send alerts to your official email." checked={prefs.email} onChange={(v) => setPref('email', v)} />
          <Toggle id="pref-sms" label="SMS for Critical flags" help="Only Critical items, to avoid alert fatigue." checked={prefs.sms} onChange={(v) => setPref('sms', v)} />
          <Toggle
            id="pref-digest"
            label={leads ? 'Daily digest' : 'Weekly digest'}
            help={leads ? 'A morning summary of what needs you and your team.' : 'A weekly summary of your open items.'}
            checked={prefs.digest}
            onChange={(v) => setPref('digest', v)}
          />
        </Panel>

        <Panel title="Appearance">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13.5px] font-medium">Light or dark mode</div>
              <div className="text-xs text-muted">Follows your device until you choose. Saved on this browser.</div>
            </div>
            <ThemeToggle />
          </div>
        </Panel>
      </div>
    </>
  )
}
