import { useEffect, useState } from 'react'
import type { User } from '../domain/types'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput } from '../ui/Field'

type KeyState = 'idle' | 'waiting' | 'verified'

function declarationFor(subject: string, user: User): string {
  return `I, ${user.name}, ${user.title}, attest that ${subject} is accurate and complete, that the attached evidence is authentic, and that it has been reviewed in accordance with the Financial Regulations.`
}

/**
 * The attestation ceremony: a typed declaration plus a hardware security key.
 * Deliberately heavier than any other action in the portal. It is the legally
 * meaningful moment. The key touch is simulated here; production uses WebAuthn.
 * Mount it only while open, so every attempt starts from a clean state.
 */
export function AttestationDialog({
  flag,
  subject = `the response to ${flag.id}`,
  destination = 'oversight',
  user,
  onClose,
  onAttest,
}: {
  flag: { id: string }
  /** What is being attested, e.g. "the response to FLG-0231-009". */
  subject?: string
  destination?: string
  user: User
  onClose: () => void
  onAttest: (declaration: string) => void
}) {
  const [read, setRead] = useState(false)
  const [typed, setTyped] = useState('')
  const [key, setKey] = useState<KeyState>('idle')

  useEffect(() => {
    if (key !== 'waiting') return
    const t = setTimeout(() => setKey('verified'), 1200)
    return () => clearTimeout(t)
  }, [key])

  const declaration = declarationFor(subject, user)
  const nameOk = typed.trim().toLowerCase() === user.name.toLowerCase()
  const ready = read && nameOk && key === 'verified'

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={`${flag.id} · Attestation`}
      title={`Attest and send to ${destination}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={() => onAttest(declaration)}>
            Attest response
          </Button>
        </>
      }
    >
      <blockquote className="rounded-md border border-line bg-sunk px-4 py-3 text-[13px] leading-relaxed text-ink-2">
        {declaration}
      </blockquote>
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
        <input
          id="attest-read"
          type="checkbox"
          checked={read}
          onChange={(e) => setRead(e.target.checked)}
          className="mt-0.5 accent-[var(--accent)]"
        />
        I have read the response, the evidence and the review notes from every step of the chain.
      </label>
      <Field id="attest-name" label="Type your full name to sign" help={`Must match: ${user.name}`}>
        <TextInput id="attest-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" invalid={!!typed && !nameOk} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold">Security key</span>
          <span className="text-xs text-muted">
            {key === 'idle' && 'Required to attest.'}
            {key === 'waiting' && 'Touch your security key…'}
            {key === 'verified' && <span className="font-semibold text-ok-fg">✓ Key verified</span>}
          </span>
        </div>
        <Button size="sm" disabled={key !== 'idle'} onClick={() => setKey('waiting')}>
          {key === 'waiting' ? 'Waiting for key…' : key === 'verified' ? 'Verified' : 'Verify security key'}
        </Button>
      </div>
      <p className="font-mono text-[11px] text-muted">Demo: the security key is simulated. Production uses WebAuthn with the key registered at onboarding.</p>
    </Dialog>
  )
}
