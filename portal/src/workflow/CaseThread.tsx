import { useState } from 'react'
import { dateTime } from '../domain/calendar'
import type { Comment, User } from '../domain/types'
import { Button } from '../ui/Button'
import { TextArea } from '../ui/Field'

/** Conversation between the MDA and oversight, attached to a flag case or a submission. */
export function CaseThread({
  flag,
  users,
  canPost,
  onPost,
}: {
  flag: { id: string; comments: Comment[] }
  users: User[]
  canPost: boolean
  onPost: (body: string) => boolean
}) {
  const [body, setBody] = useState('')
  const who = (id: string) => users.find((u) => u.id === id)
  return (
    <div className="flex flex-col gap-3">
      {flag.comments.length === 0 && <p className="text-[13px] text-muted">No messages yet. Questions and requests for information stay on this case.</p>}
      <ul className="flex flex-col gap-2.5">
        {flag.comments.map((c) => {
          const u = who(c.authorId)
          return (
            <li
              key={c.id}
              className={`rounded-lg border px-3.5 py-2.5 ${c.side === 'oversight' ? 'border-flow-bd bg-flow-bg' : 'border-line bg-sunk'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">
                  {u?.name ?? c.authorId}
                  <span className="ml-1.5 font-mono text-[10.5px] font-medium text-muted uppercase">
                    {c.side === 'oversight' ? 'Oversight' : u?.title}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-muted">{dateTime(c.at)}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{c.body}</p>
            </li>
          )
        })}
      </ul>
      {canPost && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (onPost(body)) setBody('')
          }}
        >
          <label htmlFor={`thread-${flag.id}`} className="sr-only">
            Message
          </label>
          <TextArea
            id={`thread-${flag.id}`}
            className="min-h-20"
            placeholder="Write a message on this case…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!body.trim()}>
              Post message
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
