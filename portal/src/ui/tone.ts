// Semantic tone mapping (FRD §17, UI-004). Rose, amber and emerald are
// semantic signals only; workflow states use neutral/indigo so being in a
// process never looks like being in trouble.

import type { FlagStatus, Rating, RecStatus, ReturnStatus, Severity, UserStatus } from '../domain/types'

export type Tone = 'crit' | 'warn' | 'ok' | 'flow' | 'neu'

export const PILL: Record<Tone, string> = {
  crit: 'text-crit-fg bg-crit-bg border-crit-bd',
  warn: 'text-warn-fg bg-warn-bg border-warn-bd',
  ok: 'text-ok-fg bg-ok-bg border-ok-bd',
  flow: 'text-flow-fg bg-flow-bg border-flow-bd',
  neu: 'text-neu-fg bg-neu-bg border-neu-bd',
}

/** Banner surfaces: tinted but light, so status reads without an alarm-heavy block. */
export const PANEL: Record<Tone, string> = {
  crit: 'border-crit-bd bg-crit-bg',
  warn: 'border-warn-bd bg-warn-bg',
  ok: 'border-ok-bd bg-ok-bg',
  flow: 'border-flow-bd bg-flow-bg',
  neu: 'border-line bg-surface',
}

export const TEXT: Record<Tone, string> = {
  crit: 'text-crit-fg',
  warn: 'text-warn-fg',
  ok: 'text-ok-fg',
  flow: 'text-flow-fg',
  neu: 'text-neu-fg',
}

export const RATING_TONE: Record<Rating, Tone> = { 'High Risk': 'crit', Warning: 'warn', Clear: 'ok' }

export const SEVERITY_TONE: Record<Severity, Tone> = { Critical: 'crit', High: 'crit', Medium: 'warn', Low: 'neu' }

export const FLAG_TONE: Record<FlagStatus, Tone> = {
  Detected: 'neu',
  Open: 'flow',
  Assigned: 'flow',
  'MDA Response': 'flow',
  'Under Review': 'flow',
  Resolved: 'ok',
  Rejected: 'warn',
  Escalated: 'crit',
  Closed: 'neu',
}

export const RETURN_TONE: Record<ReturnStatus, Tone> = {
  Draft: 'neu',
  Submitted: 'flow',
  'Under Review': 'flow',
  Returned: 'warn',
  Accepted: 'ok',
  Closed: 'neu',
}

export const REC_TONE: Record<RecStatus, Tone> = {
  Open: 'neu',
  'In Progress': 'flow',
  Matched: 'ok',
  Variance: 'warn',
  Reviewed: 'flow',
  Closed: 'neu',
}

export const USER_TONE: Record<UserStatus, Tone> = { Pending: 'flow', Active: 'ok', Suspended: 'warn', Disabled: 'neu' }
