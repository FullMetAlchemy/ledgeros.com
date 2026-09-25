import { BellRing, KeyRound, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ThemeToggle } from '../../app/ThemeToggle'
import { dateTime } from '../../domain/calendar'
import { permissionsOf, ROLE_LABEL, ROLE_SCOPE, type Permission } from '../../domain/roles'
import type { RoleId } from '../../domain/types'
import { useDs, useMe } from '../../state/store'
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

const CAPABILITY: Record<Permission, string> = {
  'dashboard.view': 'View the state-wide control tower',
  'mda.view': 'View MDA financial positions',
  'mda.manage': 'Edit MDA master data',
  'return.view': 'View expenditure returns',
  'return.prepare': 'Prepare and submit expenditure returns',
  'return.approve': 'Approve returns before they leave the MDA',
  'return.review': 'Accept, return or close expenditure returns',
  'flag.view': 'View compliance flags',
  'flag.open': 'Open detected flags for MDA response',
  'flag.assign': 'Assign flags within the MDA',
  'flag.respond': 'Respond to flags with explanation and evidence',
  'flag.approveResponse': 'Approve MDA flag responses before submission',
  'flag.review': 'Review MDA responses: resolve, reject or return',
  'flag.escalate': 'Escalate overdue or unresolved flags',
  'flag.close': 'Close resolved or rejected flags',
  'flag.comment': 'Comment on flag cases',
  'rec.view': 'View reconciliations',
  'rec.manage': 'Run and review reconciliations',
  'rules.run': 'Run the anomaly rules',
  'audit.view': 'View and verify the audit ledger',
  'report.view': 'View reports',
  'report.export': 'Export reports to CSV',
  'admin.users': 'Manage user accounts and access',
  'admin.config': 'Change anomaly thresholds and security settings',
  'admin.masterData': 'Open and close financial periods',
}

/** What a role can do, from the same permission matrix every action checks. */
const capabilities = (role: RoleId) => permissionsOf(role).map((p) => CAPABILITY[p])

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
  const ds = useDs()
  const me = useMe()!
  const mda = me.mdaId ? ds.mdas.find((m) => m.id === me.mdaId) : null
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
  const leads = me.role === 'executive' || me.role === 'oversight' || me.role === 'mda_supervisor'
  const mfa = ds.securityConfig.mfaRoles.includes(me.role)

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
            <span className="font-mono text-[13px]">{me.email}</span>
          </Row>
          <Row icon={<ShieldCheck size={16} />} label="Data scope">
            {mda ? `${mda.name} (${mda.code})` : me.role === 'admin' ? 'System configuration (no financial data)' : `${ROLE_SCOPE[me.role]} · State Ministry of Budget and Economic Planning`}
          </Row>
          <Row icon={<KeyRound size={16} />} label="Sign-in security">
            {mfa ? 'Password and multi-factor authentication (simulated authenticator in this prototype)' : 'Password (MFA not required for this role)'}
            {me.lastLoginAt && <span className="block text-xs text-muted">Last verified sign-in {dateTime(me.lastLoginAt)}</span>}
          </Row>
        </Panel>

        <Panel title="What your role can do" aside="From the role permission matrix">
          <ul className="flex flex-col gap-2">
            {capabilities(me.role).map((c) => (
              <li key={c} className="flex gap-2.5 text-[13px] text-ink-2">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Access changes are made by a System Administrator and recorded in the audit ledger.</p>
        </Panel>

        <Panel title="Notifications" aside={<BellRing size={14} aria-hidden />}>
          <Toggle id="pref-statutory" label="Statutory deadline alerts" help="Flags, returns and escalations in the portal. Always on." checked locked />
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
