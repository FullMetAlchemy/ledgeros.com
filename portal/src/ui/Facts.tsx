import type { ReactNode } from 'react'

/** Label/value pairs for pre-filled context. Values from the ledger are marked with their source. */
export function Facts({ items, source, cols = 3 }: { items: [label: string, value: ReactNode, mono?: boolean][]; source?: string; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
  return (
    <div className="flex flex-col gap-2">
      <dl className={`grid gap-x-6 gap-y-3 ${grid}`}>
        {items.map(([label, value, mono]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-0.5 text-[13.5px] font-medium ${mono ? 'font-mono tabular' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {source && <div className="font-mono text-[11px] text-muted">Pre-filled from {source} · read-only</div>}
    </div>
  )
}
