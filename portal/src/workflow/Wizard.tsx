import type { ReactNode } from 'react'

export type StepStatus = 'done' | 'issue' | 'todo'

/**
 * Step layout for every submission: visible "Step n of m", free navigation
 * between steps, and a per-step status marker. Persistence is the caller's job
 * (drafts autosave through the store), so leaving and returning resumes in place.
 */
export function Wizard({
  steps,
  current,
  onStep,
  saved,
  children,
  footer,
}: {
  steps: { label: string; status: StepStatus }[]
  current: number
  onStep: (i: number) => void
  saved?: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunk px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted">
          Step {current + 1} of {steps.length} · {steps[current]?.label}
        </span>
        {saved && <span className="font-mono text-[11px] text-muted">{saved}</span>}
      </div>
      <ol className="grid grid-cols-2 border-b border-line sm:grid-cols-5" aria-label="Steps">
        {steps.map((s, i) => {
          const active = i === current
          return (
            <li key={s.label} className="border-line not-first:border-l max-sm:border-b max-sm:odd:border-l-0">
              <button
                type="button"
                onClick={() => onStep(i)}
                aria-current={active ? 'step' : undefined}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[12.5px] ${active ? 'bg-accent-soft font-semibold text-ink' : 'text-ink-2 hover:bg-sunk'}`}
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full border font-mono text-[10px] font-semibold ${
                    s.status === 'done'
                      ? 'border-ok-dot bg-ok-dot text-white'
                      : s.status === 'issue'
                        ? 'border-warn-dot text-warn-fg'
                        : active
                          ? 'border-primary text-primary'
                          : 'border-line-2 text-muted'
                  }`}
                >
                  {s.status === 'done' ? '✓' : s.status === 'issue' ? '!' : i + 1}
                </span>
                <span className="truncate">{s.label}</span>
                <span className="sr-only">{s.status === 'done' ? '(complete)' : s.status === 'issue' ? '(needs attention)' : ''}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-5 p-5">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sunk px-5 py-3">{footer}</div>
    </div>
  )
}
