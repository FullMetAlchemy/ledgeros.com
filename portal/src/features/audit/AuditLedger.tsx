import { ChevronDown, ChevronRight, Download, Link2, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { verifyChain } from '../../domain/audit'
import { dateTime } from '../../domain/calendar'
import { inScope } from '../../domain/roles'
import { svcExportEvent } from '../../domain/services'
import type { AuditEntity, AuditEvent } from '../../domain/types'
import { store, useDs, useMe, userName } from '../../state/store'
import { Button } from '../../ui/Button'
import { download, toCsv } from '../../ui/csv'
import { EmptyState, PageHeader, Panel } from '../../ui/Panel'
import { useToast } from '../../ui/toast'

const ENTITIES: AuditEntity[] = ['Return', 'Flag', 'Reconciliation', 'Rules', 'User', 'Session', 'Config', 'Period', 'MDA', 'Report']
const ADMIN_ENTITIES: AuditEntity[] = ['User', 'Session', 'Config', 'Period', 'MDA']
const PAGE = 25

function hrefFor(e: AuditEvent): string | null {
  switch (e.entityType) {
    case 'Return':
      return `/returns/${e.entityId}`
    case 'Flag':
      return `/flags/${e.entityId}`
    case 'Reconciliation':
      return `/reconciliation/${e.entityId}`
    case 'MDA':
      return `/mdas/${e.entityId}`
    default:
      return null
  }
}

function Values({ label, v }: { label: string; v?: Record<string, unknown> }) {
  if (!v) return null
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</div>
      <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-[11.5px]">
        {Object.entries(v).map(([k, val]) => (
          <Fragment key={k}>
            <dt className="text-muted">{k}</dt>
            <dd className="break-words text-ink">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

/** Audit ledger search and review (FR-AUD-006, US-012). */
export function AuditLedger() {
  const ds = useDs()
  const me = useMe()!
  const toast = useToast()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('entity') ?? '')
  const [entity, setEntity] = useState<'All' | AuditEntity>('All')
  const [actor, setActor] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [integrity, setIntegrity] = useState<null | { ok: boolean; at?: AuditEvent }>(null)

  // Least privilege: administrators review security and configuration events only.
  const visible = useMemo(
    () => ds.audit.filter((e) => (me.role === 'admin' ? ADMIN_ENTITIES.includes(e.entityType) : !e.mdaId || inScope(me, e.mdaId))),
    [ds.audit, me],
  )
  const actors = [...new Set(visible.map((e) => e.actorId))]
  const rows = visible
    .filter((e) => entity === 'All' || e.entityType === entity)
    .filter((e) => actor === 'All' || e.actorId === actor)
    .filter((e) => !from || e.at.slice(0, 10) >= from)
    .filter((e) => !to || e.at.slice(0, 10) <= to)
    .filter((e) => {
      if (!q.trim()) return true
      const s = q.trim().toLowerCase()
      return [e.id, e.action, e.entityId, e.summary, e.mdaId ?? '', userName(ds, e.actorId)].some((x) => x.toLowerCase().includes(s))
    })
    .reverse()
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)

  const exportCsv = () => {
    const csv = toCsv(
      rows,
      [
        { header: 'Event', value: (e) => e.id },
        { header: 'Time', value: (e) => e.at },
        { header: 'Actor', value: (e) => userName(ds, e.actorId) },
        { header: 'Action', value: (e) => e.action },
        { header: 'Entity', value: (e) => `${e.entityType} ${e.entityId}` },
        { header: 'MDA', value: (e) => e.mdaId },
        { header: 'Summary', value: (e) => e.summary },
        { header: 'Corrects', value: (e) => e.correctsEventId },
        { header: 'Source', value: (e) => e.source },
        { header: 'Checksum', value: (e) => e.hash },
      ],
      'Oversight Ledger OS: audit ledger extract',
    )
    download(`audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    store.record((d, u, now) => svcExportEvent(d, u, 'Audit ledger extract', rows.length, now))
    toast('success', 'Exported', `${rows.length} events. The export itself is recorded in the ledger.`)
  }

  return (
    <>
      <PageHeader eyebrow="Audit ledger · append-only" title="Audit ledger">
        <Button
          onClick={() => {
            const r = verifyChain(ds.audit)
            setIntegrity(r ? { ok: false, at: r.brokenAt } : { ok: true })
          }}
        >
          <ShieldCheck size={14} aria-hidden /> Verify chain
        </Button>
        <Button onClick={exportCsv} disabled={!rows.length}>
          <Download size={14} aria-hidden /> Export CSV
        </Button>
      </PageHeader>

      <p className="-mt-2 max-w-[90ch] text-[13px] text-ink-2">
        Every material action is an event. Events are never edited or deleted; corrections are new events linked to the one they correct. Each event carries a checksum chained to the previous event. This demonstrates the
        WORM model; the prototype store itself is not cryptographically immutable.
      </p>

      {integrity && (
        <div role="status" className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-[13px] ${integrity.ok ? 'border-ok-bd bg-ok-bg text-ok-fg' : 'border-crit-bd bg-crit-bg text-crit-fg'}`}>
          {integrity.ok ? <ShieldCheck size={16} aria-hidden /> : <ShieldX size={16} aria-hidden />}
          {integrity.ok ? `Chain intact: all ${ds.audit.length} events verify against their checksums.` : `Chain broken at ${integrity.at!.id}: the event or its predecessor has been altered.`}
        </div>
      )}

      <Panel bodyClassName="">
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <label className="relative min-w-60 flex-1 sm:max-w-80">
            <span className="sr-only">Search events</span>
            <Search size={15} aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Search reference, action, actor or text"
              className="h-9 w-full rounded-md border border-line-2 bg-surface pr-3 pl-8 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Record type
            <select value={entity} onChange={(e) => { setEntity(e.target.value as 'All' | AuditEntity); setPage(0) }} className="h-9 rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink">
              <option value="All">All</option>
              {(me.role === 'admin' ? ADMIN_ENTITIES : ENTITIES).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Actor
            <select value={actor} onChange={(e) => { setActor(e.target.value); setPage(0) }} className="h-9 max-w-52 rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink">
              <option value="All">All</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {userName(ds, a)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            From
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} className="h-9 rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            To
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} className="h-9 rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink" />
          </label>
          <span className="ml-auto self-center font-mono text-xs text-muted">{rows.length} events</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No events match" body="Try a broader search or date range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-sunk text-left text-[11px] tracking-wider text-muted uppercase">
                  <th className="w-8 px-2 py-2.5" />
                  <th className="px-3 py-2.5 font-semibold">Event</th>
                  <th className="px-3 py-2.5 font-semibold">Time</th>
                  <th className="px-3 py-2.5 font-semibold">Actor</th>
                  <th className="px-3 py-2.5 font-semibold">Action</th>
                  <th className="px-3 py-2.5 font-semibold">Reference</th>
                  <th className="px-3 py-2.5 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const expanded = open === e.id
                  const href = hrefFor(e)
                  return (
                    <Fragment key={e.id}>
                      <tr className="border-b border-line align-top hover:bg-sunk">
                        <td className="px-2 py-2.5">
                          <button type="button" aria-expanded={expanded} aria-label={`Details for ${e.id}`} onClick={() => setOpen(expanded ? null : e.id)} className="cursor-pointer text-muted hover:text-ink">
                            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{e.id}</td>
                        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{dateTime(e.at)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{userName(ds, e.actorId)}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[11px]">{e.action}</span>
                          {e.correctsEventId && (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-flow-fg">
                              <Link2 size={11} aria-hidden /> corrects {e.correctsEventId}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                          {href ? (
                            <Link to={href} className="text-accent hover:underline">
                              {e.entityId}
                            </Link>
                          ) : (
                            e.entityId
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-ink-2">{e.summary}</td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-line bg-sunk">
                          <td />
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid gap-4 md:grid-cols-3">
                              <Values label="Before" v={e.before} />
                              <Values label="After" v={e.after} />
                              <div className="min-w-0 font-mono text-[11px] text-muted">
                                <div>Source: {e.source}</div>
                                <div>Entity: {e.entityType}</div>
                                <div className="break-all">Previous: {e.prevHash}</div>
                                <div className="break-all">Checksum: {e.hash}</div>
                              </div>
                            </div>
                            {!e.before && !e.after && <p className="text-xs text-muted">No field values recorded for this event.</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
            <span>
              {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}
            </span>
            <span className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </span>
          </nav>
        )}
      </Panel>
    </>
  )
}
