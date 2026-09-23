import { useState } from 'react'
import { useNavigate } from 'react-router'
import { naira } from '../../domain/money'
import { advanceStatus, findExisting, VOTES, type CreateParams } from '../../domain/submissions/create'
import { DEFS } from '../../domain/submissions/defs'
import { CONTRACTS } from '../../domain/submissions/reference'
import type { SubmissionKind } from '../../domain/submissions/types'
import type { User } from '../../domain/types'
import { store, usePortal } from '../../state/store'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Field } from '../../ui/Field'
import { useToast } from '../../ui/toast'

const ON_DEMAND = (Object.keys(DEFS) as SubmissionKind[]).filter((k) => !DEFS[k].scheduled)

/** Choose what to file; each option is pre-filled from the ledger on creation. Mount only while open. */
export function NewSubmissionDialog({ me, onClose }: { me: User; onClose: () => void }) {
  const s = usePortal()
  const toast = useToast()
  const navigate = useNavigate()
  const kinds = ON_DEMAND.filter((k) => DEFS[k].preparers.includes(me.role))
  const [kind, setKind] = useState<SubmissionKind>(kinds[0])
  const mdaId = me.mdaId!

  const advances = advanceStatus(mdaId, s.submissions).filter((a) => !a.submission)
  const milestones = CONTRACTS.filter((c) => c.mdaId === mdaId).flatMap((c) =>
    c.milestones
      .filter((m) => !findExisting(s.submissions, mdaId, { kind: 'milestone_certificate', contractRef: c.ref, milestoneNo: m.no }))
      .map((m) => ({ value: `${c.ref}#${m.no}`, label: `${c.ref} · ${m.no}. ${m.title} (${naira(m.value)})` })),
  )
  const votes = VOTES.filter((v) => !findExisting(s.submissions, mdaId, { kind: 'release_request', vote: v }))
  const [choice, setChoice] = useState<Record<string, string>>({})
  const pick = (k: SubmissionKind, fallback: string) => choice[k] ?? fallback

  const params = (): CreateParams | null => {
    switch (kind) {
      case 'advance_retirement': {
        const ref = pick(kind, advances[0]?.advance.ref ?? '')
        return ref ? { kind, advanceRef: ref } : null
      }
      case 'milestone_certificate': {
        const v = pick(kind, milestones[0]?.value ?? '')
        if (!v) return null
        const [contractRef, no] = v.split('#')
        return { kind, contractRef, milestoneNo: Number(no) }
      }
      case 'release_request': {
        const vote = pick(kind, votes[0] ?? '')
        return vote ? { kind, vote } : null
      }
      case 'vendor_exception':
        return { kind }
      default:
        return null
    }
  }

  const create = () => {
    const p = params()
    if (!p) return
    const r = store.createSubmission(p)
    if (!r.ok) {
      toast('error', 'Could not create', r.error)
      return
    }
    toast('success', 'Draft created', 'Pre-filled from the ledger. Continue where the wizard starts.')
    onClose()
    navigate(`/submissions/${r.id}`)
  }

  const select = (id: string, label: string, options: { value: string; label: string }[], empty: string) =>
    options.length ? (
      <Field id={id} label={label}>
        <select
          id={id}
          value={pick(kind, options[0].value)}
          onChange={(e) => setChoice({ ...choice, [kind]: e.target.value })}
          className="h-10 w-full rounded-md border border-line-2 bg-surface px-2.5 text-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    ) : (
      <p className="rounded-md border border-line bg-sunk px-3.5 py-2.5 text-[13px] text-muted">{empty}</p>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Submissions"
      title="New submission"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!params()} onClick={create}>
            Create draft
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium text-ink-2">What are you filing?</legend>
        {kinds.map((k) => (
          <label key={k} className="flex cursor-pointer gap-3 rounded-lg border border-line-2 p-3 hover:bg-sunk has-checked:border-accent has-checked:bg-accent-soft">
            <input type="radio" name="new-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1 accent-[var(--accent)]" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{DEFS[k].label}</span>
              <span className="text-xs text-muted">{DEFS[k].blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {kind === 'advance_retirement' &&
        select(
          'new-advance',
          'Advance to retire',
          advances.map((a) => ({ value: a.advance.ref, label: `${a.advance.ref} · ${a.advance.holder} · ${naira(a.advance.amount)}` })),
          'Every advance in the register already has a retirement.',
        )}
      {kind === 'milestone_certificate' && select('new-milestone', 'Contract milestone', milestones, 'Every contract milestone already has a certificate.')}
      {kind === 'release_request' &&
        select(
          'new-vote',
          'Vote',
          votes.map((v) => ({ value: v, label: v })),
          'There is already an open request for every vote.',
        )}
    </Dialog>
  )
}
