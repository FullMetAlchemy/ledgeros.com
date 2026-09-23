import type { VendorData } from '../../../domain/submissions/types'
import { Facts } from '../../../ui/Facts'
import { Field, TextArea, TextInput } from '../../../ui/Field'
import type { DetailsProps, ViewProps } from './types'

const LOOKUPS: VendorData['failedLookup'][] = ['BPP registry', 'CAC', 'FIRS TIN']

export function VendorScope() {
  return (
    <p className="max-w-[70ch] text-[13.5px] text-ink-2">
      Vendors are normally verified automatically against the BPP registry, CAC and FIRS. Use this form only when one of those lookups fails. The TIN is checked against every vendor already in the registry.
    </p>
  )
}

export function VendorDetails({ data, update, error }: DetailsProps<VendorData>) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Field id="vendorName" label="Registered name" error={error('vendorName')}>
        <TextInput id="vendorName" value={data.vendorName} invalid={!!error('vendorName')} onChange={(e) => update({ vendorName: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rcNumber" label="CAC registration number" help="Format: RC 1234567" error={error('rcNumber')}>
          <TextInput id="rcNumber" className="font-mono" value={data.rcNumber} invalid={!!error('rcNumber')} onChange={(e) => update({ rcNumber: e.target.value })} />
        </Field>
        <Field id="tin" label="Tax identification number" help="Format: 12345678-0001" error={error('tin')}>
          <TextInput id="tin" className="font-mono" value={data.tin} invalid={!!error('tin')} onChange={(e) => update({ tin: e.target.value })} />
        </Field>
      </div>
      <Field id="failedLookup" label="Which lookup failed?" error={error('failedLookup')}>
        <select
          id="failedLookup"
          value={data.failedLookup}
          onChange={(e) => update({ failedLookup: e.target.value as VendorData['failedLookup'] })}
          className={`h-10 max-w-xs rounded-md border bg-surface px-2.5 text-sm ${error('failedLookup') ? 'border-crit-bd' : 'border-line-2'}`}
        >
          <option value="">Choose…</option>
          {LOOKUPS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field id="reason" label="Why did the lookup fail?" error={error('reason')}>
        <TextArea id="reason" className="min-h-24" value={data.reason} invalid={!!error('reason')} onChange={(e) => update({ reason: e.target.value })} />
      </Field>
    </div>
  )
}

export function VendorView({ data }: ViewProps<VendorData>) {
  return (
    <div className="flex flex-col gap-4">
      <Facts
        items={[
          ['Vendor', data.vendorName || '—'],
          ['RC number', data.rcNumber || '—', true],
          ['TIN', data.tin || '—', true],
          ['Failed lookup', data.failedLookup || '—'],
        ]}
        cols={4}
      />
      <div>
        <div className="text-xs text-muted">Reason</div>
        <p className="mt-0.5 max-w-[70ch] text-[13.5px] whitespace-pre-wrap">{data.reason || '—'}</p>
      </div>
    </div>
  )
}

