import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, TextArea } from './Field'

/**
 * Confirmation with a reason, for irreversible or high-impact actions (UI-009).
 * Mount only while open so each use starts clean. `onConfirm` returns an error
 * message to keep the dialog open, or null to close it.
 */
export function ConfirmDialog({
  title,
  eyebrow,
  children,
  confirmLabel,
  danger = false,
  reasonLabel = 'Reason (recorded in the audit ledger)',
  minReason = 10,
  onConfirm,
  onClose,
}: {
  title: string
  eyebrow?: string
  children?: ReactNode
  confirmLabel: string
  danger?: boolean
  reasonLabel?: string
  minReason?: number
  onConfirm: (reason: string) => string | null
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const short = reason.trim().length < minReason
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={short}
            onClick={() => {
              const err = onConfirm(reason.trim())
              if (err) setError(err)
              else onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {minReason > 0 && (
        <Field id="confirm-reason" label={reasonLabel} counter={`${reason.trim().length} / ${minReason} min`} error={error}>
          <TextArea id="confirm-reason" className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      )}
      {minReason === 0 && error && <p className="text-xs font-medium text-crit-fg">{error}</p>}
    </Dialog>
  )
}
