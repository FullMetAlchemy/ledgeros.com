// Three-tier validation for flag responses.
//   blocking      – cannot be submitted
//   justification – may be submitted once a written justification is supplied;
//                   the justification travels with the response to every reviewer
//   advisory      – informational, never blocks
// The same function runs in the browser and (in production) on the server.

import { TEMPLATES } from './templates'
import type { Flag, ResponseDraft } from './types'

export type Tier = 'blocking' | 'justification' | 'advisory'

/** Wizard steps of the response composer, used to jump to the offending field. */
export const COMPOSER_STEPS = ['Response type', 'Answers', 'Evidence', 'Checks', 'Declaration'] as const

export interface Issue {
  id: string
  tier: Tier
  step: number
  field: string
  message: string
  /** For justification issues: whether an adequate justification has been written. */
  satisfied?: boolean
}

export const MIN_NARRATIVE = { detailed: 80, brief: 40 }
export const MIN_JUSTIFICATION = 30
export const MAX_EXTENSION_DAYS = 30

export function validateResponse(flag: Flag, draft: ResponseDraft): Issue[] {
  const issues: Issue[] = []
  const t = TEMPLATES[flag.type]
  const type = draft.type

  if (!type) {
    issues.push({ id: 'type', tier: 'blocking', step: 0, field: 'type', message: 'Choose a response type.' })
    return issues
  }

  const detailed = type === 'justify' || type === 'dispute'
  const minNarrative = detailed ? MIN_NARRATIVE.detailed : MIN_NARRATIVE.brief
  const narrative = draft.narrative.trim()
  if (narrative.length < minNarrative) {
    issues.push({
      id: 'narrative',
      tier: 'blocking',
      step: 1,
      field: 'narrative',
      message: `Write at least ${minNarrative} characters in the explanation (currently ${narrative.length}).`,
    })
  }

  if (detailed) {
    for (const q of t.questions) {
      if (!(draft.answers[q.id] ?? '').trim()) {
        issues.push({ id: `q:${q.id}`, tier: 'blocking', step: 1, field: `q:${q.id}`, message: `Answer: "${q.label}"` })
      }
    }
  }

  if (type === 'correct' && draft.correctiveRef.trim().length < 4) {
    issues.push({
      id: 'correctiveRef',
      tier: 'blocking',
      step: 1,
      field: 'correctiveRef',
      message: 'Enter the reference of the corrective record (reversal voucher, recovery receipt or TSA remittance).',
    })
  }

  if (type === 'extension') {
    if (flag.extensionUsed) {
      issues.push({
        id: 'extension-used',
        tier: 'blocking',
        step: 0,
        field: 'type',
        message: 'An extension has already been granted on this case. Choose another response type.',
      })
    }
    const due = new Date(flag.resolveDueAt)
    const requested = draft.extensionDate ? new Date(`${draft.extensionDate}T17:00:00`) : null
    if (!requested || Number.isNaN(requested.getTime())) {
      issues.push({ id: 'extensionDate', tier: 'blocking', step: 1, field: 'extensionDate', message: 'Choose the new date you are requesting.' })
    } else {
      const maxDate = new Date(due)
      maxDate.setDate(maxDate.getDate() + MAX_EXTENSION_DAYS)
      if (requested <= due) {
        issues.push({ id: 'extensionDate', tier: 'blocking', step: 1, field: 'extensionDate', message: 'The new date must be after the current deadline.' })
      } else if (requested > maxDate) {
        issues.push({
          id: 'extensionDate',
          tier: 'blocking',
          step: 1,
          field: 'extensionDate',
          message: `Extensions are limited to ${MAX_EXTENSION_DAYS} days beyond the current deadline.`,
        })
      }
    }
  }

  for (const slot of t.evidence) {
    if (slot.requiredFor.includes(type) && !draft.evidence.some((e) => e.slotId === slot.id)) {
      issues.push({
        id: `evidence:${slot.id}`,
        tier: 'blocking',
        step: 2,
        field: `evidence:${slot.id}`,
        message: `Attach: ${slot.label}.`,
      })
    }
  }

  if (detailed) {
    for (const trig of t.triggers) {
      if (trig.when(draft.answers)) {
        const written = (draft.justifications[trig.id] ?? '').trim()
        issues.push({
          id: trig.id,
          tier: 'justification',
          step: 3,
          field: `justification:${trig.id}`,
          message: trig.message,
          satisfied: written.length >= MIN_JUSTIFICATION,
        })
      }
    }
  }

  if (flag.relatedRefs.length && narrative && !flag.relatedRefs.some((r) => narrative.includes(r))) {
    issues.push({
      id: 'advisory-ref',
      tier: 'advisory',
      step: 1,
      field: 'narrative',
      message: `Mention ${flag.relatedRefs.join(' or ')} in your explanation so reviewers can trace it in the ledger.`,
    })
  }

  return issues
}

/** True when nothing prevents submission. */
export function canSubmit(issues: Issue[]): boolean {
  return !issues.some((i) => i.tier === 'blocking' || (i.tier === 'justification' && !i.satisfied))
}
