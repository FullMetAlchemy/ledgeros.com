import { Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { allowedUserStatuses } from '../../domain/access'
import { dateTime } from '../../domain/calendar'
import { naira } from '../../domain/money'
import { can, isMdaRole, permissionsOf, ROLE_LABEL, ROLE_SCOPE, type Permission } from '../../domain/roles'
import { RULE_LABEL } from '../../domain/rules'
import { svcChangeUser, svcCreateUser, svcPeriod, svcRuleConfig, svcSecurityConfig, svcUpdateMda } from '../../domain/services'
import type { FinancialPeriod, Mda, RoleId, RuleConfig, SecurityConfig, Severity, User, UserStatus } from '../../domain/types'
import { store, useDs, useMe } from '../../state/store'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { DataTable } from '../../ui/DataTable'
import { Dialog } from '../../ui/Dialog'
import { Field, TextInput } from '../../ui/Field'
import { PageHeader, Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { useToast } from '../../ui/toast'
import { USER_TONE } from '../../ui/tone'

type Tab = 'users' | 'roles' | 'thresholds' | 'security' | 'periods' | 'mdas' | 'integrations'
const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles and permissions' },
  { id: 'thresholds', label: 'Anomaly thresholds' },
  { id: 'security', label: 'Security' },
  { id: 'periods', label: 'Financial periods' },
  { id: 'mdas', label: 'MDA master data' },
  { id: 'integrations', label: 'Reference data and integrations' },
]
const ROLES = Object.keys(ROLE_LABEL) as RoleId[]
const SELECT = 'h-10 w-full rounded-md border border-line-2 bg-surface px-2.5 text-sm'

/** Runs a service call; returns an error string for ConfirmDialog or null on success. */
function useAct() {
  const toast = useToast()
  return (fn: Parameters<typeof store.run>[0], success: string): string | null => {
    const r = store.run(fn)
    if (!r.ok) return r.error
    toast('success', success, 'Recorded in the audit ledger.')
    return null
  }
}

// ---- Users ----------------------------------------------------------------------------

function NewUserDialog({ onClose }: { onClose: () => void }) {
  const ds = useDs()
  const act = useAct()
  const [f, setF] = useState({ name: '', email: '', title: '', role: 'mda_officer' as RoleId, mdaId: ds.mdas[0]?.id ?? '' })
  const [error, setError] = useState<string | null>(null)
  const create = () => {
    const err = act((d, u, now) => svcCreateUser(d, u, { ...f, mdaId: isMdaRole(f.role) ? f.mdaId : null }, now), `${f.name} created as Pending`)
    if (err) setError(err)
    else onClose()
  }
  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Administration"
      title="Create user"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create}>
            Create (Pending)
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field id="nu-name" label="Full name">
          <TextInput id="nu-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field id="nu-email" label="Official email" help="Must be a .gov.ng address.">
          <TextInput id="nu-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field id="nu-title" label="Job title (optional)">
          <TextInput id="nu-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field id="nu-role" label="Role">
          <select id="nu-role" className={SELECT} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as RoleId })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        {isMdaRole(f.role) && (
          <Field id="nu-mda" label="Assigned MDA">
            <select id="nu-mda" className={SELECT} value={f.mdaId} onChange={(e) => setF({ ...f, mdaId: e.target.value })}>
              {ds.mdas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-xs font-medium text-crit-fg">{error}</p>}
        <p className="text-xs text-muted">New accounts start Pending and cannot sign in until activated. In production, accounts are provisioned from the government identity provider.</p>
      </div>
    </Dialog>
  )
}

type UserChange = { user: User; kind: 'status'; status: UserStatus } | { user: User; kind: 'access' }

function AccessFields({ user, value, onChange }: { user: User; value: { role: RoleId; mdaId: string }; onChange: (v: { role: RoleId; mdaId: string }) => void }) {
  const ds = useDs()
  return (
    <div className="mb-3 grid gap-3">
      <Field id={`role-${user.id}`} label="Role">
        <select id={`role-${user.id}`} className={SELECT} value={value.role} onChange={(e) => onChange({ ...value, role: e.target.value as RoleId })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      {isMdaRole(value.role) && (
        <Field id={`mda-${user.id}`} label="MDA scope">
          <select id={`mda-${user.id}`} className={SELECT} value={value.mdaId} onChange={(e) => onChange({ ...value, mdaId: e.target.value })}>
            {ds.mdas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  )
}

function UsersTab() {
  const ds = useDs()
  const me = useMe()!
  const act = useAct()
  const [creating, setCreating] = useState(false)
  const [change, setChange] = useState<UserChange | null>(null)
  const [access, setAccess] = useState({ role: 'mda_officer' as RoleId, mdaId: '' })
  const openAccess = (u: User) => {
    setAccess({ role: u.role, mdaId: u.mdaId ?? ds.mdas[0].id })
    setChange({ user: u, kind: 'access' })
  }
  const verb: Record<UserStatus, string> = { Active: 'Activate', Suspended: 'Suspend', Disabled: 'Disable', Pending: 'Pending' }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="text-xs text-muted">{ds.users.length} accounts · Pending → Active → Suspended / Disabled</span>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
          <Plus size={14} aria-hidden /> Create user
        </Button>
      </div>
      <DataTable
        caption="Users"
        rows={ds.users}
        rowKey={(u) => u.id}
        pageSize={12}
        minWidth={1000}
        initialSort={{ key: 'id', dir: 'asc' }}
        empty={{ title: 'No users' }}
        columns={[
          { key: 'id', header: 'ID', sort: (u) => u.id, cell: (u) => <span className="font-mono text-xs">{u.id}</span> },
          {
            key: 'name',
            header: 'Name',
            sort: (u) => u.name,
            cell: (u) => (
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </div>
            ),
          },
          { key: 'role', header: 'Role', sort: (u) => ROLE_LABEL[u.role], cell: (u) => ROLE_LABEL[u.role] },
          { key: 'mda', header: 'Scope', cell: (u) => (u.mdaId ? (ds.mdas.find((m) => m.id === u.mdaId)?.acronym ?? u.mdaId) : ROLE_SCOPE[u.role]) },
          { key: 'status', header: 'Status', sort: (u) => u.status, cell: (u) => <StatusPill tone={USER_TONE[u.status]} label={u.status} /> },
          { key: 'last', header: 'Last sign-in', cell: (u) => <span className="font-mono text-xs">{u.lastLoginAt ? dateTime(u.lastLoginAt) : '—'}</span> },
          {
            key: 'act',
            header: <span className="sr-only">Actions</span>,
            cell: (u) =>
              u.id === me.id ? (
                <span className="text-xs text-muted">You</span>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {allowedUserStatuses(u.status).map((s) => (
                    <Button key={s} size="sm" variant={s === 'Active' ? 'primary' : s === 'Disabled' ? 'danger' : 'secondary'} onClick={() => setChange({ user: u, kind: 'status', status: s })}>
                      {verb[s]}
                    </Button>
                  ))}
                  {u.status !== 'Disabled' && (
                    <Button size="sm" onClick={() => openAccess(u)}>
                      Change access
                    </Button>
                  )}
                </div>
              ),
          },
        ]}
      />
      {creating && <NewUserDialog onClose={() => setCreating(false)} />}
      {change?.kind === 'status' && (
        <ConfirmDialog
          title={`${verb[change.status]} ${change.user.name}`}
          eyebrow={change.user.id}
          confirmLabel={verb[change.status]}
          danger={change.status !== 'Active'}
          onClose={() => setChange(null)}
          onConfirm={(reason) => act((d, u, now) => svcChangeUser(d, u, change.user.id, { status: change.status }, reason, now), `${change.user.name}: ${change.status}`)}
        >
          <p className="mb-3 text-[13px] text-ink-2">
            {change.user.status} → {change.status}.{change.status === 'Disabled' && ' Disabled accounts cannot be re-enabled.'}
          </p>
        </ConfirmDialog>
      )}
      {change?.kind === 'access' && (
        <ConfirmDialog
          title={`Change access for ${change.user.name}`}
          eyebrow={change.user.id}
          confirmLabel="Save access"
          onClose={() => setChange(null)}
          onConfirm={(reason) =>
            act((d, u, now) => svcChangeUser(d, u, change.user.id, { role: access.role, mdaId: isMdaRole(access.role) ? access.mdaId : null }, reason, now), `${change.user.name}: access updated`)
          }
        >
          <AccessFields user={change.user} value={access} onChange={setAccess} />
        </ConfirmDialog>
      )}
    </>
  )
}

// ---- Roles (read-only matrix) ----------------------------------------------------------

const PERMISSION_GROUPS: { label: string; items: [Permission, string][] }[] = [
  { label: 'Monitoring', items: [['dashboard.view', 'Control tower'], ['mda.view', 'View MDAs'], ['report.view', 'View reports'], ['report.export', 'Export CSV']] },
  { label: 'Returns', items: [['return.view', 'View'], ['return.prepare', 'Prepare and submit'], ['return.approve', 'Supervisor approval'], ['return.review', 'Accept / return / close']] },
  {
    label: 'Flags',
    items: [
      ['flag.view', 'View'],
      ['flag.open', 'Open detected flags'],
      ['flag.assign', 'Assign in MDA'],
      ['flag.respond', 'Respond'],
      ['flag.approveResponse', 'Approve MDA response'],
      ['flag.review', 'Review response'],
      ['flag.escalate', 'Escalate'],
      ['flag.close', 'Close'],
      ['flag.comment', 'Comment'],
    ],
  },
  { label: 'Reconciliation and rules', items: [['rec.view', 'View reconciliations'], ['rec.manage', 'Work reconciliations'], ['rules.run', 'Run anomaly rules']] },
  { label: 'Governance', items: [['audit.view', 'Audit ledger'], ['admin.users', 'Manage users'], ['admin.config', 'Thresholds and security'], ['admin.masterData', 'Periods and master data'], ['mda.manage', 'Edit MDAs']] },
]

function RolesTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <caption className="sr-only">Role permissions</caption>
        <thead>
          <tr className="border-b border-line bg-sunk text-left text-[11px] tracking-wider text-muted uppercase">
            <th className="px-4 py-2.5 font-semibold">Permission</th>
            {ROLES.map((r) => (
              <th key={r} className="px-2 py-2.5 text-center font-semibold">
                {ROLE_LABEL[r]}
                <div className="font-normal normal-case tracking-normal">{ROLE_SCOPE[r]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((g) => [
            <tr key={g.label} className="border-b border-line bg-sunk/50">
              <th colSpan={ROLES.length + 1} className="px-4 py-1.5 text-left text-xs font-semibold text-ink-2">
                {g.label}
              </th>
            </tr>,
            ...g.items.map(([p, label]) => (
              <tr key={p} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2">{label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {permissionsOf(r).includes(p) ? <span className="font-semibold text-ok-fg">Yes</span> : <span className="text-faint">—</span>}
                  </td>
                ))}
              </tr>
            )),
          ])}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">Role definitions follow FRD §3. The matrix is read-only; change a person’s role from the Users tab. The Auditor role is read-only by design.</p>
    </div>
  )
}

// ---- Thresholds ----------------------------------------------------------------------

function NumberField({ id, label, value, onChange, step = 1, suffix }: { id: string; label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <Field id={id} label={label}>
      <div className="flex items-center gap-2">
        <TextInput id={id} type="number" step={step} className="h-10 max-w-32 font-mono" value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </div>
    </Field>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  )
}

function ThresholdsTab() {
  const ds = useDs()
  const act = useAct()
  const [c, setC] = useState<RuleConfig>(() => structuredClone(ds.ruleConfig))
  const [confirm, setConfirm] = useState(false)
  const dirty = JSON.stringify(c) !== JSON.stringify(ds.ruleConfig)
  const set = <K extends keyof RuleConfig>(k: K, v: Partial<RuleConfig[K]>) => setC({ ...c, [k]: { ...(c[k] as object), ...v } })
  return (
    <div className="grid gap-4 p-4">
      <p className="max-w-[90ch] text-[13px] text-ink-2">Thresholds are draft values pending stakeholder approval (FRD §10). Changes apply the next time rules run and are recorded with before and after values.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={RULE_LABEL.overspend}>
          <div className="grid gap-3">
            <Check label="Enabled" checked={c.overspend.enabled} onChange={(b) => set('overspend', { enabled: b })} />
            <NumberField id="t-os" label="Critical when utilization exceeds allocation by" suffix="%" value={c.overspend.criticalAbovePct} onChange={(n) => set('overspend', { criticalAbovePct: n })} />
          </div>
        </Panel>
        <Panel title={RULE_LABEL.velocity}>
          <div className="grid gap-3">
            <Check label="Enabled" checked={c.velocity.enabled} onChange={(b) => set('velocity', { enabled: b })} />
            <NumberField id="t-vp" label="Pace multiple (utilization vs elapsed year)" step={0.05} suffix="×" value={c.velocity.paceMultiple} onChange={(n) => set('velocity', { paceMultiple: n })} />
            <NumberField id="t-vm" label="Minimum utilization before flagging" suffix="%" value={c.velocity.minUtilizationPct} onChange={(n) => set('velocity', { minUtilizationPct: n })} />
          </div>
        </Panel>
        <Panel title={RULE_LABEL.milestone}>
          <div className="grid gap-3">
            <Check label="Enabled" checked={c.milestone.enabled} onChange={(b) => set('milestone', { enabled: b })} />
            <NumberField id="t-ms" label="Tolerance: payment % ahead of physical completion" suffix="points" value={c.milestone.tolerancePts} onChange={(n) => set('milestone', { tolerancePts: n })} />
          </div>
        </Panel>
        <Panel title={RULE_LABEL.duplication}>
          <div className="grid gap-2.5">
            <Check label="Enabled" checked={c.duplication.enabled} onChange={(b) => set('duplication', { enabled: b })} />
            <Check label="Same vendor" checked={c.duplication.matchVendor} onChange={(b) => set('duplication', { matchVendor: b })} />
            <Check label="Same amount" checked={c.duplication.matchAmount} onChange={(b) => set('duplication', { matchAmount: b })} />
            <Check label="Same period" checked={c.duplication.samePeriod} onChange={(b) => set('duplication', { samePeriod: b })} />
            <Check label="Same service description" checked={c.duplication.matchService} onChange={(b) => set('duplication', { matchService: b })} />
            <NumberField id="t-dt" label="Amount tolerance" step={0.1} suffix="%" value={c.duplication.amountTolerancePct} onChange={(n) => set('duplication', { amountTolerancePct: n })} />
          </div>
        </Panel>
      </div>
      <Panel title="Response deadlines by severity">
        <div className="grid gap-3 sm:grid-cols-4">
          {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((s) => (
            <NumberField key={s} id={`sla-${s}`} label={s} suffix="working days" value={c.responseSlaDays[s]} onChange={(n) => setC({ ...c, responseSlaDays: { ...c.responseSlaDays, [s]: n } })} />
          ))}
        </div>
      </Panel>
      <div className="flex gap-2">
        <Button variant="primary" disabled={!dirty} onClick={() => setConfirm(true)}>
          <Save size={14} aria-hidden /> Save thresholds…
        </Button>
        <Button disabled={!dirty} onClick={() => setC(structuredClone(ds.ruleConfig))}>
          Discard changes
        </Button>
      </div>
      {confirm && <ConfirmDialog title="Save anomaly thresholds" confirmLabel="Save" onClose={() => setConfirm(false)} onConfirm={(reason) => act((d, u, now) => svcRuleConfig(d, u, c, reason, now), 'Thresholds saved')} />}
    </div>
  )
}

// ---- Security ------------------------------------------------------------------------

function SecurityTab() {
  const ds = useDs()
  const act = useAct()
  const [c, setC] = useState<SecurityConfig>(() => structuredClone(ds.securityConfig))
  const [confirm, setConfirm] = useState(false)
  const dirty = JSON.stringify(c) !== JSON.stringify(ds.securityConfig)
  return (
    <div className="grid max-w-[720px] gap-4 p-4">
      <NumberField id="sec-timeout" label="Session timeout (inactivity)" suffix="minutes" value={c.sessionTimeoutMin} onChange={(n) => setC({ ...c, sessionTimeoutMin: n })} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium text-ink-2">Roles that must use MFA</legend>
        {ROLES.map((r) => (
          <Check
            key={r}
            label={ROLE_LABEL[r]}
            checked={c.mfaRoles.includes(r)}
            onChange={(b) => setC({ ...c, mfaRoles: b ? [...c.mfaRoles, r] : c.mfaRoles.filter((x) => x !== r) })}
          />
        ))}
      </fieldset>
      <p className="text-xs text-muted">Prototype: MFA codes appear in a simulated authenticator. In production, sign-in and MFA are delegated to the government identity provider.</p>
      <div className="flex gap-2">
        <Button variant="primary" disabled={!dirty} onClick={() => setConfirm(true)}>
          <Save size={14} aria-hidden /> Save security settings…
        </Button>
        <Button disabled={!dirty} onClick={() => setC(structuredClone(ds.securityConfig))}>
          Discard changes
        </Button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Save security settings"
          confirmLabel="Save"
          onClose={() => setConfirm(false)}
          onConfirm={(reason) => (c.sessionTimeoutMin < 5 || c.sessionTimeoutMin > 60 ? 'Session timeout must be between 5 and 60 minutes.' : act((d, u, now) => svcSecurityConfig(d, u, c, reason, now), 'Security settings saved'))}
        />
      )}
    </div>
  )
}

// ---- Periods -------------------------------------------------------------------------

function PeriodsTab() {
  const ds = useDs()
  const act = useAct()
  const [target, setTarget] = useState<{ p: FinancialPeriod; status: FinancialPeriod['status'] } | null>(null)
  return (
    <>
      <DataTable
        caption="Financial periods"
        rows={ds.periods}
        rowKey={(p) => p.id}
        pageSize={12}
        empty={{ title: 'No periods' }}
        columns={[
          { key: 'id', header: 'Period', cell: (p) => <span className="font-mono">{p.id}</span> },
          { key: 'label', header: 'Label', cell: (p) => p.label },
          { key: 'q', header: 'Quarter', cell: (p) => `Q${p.quarter}` },
          { key: 's', header: 'Status', cell: (p) => <StatusPill tone={p.status === 'Open' ? 'ok' : p.status === 'Closed' ? 'neu' : 'flow'} label={p.status} /> },
          { key: 'r', header: 'Returns', align: 'right', cell: (p) => ds.returns.filter((r) => r.periodId === p.id).length },
          {
            key: 'a',
            header: <span className="sr-only">Actions</span>,
            cell: (p) => (
              <div className="flex justify-end gap-1.5">
                {p.status !== 'Open' && (
                  <Button size="sm" onClick={() => setTarget({ p, status: 'Open' })}>
                    {p.status === 'Closed' ? 'Reopen' : 'Open'}
                  </Button>
                )}
                {p.status === 'Open' && (
                  <Button size="sm" variant="danger" onClick={() => setTarget({ p, status: 'Closed' })}>
                    Close
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {target && (
        <ConfirmDialog
          title={`${target.status === 'Closed' ? 'Close' : 'Open'} ${target.p.label}`}
          confirmLabel={target.status === 'Closed' ? 'Close period' : 'Open period'}
          danger={target.status === 'Closed'}
          onClose={() => setTarget(null)}
          onConfirm={(reason) => act((d, u, now) => svcPeriod(d, u, target.p.id, target.status, reason, now), `${target.p.label}: ${target.status}`)}
        >
          <p className="mb-3 text-[13px] text-ink-2">{target.status === 'Closed' ? 'MDAs will not be able to start new returns for this period.' : 'MDAs will be able to start and submit returns for this period.'}</p>
        </ConfirmDialog>
      )}
    </>
  )
}

// ---- MDA master data ---------------------------------------------------------------------

function MdaEdit({ mda, onClose }: { mda: Mda; onClose: () => void }) {
  const act = useAct()
  const [f, setF] = useState({ name: mda.name, sector: mda.sector, accountingOfficer: mda.accountingOfficer, contactEmail: mda.contactEmail, status: mda.status, appropriation: String(mda.appropriation / 1e9) })
  return (
    <ConfirmDialog
      title={`Edit ${mda.acronym}`}
      eyebrow={mda.code}
      confirmLabel="Save"
      onClose={onClose}
      onConfirm={(reason) => {
        const appropriation = Number(f.appropriation) * 1e9
        if (!Number.isFinite(appropriation)) return 'Enter the appropriation in billions of naira.'
        return act((d, u, now) => svcUpdateMda(d, u, mda.id, { ...f, appropriation }, reason, now), `${mda.acronym} updated`)
      }}
    >
      <div className="mb-3 grid gap-3">
        <Field id="m-name" label="Name">
          <TextInput id="m-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field id="m-sector" label="Sector">
          <TextInput id="m-sector" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })} />
        </Field>
        <Field id="m-ao" label="Accounting officer">
          <TextInput id="m-ao" value={f.accountingOfficer} onChange={(e) => setF({ ...f, accountingOfficer: e.target.value })} />
        </Field>
        <Field id="m-email" label="Contact email">
          <TextInput id="m-email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />
        </Field>
        <Field id="m-app" label="FY2026 appropriation (₦ billions)">
          <TextInput id="m-app" inputMode="decimal" className="h-10 font-mono" value={f.appropriation} onChange={(e) => setF({ ...f, appropriation: e.target.value })} />
        </Field>
        <Field id="m-status" label="Status">
          <select id="m-status" className={SELECT} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Mda['status'] })}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </Field>
      </div>
    </ConfirmDialog>
  )
}

function MdasTab() {
  const ds = useDs()
  const [editing, setEditing] = useState<Mda | null>(null)
  return (
    <>
      <DataTable
        caption="MDA master data"
        rows={ds.mdas}
        rowKey={(m) => m.id}
        onOpen={setEditing}
        minWidth={900}
        empty={{ title: 'No MDAs' }}
        columns={[
          { key: 'code', header: 'Code', cell: (m) => <span className="font-mono text-xs">{m.code}</span> },
          { key: 'name', header: 'Name', sort: (m) => m.name, cell: (m) => <span className="font-medium">{m.name}</span> },
          { key: 'sector', header: 'Sector', cell: (m) => m.sector },
          { key: 'ao', header: 'Accounting officer', cell: (m) => m.accountingOfficer },
          { key: 'app', header: 'Appropriation', align: 'right', sort: (m) => m.appropriation, cell: (m) => <span className="font-mono tabular">{naira(m.appropriation)}</span> },
          { key: 's', header: 'Status', cell: (m) => <StatusPill tone={m.status === 'Active' ? 'ok' : 'neu'} label={m.status} /> },
        ]}
      />
      {editing && <MdaEdit mda={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

// ---- Reference data and integrations ----------------------------------------------------

function IntegrationsTab() {
  const ds = useDs()
  const integrations: [string, string, 'ok' | 'warn' | 'neu' | 'flow', string][] = [
    ['GIFMIS', 'Mock adapter', 'flow', 'Expenditure postings for return pre-fill. Returns fixed sample data with simulated latency.'],
    ['TSA bank statements', 'Mock adapter', 'flow', 'Statement lines for reconciliation matching. Sample statements per MDA and period.'],
    ['Identity provider (SSO / MFA)', 'Prototype', 'flow', 'Demo password and simulated authenticator. Production delegates to the government IdP.'],
    ['OCDS procurement feed', 'Not connected', 'neu', 'Planned for contract and milestone data (FRD §13).'],
  ]
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <Panel title="Integrations">
        <ul className="grid gap-3">
          {integrations.map(([name, status, tone, note]) => (
            <li key={name} className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium">{name}</div>
                <div className="text-xs text-muted">{note}</div>
              </div>
              <StatusPill tone={tone} label={status} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Economic codes" aside={`${ds.economicCodes.length} codes`}>
        <ul className="grid gap-1.5 text-[13px]">
          {ds.economicCodes.map((e) => (
            <li key={e.code} className="flex justify-between gap-3">
              <span>
                <span className="font-mono text-xs text-muted">{e.code}</span> {e.label}
              </span>
              <span className="text-xs text-muted">{e.category}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Vendors" aside={`${ds.vendors.length} vendors`}>
        <ul className="grid gap-1.5 text-[13px]">
          {ds.vendors.map((v) => (
            <li key={v.id} className="flex justify-between gap-3">
              <span>{v.name}</span>
              <span className="font-mono text-xs text-muted">{v.tin}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Projects" aside={`${ds.projects.length} projects`}>
        <ul className="grid gap-1.5 text-[13px]">
          {ds.projects.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>
                <span className="font-mono text-xs text-muted">{p.id}</span> {p.name}
              </span>
              <span className="font-mono text-xs text-muted">{naira(p.contractValue)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export function Admin() {
  const { tab = 'users' } = useParams()
  const navigate = useNavigate()
  const me = useMe()!
  const current = (TABS.some((t) => t.id === tab) ? tab : 'users') as Tab
  const pending = useDs().users.filter((u) => u.status === 'Pending').length
  return (
    <>
      <PageHeader eyebrow="System administration" title="Administration" />
      {!can(me, 'admin.config') && <p className="text-[13px] text-muted">Some settings are read-only for your role.</p>}
      <Panel bodyClassName="">
        <Tabs label="Administration" value={current} onChange={(t) => navigate(`/admin/${t}`)} tabs={TABS.map((t) => (t.id === 'users' ? { ...t, count: pending || undefined } : t))} />
        {current === 'users' && <UsersTab />}
        {current === 'roles' && <RolesTab />}
        {current === 'thresholds' && <ThresholdsTab />}
        {current === 'security' && <SecurityTab />}
        {current === 'periods' && <PeriodsTab />}
        {current === 'mdas' && <MdasTab />}
        {current === 'integrations' && <IntegrationsTab />}
      </Panel>
    </>
  )
}
