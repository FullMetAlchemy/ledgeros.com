import { Play } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { dateTime } from '../../domain/calendar'
import { isOverdue } from '../../domain/flags'
import { naira } from '../../domain/money'
import { can, inScope } from '../../domain/roles'
import { latestPeriodWithData, RULE_LABEL, SEVERITY_ORDER } from '../../domain/rules'
import { svcRunRules } from '../../domain/services'
import type { Flag, FlagStatus, RuleId, Severity } from '../../domain/types'
import { store, useDs, useMe } from '../../state/store'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { PageHeader, Panel } from '../../ui/Panel'
import { DueChip, SeverityBadge, StatusPill } from '../../ui/Pill'
import { Tabs } from '../../ui/Tabs'
import { useToast } from '../../ui/toast'
import { FLAG_TONE } from '../../ui/tone'

type Stage = 'active' | 'triage' | 'mda' | 'review' | 'escalated' | 'closed' | 'all'
const STAGES: Record<Stage, FlagStatus[] | null> = {
  active: ['Detected', 'Open', 'Assigned', 'MDA Response', 'Under Review', 'Resolved', 'Rejected', 'Escalated'],
  triage: ['Detected'],
  mda: ['Open', 'Assigned', 'MDA Response'],
  review: ['Under Review', 'Resolved', 'Rejected'],
  escalated: ['Escalated'],
  closed: ['Closed'],
  all: null,
}

export function FlagsCentre() {
  const ds = useDs()
  const me = useMe()!
  const toast = useToast()
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('active')
  const [severity, setSeverity] = useState<'All' | Severity>('All')
  const [rule, setRule] = useState<'All' | RuleId>('All')
  const [mda, setMda] = useState('All')
  const [running, setRunning] = useState(false)
  const now = new Date()

  const scoped = ds.flags.filter((f) => inScope(me, f.mdaId))
  const inStage = (f: Flag, s: Stage) => !STAGES[s] || STAGES[s]!.includes(f.status)
  const rows = scoped.filter((f) => inStage(f, stage) && (severity === 'All' || f.severity === severity) && (rule === 'All' || f.ruleId === rule) && (mda === 'All' || f.mdaId === mda))
  const asOf = latestPeriodWithData(ds)

  const runRules = async () => {
    setRunning(true)
    await new Promise((r) => setTimeout(r, 600))
    const r = store.run((d, u, n) => svcRunRules(d, u, n, asOf))
    setRunning(false)
    if (!r.ok) return toast('error', 'Rules not run', r.error)
    toast(r.message?.startsWith('Rule evaluation failed') ? 'error' : 'success', 'Rules evaluated', `${r.message}. ${r.value.suppressed} condition${r.value.suppressed === 1 ? ' is' : 's are'} already flagged.`)
  }

  const select = (id: string, label: string, value: string, set: (v: string) => void, options: string[]) => (
    <label className="flex items-center gap-2 text-xs text-muted" htmlFor={id}>
      {label}
      <select id={id} value={value} onChange={(e) => set(e.target.value)} className="h-8 rounded-md border border-line-2 bg-surface px-2 text-[13px] text-ink">
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'All' ? 'All' : label === 'Rule' ? RULE_LABEL[o as RuleId] : o}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <>
      <PageHeader eyebrow="Compliance centre" title="Flag resolution">
        {can(me, 'rules.run') && (
          <Button onClick={runRules} disabled={running}>
            <Play size={14} aria-hidden /> {running ? 'Evaluating rules…' : `Run rules as at ${ds.periods.find((p) => p.id === asOf)?.label}`}
          </Button>
        )}
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Active flags by severity">
        {SEVERITY_ORDER.map((sev) => {
          const list = scoped.filter((f) => f.severity === sev && f.status !== 'Closed')
          return (
            <button
              key={sev}
              type="button"
              aria-pressed={severity === sev}
              onClick={() => setSeverity(severity === sev ? 'All' : sev)}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-surface px-4 py-3 text-left transition-colors duration-200 hover:bg-sunk ${severity === sev ? 'border-primary' : 'border-line'}`}
            >
              <SeverityBadge severity={sev} />
              <span className="font-mono text-xl font-semibold tabular">{list.length}</span>
              <span className="text-xs text-muted">{naira(list.reduce((a, f) => a + Math.max(0, f.amount), 0))} affected</span>
            </button>
          )
        })}
      </section>

      <Panel bodyClassName="">
        <Tabs
          label="Workflow stage"
          value={stage}
          onChange={setStage}
          tabs={[
            { id: 'active', label: 'Active', count: scoped.filter((f) => inStage(f, 'active')).length },
            { id: 'triage', label: 'Detected', count: scoped.filter((f) => inStage(f, 'triage')).length },
            { id: 'mda', label: 'With MDA', count: scoped.filter((f) => inStage(f, 'mda')).length },
            { id: 'review', label: 'Review', count: scoped.filter((f) => inStage(f, 'review')).length },
            { id: 'escalated', label: 'Escalated', count: scoped.filter((f) => inStage(f, 'escalated')).length },
            { id: 'closed', label: 'Closed', count: scoped.filter((f) => inStage(f, 'closed')).length },
            { id: 'all', label: 'All', count: scoped.length },
          ]}
        />
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-2.5">
          {select('f-sev', 'Severity', severity, (v) => setSeverity(v as 'All' | Severity), ['All', ...SEVERITY_ORDER])}
          {select('f-rule', 'Rule', rule, (v) => setRule(v as 'All' | RuleId), ['All', 'overspend', 'velocity', 'milestone', 'duplication'])}
          {!me.mdaId && select('f-mda', 'MDA', mda, setMda, ['All', ...ds.mdas.map((m) => m.id)])}
        </div>
        <DataTable
          caption="Compliance flags"
          rows={rows}
          rowKey={(f) => f.id}
          onOpen={(f) => navigate(`/flags/${f.id}`)}
          initialSort={{ key: 'severity', dir: 'asc' }}
          minWidth={1000}
          empty={{ title: 'No flags match', body: stage === 'closed' ? 'Closed flags remain searchable here.' : 'Try another stage or filter.' }}
          columns={[
            {
              key: 'flag',
              header: 'Flag',
              cell: (f) => (
                <div className="max-w-md">
                  <div className="font-medium">{RULE_LABEL[f.ruleId]}</div>
                  <div className="truncate text-xs text-muted" title={f.title}>
                    {f.id} · {f.title}
                  </div>
                </div>
              ),
            },
            { key: 'mda', header: 'MDA', sort: (f) => f.mdaId, cell: (f) => <span className="font-mono text-xs">{f.mdaId}</span> },
            { key: 'severity', header: 'Severity', sort: (f) => SEVERITY_ORDER.indexOf(f.severity), cell: (f) => <SeverityBadge severity={f.severity} /> },
            { key: 'amount', header: 'Amount', align: 'right', sort: (f) => f.amount, cell: (f) => <span className="font-mono tabular">{naira(f.amount)}</span> },
            { key: 'status', header: 'Status', sort: (f) => f.status, cell: (f) => <StatusPill tone={FLAG_TONE[f.status]} label={f.status} /> },
            { key: 'due', header: 'Response due', sort: (f) => f.dueAt ?? '', cell: (f) => <DueChip due={f.dueAt} open={['Open', 'Assigned', 'MDA Response'].includes(f.status)} closedLabel={isOverdue(f, now) ? 'Overdue' : '—'} /> },
            { key: 'detected', header: 'Detected', sort: (f) => f.detectedAt, cell: (f) => <span className="font-mono text-xs">{dateTime(f.detectedAt)}</span> },
          ]}
        />
      </Panel>
    </>
  )
}
