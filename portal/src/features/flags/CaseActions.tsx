import { useState } from 'react'
import { dateTime } from '../../domain/calendar'
import { chainFor, currentStep, ROLE_LABEL, rolesForStep, STEP_LABEL } from '../../domain/policy'
import type { Flag, FlagEvent, User } from '../../domain/types'
import { store, userName, usePortal } from '../../state/store'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/toast'
import { AttestationDialog } from '../../workflow/AttestationDialog'
import { Banner, CommentAction } from '../../workflow/CaseBits'

/** The "what happens next" panel on a case: actions for the signed-in user, or who it is waiting on. */
export function CaseActions({ flag, me }: { flag: Flag; me: User }) {
  const s = usePortal()
  const toast = useToast()
  const [attesting, setAttesting] = useState(false)
  const lead = me.role === 'dfa' || me.role === 'accounting_officer'
  const sameMda = me.mdaId === flag.mdaId
  const auditor = me.role === 'auditor'
  const owners = s.users.filter((u) => u.mdaId === flag.mdaId && (u.role === 'finance_officer' || u.role === 'dfa'))
  const [ownerId, setOwnerId] = useState(flag.ownerId ?? owners[0]?.id ?? '')

  const act = (event: FlagEvent, success: string, body?: string): boolean => {
    const r = store.dispatch(flag.id, event)
    if (r.ok) toast('success', success, body)
    else toast('error', 'Action not allowed', r.error)
    return r.ok
  }

  const assign = (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="owner" className="text-[13px] font-medium text-ink-2">
          Response owner
        </label>
        <select
          id="owner"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="h-9 min-w-56 rounded-md border border-line-2 bg-surface px-2.5 text-sm"
        >
          {owners.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABEL[u.role]}
            </option>
          ))}
        </select>
      </div>
      <Button variant="primary" onClick={() => act({ type: 'ASSIGN', ownerId }, 'Owner assigned', `${userName(s, ownerId)} will draft the response.`)}>
        Assign owner
      </Button>
    </div>
  )

  switch (flag.state) {
    case 'Raised':
      return lead && sameMda ? (
        <Banner tone="warn" title="This flag needs acknowledging">
          <p className="text-[13px] text-ink-2">Acknowledging tells oversight the MDA has seen it and starts the response clock.</p>
          <div>
            <Button variant="primary" onClick={() => act({ type: 'ACKNOWLEDGE' }, 'Flag acknowledged', 'Now assign an owner to draft the response.')}>
              Acknowledge flag
            </Button>
          </div>
        </Banner>
      ) : (
        <Banner title="Waiting for acknowledgement">
          <p className="text-[13px] text-ink-2">The DFA or the Accounting Officer must acknowledge this flag.</p>
        </Banner>
      )

    case 'Acknowledged':
      return lead && sameMda ? (
        <Banner tone="flow" title="Assign someone to draft the response">{assign}</Banner>
      ) : (
        <Banner title="Acknowledged. Waiting for an owner to be assigned." />
      )

    case 'Escalated': {
      const reason = flag.escalations.at(-1)
      const why =
        reason === 'ack_overdue'
          ? 'It was not acknowledged within the deadline.'
          : reason === 'resolve_overdue'
            ? 'The resolution deadline passed while the response was in drafting.'
            : 'Oversight rejected the response.'
      return (
        <Banner tone="crit" title="Escalated to the Accounting Officer and oversight">
          <p className="text-[13px] text-ink-2">{why}</p>
          {sameMda && lead && !flag.ownerId && assign}
          {sameMda && flag.ownerId && (lead || me.id === flag.ownerId) && (
            <div>
              <Button variant="primary" onClick={() => act({ type: 'RESUME' }, 'Drafting restarted', 'The previous response has been copied into a new draft.')}>
                Restart drafting
              </Button>
            </div>
          )}
        </Banner>
      )
    }

    case 'Drafting':
      if (me.id === flag.ownerId) return null // the composer is the action
      return (
        <Banner tone={flag.returned ? 'flow' : 'neu'} title={`${flag.returned ? 'Returned for changes' : 'Being drafted'} · owner ${userName(s, flag.ownerId)}`}>
          {lead && sameMda && (
            <details>
              <summary className="cursor-pointer text-[13px] text-accent">Reassign</summary>
              <div className="mt-3">{assign}</div>
            </details>
          )}
        </Banner>
      )

    case 'InChain': {
      const step = currentStep(flag)!
      const isFinal = flag.chain.length === chainFor(flag.severity).length - 1
      const allowed = rolesForStep(step, isFinal)
      const mine = sameMda && allowed.includes(me.role)
      const alreadyActed = flag.chain.some((a) => a.userId === me.id)
      if (!mine || alreadyActed) {
        const waitingOn = s.users.filter((u) => u.mdaId === flag.mdaId && allowed.includes(u.role) && !flag.chain.some((a) => a.userId === u.id))
        return (
          <Banner tone="flow" title={`${STEP_LABEL[step]} pending`}>
            <p className="text-[13px] text-ink-2">
              Waiting for {waitingOn.map((u) => `${u.name} (${ROLE_LABEL[u.role]})`).join(' or ') || allowed.map((r) => ROLE_LABEL[r]).join(' or ')}.
              {alreadyActed && ' You have already acted on this response, so another officer must take this step.'}
            </p>
          </Banner>
        )
      }
      return (
        <Banner tone="flow" title={isFinal ? 'Your attestation is needed' : `Your ${STEP_LABEL[step].toLowerCase()} is needed`}>
          <p className="text-[13px] text-ink-2">
            {isFinal
              ? 'Attesting locks the response and sends it to oversight. You will sign a declaration and verify your security key.'
              : 'Check the response and evidence below. Approve to pass it to the next step, or return it with comments.'}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {isFinal ? (
              <Button variant="primary" onClick={() => setAttesting(true)}>
                Attest and send to oversight
              </Button>
            ) : (
              <Button variant="primary" onClick={() => act({ type: 'APPROVE_STEP' }, `${STEP_LABEL[step]} approved`, 'Passed to the next step in the chain.')}>
                Approve {STEP_LABEL[step].toLowerCase()}
              </Button>
            )}
            <CommentAction
              id="return-comment"
              label={`Return to ${userName(s, flag.ownerId)}`}
              placeholder="What needs to change? Be specific: which answer or document."
              onSubmit={(c) => act({ type: 'RETURN', comment: c }, 'Returned for changes', `${userName(s, flag.ownerId)} has been notified.`)}
            />
          </div>
          {attesting && (
            <AttestationDialog
              flag={flag}
              user={me}
              onClose={() => setAttesting(false)}
              onAttest={(declaration) => {
                if (act({ type: 'APPROVE_STEP', attestation: { declaration, keyVerified: true } }, 'Response attested', 'Sent to oversight. The response is now locked.')) setAttesting(false)
              }}
            />
          )}
        </Banner>
      )
    }

    case 'OversightReview':
      if (!auditor)
        return (
          <Banner tone="flow" title="With oversight">
            <p className="text-[13px] text-ink-2">
              Attested {flag.attestation ? dateTime(flag.attestation.at) : ''}. The Chief Auditor will accept it, ask for more information or escalate it.
            </p>
          </Banner>
        )
      return (
        <Banner tone="flow" title="Oversight decision">
          <p className="text-[13px] text-ink-2">
            {flag.submitted?.type === 'extension'
              ? 'This is an extension request. Accepting moves the deadline and returns the case to the MDA for a full response.'
              : 'Accepting resolves the flag and updates the MDA’s rating.'}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="primary" onClick={() => act({ type: 'ACCEPT' }, flag.submitted?.type === 'extension' ? 'Extension granted' : 'Response accepted', 'The MDA has been notified.')}>
              {flag.submitted?.type === 'extension' ? 'Grant extension' : 'Accept response'}
            </Button>
            <CommentAction
              id="info-comment"
              label="Request more information"
              placeholder="What is missing? The MDA will see this on the case."
              onSubmit={(c) => act({ type: 'REQUEST_INFO', comment: c }, 'Information requested', 'The case is back with the MDA.')}
            />
            <CommentAction
              id="reject-comment"
              label="Reject and escalate"
              variant="danger"
              placeholder="Why is the response not acceptable?"
              onSubmit={(c) => act({ type: 'REJECT', comment: c }, 'Response rejected', 'Escalated to the Accounting Officer.')}
            />
          </div>
        </Banner>
      )

    case 'InfoRequested':
      return (
        <Banner tone="flow" title="Oversight asked for more information">
          <p className="text-[13px] text-ink-2">See the request in the case thread. Restarting drafting copies the last response so nothing is retyped.</p>
          {sameMda && (lead || me.id === flag.ownerId) && (
            <div>
              <Button variant="primary" onClick={() => act({ type: 'RESUME' }, 'Drafting restarted', 'Update the response and send it through the chain again.')}>
                Start revision
              </Button>
            </div>
          )}
        </Banner>
      )

    case 'Resolved':
      return (
        <Banner tone="ok" title="Resolved: accepted by oversight">
          {auditor && (
            <CommentAction
              id="reopen-comment"
              label="Reopen flag"
              placeholder="Why is this being reopened? (e.g. recurrence, new facts)"
              onSubmit={(c) => act({ type: 'REOPEN', comment: c }, 'Flag reopened', 'The MDA has been notified.')}
            />
          )}
        </Banner>
      )

    case 'Reopened':
      return (
        <Banner tone="flow" title="Reopened by oversight">
          {sameMda && (lead || me.id === flag.ownerId) && flag.ownerId && (
            <div>
              <Button variant="primary" onClick={() => act({ type: 'RESUME' }, 'Drafting restarted')}>
                Restart drafting
              </Button>
            </div>
          )}
        </Banner>
      )
  }
}
