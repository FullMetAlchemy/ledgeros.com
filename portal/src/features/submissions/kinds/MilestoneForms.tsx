import { shortDate } from '../../../domain/calendar'
import { naira } from '../../../domain/money'
import type { MilestoneData } from '../../../domain/submissions/types'
import { Facts } from '../../../ui/Facts'
import { Field, TextInput } from '../../../ui/Field'
import type { DetailsProps, ViewProps } from './types'

function Vouchers({ data }: { data: MilestoneData }) {
  const cert = data.certDate ? new Date(`${data.certDate}T12:00:00`) : null
  if (!data.vouchers.length) return <p className="text-[13px] text-muted">No payments have been made against this milestone yet.</p>
  return (
    <ul className="divide-y divide-line rounded-md border border-line text-[13px]">
      {data.vouchers.map((v) => {
        const early = cert && new Date(`${v.date}T12:00:00`) < cert
        return (
          <li key={v.ref} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2">
            <span className="font-mono font-semibold">{v.ref}</span>
            <span className="text-ink-2">paid {shortDate(`${v.date}T12:00:00`)}</span>
            <span className="ml-auto font-mono tabular">{naira(v.amount)}</span>
            {early && <span className="w-full text-xs font-semibold text-warn-fg">Paid before the certificate date. You will be asked to explain.</span>}
          </li>
        )
      })}
    </ul>
  )
}

export function MilestoneScope({ data }: ViewProps<MilestoneData>) {
  return (
    <div className="flex flex-col gap-3">
      <Facts
        source="the contracts register and GIFMIS"
        items={[
          ['Contract', data.contractRef, true],
          ['Title', data.contractTitle],
          ['Contractor', data.contractor],
          ['Milestone', `${data.milestoneNo}. ${data.milestoneTitle}`],
          ['Milestone value', naira(data.milestoneValue), true],
        ]}
      />
      <div>
        <div className="mb-1.5 text-xs text-muted">Payments against this milestone</div>
        <Vouchers data={data} />
      </div>
    </div>
  )
}

export function MilestoneDetails({ data, update, error }: DetailsProps<MilestoneData>) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="certDate" label="Date the certificate was signed" error={error('certDate')}>
          <TextInput id="certDate" type="date" value={data.certDate} invalid={!!error('certDate')} onChange={(e) => update({ certDate: e.target.value })} />
        </Field>
        <Field id="percentComplete" label="Percent complete" help="As measured on site or at delivery." error={error('percentComplete')}>
          <TextInput id="percentComplete" inputMode="numeric" className="max-w-32 font-mono" value={data.percentComplete} invalid={!!error('percentComplete')} onChange={(e) => update({ percentComplete: e.target.value })} />
        </Field>
      </div>
      <Field id="engineer" label="Certifying engineer or receiving officer" help="Name and role, as on the certificate." error={error('engineer')}>
        <TextInput id="engineer" value={data.engineer} invalid={!!error('engineer')} onChange={(e) => update({ engineer: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 text-xs text-muted">Payments against this milestone, checked against your certificate date</div>
        <Vouchers data={data} />
      </div>
    </div>
  )
}

export function MilestoneView({ data }: ViewProps<MilestoneData>) {
  return (
    <Facts
      items={[
        ['Certificate signed', data.certDate ? shortDate(`${data.certDate}T12:00:00`) : '—'],
        ['Certified by', data.engineer || '—'],
        ['Percent complete', data.percentComplete ? `${data.percentComplete}%` : '—', true],
      ]}
    />
  )
}

