import { Link } from 'react-router'
import { useMe } from '../../../state/store'
import { nairaExact } from '../../../domain/money'
import { parseAmount } from '../../../domain/submissions/defs'
import { RETIREMENT_WINDOW_DAYS } from '../../../domain/submissions/validation'
import type { RetirementData, RetirementItem } from '../../../domain/submissions/types'
import { Button } from '../../../ui/Button'
import { Facts } from '../../../ui/Facts'
import { Field, TextInput } from '../../../ui/Field'
import type { DetailsProps, ViewProps } from './types'

const age = (iso: string) => Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)

function Totals({ data }: { data: RetirementData }) {
  const spent = data.items.reduce((a, i) => a + (parseAmount(i.amount) || 0), 0)
  const remitted = parseAmount(data.remitted) || 0
  const diff = spent + remitted - data.advanceAmount
  return (
    <dl className="grid gap-3 rounded-md border border-line px-4 py-3 text-[13px] sm:grid-cols-4" data-field="totals">
      {[
        ['Spent', nairaExact(spent), ''],
        ['Remitted to TSA', nairaExact(remitted), ''],
        ['Advance', nairaExact(data.advanceAmount), ''],
        ['Unaccounted', diff === 0 ? '₦0 · balanced' : nairaExact(-diff), diff === 0 ? 'text-ok-fg' : 'text-warn-fg'],
      ].map(([k, v, c]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className={`font-mono font-semibold tabular ${c}`}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RetirementScope({ data }: ViewProps<RetirementData>) {
  const me = useMe()
  const flagBase = me?.mdaId ? '/flags' : '/oversight/flags'
  const days = age(data.disbursedOn)
  return (
    <div className="flex flex-col gap-3">
      <Facts
        source="the advances register"
        items={[
          ['Advance', data.advanceRef, true],
          ['Holder', data.holder],
          ['Amount', nairaExact(data.advanceAmount), true],
          ['Disbursed', `${new Date(`${data.disbursedOn}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${days} days ago`],
          ['Purpose', data.purpose],
          [
            'Linked flag',
            data.linkedFlagId ? (
              <Link key="flag" className="font-mono text-accent hover:underline" to={`${flagBase}/${data.linkedFlagId}`}>
                {data.linkedFlagId}
              </Link>
            ) : (
              '—'
            ),
          ],
        ]}
      />
      {days > RETIREMENT_WINDOW_DAYS && (
        <p className="rounded-md border border-warn-bd bg-warn-bg px-3.5 py-2 text-[13px] text-warn-fg">
          This advance is past the {RETIREMENT_WINDOW_DAYS}-day retirement window. You will be asked to explain the delay.
        </p>
      )}
    </div>
  )
}

export function RetirementDetails({ data, update, error }: DetailsProps<RetirementData>) {
  const setItem = (id: string, patch: Partial<RetirementItem>) => update({ items: data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const addItem = () => update({ items: [...data.items, { id: `i${Date.now().toString(36)}`, description: '', amount: '', receiptRef: '' }] })
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2" data-field="items">
        <h3 className="text-sm font-semibold">What the advance was spent on</h3>
        <div className="flex flex-col gap-2">
          {data.items.map((it, n) => (
            <div key={it.id} data-field={`item:${it.id}`} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,1fr)_180px_150px_auto] sm:items-end">
              <Field id={`desc-${it.id}`} label={`Line ${n + 1}: description`}>
                <TextInput id={`desc-${it.id}`} value={it.description} invalid={!!error(`item:${it.id}`)} onChange={(e) => setItem(it.id, { description: e.target.value })} />
              </Field>
              <Field id={`amt-${it.id}`} label="Amount (₦)">
                <TextInput id={`amt-${it.id}`} inputMode="decimal" className="font-mono" value={it.amount} invalid={!!error(`item:${it.id}`)} onChange={(e) => setItem(it.id, { amount: e.target.value })} />
              </Field>
              <Field id={`rcpt-${it.id}`} label="Receipt ref">
                <TextInput id={`rcpt-${it.id}`} className="font-mono" value={it.receiptRef} onChange={(e) => setItem(it.id, { receiptRef: e.target.value })} />
              </Field>
              <Button size="sm" variant="ghost" disabled={data.items.length === 1} onClick={() => update({ items: data.items.filter((x) => x.id !== it.id) })}>
                Remove
              </Button>
              {error(`item:${it.id}`) && <p className="text-xs font-medium text-crit-fg sm:col-span-4">{error(`item:${it.id}`)}</p>}
            </div>
          ))}
        </div>
        <div>
          <Button size="sm" onClick={addItem}>
            + Add line
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field id="remitted" label="Unspent cash remitted to the TSA (₦)" help="Enter 0 if everything was spent." error={error('remitted')}>
          <TextInput id="remitted" inputMode="decimal" className="font-mono" value={data.remitted} invalid={!!error('remitted')} onChange={(e) => update({ remitted: e.target.value })} />
        </Field>
        <Field id="remittanceRef" label="TSA remittance reference" help="Required when cash was remitted." error={error('remittanceRef')}>
          <TextInput id="remittanceRef" className="font-mono" value={data.remittanceRef} invalid={!!error('remittanceRef')} onChange={(e) => update({ remittanceRef: e.target.value })} />
        </Field>
      </section>

      <Totals data={data} />
      {error('totals') && <p className="-mt-3 text-xs font-medium text-crit-fg">{error('totals')}</p>}
    </div>
  )
}

export function RetirementView({ data }: ViewProps<RetirementData>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="bg-sunk text-left">
              {['Spent on', 'Receipt', 'Amount'].map((h) => (
                <th key={h} className={`px-3.5 py-2 text-[11px] font-semibold tracking-wider text-muted uppercase ${h === 'Amount' ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="px-3.5 py-2">{i.description || '—'}</td>
                <td className="px-3.5 py-2 font-mono text-xs">{i.receiptRef || '—'}</td>
                <td className="px-3.5 py-2 text-right font-mono tabular">{nairaExact(parseAmount(i.amount) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.remittanceRef && (
        <p className="text-[13px] text-ink-2">
          Remittance reference: <span className="font-mono font-medium text-ink">{data.remittanceRef}</span>
        </p>
      )}
      <Totals data={data} />
    </div>
  )
}

