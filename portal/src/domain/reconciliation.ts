// Reconciliation (FRD §4.5, US-011):
//   Open → In Progress → Matched / Variance → Reviewed → Closed
// Variance = system (return) amount − external (TSA) amount. The sign convention
// is a stakeholder decision (FRD §10); this is the draft convention.

import { fail, ok, type Result } from './audit'
import type { Dataset } from './dataset'
import { key } from './dataset'
import { COUNTED } from './metrics'
import { naira } from './money'
import { can, inScope } from './roles'
import type { RecLine, RecStatus, RecType, Reconciliation, User } from './types'

export const REC_STATUSES: RecStatus[] = ['Open', 'In Progress', 'Matched', 'Variance', 'Reviewed', 'Closed']

function countedReturn(ds: Dataset, mdaId: string, periodId: string) {
  return ds.returns.find((r) => r.mdaId === mdaId && r.periodId === periodId && COUNTED.includes(r.status))
}

export function createReconciliation(ds: Dataset, actor: User, type: RecType, mdaId: string, periodId: string, now: Date): Result<Reconciliation> {
  if (!can(actor, 'rec.manage')) return fail('Only a Ministry Oversight Officer can create reconciliations.')
  if (!countedReturn(ds, mdaId, periodId)) return fail('There is no submitted return for this MDA and period to reconcile.')
  const dup = ds.reconciliations.find((r) => r.type === type && r.mdaId === mdaId && r.periodId === periodId && r.status !== 'Closed')
  if (dup) return fail(`${dup.id} is already open for this MDA and period.`)
  const n = ds.counters.rec + 1
  const id = `REC-${periodId.slice(0, 4)}-${String(n).padStart(4, '0')}`
  const at = now.toISOString()
  const rec: Reconciliation = {
    id,
    type,
    mdaId,
    periodId,
    status: 'Open',
    systemValue: 0,
    externalValue: 0,
    lines: [],
    reviewNote: '',
    createdBy: actor.id,
    createdAt: at,
    history: [{ id: `${id}-h1`, at, actorId: actor.id, from: null, to: 'Open' }],
  }
  return ok(rec, [{ action: 'REC_CREATED', entityType: 'Reconciliation', entityId: id, mdaId, summary: `${type} reconciliation opened for ${periodId}` }])
}

/** Match system transactions against the (mock) TSA statement. */
export function matchLines(ds: Dataset, rec: Pick<Reconciliation, 'type' | 'mdaId' | 'periodId'>): { lines: RecLine[]; systemValue: number; externalValue: number } {
  const ret = countedReturn(ds, rec.mdaId, rec.periodId)
  const system = ret?.transactions ?? []
  const tsa = ds.tsaStatements[key(rec.mdaId, rec.periodId)] ?? []
  const systemValue = system.reduce((a, t) => a + t.amount, 0)
  const externalValue = tsa.reduce((a, t) => a + t.amount, 0)

  if (rec.type === 'Vendor') {
    const vendors = new Map<string, { sys: number; ext: number }>()
    const k = (s: string) => s.trim().toLowerCase()
    for (const t of system) vendors.set(k(t.vendorName), { sys: (vendors.get(k(t.vendorName))?.sys ?? 0) + t.amount, ext: vendors.get(k(t.vendorName))?.ext ?? 0 })
    for (const t of tsa) vendors.set(k(t.payee), { sys: vendors.get(k(t.payee))?.sys ?? 0, ext: (vendors.get(k(t.payee))?.ext ?? 0) + t.amount })
    const names = new Map([...system.map((t) => [k(t.vendorName), t.vendorName] as const), ...tsa.map((t) => [k(t.payee), t.payee] as const)])
    const lines: RecLine[] = [...vendors].map(([vk, v], i) => ({
      id: `L${i + 1}`,
      reference: names.get(vk) ?? vk,
      vendor: names.get(vk) ?? vk,
      systemAmount: v.sys || null,
      externalAmount: v.ext || null,
      status: !v.sys ? 'External only' : !v.ext ? 'System only' : Math.abs(v.sys - v.ext) < 1 ? 'Matched' : 'Amount differs',
      explanation: '',
    }))
    return { lines, systemValue, externalValue }
  }

  const used = new Set<number>()
  const lines: RecLine[] = system.map((t, i) => {
    const j = tsa.findIndex((x, idx) => !used.has(idx) && x.reference === t.reference)
    if (j >= 0) {
      used.add(j)
      const x = tsa[j]
      return {
        id: `L${i + 1}`,
        reference: t.reference,
        vendor: t.vendorName,
        systemAmount: t.amount,
        externalAmount: x.amount,
        status: Math.abs(x.amount - t.amount) < 1 ? 'Matched' : 'Amount differs',
        explanation: '',
      }
    }
    return { id: `L${i + 1}`, reference: t.reference, vendor: t.vendorName, systemAmount: t.amount, externalAmount: null, status: 'System only', explanation: '' }
  })
  tsa.forEach((x, idx) => {
    if (!used.has(idx))
      lines.push({ id: `L${lines.length + 1}`, reference: x.reference, vendor: x.payee, systemAmount: null, externalAmount: x.amount, status: 'External only', explanation: '' })
  })
  return { lines, systemValue, externalValue }
}

export type RecAction =
  | { type: 'RUN_MATCHING' }
  | { type: 'EXPLAIN_LINE'; lineId: string; explanation: string }
  | { type: 'REVIEW'; note: string }
  | { type: 'CLOSE'; note?: string }

export function transitionRec(ds: Dataset, rec: Reconciliation, action: RecAction, actor: User, now: Date): Result<Reconciliation> {
  if (!can(actor, 'rec.manage') || !inScope(actor, rec.mdaId)) return fail('Only a Ministry Oversight Officer can work reconciliations.')
  const at = now.toISOString()
  const step = (history: Reconciliation['history'], from: RecStatus, to: RecStatus, note?: string) => [
    ...history,
    { id: `${rec.id}-h${history.length + 1}`, at, actorId: actor.id, from, to, note },
  ]

  switch (action.type) {
    case 'RUN_MATCHING': {
      if (!['Open', 'In Progress', 'Matched', 'Variance'].includes(rec.status)) return fail(`Matching can't be re-run once ${rec.status.toLowerCase()}.`)
      const { lines, systemValue, externalValue } = matchLines(ds, rec)
      // Keep explanations already written for lines that still differ.
      const kept = lines.map((l) => ({ ...l, explanation: rec.lines.find((o) => o.reference === l.reference && o.status === l.status)?.explanation ?? '' }))
      const variance = systemValue - externalValue
      const result: RecStatus = kept.every((l) => l.status === 'Matched') && Math.abs(variance) < 1 ? 'Matched' : 'Variance'
      let history = rec.history
      if (rec.status === 'Open') history = step(history, 'Open', 'In Progress', 'Matching against the mock TSA statement')
      history = step(history, rec.status === 'Open' ? 'In Progress' : rec.status, result)
      const unmatched = kept.filter((l) => l.status !== 'Matched').length
      return ok({ ...rec, lines: kept, systemValue, externalValue, status: result, history }, [
        {
          action: 'REC_MATCHED',
          entityType: 'Reconciliation',
          entityId: rec.id,
          mdaId: rec.mdaId,
          summary: `${result}: system ${naira(systemValue)} vs TSA ${naira(externalValue)}, variance ${naira(variance)}, ${unmatched} unmatched line${unmatched === 1 ? '' : 's'}`,
          before: { status: rec.status },
          after: { status: result, systemValue, externalValue, variance },
          source: 'Mock TSA',
        },
      ])
    }
    case 'EXPLAIN_LINE': {
      if (rec.status !== 'Variance') return fail('Explanations are recorded while the reconciliation shows a variance.')
      return ok({ ...rec, lines: rec.lines.map((l) => (l.id === action.lineId ? { ...l, explanation: action.explanation } : l)) })
    }
    case 'REVIEW': {
      if (rec.status !== 'Matched' && rec.status !== 'Variance') return fail('Run matching before reviewing.')
      if (action.note.trim().length < 10) return fail('Write a review note of at least 10 characters.')
      const unexplained = rec.lines.filter((l) => l.status !== 'Matched' && l.explanation.trim().length < 5)
      if (unexplained.length) return fail(`Explain every unmatched line first (${unexplained.length} remaining).`)
      return ok({ ...rec, status: 'Reviewed', reviewNote: action.note.trim(), history: step(rec.history, rec.status, 'Reviewed', action.note) }, [
        { action: 'REC_REVIEWED', entityType: 'Reconciliation', entityId: rec.id, mdaId: rec.mdaId, summary: `Reviewed: ${action.note.trim()}`, before: { status: rec.status }, after: { status: 'Reviewed' } },
      ])
    }
    case 'CLOSE': {
      if (rec.status !== 'Reviewed') return fail('Only a reviewed reconciliation can be closed.')
      return ok({ ...rec, status: 'Closed', history: step(rec.history, 'Reviewed', 'Closed', action.note) }, [
        { action: 'REC_CLOSED', entityType: 'Reconciliation', entityId: rec.id, mdaId: rec.mdaId, summary: 'Closed', before: { status: 'Reviewed' }, after: { status: 'Closed' } },
      ])
    }
  }
}

export const recVariance = (r: Pick<Reconciliation, 'systemValue' | 'externalValue'>) => r.systemValue - r.externalValue
