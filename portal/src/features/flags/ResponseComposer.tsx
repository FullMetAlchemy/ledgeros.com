import { useMemo, useState } from 'react'
import { clock, shortDate } from '../../domain/calendar'
import { chainFor, ROLE_LABEL, rolesForStep } from '../../domain/policy'
import { RESPONSE_TYPES, TEMPLATES } from '../../domain/templates'
import type { Flag, ResponseDraft, User } from '../../domain/types'
import { canSubmit, COMPOSER_STEPS, MAX_EXTENSION_DAYS, MIN_JUSTIFICATION, MIN_NARRATIVE, validateResponse } from '../../domain/validation'
import { store } from '../../state/store'
import { Button } from '../../ui/Button'
import { Field, TextArea, TextInput, YesNo } from '../../ui/Field'
import { useToast } from '../../ui/toast'
import { ValidationSummary } from '../../ui/ValidationSummary'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { Wizard, type StepStatus } from '../../workflow/Wizard'

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ResponseComposer({ flag, me }: { flag: Flag; me: User }) {
  const toast = useToast()
  const draft = flag.draft
  const t = TEMPLATES[flag.type]
  const [step, setStepState] = useState(draft.step)
  const [confirmed, setConfirmed] = useState(false)
  // Field-level errors stay quiet while the officer is filling things in, and
  // appear once they have reached the checks step (then persist on revisits).
  const [reviewed, setReviewed] = useState(draft.step >= 3)
  const issues = useMemo(() => validateResponse(flag, draft), [flag, draft])
  const ready = canSubmit(issues)

  const save = (patch: Partial<ResponseDraft>) => {
    const r = store.saveDraft(flag.id, patch)
    if (!r.ok) toast('error', 'Draft not saved', r.error)
  }
  const setStep = (i: number) => {
    setStepState(i)
    if (i >= 3) setReviewed(true)
    save({ step: i })
  }

  // From the checks list: go to the step, then bring the offending field into view once it has rendered.
  const jumpTo = (s: number, field: string) => {
    setStep(s)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('input,textarea,select,button')?.focus({ preventScroll: true })
    })
  }

  const blockingOn = (s: number) => issues.some((i) => i.step === s && (i.tier === 'blocking' || (i.tier === 'justification' && !i.satisfied)))
  const status = (s: number): StepStatus => {
    if (s === 4 || s >= step) return 'todo'
    return blockingOn(s) ? 'issue' : 'done'
  }
  const fieldError = (field: string) => (reviewed ? issues.find((i) => i.field === field && i.tier === 'blocking')?.message : undefined)
  const detailed = draft.type === 'justify' || draft.type === 'dispute'
  const minNarrative = detailed ? MIN_NARRATIVE.detailed : MIN_NARRATIVE.brief
  const nextReviewer = rolesForStep(chainFor(flag.severity)[1], chainFor(flag.severity).length === 2)[0]

  const submit = () => {
    const r = store.dispatch(flag.id, { type: 'SUBMIT' })
    if (r.ok) toast('success', 'Response submitted', `Sent to the ${ROLE_LABEL[nextReviewer]} for review. The draft is now locked.`)
    else toast('error', 'Not submitted', r.error)
  }

  const visibleSlots = t.evidence.filter((s) => (draft.type && s.requiredFor.includes(draft.type)) || s.id !== 'correction')
  const due = new Date(flag.resolveDueAt)
  const maxExt = new Date(due)
  maxExt.setDate(maxExt.getDate() + MAX_EXTENSION_DAYS)

  return (
    <Wizard
      steps={COMPOSER_STEPS.map((label, i) => ({ label, status: status(i) }))}
      current={step}
      onStep={setStep}
      saved={draft.updatedAt ? `Draft saved ${clock(new Date(draft.updatedAt))}` : 'Not started'}
      footer={
        <>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Back
          </Button>
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 0 && !draft.type}>
              Continue to {COMPOSER_STEPS[step + 1]} →
            </Button>
          ) : (
            <Button variant="primary" disabled={!ready || !confirmed} onClick={submit}>
              Submit for review
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <fieldset className="flex flex-col gap-3" data-field="type">
          <legend className="mb-3 text-sm font-semibold">How is the MDA responding to this flag?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {RESPONSE_TYPES.map((r) => {
              const disabled = r.id === 'extension' && flag.extensionUsed
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 has-checked:border-accent has-checked:bg-accent-soft ${disabled ? 'cursor-not-allowed opacity-50' : 'border-line-2 hover:bg-sunk'}`}
                >
                  <input
                    type="radio"
                    name={`type-${flag.id}`}
                    value={r.id}
                    checked={draft.type === r.id}
                    disabled={disabled}
                    onChange={() => save({ type: r.id })}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{r.label}</span>
                    <span className="text-xs text-muted">{disabled ? 'An extension has already been granted on this case.' : r.help}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <div className="flex max-w-3xl flex-col gap-5">
          {!draft.type && <p className="text-sm text-muted">Choose a response type first.</p>}
          {detailed &&
            t.questions.map((q) =>
              q.kind === 'yesno' ? (
                <YesNo
                  key={q.id}
                  id={`q:${q.id}`}
                  label={q.label}
                  value={draft.answers[q.id]}
                  invalid={!!fieldError(`q:${q.id}`)}
                  onChange={(v) => save({ answers: { ...draft.answers, [q.id]: v } })}
                />
              ) : (
                <Field key={q.id} id={`q:${q.id}`} label={q.label} help={q.help} error={fieldError(`q:${q.id}`)}>
                  {q.kind === 'longtext' ? (
                    <TextArea
                      id={`q:${q.id}`}
                      className="min-h-20"
                      value={draft.answers[q.id] ?? ''}
                      invalid={!!fieldError(`q:${q.id}`)}
                      onChange={(e) => save({ answers: { ...draft.answers, [q.id]: e.target.value } })}
                    />
                  ) : (
                    <TextInput
                      id={`q:${q.id}`}
                      value={draft.answers[q.id] ?? ''}
                      invalid={!!fieldError(`q:${q.id}`)}
                      onChange={(e) => save({ answers: { ...draft.answers, [q.id]: e.target.value } })}
                    />
                  )}
                </Field>
              ),
            )}
          {draft.type === 'correct' && (
            <Field
              id="correctiveRef"
              label="Corrective record reference"
              help="Reversal voucher, recovery receipt or TSA remittance reference, e.g. RET-0231-0712."
              error={fieldError('correctiveRef')}
            >
              <TextInput
                id="correctiveRef"
                className="max-w-xs font-mono"
                value={draft.correctiveRef}
                invalid={!!fieldError('correctiveRef')}
                onChange={(e) => save({ correctiveRef: e.target.value })}
              />
            </Field>
          )}
          {draft.type === 'extension' && (
            <Field
              id="extensionDate"
              label="New deadline requested"
              help={`Current deadline ${shortDate(due)}. Up to ${MAX_EXTENSION_DAYS} days later. Only one extension per case.`}
              error={fieldError('extensionDate')}
            >
              <TextInput
                id="extensionDate"
                type="date"
                className="max-w-xs"
                min={toDateInput(new Date(due.getTime() + 86_400_000))}
                max={toDateInput(maxExt)}
                value={draft.extensionDate}
                invalid={!!fieldError('extensionDate')}
                onChange={(e) => save({ extensionDate: e.target.value })}
              />
            </Field>
          )}
          {draft.type && (
            <Field
              id="narrative"
              label={draft.type === 'extension' ? 'Reason for the extension' : 'Explanation'}
              help={`Plain language. Reference the voucher numbers (${flag.relatedRefs.join(', ') || 'if any'}).`}
              counter={`${draft.narrative.trim().length} / ${minNarrative} min`}
              error={fieldError('narrative')}
            >
              <TextArea
                id="narrative"
                className="min-h-36"
                value={draft.narrative}
                invalid={!!fieldError('narrative')}
                onChange={(e) => save({ narrative: e.target.value })}
              />
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="max-w-[70ch] text-[13px] text-ink-2">
            Each file is fingerprinted (SHA-256) on this computer as it is added. Reviewers and oversight see the fingerprint, so any later change to a file can be detected.
          </p>
          {visibleSlots.map((slot) => (
            <EvidenceSlot
              key={slot.id}
              slot={slot}
              files={draft.evidence.filter((e) => e.slotId === slot.id)}
              required={!!draft.type && slot.requiredFor.includes(draft.type)}
              editable
              userId={me.id}
              onAdd={(files) => {
                // Read the latest draft: fingerprinting is async and the draft may have moved on.
                const latest = store.getState().flags.find((f) => f.id === flag.id)?.draft ?? draft
                save({ evidence: [...latest.evidence, ...files] })
                toast('success', `${files.length} file${files.length === 1 ? '' : 's'} attached`, slot.label)
              }}
              onDetach={(id) => save({ evidence: draft.evidence.filter((e) => e.id !== id) })}
            />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <ValidationSummary issues={issues} onJump={jumpTo} currentStep={step} />
          {issues
            .filter((i) => i.tier === 'justification')
            .map((i) => (
              <Field
                key={i.id}
                id={`justification:${i.id}`}
                label="Written justification"
                help={i.message}
                counter={`${(draft.justifications[i.id] ?? '').trim().length} / ${MIN_JUSTIFICATION} min`}
              >
                <TextArea
                  id={`justification:${i.id}`}
                  className="min-h-24"
                  value={draft.justifications[i.id] ?? ''}
                  onChange={(e) => save({ justifications: { ...draft.justifications, [i.id]: e.target.value } })}
                />
              </Field>
            ))}
        </div>
      )}

      {step === 4 && (
        <div className="flex max-w-3xl flex-col gap-4">
          {!ready && (
            <div className="rounded-lg border border-crit-bd bg-crit-bg px-4 py-3 text-[13px] text-crit-fg">
              Some checks have not passed yet.{' '}
              <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setStep(3)}>
                Review the checks
              </button>
            </div>
          )}
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-lg border border-line px-4 py-3 text-[13px]">
            <dt className="text-muted">Response</dt>
            <dd className="font-medium">{RESPONSE_TYPES.find((r) => r.id === draft.type)?.label ?? '—'}</dd>
            <dt className="text-muted">Evidence</dt>
            <dd className="font-medium">{draft.evidence.length} file{draft.evidence.length === 1 ? '' : 's'}</dd>
            <dt className="text-muted">Next</dt>
            <dd className="font-medium">
              {chainFor(flag.severity)
                .slice(1)
                .map((s, i, arr) => ROLE_LABEL[rolesForStep(s, i === arr.length - 1)[0]])
                .join(' → ')}{' '}
              → Oversight
            </dd>
          </dl>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input
              id={`confirm-${flag.id}`}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            I confirm this response and its evidence are accurate to the best of my knowledge. Once submitted, it is locked. Changes after that need the response to be returned.
          </label>
        </div>
      )}
    </Wizard>
  )
}
