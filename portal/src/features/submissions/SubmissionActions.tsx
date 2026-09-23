import { useState } from 'react'
import { chainCursor, isMyStep } from '../../domain/chain'
import { dateTime } from '../../domain/calendar'
import { nairaExact } from '../../domain/money'
import { ROLE_LABEL, STEP_LABEL } from '../../domain/policy'
import { DEFS, parseAmount } from '../../domain/submissions/defs'
import type { Submission, SubmissionEvent } from '../../domain/submissions/types'
import type { User } from '../../domain/types'
import { store, userName, usePortal } from '../../state/store'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/toast'
import { AttestationDialog } from '../../workflow/AttestationDialog'
import { Banner, CommentAction } from '../../workflow/CaseBits'

export function SubmissionActions({ sub, me }: { sub: Submission; me: User }) {
  const s = usePortal()
  const toast = useToast()
  const [attesting, setAttesting] = useState(false)
  const def = DEFS[sub.kind]
  const treasury = def.reviewer === 'treasury'
  const inMda = me.mdaId === sub.mdaId
  const lead = inMda && (me.role === 'dfa' || me.role === 'accounting_officer')

  const act = (event: SubmissionEvent, title: string, body?: string) => {
    const r = store.dispatchSubmission(sub.id, event)
    if (r.ok) toast('success', title, body)
    else toast('error', 'Action not allowed', r.error)
    return r.ok
  }

  switch (sub.state) {
    case 'Draft':
      if (me.id === sub.ownerId) return null // the composer is the action
      return (
        <Banner tone={sub.returned ? 'flow' : 'neu'} title={`${sub.returned ? 'Returned for changes' : 'Being prepared'} · ${userName(s, sub.ownerId)}`}>
          <p className="text-[13px] text-ink-2">Nothing is visible to oversight until the preparer submits it and the chain signs it off.</p>
        </Banner>
      )

    case 'InChain': {
      const cur = chainCursor(def.chain, sub.chain)!
      if (!isMyStep(def.chain, sub.chain, me, sub.mdaId)) {
        const waiting = s.users.filter((u) => u.mdaId === sub.mdaId && cur.roles.includes(u.role) && !sub.chain.some((a) => a.userId === u.id))
        const acted = sub.chain.some((a) => a.userId === me.id)
        return (
          <Banner tone="flow" title={`${STEP_LABEL[cur.step]} pending`}>
            <p className="text-[13px] text-ink-2">
              Waiting for {waiting.map((u) => `${u.name} (${ROLE_LABEL[u.role]})`).join(' or ') || cur.roles.map((r) => ROLE_LABEL[r]).join(' or ')}.
              {acted && ' You have already acted on this, so another officer must take this step.'}
            </p>
          </Banner>
        )
      }
      return (
        <Banner tone="flow" title={cur.isFinal ? 'Your attestation is needed' : `Your ${STEP_LABEL[cur.step].toLowerCase()} is needed`}>
          <p className="text-[13px] text-ink-2">
            {cur.isFinal
              ? `Attesting locks this submission and sends it for ${treasury ? 'a Treasury decision' : 'oversight review'}.`
              : 'Check the figures, evidence and any justifications below. Approve to pass it on, or return it with comments.'}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {cur.isFinal ? (
              <Button variant="primary" onClick={() => setAttesting(true)}>
                Attest and send
              </Button>
            ) : (
              <Button variant="primary" onClick={() => act({ type: 'APPROVE_STEP' }, `${STEP_LABEL[cur.step]} approved`, 'Passed to the next step.')}>
                Approve {STEP_LABEL[cur.step].toLowerCase()}
              </Button>
            )}
            <CommentAction
              id="sub-return"
              label={`Return to ${userName(s, sub.ownerId)}`}
              placeholder="What needs to change? Name the line, figure or document."
              onSubmit={(c) => act({ type: 'RETURN', comment: c }, 'Returned for changes', `${userName(s, sub.ownerId)} has been notified.`)}
            />
          </div>
          {attesting && (
            <AttestationDialog
              flag={sub}
              subject={`${def.label.toLowerCase()} ${sub.id}`}
              destination={treasury ? 'Treasury' : 'oversight'}
              user={me}
              onClose={() => setAttesting(false)}
              onAttest={(declaration) => {
                if (act({ type: 'APPROVE_STEP', attestation: { declaration, keyVerified: true } }, 'Submission attested', treasury ? 'Sent to Treasury.' : 'Sent to oversight.')) setAttesting(false)
              }}
            />
          )}
        </Banner>
      )
    }

    case 'UnderReview':
      if (me.role !== def.reviewer)
        return (
          <Banner tone="flow" title={treasury ? 'With Treasury' : 'With oversight'}>
            <p className="text-[13px] text-ink-2">
              Attested {sub.attestation ? dateTime(sub.attestation.at) : ''}. {treasury ? 'The Treasury Officer will approve the release or query it.' : 'The Chief Auditor will accept it or raise a query.'}
            </p>
          </Banner>
        )
      return (
        <Banner tone="flow" title={treasury ? 'Release decision' : 'Oversight decision'}>
          <p className="text-[13px] text-ink-2">
            {treasury && sub.data.kind === 'release_request'
              ? `Approving releases ${nairaExact(parseAmount(sub.data.amount) || 0)} to the MDA and updates its released funds everywhere.`
              : 'Accepting closes the submission. A query sends it back to the MDA with your question.'}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="primary" onClick={() => act({ type: 'ACCEPT' }, treasury ? 'Release approved' : 'Submission accepted', 'The MDA has been notified.')}>
              {treasury ? 'Approve release' : 'Accept submission'}
            </Button>
            <CommentAction
              id="sub-query"
              label="Raise a query"
              placeholder="What must the MDA clarify or provide?"
              onSubmit={(c) => act({ type: 'QUERY', comment: c }, 'Query raised', 'The submission is back with the MDA.')}
            />
          </div>
        </Banner>
      )

    case 'Queried':
      return (
        <Banner tone="flow" title={`${treasury ? 'Treasury' : 'Oversight'} raised a query`}>
          <p className="text-[13px] text-ink-2">See the query in the thread. Starting a revision copies the last submission so nothing is retyped.</p>
          {(lead || me.id === sub.ownerId) && (
            <div>
              <Button variant="primary" onClick={() => act({ type: 'REVISE' }, 'Revision started', 'Update the submission and send it through sign-off again.')}>
                Start revision
              </Button>
            </div>
          )}
        </Banner>
      )

    case 'Accepted':
      return <Banner tone="ok" title={treasury ? 'Release approved by Treasury' : 'Accepted by oversight'} />
  }
}
