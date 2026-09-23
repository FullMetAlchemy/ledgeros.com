import type { ReactNode } from 'react'

export function Panel({
  title,
  aside,
  children,
  className = '',
  bodyClassName = 'p-4',
  id,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section id={id} className={`rounded-lg border border-line bg-surface shadow-sm shadow-slate-900/[0.03] transition-colors duration-200 ${className}`}>
      {(title || aside) && (
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {aside && <div className="text-xs text-muted">{aside}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      {body && <p className="max-w-md text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
