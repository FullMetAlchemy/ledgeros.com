import { useState, type ReactNode } from 'react'
import { buildFlags, buildUsers } from '../../domain/seed'
import type { Issue } from '../../domain/validation'
import { Button } from '../../ui/Button'
import { Field, TextArea, TextInput, YesNo } from '../../ui/Field'
import { PageHeader, Panel } from '../../ui/Panel'
import { DeadlineChip, FlagStatePill, RatingPill, SeverityTag, StatusPill } from '../../ui/Pill'
import { ValidationSummary } from '../../ui/ValidationSummary'
import { SignOffRail } from '../../workflow/SignOffRail'
import { flagRail } from '../flags/flagViews'

const SAMPLE_ISSUES: Issue[] = [
  { id: 'a', tier: 'blocking', step: 2, field: 'x', message: 'Attach: Approved procurement plan.' },
  { id: 'b', tier: 'justification', step: 3, field: 'y', message: '2 awards to this vendor within 48h, each within 2% of ₦250M.', satisfied: false },
  { id: 'c', tier: 'advisory', step: 1, field: 'z', message: 'Mention PV-4029 in your explanation so reviewers can trace it.' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-line py-3 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="text-[13px] font-medium text-ink-2">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Living reference for the four status scales and shared components, in the current theme. */
export function DesignSystem() {
  const [yn, setYn] = useState<'yes' | 'no' | undefined>()
  const [{ users, flags }] = useState(() => {
    const users = buildUsers()
    return { users, flags: buildFlags(new Date(), users) }
  })
  const f = (id: string) => flags.find((x) => x.id === id)!

  return (
    <>
      <PageHeader eyebrow="Foundations" title="Design system">
        <span className="text-xs text-muted">Use the sun/moon toggle in the header to check both palettes</span>
      </PageHeader>

      <Panel title="Four status scales" aside="Never merged. Colour is never the only signal.">
        <Row label="Entity rating">
          <RatingPill rating="High Risk" />
          <RatingPill rating="Warning" />
          <RatingPill rating="Clear" />
        </Row>
        <Row label="Flag severity">
          <SeverityTag severity="Critical" />
          <SeverityTag severity="High" />
          <SeverityTag severity="Medium" />
          <SeverityTag severity="Low" />
        </Row>
        <Row label="Workflow status">
          <StatusPill tone="neu" label="Drafting" />
          <StatusPill tone="flow" label="Returned" />
          <StatusPill tone="flow" label="Review pending" />
          <StatusPill tone="flow" label="With oversight" />
          <StatusPill tone="ok" label="Accepted" />
          <StatusPill tone="crit" label="Escalated" />
        </Row>
        <Row label="Deadline (live seed flags)">
          <DeadlineChip flag={f('FLG-0102-014')} />
          <DeadlineChip flag={f('FLG-0231-009')} />
          <DeadlineChip flag={f('FLG-0880-005')} />
          <DeadlineChip flag={f('FLG-0120-003')} />
        </Row>
        <Row label="Flag state (derived)">
          {['FLG-0231-009', 'FLG-0231-004', 'FLG-0231-008', 'FLG-0344-003', 'FLG-0231-006', 'FLG-0120-003'].map((id) => (
            <FlagStatePill key={id} flag={f(id)} />
          ))}
        </Row>
      </Panel>

      <Panel title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary action</Button>
          <Button>Secondary</Button>
          <Button variant="danger">Reject and escalate</Button>
          <Button variant="ghost">Ghost link</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
        </div>
      </Panel>

      <Panel title="Form fields">
        <div className="grid max-w-3xl gap-5">
          <Field id="ds-ref" label="Corrective record reference" help="Reversal voucher, recovery receipt or TSA remittance reference.">
            <TextInput id="ds-ref" className="max-w-xs font-mono" placeholder="RET-0231-0712" />
          </Field>
          <Field id="ds-err" label="Explanation" counter="12 / 80 min" error="Write at least 80 characters in the explanation (currently 12).">
            <TextArea id="ds-err" invalid defaultValue="Too short." />
          </Field>
          <YesNo id="ds-yn" label="Was this spend profile in the approved procurement plan?" value={yn} onChange={setYn} />
        </div>
      </Panel>

      <Panel title="Validation: three tiers">
        <ValidationSummary issues={SAMPLE_ISSUES} />
      </Panel>

      <Panel title="Sign-off rail" aside="Critical/High: 4 steps · Medium/Low: 2 steps">
        <div className="flex flex-col gap-3">
          <SignOffRail {...flagRail(f('FLG-0231-006'))} users={users} />
          <SignOffRail {...flagRail(f('FLG-0344-003'))} users={users} />
          <SignOffRail {...flagRail(f('FLG-0120-003'))} users={users} />
        </div>
      </Panel>
    </>
  )
}
