// Semantic tone mapping. Four scales stay separate (see spec §3):
//   entity rating · flag severity · workflow status · deadline.
// Red (crit) is reserved for Critical, High Risk, Overdue and Escalated.
// Workflow states use blue/grey; green only once oversight has accepted.

import { currentStep, STEP_LABEL, type DeadlineStatus } from '../domain/policy'
import type { Flag, Rating, Severity } from '../domain/types'

export type Tone = 'crit' | 'warn' | 'ok' | 'flow' | 'neu'

export const PILL: Record<Tone, string> = {
  crit: 'text-crit-fg bg-crit-bg border-crit-bd',
  warn: 'text-warn-fg bg-warn-bg border-warn-bd',
  ok: 'text-ok-fg bg-ok-bg border-ok-bd',
  flow: 'text-flow-fg bg-flow-bg border-flow-bd',
  neu: 'text-neu-fg bg-neu-bg border-neu-bd',
}

export const DOT: Record<Tone, string> = {
  crit: 'bg-crit-dot',
  warn: 'bg-warn-dot',
  ok: 'bg-ok-dot',
  flow: 'bg-flow-dot',
  neu: 'bg-neu-dot',
}

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

export const SEVERITY_BG: Record<Severity, string> = {
  Critical: 'bg-sev-critical',
  High: 'bg-sev-high',
  Medium: 'bg-sev-medium',
  Low: 'bg-sev-low',
}

export const DEADLINE_TEXT: Record<DeadlineStatus, string> = {
  ok: 'text-muted',
  soon: 'text-warn-fg',
  over: 'text-crit-fg',
}

export function flagStatus(flag: Flag): { label: string; tone: Tone } {
  switch (flag.state) {
    case 'Raised':
      return { label: 'Raised', tone: 'neu' }
    case 'Acknowledged':
      return { label: 'Acknowledged', tone: 'neu' }
    case 'Drafting':
      return flag.returned ? { label: 'Returned', tone: 'flow' } : { label: 'Drafting', tone: 'neu' }
    case 'InChain': {
      const step = currentStep(flag)
      return { label: step ? `${STEP_LABEL[step]} pending` : 'In review', tone: 'flow' }
    }
    case 'OversightReview':
      return { label: 'With oversight', tone: 'flow' }
    case 'InfoRequested':
      return { label: 'Info requested', tone: 'flow' }
    case 'Resolved':
      return { label: 'Accepted', tone: 'ok' }
    case 'Escalated':
      return { label: 'Escalated', tone: 'crit' }
    case 'Reopened':
      return { label: 'Reopened', tone: 'flow' }
  }
}
