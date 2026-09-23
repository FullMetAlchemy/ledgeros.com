import { useMemo, useState } from 'react'
import { clock } from '../../domain/calendar'
import { ROLE_LABEL, rolesForStep } from '../../domain/policy'
import { DEFS, evidenceSlots, REVIEWER_LABEL, SUBMISSION_STEPS } from '../../domain/submissions/defs'
import { VENDORS } from '../../domain/submissions/reference'
import type { Submission, SubmissionContent, SubmissionData } from '../../domain/submissions/types'
import { validateSubmission } from '../../domain/submissions/validation'
import type { EvidenceFile, User } from '../../domain/types'
import { canSubmit, MIN_JUSTIFICATION } from '../../domain/validation'
import { store } from '../../state/store'
import { Button } from '../../ui/Button'
import { Field, TextArea } from '../../ui/Field'
import { useToast } from '../../ui/toast'
import { ValidationSummary } from '../../ui/ValidationSummary'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'
import { Wizard, type StepStatus } from '../../workflow/Wizard'
import { KIND_MODULES } from './kinds'

/** The five-step preparer wizard shared by every submission kind. */
export function SubmissionComposer({ sub, me }: { sub: Submission; me: User }) {
  const toast = useToast()
  const def = DEFS[sub.kind]
  const K = KIND_MODULES[sub.kind]
  const [step, setStepState] = useState(sub.step)
  const [reviewed, setReviewed] = useState(sub.step >= 3)
  const [confirmed, setConfirmed] = useState(false)
  const content: SubmissionContent = { data: sub.data, evidence: sub.evidence, justifications: sub.justifications }
  const issues = useMemo(() => validateSubmission({ data: sub.data, evidence: sub.evidence, justifications: sub.justifications }, { now: new Date(), vendors: VENDORS }), [sub.data, sub.evidence, sub.justifications])
  const ready = canSubmit(issues)

  const save = (patch: Partial<SubmissionContent> & { step?: number }) => {
    const r = store.saveSubmission(sub.id, patch)
    if (!r.ok) toast('error', 'Draft not saved', r.error)
  }
  // Always patch on top of the latest saved record; evidence hashing is async.
  const latest = () => store.getState().submissions.find((s) => s.id === sub.id) ?? sub
  const update = (patch: Partial<SubmissionData>) => save({ data: { ...latest().data, ...patch } as SubmissionData })
  const addFiles = (files: EvidenceFile[]) => {
    save({ evidence: [...latest().evidence, ...files] })
    toast('success', `${files.length} file${files.length === 1 ? '' : 's'} attached`, 'Fingerprinted with SHA-256.')
  }
  const detach = (id: string) => save({ evidence: latest().evidence.filter((e) => e.id !== id) })

  const setStep = (i: number) => {
    setStepState(i)
    if (i >= 3) setReviewed(true)
    save({ step: i })
  }
  const jumpTo = (s: number, field: string) => {
    setStep(s)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('input,textarea,select,button')?.focus({ preventScroll: true })
    })
  }

  const blockingOn = (s: number) => issues.some((i) => i.step === s && (i.tier === 'blocking' || (i.tier === 'justification' && !i.satisfied)))
  const status = (s: number): StepStatus => (s === 4 || s >= step ? 'todo' : blockingOn(s) ? 'issue' : 'done')
  const error = (field: string) => (reviewed ? issues.find((i) => i.field === field && i.tier === 'blocking')?.message : undefined)

  const next = def.chain.slice(1).map((s, i, arr) => ROLE_LABEL[rolesForStep(s, i === arr.length - 1)[0]])
  const submit = () => {
    const r = store.dispatchSubmission(sub.id, { type: 'SUBMIT' })
    if (r.ok) toast('success', 'Submitted for sign-off', `Sent to the ${next[0]}. The draft is now locked.`)
    else toast('error', 'Not submitted', r.error)
  }

  return (
    <Wizard
      steps={SUBMISSION_STEPS.map((label, i) => ({ label, status: status(i) }))}
      current={step}
      onStep={setStep}
      saved={sub.updatedAt ? `Draft saved ${clock(new Date(sub.updatedAt))}` : 'Not started'}
      footer={
        <>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Back
          </Button>
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              Continue to {SUBMISSION_STEPS[step + 1]} →
            </Button>
          ) : (
            <Button variant="primary" disabled={!ready || !confirmed} onClick={submit}>
              Submit for sign-off
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <p className="max-w-[70ch] text-[13.5px] text-ink-2">{def.blurb}</p>
          <K.Scope sub={sub} data={sub.data} content={content} />
        </div>
      )}
      {step === 1 && <K.Details sub={sub} data={sub.data} me={me} update={update} error={error} />}
      {step === 2 &&
        (K.Evidence ? (
          <K.Evidence sub={sub} data={sub.data} me={me} evidence={sub.evidence} addFiles={addFiles} detach={detach} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="max-w-[70ch] text-[13px] text-ink-2">
              Each file is fingerprinted (SHA-256) on this computer as it is added, so any later change to a file can be detected.
            </p>
            {evidenceSlots(sub.data).map((slot) => (
              <EvidenceSlot
                key={slot.id}
                slot={slot}
                files={sub.evidence.filter((e) => e.slotId === slot.id)}
                required={slot.required}
                editable
                userId={me.id}
                onAdd={addFiles}
                onDetach={detach}
              />
            ))}
          </div>
        ))}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <ValidationSummary issues={issues} onJump={jumpTo} currentStep={step} stepLabels={SUBMISSION_STEPS} />
          {issues
            .filter((i) => i.tier === 'justification')
            .map((i) => (
              <Field
                key={i.id}
                id={`justification:${i.id}`}
                label="Written justification"
                help={i.message}
                counter={`${(sub.justifications[i.id] ?? '').trim().length} / ${MIN_JUSTIFICATION} min`}
              >
                <TextArea
                  id={`justification:${i.id}`}
                  className="min-h-24"
                  value={sub.justifications[i.id] ?? ''}
                  onChange={(e) => save({ justifications: { ...latest().justifications, [i.id]: e.target.value } })}
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
            <dt className="text-muted">Submission</dt>
            <dd className="font-medium">{def.label}</dd>
            <dt className="text-muted">Evidence</dt>
            <dd className="font-medium">
              {sub.evidence.length} file{sub.evidence.length === 1 ? '' : 's'}
            </dd>
            <dt className="text-muted">Next</dt>
            <dd className="font-medium">
              {next.join(' → ')} → {REVIEWER_LABEL[def.reviewer]}
            </dd>
          </dl>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input id={`confirm-${sub.id}`} type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            I confirm this submission and its evidence are accurate to the best of my knowledge. Once submitted it is locked; changes need it to be returned.
          </label>
        </div>
      )}
    </Wizard>
  )
}
