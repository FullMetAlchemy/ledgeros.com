import { useNavigate } from 'react-router'
import { shortDate } from '../../domain/calendar'
import { isOpen } from '../../domain/flagMachine'
import { naira, pct } from '../../domain/money'
import { deriveRating } from '../../domain/rating'
import { parseAmount } from '../../domain/submissions/defs'
import type { Submission } from '../../domain/submissions/types'
import { useMe, usePortal, visibleSubmissions } from '../../state/store'
import { EmptyState, PageHeader, Panel } from '../../ui/Panel'
import { RatingPill, StatusPill } from '../../ui/Pill'
import { submissionStatus } from '../submissions/submissionViews'

const amount = (r: Submission) => (r.data.kind === 'release_request' ? parseAmount(r.data.amount) : 0)
const sum = (list: Submission[]) => list.reduce((a, r) => a + amount(r), 0)

function ReleaseTable({ list }: { list: Submission[] }) {
  const s = usePortal()
  const navigate = useNavigate()
  const go = (r: Submission) => navigate(`/oversight/releases/${r.id}`)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-sunk text-left">
            {['Request', 'MDA · compliance', 'Vote', 'Amount', 'Released → after', 'Status'].map((h) => (
              <th key={h} className={`px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase ${h === 'Amount' || h.startsWith('Released') ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const mda = s.mdas.find((m) => m.id === r.mdaId)!
            const flags = s.flags.filter((f) => f.mdaId === r.mdaId)
            const open = flags.filter(isOpen)
            const crit = open.filter((f) => f.severity === 'Critical' || f.severity === 'High').length
            const after = Math.min(mda.appropriated, mda.released + (r.state === 'Accepted' ? 0 : amount(r)))
            const st = submissionStatus(r)
            return (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => go(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    go(r)
                  }
                }}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-sunk focus:bg-accent-soft focus:outline-none"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-mono text-[13px] font-medium">{r.id}</div>
                  <div className="text-xs text-muted">{r.attestation ? `Attested ${shortDate(r.attestation.at)}` : 'Not yet attested'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{mda.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <RatingPill rating={deriveRating(flags)} />
                    <span className={crit ? 'font-semibold text-crit-fg' : 'text-muted'}>
                      {open.length} open flag{open.length === 1 ? '' : 's'}
                      {crit ? ` · ${crit} Critical/High` : ''}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">{r.data.kind === 'release_request' ? r.data.vote : ''}</td>
                <td className="px-4 py-3 text-right font-mono text-[14px] font-semibold whitespace-nowrap tabular">{naira(amount(r))}</td>
                <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap text-ink-2 tabular">
                  {naira(mda.released)} → <span className="font-semibold text-ink">{naira(after)}</span>
                  <div className="text-muted">
                    {pct(after, mda.appropriated, 0)} of appropriation · absorption {pct(mda.utilized, mda.released, 0)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={st.tone} label={st.label} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Treasury: release (warrant) requests with each MDA's live compliance position
 * alongside, so a release decision is never taken blind to open anomalies.
 */
export function ReleaseQueue() {
  const s = usePortal()
  const me = useMe()!
  const requests = visibleSubmissions(s, me).sort((a, b) => (a.attestation?.at ?? a.createdAt).localeCompare(b.attestation?.at ?? b.createdAt))
  const pending = requests.filter((r) => r.state === 'UnderReview')
  const decided = requests.filter((r) => r.state === 'Accepted')
  const headroom = s.mdas.reduce((a, m) => a + (m.appropriated - m.released), 0)

  return (
    <>
      <PageHeader eyebrow="Treasury · Allocations & warrants" title="Release requests">
        <span className="text-xs text-muted">Oldest attestation first</span>
      </PageHeader>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {[
          ['Awaiting decision', String(pending.length), `${naira(sum(pending))} requested`, ''],
          ['Released from these requests', naira(sum(decided)), `${decided.length} approved`, 'text-ok-fg'],
          ['Unreleased appropriation', naira(headroom), 'Across all MDAs', ''],
        ].map(([label, value, sub, cls]) => (
          <div key={label} className="rounded-lg border border-line bg-surface px-4 py-3.5">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className={`mt-1 font-mono text-[22px] font-semibold tabular ${cls}`}>{value}</div>
            <div className="text-xs text-muted">{sub}</div>
          </div>
        ))}
      </section>
      <Panel title="Awaiting your decision" aside="MDA compliance is live, not as at request" bodyClassName="">
        {pending.length ? <ReleaseTable list={pending} /> : <EmptyState title="No requests waiting" body="Attested release requests from MDAs appear here." />}
      </Panel>
      {decided.length > 0 && (
        <Panel title="Approved" bodyClassName="">
          <ReleaseTable list={decided} />
        </Panel>
      )}
    </>
  )
}
