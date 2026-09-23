import { useState, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { TextArea } from '../ui/Field'
import { PANEL, type Tone } from '../ui/tone'

/** The "what happens next" banner at the top of a case or submission. */
export function Banner({ tone = 'neu', title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 rounded-lg border px-4 py-3.5 ${PANEL[tone]}`}>
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  )
}

/** A button that expands into a required comment, for actions that must be explained on the record. */
export function CommentAction({
  id,
  label,
  placeholder,
  variant = 'secondary',
  onSubmit,
}: {
  id: string
  label: string
  placeholder: string
  variant?: 'secondary' | 'danger' | 'primary'
  onSubmit: (comment: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open)
    return (
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}…
      </Button>
    )
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (onSubmit(text)) {
          setText('')
          setOpen(false)
        }
      }}
    >
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}: comment for the record
      </label>
      <TextArea id={id} className="min-h-20" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <Button type="submit" variant={variant} disabled={text.trim().length < 10}>
          {label}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
