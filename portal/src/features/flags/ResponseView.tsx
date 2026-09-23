import { dateTime, shortDate } from '../../domain/calendar'
import { RESPONSE_TYPES, TEMPLATES } from '../../domain/templates'
import type { Flag, ResponseDraft, User } from '../../domain/types'
import { validateResponse } from '../../domain/validation'
import { EvidenceSlot } from '../../workflow/EvidenceSlot'

/** Read-only rendering of a response, as reviewers and oversight see it. */
export function ResponseView({ flag, draft, users }: { flag: Flag; draft: ResponseDraft; users: User[] }) {
  const t = TEMPLATES[flag.type]
  const type = RESPONSE_TYPES.find((r) => r.id === draft.type)
  const justifications = validateResponse(flag, draft).filter((i) => i.tier === 'justification')
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? '—'
  const detailed = draft.type === 'justify' || draft.type === 'dispute'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="eyebrow">Response type</div>
          <div className="mt-0.5 text-[15px] font-semibold">{type?.label ?? 'Not chosen'}</div>
        </div>
        {draft.updatedAt && (
          <div className="font-mono text-[11px] text-muted">
            Prepared by {name(draft.updatedBy)} · {dateTime(draft.updatedAt)}
          </div>
        )}
      </div>

      {detailed && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {t.questions.map((q) => (
            <div key={q.id} className={q.kind === 'longtext' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs text-muted">{q.label}</dt>
              <dd className="mt-0.5 text-[13px] font-medium whitespace-pre-wrap">
                {q.kind === 'yesno' ? (draft.answers[q.id] === 'yes' ? 'Yes' : draft.answers[q.id] === 'no' ? 'No' : '—') : draft.answers[q.id] || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {draft.type === 'correct' && (
        <div>
          <div className="text-xs text-muted">Corrective record</div>
          <div className="mt-0.5 font-mono text-[13px] font-semibold">{draft.correctiveRef || '—'}</div>
        </div>
      )}
      {draft.type === 'extension' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">Current deadline</div>
            <div className="mt-0.5 font-mono text-[13px]">{shortDate(flag.resolveDueAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Requested new deadline</div>
            <div className="mt-0.5 font-mono text-[13px] font-semibold">{draft.extensionDate ? shortDate(`${draft.extensionDate}T12:00:00`) : '—'}</div>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-muted">Explanation</div>
        <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed whitespace-pre-wrap">{draft.narrative || '—'}</p>
      </div>

      {justifications.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="eyebrow">Justifications</div>
          {justifications.map((j) => (
            <div key={j.id} className="rounded-md border border-warn-bd bg-warn-bg px-3.5 py-2.5">
              <div className="text-xs font-semibold text-warn-fg">{j.message}</div>
              <p className="mt-1 text-[13px] whitespace-pre-wrap text-ink-2">{draft.justifications[j.id] || 'Not provided.'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="eyebrow">Evidence · {draft.evidence.length} file{draft.evidence.length === 1 ? '' : 's'}</div>
        {t.evidence
          .filter((slot) => draft.evidence.some((e) => e.slotId === slot.id) || (draft.type && slot.requiredFor.includes(draft.type)))
          .map((slot) => (
            <EvidenceSlot
              key={slot.id}
              slot={slot}
              files={draft.evidence.filter((e) => e.slotId === slot.id)}
              required={!!draft.type && slot.requiredFor.includes(draft.type)}
              editable={false}
              userId=""
            />
          ))}
        {draft.evidence.length === 0 && <p className="text-[13px] text-muted">No evidence attached.</p>}
      </div>
    </div>
  )
}
