import { type ReactNode } from 'react'
import type { FlagStatus, RecStatus, ReturnStatus, UserStatus } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Field, TextArea, TextInput } from '../../ui/Field'
import { PageHeader, Panel } from '../../ui/Panel'
import { DueChip, RiskBadge, SeverityBadge, StatusPill } from '../../ui/Pill'
import { FLAG_TONE, REC_TONE, RETURN_TONE, USER_TONE } from '../../ui/tone'
import { ValidationSummary, type SummaryIssue } from '../../ui/ValidationSummary'
import { Stepper } from '../shared/Stepper'

const SAMPLE_ISSUES: SummaryIssue[] = [
  { id: 'a', tier: 'blocking', message: 'Attach the TSA bank statement for the period.', where: 'Evidence' },
  { id: 'b', tier: 'blocking', message: 'Row 4: vendor TIN must look like 12345678-0001.', where: 'Transactions' },
  { id: 'c', tier: 'warning', message: 'Two payments to Geotech Survey Limited for the same amount in this period.', where: 'Vendors' },
]

const RETURN_STATUSES: ReturnStatus[] = ['Draft', 'Submitted', 'Under Review', 'Returned', 'Accepted', 'Closed']
const FLAG_STATUSES: FlagStatus[] = ['Detected', 'Open', 'Assigned', 'MDA Response', 'Under Review', 'Resolved', 'Rejected', 'Escalated', 'Closed']
const REC_STATUSES: RecStatus[] = ['Open', 'In Progress', 'Matched', 'Variance', 'Reviewed', 'Closed']
const USER_STATUSES: UserStatus[] = ['Pending', 'Active', 'Suspended', 'Disabled']

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-3 border-b border-line py-3 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="text-[13px] font-medium text-ink-2">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const inDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString()

/** Living reference for the status scales and shared components, in the current theme. */
export function DesignSystem() {
  return (
    <>
      <PageHeader eyebrow="Foundations" title="Design system">
        <span className="text-xs text-muted">Use the sun/moon toggle in the header to check both palettes</span>
      </PageHeader>

      <Panel title="Status scales" aside="Never merged. Colour is never the only signal.">
        <Row label="MDA risk rating">
          <RiskBadge rating="High Risk" />
          <RiskBadge rating="Warning" />
          <RiskBadge rating="Clear" />
        </Row>
        <Row label="Flag severity">
          <SeverityBadge severity="Critical" />
          <SeverityBadge severity="High" />
          <SeverityBadge severity="Medium" />
          <SeverityBadge severity="Low" />
        </Row>
        <Row label="Return status">
          {RETURN_STATUSES.map((s) => (
            <StatusPill key={s} tone={RETURN_TONE[s]} label={s} />
          ))}
        </Row>
        <Row label="Flag status">
          {FLAG_STATUSES.map((s) => (
            <StatusPill key={s} tone={FLAG_TONE[s]} label={s} />
          ))}
        </Row>
        <Row label="Reconciliation status">
          {REC_STATUSES.map((s) => (
            <StatusPill key={s} tone={REC_TONE[s]} label={s} />
          ))}
        </Row>
        <Row label="User status">
          {USER_STATUSES.map((s) => (
            <StatusPill key={s} tone={USER_TONE[s]} label={s} />
          ))}
        </Row>
        <Row label="Response deadline">
          <DueChip due={inDays(-3)} />
          <DueChip due={inDays(1)} />
          <DueChip due={inDays(12)} />
          <DueChip due={inDays(4)} open={false} closedLabel="Closed" />
        </Row>
      </Panel>

      <Panel title="Workflow stepper">
        <div className="grid gap-3">
          <Stepper steps={['Draft', 'Submitted', 'Under Review', 'Accepted', 'Closed']} current="Under Review" />
          <Stepper steps={['Draft', 'Submitted', 'Under Review', 'Accepted', 'Closed']} current="Returned" branch={{ at: 'Accepted', label: 'Returned', tone: 'warn' }} />
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary action</Button>
          <Button>Secondary</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="ghost">Ghost link</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
        </div>
      </Panel>

      <Panel title="Form fields">
        <div className="grid max-w-3xl gap-5">
          <Field id="ds-ref" label="Payment reference" help="Voucher reference as it appears on the TSA statement, e.g. PV-3830.">
            <TextInput id="ds-ref" className="max-w-xs font-mono" placeholder="PV-3830" />
          </Field>
          <Field id="ds-err" label="Explanation" counter="10 / 40 min" error="Write at least 40 characters (currently 10).">
            <TextArea id="ds-err" invalid defaultValue="Too short." />
          </Field>
        </div>
      </Panel>

      <Panel title="Validation: two tiers">
        <ValidationSummary issues={SAMPLE_ISSUES} />
      </Panel>
    </>
  )
}
