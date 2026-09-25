// Anomaly engine (FRD §4.6, BR-001..BR-006). Evaluates eligible records against
// the active rules and returns new flags in the Detected state. Flags are
// decision support: each carries the rule, the threshold, the observed values
// and the records that generated it, and a human reviews every one.

import type { AuditDraft } from './audit'
import type { Dataset } from './dataset'
import { COUNTED, mdaPosition } from './metrics'
import { naira, pctText } from './money'
import { elapsedShare, monthOf, MONTH_SHORT, periodId, type PeriodScope } from './periods'
import type { Flag, FlagRecordRef, RuleConfig, RuleId, Severity, Transaction } from './types'

export const RULE_LABEL: Record<RuleId, string> = {
  overspend: 'Overspend',
  velocity: 'Velocity',
  milestone: 'Milestone mismatch',
  duplication: 'Potential duplication',
}

export const RULE_DEFINITION: Record<RuleId, string> = {
  overspend: 'Utilization greater than the approved allocation (BR-001). Equal to allocation is not overspend (BR-002).',
  velocity: 'Utilization rate running ahead of the share of the year elapsed by more than the configured pace (BR-003).',
  milestone: 'Payment progress exceeding documented completion by more than the configured tolerance (BR-004).',
  duplication: 'Transactions matching on the configured vendor, amount, period, MDA and service criteria (BR-005). A potential duplicate is not a finding of fraud.',
}

export const DEFAULT_RULES: RuleConfig = {
  overspend: { enabled: true, criticalAbovePct: 50 },
  velocity: { enabled: true, paceMultiple: 1.25, minUtilizationPct: 50 },
  milestone: { enabled: true, tolerancePts: 15 },
  duplication: { enabled: true, matchVendor: true, matchAmount: true, amountTolerancePct: 0, samePeriod: true, matchService: true },
  responseSlaDays: { Critical: 5, High: 10, Medium: 15, Low: 30 },
}

export interface EvaluationResult {
  flags: Flag[]
  evaluated: { rule: RuleId; subjects: number }[]
  /** Conditions still present but already flagged (BR-006). */
  suppressed: string[]
  events: AuditDraft[]
}

type Candidate = Omit<Flag, 'id' | 'status' | 'reviewerId' | 'assigneeId' | 'dueAt' | 'draft' | 'responses' | 'history' | 'comments' | 'closedOutcome' | 'detectedAt'>

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Evaluate every active rule as at the end of `asOf` (a month). Returns new
 * flags only; a condition with an existing flag of the same key is suppressed.
 * `mdaIds` limits evaluation (e.g. to the MDA whose return was just submitted).
 */
export function evaluate(ds: Dataset, asOf: string, now: Date, mdaIds?: string[]): EvaluationResult {
  const cfg = ds.ruleConfig
  const month = monthOf(asOf)
  const ytd: PeriodScope = { mode: 'ytd', periodId: asOf }
  const mdas = ds.mdas.filter((m) => m.status === 'Active' && (!mdaIds || mdaIds.includes(m.id)))
  const candidates: Candidate[] = []
  const evaluated: EvaluationResult['evaluated'] = []
  const obs = `FY${asOf.slice(0, 4)} to ${MONTH_SHORT[month - 1]} (${month} of 12 months)`

  // BR-001/002: overspend
  const overspent = new Set<string>()
  if (cfg.overspend.enabled) {
    evaluated.push({ rule: 'overspend', subjects: mdas.length })
    for (const m of mdas) {
      const p = mdaPosition(ds, m.id, ytd)
      if (p.utilized > p.appropriation) {
        overspent.add(m.id)
        const variancePct = p.appropriation ? ((p.utilized - p.appropriation) / p.appropriation) * 100 : Infinity
        candidates.push({
          ruleId: 'overspend',
          dedupeKey: `overspend:${m.id}:FY${asOf.slice(0, 4)}`,
          mdaId: m.id,
          periodId: asOf,
          severity: variancePct > cfg.overspend.criticalAbovePct ? 'Critical' : 'High',
          title: `Overspend: utilization ${naira(p.utilized)} against allocation ${naira(p.appropriation)}`,
          amount: p.utilized - p.appropriation,
          evidence: {
            metrics: [
              { label: 'Approved allocation', value: naira(p.appropriation) },
              { label: 'Utilization', value: naira(p.utilized) },
              { label: 'Allocation variance', value: `+${naira(p.utilized - p.appropriation)}` },
              { label: 'Utilization rate', value: pctText(p.utilizationRate) },
            ],
            threshold: `Utilization > approved allocation. Critical when the variance exceeds ${cfg.overspend.criticalAbovePct}% of allocation.`,
            observation: obs,
            records: [{ type: 'mda', id: m.id, label: m.name, amount: p.utilized }, ...contributingReturns(ds, m.id, month)],
          },
        })
      }
    }
  }

  // BR-003: velocity (skipped where overspend already covers the condition)
  if (cfg.velocity.enabled) {
    evaluated.push({ rule: 'velocity', subjects: mdas.length })
    const elapsed = elapsedShare(month)
    for (const m of mdas) {
      if (overspent.has(m.id)) continue
      const p = mdaPosition(ds, m.id, ytd)
      const rateNow = p.utilizationRate ?? 0
      const pace = rateNow / 100 / elapsed
      if (rateNow >= cfg.velocity.minUtilizationPct && pace >= cfg.velocity.paceMultiple) {
        const expected = p.appropriation * elapsed
        candidates.push({
          ruleId: 'velocity',
          dedupeKey: `velocity:${m.id}:FY${asOf.slice(0, 4)}`,
          mdaId: m.id,
          periodId: asOf,
          severity: 'High',
          title: `Velocity: ${pctText(rateNow)} of allocation used with ${Math.round(elapsed * 100)}% of the year elapsed`,
          amount: p.utilized - expected,
          evidence: {
            metrics: [
              { label: 'Utilization rate', value: pctText(rateNow) },
              { label: 'Year elapsed', value: `${Math.round(elapsed * 100)}%` },
              { label: 'Calculated pace', value: `${pace.toFixed(2)}× expected` },
              { label: 'Ahead of straight-line burn', value: naira(p.utilized - expected) },
            ],
            threshold: `Pace ≥ ${cfg.velocity.paceMultiple.toFixed(2)}× the share of year elapsed, and utilization ≥ ${cfg.velocity.minUtilizationPct}%.`,
            observation: obs,
            records: [{ type: 'mda', id: m.id, label: m.name, amount: p.utilized }, ...contributingReturns(ds, m.id, month)],
          },
        })
      }
    }
  }

  // BR-004: milestone mismatch
  if (cfg.milestone.enabled) {
    const projects = ds.projects.filter((p) => mdas.some((m) => m.id === p.mdaId))
    evaluated.push({ rule: 'milestone', subjects: projects.length })
    for (const pr of projects) {
      const paidPct = pr.contractValue ? (pr.paidToDate / pr.contractValue) * 100 : 0
      const gap = paidPct - pr.completionPct
      if (gap > cfg.milestone.tolerancePts) {
        const vendor = ds.vendors.find((v) => v.id === pr.vendorId)
        candidates.push({
          ruleId: 'milestone',
          dedupeKey: `milestone:${pr.id}`,
          mdaId: pr.mdaId,
          periodId: asOf,
          severity: gap >= cfg.milestone.tolerancePts * 2 ? 'High' : 'Medium',
          title: `Milestone mismatch: ${pr.name} paid ${paidPct.toFixed(0)}% against ${pr.completionPct}% complete`,
          amount: pr.paidToDate - (pr.completionPct / 100) * pr.contractValue,
          evidence: {
            metrics: [
              { label: 'Contract value', value: naira(pr.contractValue) },
              { label: 'Paid to date', value: `${naira(pr.paidToDate)} (${paidPct.toFixed(1)}%)` },
              { label: 'Documented completion', value: `${pr.completionPct}% (inspected ${pr.lastInspection})` },
              { label: 'Gap', value: `${gap.toFixed(1)} percentage points` },
            ],
            threshold: `Payment progress − completion > ${cfg.milestone.tolerancePts} percentage points.`,
            observation: `Contractor ${vendor?.name ?? pr.vendorId}; last inspection ${pr.lastInspection}`,
            records: [{ type: 'project', id: pr.id, label: pr.name, amount: pr.paidToDate }, ...pr.paymentRefs.map((ref) => ({ type: 'transaction' as const, id: ref, label: ref }))],
          },
        })
      }
    }
  }

  // BR-005: potential duplication
  if (cfg.duplication.enabled) {
    const d = cfg.duplication
    const pool: (Transaction & { mdaId: string; periodId: string; returnId: string })[] = []
    for (const r of ds.returns) {
      if (!COUNTED.includes(r.status)) continue
      if (!mdas.some((m) => m.id === r.mdaId)) continue
      if (monthOf(r.periodId) > month) continue
      for (const t of r.transactions) pool.push({ ...t, mdaId: r.mdaId, periodId: r.periodId, returnId: r.id })
    }
    evaluated.push({ rule: 'duplication', subjects: pool.length })
    const seen = new Set<string>()
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i]
        const b = pool[j]
        if (a.mdaId !== b.mdaId || a.reference === b.reference) continue
        if (d.samePeriod && a.periodId !== b.periodId) continue
        if (d.matchVendor && norm(a.vendorName) !== norm(b.vendorName) && a.vendorTin !== b.vendorTin) continue
        if (d.matchAmount && Math.abs(a.amount - b.amount) > (Math.max(a.amount, b.amount) * d.amountTolerancePct) / 100) continue
        if (d.matchService && norm(a.description) !== norm(b.description)) continue
        const refs = [a.reference, b.reference].sort()
        const k = `duplication:${a.mdaId}:${refs.join('+')}`
        if (seen.has(k)) continue
        seen.add(k)
        candidates.push({
          ruleId: 'duplication',
          dedupeKey: k,
          mdaId: a.mdaId,
          periodId: a.periodId,
          severity: 'Medium',
          title: `Potential duplication: ${refs.join(' and ')} to ${a.vendorName}`,
          amount: Math.min(a.amount, b.amount),
          evidence: {
            metrics: [
              { label: 'Vendor', value: `${a.vendorName} (${a.vendorTin})` },
              { label: 'Amounts', value: `${naira(a.amount)} and ${naira(b.amount)}` },
              { label: 'Dates', value: `${a.date} and ${b.date}` },
              { label: 'Service', value: a.description },
            ],
            threshold: criteriaText(d),
            observation: `${a.returnId === b.returnId ? a.returnId : `${a.returnId} and ${b.returnId}`}; potential duplicate only, not a finding of fraud`,
            records: [a, b].map((t) => ({ type: 'transaction' as const, id: t.reference, label: `${t.reference} · ${t.date}`, amount: t.amount })),
          },
        })
      }
    }
  }

  // BR-006: suppress conditions that already have a flag.
  const existing = new Set(ds.flags.map((f) => f.dedupeKey))
  const suppressed: string[] = []
  const fresh = candidates.filter((c) => {
    if (existing.has(c.dedupeKey)) {
      suppressed.push(c.dedupeKey)
      return false
    }
    return true
  })

  const at = now.toISOString()
  let n = ds.counters.flag
  const flags: Flag[] = fresh.map((c) => {
    n += 1
    const id = `FLG-${asOf.slice(0, 4)}-${String(n).padStart(4, '0')}`
    return {
      ...c,
      id,
      detectedAt: at,
      status: 'Detected',
      reviewerId: null,
      assigneeId: null,
      dueAt: null,
      draft: { explanation: '', correctiveAction: '', evidence: [] },
      responses: [],
      history: [{ id: `${id}-h1`, at, actorId: 'system', from: null, to: 'Detected', note: `${RULE_LABEL[c.ruleId]} rule` }],
      comments: [],
      closedOutcome: null,
    }
  })

  const events: AuditDraft[] = [
    {
      action: 'RULES_EVALUATED',
      entityType: 'Rules',
      entityId: `RUN-${asOf}`,
      mdaId: mdaIds?.length === 1 ? mdaIds[0] : null,
      summary: `Evaluated ${evaluated.map((e) => `${RULE_LABEL[e.rule]} (${e.subjects})`).join(', ')} as at ${asOf}: ${flags.length} new flag${flags.length === 1 ? '' : 's'}, ${suppressed.length} already flagged`,
      source: 'Rule engine',
      actorId: 'system',
    },
    ...flags.map((f) => ({
      action: 'FLAG_DETECTED',
      entityType: 'Flag' as const,
      entityId: f.id,
      mdaId: f.mdaId,
      summary: `${f.severity} ${RULE_LABEL[f.ruleId]} flag detected: ${f.title}`,
      after: { status: 'Detected', severity: f.severity, amount: f.amount },
      source: 'Rule engine' as const,
      actorId: 'system',
    })),
  ]

  return { flags, evaluated, suppressed, events }
}

function contributingReturns(ds: Dataset, mdaId: string, toMonth: number): FlagRecordRef[] {
  return ds.returns
    .filter((r) => r.mdaId === mdaId && monthOf(r.periodId) <= toMonth && COUNTED.includes(r.status))
    .map((r) => ({ type: 'return' as const, id: r.id, label: `${r.id} (${r.periodId})`, amount: r.transactions.reduce((a, t) => a + t.amount, 0) }))
}

function criteriaText(d: RuleConfig['duplication']): string {
  const parts = ['same MDA']
  if (d.matchVendor) parts.push('same vendor (name or TIN)')
  if (d.matchAmount) parts.push(d.amountTolerancePct ? `amount within ${d.amountTolerancePct}%` : 'same amount')
  if (d.samePeriod) parts.push('same period')
  if (d.matchService) parts.push('same service description')
  return `Match on ${parts.join(', ')}; different references.`
}

export const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low']
export const latestPeriodWithData = (ds: Dataset): string => {
  let max = 1
  for (const r of ds.returns) if (COUNTED.includes(r.status)) max = Math.max(max, monthOf(r.periodId))
  return periodId(max)
}
