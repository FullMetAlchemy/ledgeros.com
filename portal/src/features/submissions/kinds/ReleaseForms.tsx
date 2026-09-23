import { naira, nairaExact, pct } from '../../../domain/money'
import { parseAmount } from '../../../domain/submissions/defs'
import type { ReleaseData } from '../../../domain/submissions/types'
import { Facts } from '../../../ui/Facts'
import { Field, TextArea, TextInput } from '../../../ui/Field'
import type { DetailsProps, ViewProps } from './types'

export function ReleaseScope({ data }: ViewProps<ReleaseData>) {
  const s = data.snapshot
  return (
    <div className="flex flex-col gap-3">
      <Facts
        source="the ledger at the time of the request"
        items={[
          ['Vote', data.vote],
          ['Appropriated', naira(s.appropriated), true],
          ['Released so far', `${naira(s.released)} (${pct(s.released, s.appropriated, 0)})`, true],
          ['Unreleased headroom', naira(s.appropriated - s.released), true],
          ['Absorption of release', pct(s.utilized, s.released), true],
          ['Open flags', `${s.openFlags} (${s.openCriticalHigh} Critical/High)`],
        ]}
      />
      <p className="rounded-md border border-flow-bd bg-flow-bg px-3.5 py-2 text-[13px] text-ink-2">
        Treasury sees these figures and your open flags alongside the request. Resolving flags before requesting a release makes approval quicker.
      </p>
    </div>
  )
}

export function ReleaseDetails({ data, update, error }: DetailsProps<ReleaseData>) {
  const amt = parseAmount(data.amount)
  const headroom = data.snapshot.appropriated - data.snapshot.released
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Field
        id="amount"
        label="Amount requested (₦)"
        help={`Up to ${nairaExact(headroom)} of unreleased appropriation.`}
        counter={amt > 0 ? naira(amt) : undefined}
        error={error('amount')}
      >
        <TextInput id="amount" inputMode="decimal" className="max-w-xs font-mono" value={data.amount} invalid={!!error('amount')} onChange={(e) => update({ amount: e.target.value })} />
      </Field>
      <Field id="purpose" label="Purpose" help="What the release will achieve this quarter." error={error('purpose')}>
        <TextArea id="purpose" className="min-h-24" value={data.purpose} invalid={!!error('purpose')} onChange={(e) => update({ purpose: e.target.value })} />
      </Field>
      <Field id="obligations" label="Obligations being funded" help="Contract numbers and milestones, one per line." error={error('obligations')}>
        <TextArea id="obligations" className="min-h-20" value={data.obligations} invalid={!!error('obligations')} onChange={(e) => update({ obligations: e.target.value })} />
      </Field>
    </div>
  )
}

export function ReleaseView({ data }: ViewProps<ReleaseData>) {
  return (
    <div className="flex flex-col gap-4">
      <Facts items={[['Amount requested', nairaExact(parseAmount(data.amount) || 0), true], ['Vote', data.vote]]} cols={2} />
      <div>
        <div className="text-xs text-muted">Purpose</div>
        <p className="mt-0.5 max-w-[70ch] text-[13.5px] whitespace-pre-wrap">{data.purpose || '—'}</p>
      </div>
      <div>
        <div className="text-xs text-muted">Obligations being funded</div>
        <p className="mt-0.5 max-w-[70ch] text-[13.5px] whitespace-pre-wrap">{data.obligations || '—'}</p>
      </div>
    </div>
  )
}

