import { Check } from 'lucide-react'

/**
 * A record's position in its workflow (FRD §8). Branch outcomes (e.g. Returned,
 * Rejected, Escalated) replace the step they branch from, so the path shown is
 * the one this record actually took.
 */
export function Stepper({ steps, current, branch }: { steps: string[]; current: string; branch?: { at: string; label: string; tone: 'warn' | 'crit' } }) {
  const shown = branch ? steps.map((s) => (s === branch.at ? branch.label : s)) : steps
  const idx = shown.indexOf(branch && current === branch.label ? branch.label : current)
  return (
    <ol aria-label="Workflow" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[12px]">
      {shown.map((s, i) => {
        const done = i < idx
        const here = i === idx
        const isBranch = branch && s === branch.label
        return (
          <li key={s} className="flex items-center gap-1" aria-current={here ? 'step' : undefined}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${
                here
                  ? isBranch
                    ? branch!.tone === 'crit'
                      ? 'border-crit-bd bg-crit-bg text-crit-fg'
                      : 'border-warn-bd bg-warn-bg text-warn-fg'
                    : 'border-primary bg-accent-soft text-ink'
                  : done
                    ? 'border-line bg-surface text-ink-2'
                    : 'border-dashed border-line-2 text-faint'
              }`}
            >
              {done && <Check size={12} aria-hidden className="text-ok-fg" />}
              {s}
              <span className="sr-only">{here ? '(current)' : done ? '(done)' : '(not yet)'}</span>
            </span>
            {i < shown.length - 1 && (
              <span aria-hidden className="h-px w-3 bg-line-2" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
