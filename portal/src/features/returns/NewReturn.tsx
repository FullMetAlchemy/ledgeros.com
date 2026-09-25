import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { can } from '../../domain/roles'
import { svcCreateReturn } from '../../domain/services'
import { store, useDs, useMe } from '../../state/store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { PageHeader, Panel } from '../../ui/Panel'
import { useToast } from '../../ui/toast'

/** Start a monthly return for an open period (FR-EXP-001, BR-008). */
export function NewReturn() {
  const ds = useDs()
  const me = useMe()!
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const open = ds.periods.filter((p) => p.status === 'Open')
  const available = open.filter((p) => !ds.returns.some((r) => r.mdaId === me.mdaId && r.periodId === p.id))
  const [periodId, setPeriodId] = useState(params.get('period') && available.some((p) => p.id === params.get('period')) ? params.get('period')! : (available[0]?.id ?? ''))
  const [error, setError] = useState<string | null>(null)

  if (!can(me, 'return.prepare') || !me.mdaId) return <Navigate to="/returns" replace />
  const mda = ds.mdas.find((m) => m.id === me.mdaId)!

  const create = () => {
    const r = store.run((d, u, now) => svcCreateReturn(d, u, mda.id, periodId, now))
    if (!r.ok) return setError(r.error)
    toast('success', 'Draft return created', 'Add transactions manually, import a CSV, or import from mock GIFMIS.')
    navigate(`/returns/${r.value.id}`)
  }

  return (
    <>
      <PageHeader eyebrow={`${mda.name} · Expenditure returns`} title="Start a monthly return" />
      <Panel className="max-w-2xl">
        {available.length === 0 ? (
          <div className="flex flex-col gap-2 text-[13.5px] text-ink-2">
            <p>Every open period already has a return for {mda.acronym}. Closed periods accept changes only through a correction on the existing return.</p>
            <Link to="/returns" className="text-accent hover:underline">
              Back to returns
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field id="period" label="Reporting period" help="Only open periods accept new returns." error={error}>
              <select id="period" value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="h-10 max-w-xs rounded-md border border-line-2 bg-surface px-2.5 text-sm">
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-muted">The return starts as a draft. Nothing is visible to the Ministry until it is submitted and approved by your supervisor.</p>
            <div>
              <Button variant="primary" onClick={create} disabled={!periodId}>
                Create draft return
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </>
  )
}
