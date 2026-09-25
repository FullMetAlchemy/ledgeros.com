// Audit ledger (FRD §4.8, §14). Append-only: events are never edited or
// removed; a correction is a new event linked to the one it corrects.
// Each event carries a checksum chained to the previous event so tampering is
// detectable in the demo. This is NOT cryptographic immutability; the
// production ledger is intended to be WORM storage.

import type { AuditEntity, AuditEvent } from './types'

/** What a domain action asks the ledger to record. */
export interface AuditDraft {
  action: string
  entityType: AuditEntity
  entityId: string
  mdaId: string | null
  summary: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  correctsEventId?: string
  source?: AuditEvent['source']
  /** Override the acting user (e.g. 'system' for the rule engine). */
  actorId?: string
}

export type Result<T> = { ok: true; value: T; events: AuditDraft[] } | { ok: false; error: string }

export const ok = <T>(value: T, events: AuditDraft[] = []): Result<T> => ({ ok: true, value, events })
export const fail = <T>(error: string): Result<T> => ({ ok: false, error })

export const GENESIS = '0000000000000000'

/** FNV-1a 64-bit over a string, hex. Deterministic and synchronous. */
export function checksum(text: string): string {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i))
    h = (h * prime) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

function body(e: Omit<AuditEvent, 'hash'>): string {
  return JSON.stringify([e.seq, e.at, e.actorId, e.action, e.entityType, e.entityId, e.mdaId, e.summary, e.before ?? null, e.after ?? null, e.correctsEventId ?? null, e.source, e.prevHash])
}

/** Append drafts to the ledger, assigning ids, sequence numbers and chained checksums. */
export function append(log: AuditEvent[], drafts: AuditDraft[], actorId: string, at: string): AuditEvent[] {
  if (!drafts.length) return log
  const out = [...log]
  for (const d of drafts) {
    const prev = out[out.length - 1]
    const seq = (prev?.seq ?? 0) + 1
    const base: Omit<AuditEvent, 'hash'> = {
      id: `EVT-${String(seq).padStart(6, '0')}`,
      seq,
      at,
      actorId: d.actorId ?? actorId,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      mdaId: d.mdaId,
      summary: d.summary,
      ...(d.before ? { before: d.before } : {}),
      ...(d.after ? { after: d.after } : {}),
      ...(d.correctsEventId ? { correctsEventId: d.correctsEventId } : {}),
      source: d.source ?? 'Portal',
      prevHash: prev?.hash ?? GENESIS,
    }
    out.push({ ...base, hash: checksum(body(base)) })
  }
  return out
}

/** Recompute the chain; returns the first broken event, or null if intact. */
export function verifyChain(log: AuditEvent[]): { brokenAt: AuditEvent } | null {
  let prevHash = GENESIS
  for (const e of log) {
    const { hash, ...rest } = e
    if (e.prevHash !== prevHash || checksum(body(rest)) !== hash) return { brokenAt: e }
    prevHash = hash
  }
  return null
}

/** The full chain for one record, oldest first, including correction links. */
export function chainFor(log: AuditEvent[], entityId: string): AuditEvent[] {
  return log.filter((e) => e.entityId === entityId)
}

export function lastEvent(log: AuditEvent[], entityId: string, action: string): AuditEvent | undefined {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].entityId === entityId && log[i].action === action) return log[i]
  return undefined
}
