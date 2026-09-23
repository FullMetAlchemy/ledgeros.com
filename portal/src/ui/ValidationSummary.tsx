import type { Issue, Tier } from '../domain/validation'
import { COMPOSER_STEPS } from '../domain/validation'

const TIER: Record<Tier, { label: string; box: string; head: string }> = {
  blocking: { label: 'Must fix before submitting', box: 'border-crit-bd bg-crit-bg', head: 'text-crit-fg' },
  justification: { label: 'Needs a written justification', box: 'border-warn-bd bg-warn-bg', head: 'text-warn-fg' },
  advisory: { label: 'Advisory', box: 'border-line bg-sunk', head: 'text-neu-fg' },
}

/** Issues grouped by tier; each links back to the wizard step that fixes it. */
export function ValidationSummary({
  issues,
  onJump,
  currentStep,
  stepLabels = COMPOSER_STEPS,
}: {
  issues: Issue[]
  onJump?: (step: number, field: string) => void
  currentStep?: number
  stepLabels?: readonly string[]
}) {
  const tiers: Tier[] = ['blocking', 'justification', 'advisory']
  const shown = tiers.map((t) => [t, issues.filter((i) => i.tier === t)] as const).filter(([, list]) => list.length)
  if (!shown.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ok-bd bg-ok-bg px-4 py-3 text-sm text-ok-fg">
        <span aria-hidden>✓</span> All checks passed. Nothing prevents submission.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {shown.map(([tier, list]) => (
        <div key={tier} className={`rounded-lg border px-4 py-3 ${TIER[tier].box}`}>
          <div className={`font-mono text-[11px] font-semibold tracking-wider uppercase ${TIER[tier].head}`}>
            {TIER[tier].label} · {list.length}
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {list.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 text-[13px] text-ink-2">
                <span>
                  {i.tier === 'justification' && (
                    <span className={`mr-1.5 font-semibold ${i.satisfied ? 'text-ok-fg' : 'text-warn-fg'}`}>
                      {i.satisfied ? 'Justified.' : 'Open.'}
                    </span>
                  )}
                  {i.message}
                </span>
                {onJump && (
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer font-mono text-[11px] text-accent hover:underline"
                    onClick={() => onJump(i.step, i.field)}
                  >
                    {i.step === currentStep ? 'Go to field ↓' : `Go to ${stepLabels[i.step]} →`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
