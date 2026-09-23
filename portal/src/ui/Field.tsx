import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-md border bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15'

export function Field({
  id,
  label,
  help,
  error,
  children,
  counter,
}: {
  id: string
  label: ReactNode
  help?: ReactNode
  error?: string | null
  counter?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5" data-field={id}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {counter && <span className="font-mono text-[11px] text-muted">{counter}</span>}
      </div>
      {help && (
        <p id={`${id}-help`} className="-mt-1 text-xs text-muted">
          {help}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-crit-fg">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ invalid, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${CONTROL} h-10 ${invalid ? 'border-crit-bd' : 'border-line-2'} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function TextArea({ invalid, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`${CONTROL} min-h-28 py-2 leading-relaxed ${invalid ? 'border-crit-bd' : 'border-line-2'} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function YesNo({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string
  label: string
  value: string | undefined
  onChange: (v: 'yes' | 'no') => void
  invalid?: boolean
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-2" data-field={id}>
      <legend className="mb-2 text-[13px] font-medium text-ink-2">{label}</legend>
      <div className="flex gap-2">
        {(['yes', 'no'] as const).map((v) => (
          <label
            key={v}
            className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold ${invalid ? 'border-crit-bd' : 'border-line-2'}`}
          >
            <input
              id={v === 'yes' ? id : undefined}
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="accent-[var(--accent)]"
            />
            {v === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
