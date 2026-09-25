import { ArrowLeft, Link2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { returnTotal } from '../../domain/metrics'
import { naira, nairaExact } from '../../domain/money'
import { parseMoney, RETURN_NEXT, type ReturnAction } from '../../domain/returns'
import { can, inScope } from '../../domain/roles'
import { svcReturnAction } from '../../domain/services'
import type { ExpenditureReturn, User } from '../../domain/types'
import { store, useDs, useMe, userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Facts } from '../../ui/Facts'
import { EmptyState, Panel } from '../../ui/Panel'
import { StatusPill } from '../../ui/Pill'
import { useToast } from '../../ui/toast'
import { RETURN_TONE } from '../../ui/tone'
import { Banner } from '../../workflow/CaseBits'
import { CaseThread } from '../../workflow/CaseThread'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { StatusHistory } from '../../workflow/StatusHistory'
import { Stepper } from '../shared/Stepper'
import { ReturnEditor } from './ReturnEditor'
import { TransactionTable, VendorTable, VersionsTable } from './ReturnParts'

type Pending = { action: 'SUPERVISOR_RETURN' | 'RETURN' | 'CORRECT'; title: string; confirm: string } | null

function Actions({ ret, me }: { ret: ExpenditureReturn; me: User }) {
  const toast = useToast()
  const [pending, setPending] = useState<Pending>(null)
  const act = (action: ReturnAction, title: string) => {
    const r = store.run((d, u, now) => svcReturnAction(d, u, ret.id, action, now))
    if (!r.ok) {
      toast('error', 'Action not allowed', r.error)
      return r.error
    }
    toast('success', title)
    return null
  }
  const inMda = me.mdaId === ret.mdaId
  const buttons: ReactNode[] = []
  let message = RETURN_NEXT[ret.status]

  if (ret.status === 'Submitted' && can(me, 'return.approve') && inMda) {
    if (ret.submittedBy === me.id) message = 'You submitted this return, so another supervisor must approve it.'
    else {
      message = 'Check the lines and evidence, then approve it for oversight review or return it to the officer.'
      buttons.push(
        <Button key="a" variant="primary" onClick={() => act({ type: 'SUPERVISOR_APPROVE' }, 'Approved and sent for oversight review')}>
          Approve for oversight
        </Button>,
        <Button key="r" onClick={() => setPending({ action: 'SUPERVISOR_RETURN', title: 'Return to the officer', confirm: 'Return' })}>
          Return to officer…
        </Button>,
      )
    }
  }
  if (ret.status === 'Under Review' && can(me, 'return.review')) {
    message = 'Accept the return into the ledger, or return it to the MDA with the reason.'
    buttons.push(
      <Button key="acc" variant="primary" onClick={() => act({ type: 'ACCEPT' }, 'Return accepted')}>
        Accept return
      </Button>,
      <Button key="ret" onClick={() => setPending({ action: 'RETURN', title: 'Return to the MDA', confirm: 'Return to MDA' })}>
        Return to MDA…
      </Button>,
    )
  }
  if (ret.status === 'Accepted' && can(me, 'return.review'))
    buttons.push(
      <Button key="close" onClick={() => act({ type: 'CLOSE' }, 'Return closed')}>
        Close return
      </Button>,
    )
  if ((ret.status === 'Accepted' || ret.status === 'Closed') && can(me, 'return.prepare') && inMda)
    buttons.push(
      <Button key="corr" onClick={() => setPending({ action: 'CORRECT', title: 'Open a correction', confirm: 'Open correction' })}>
        Request correction…
      </Button>,
    )
  if ((ret.status === 'Draft' || ret.status === 'Returned') && !(can(me, 'return.prepare') && inMda)) message = `${RETURN_NEXT[ret.status]}. Only officers of this MDA can edit it.`

  return (
    <>
      <Banner tone={ret.status === 'Returned' ? 'warn' : ret.status === 'Accepted' || ret.status === 'Closed' ? 'ok' : 'flow'} title={`${ret.status} · ${message}`}>
        {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
      </Banner>
      {pending && (
        <ConfirmDialog
          title={pending.title}
          eyebrow={ret.id}
          confirmLabel={pending.confirm}
          danger={pending.action !== 'CORRECT'}
          onClose={() => setPending(null)}
          onConfirm={(reason) =>
            pending.action === 'CORRECT'
              ? act({ type: 'CORRECT', reason }, 'Correction opened as a new version')
              : act({ type: pending.action, note: reason }, 'Returned with your reason')
          }
        >
          {pending.action === 'CORRECT' && (
            <p className="text-[13px] text-ink-2">
              The accepted version is preserved. A new draft version opens, and the correction is linked to the original submission in the audit ledger (BR-007).
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}

export function ReturnPage() {
  const { returnId } = useParams()
  const ds = useDs()
  const me = useMe()!
  const toast = useToast()
  const navigate = useNavigate()
  const ret = ds.returns.find((r) => r.id === returnId)
  if (!ret || !inScope(me, ret.mdaId))
    return <EmptyState title="Return not found" body="It may be outside your data scope, or the link is out of date." action={<Link to="/returns" className="text-accent hover:underline">Back to returns</Link>} />

  const mda = ds.mdas.find((m) => m.id === ret.mdaId)!
  const period = ds.periods.find((p) => p.id === ret.periodId)!
  const editable = (ret.status === 'Draft' || ret.status === 'Returned') && can(me, 'return.prepare') && me.mdaId === ret.mdaId
  const events = ds.audit.filter((e) => e.entityId === ret.id)
  const tsa = parseMoney(ret.tsaClosingBalance)

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <button type="button" onClick={() => navigate('/returns')} className="inline-flex h-[34px] cursor-pointer items-center gap-1 rounded-md border border-line-2 bg-surface pr-3 pl-2 text-[13px] font-medium hover:bg-sunk">
          <ArrowLeft size={15} aria-hidden /> Returns
        </button>
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">
            {mda.name} · {ret.id}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{period.label} expenditure return</h1>
            <StatusPill tone={RETURN_TONE[ret.status]} label={ret.status} />
            <span className="font-mono text-xs text-muted">v{ret.version}</span>
          </div>
        </div>
      </div>

      <Stepper
        steps={['Draft', 'Submitted', 'Under Review', 'Accepted', 'Closed']}
        current={ret.status}
        branch={ret.status === 'Returned' ? { at: 'Accepted', label: 'Returned', tone: 'warn' } : undefined}
      />

      <Actions ret={ret} me={me} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {editable ? (
            <ReturnEditor key={`${ret.id}-${ret.version}-${ret.status}`} ret={ret} me={me} />
          ) : (
            <>
              <Panel title="Summary">
                <Facts
                  cols={4}
                  items={[
                    ['MDA', mda.acronym],
                    ['Period', period.label],
                    ['Lines', String(ret.transactions.length)],
                    ['Total', naira(returnTotal(ret)), true],
                    ['Submitted by', userName(ds, ret.submittedBy)],
                    ['Submitted', ret.submittedAt ? dateTime(ret.submittedAt) : '—', true],
                    ['TSA closing balance', Number.isFinite(tsa) ? nairaExact(tsa) : '—', true],
                    ['Version', `v${ret.version}`, true],
                  ]}
                />
              </Panel>
              <Panel title="Transactions" aside={`${ret.transactions.length} vendor-level lines`} bodyClassName="">
                <TransactionTable ds={ds} txns={ret.transactions} />
              </Panel>
              <Panel title="Vendors" bodyClassName="">
                <VendorTable ds={ds} txns={ret.transactions} />
              </Panel>
              <Panel title="Evidence">
                <div className="flex flex-col gap-2">
                  {ret.evidence.length === 0 && <p className="text-[13px] text-muted">No evidence attached yet.</p>}
                  {['tsa_statement', 'vouchers', 'other'].map((slot) => {
                    const files = ret.evidence.filter((e) => e.slotId === slot)
                    if (!files.length) return null
                    const label = slot === 'tsa_statement' ? 'TSA sub-account statement' : slot === 'vouchers' ? 'Payment vouchers' : 'Other supporting documents'
                    return <EvidenceSlot key={slot} slot={{ id: slot, label, help: '' }} files={files} required={slot === 'tsa_statement'} editable={false} userId="" />
                  })}
                </div>
              </Panel>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Versions" aside="Preserved on correction">
            <VersionsTable ds={ds} ret={ret} />
          </Panel>
          <Panel title="Thread" aside={`${ret.comments.length}`}>
            <CaseThread
              flag={ret}
              users={ds.users}
              canPost={can(me, 'return.view') && me.role !== 'auditor'}
              onPost={(body) => {
                const r = store.run((d, u, now) => svcReturnAction(d, u, ret.id, { type: 'COMMENT', body }, now))
                if (!r.ok) toast('error', 'Not posted', r.error)
                return r.ok
              }}
            />
          </Panel>
          <Panel title="Audit trail" aside={can(me, 'audit.view') ? <Link to={`/audit?entity=${ret.id}`} className="text-accent hover:underline">Open in ledger →</Link> : undefined}>
            <StatusHistory
              entries={events.slice(1).map((e) => ({
                id: e.id,
                at: e.at,
                actorId: e.actorId,
                label: e.action.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
                note: `${e.summary}${e.correctsEventId ? ` (corrects ${e.correctsEventId})` : ''}`,
                tone: e.action === 'RETURN_ACCEPTED' ? 'good' : e.action === 'RETURN_RETURNED' ? 'bad' : undefined,
              }))}
              origin={{ label: 'Draft created', at: events[0]?.at ?? ret.createdAt, actorId: ret.createdBy }}
              users={ds.users}
            />
            {events.some((e) => e.correctsEventId) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Link2 size={12} aria-hidden /> Corrections are linked to the event they correct; nothing is overwritten.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
