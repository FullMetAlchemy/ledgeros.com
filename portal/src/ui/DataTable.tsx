import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from './Panel'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => string | number
  align?: 'left' | 'right'
  className?: string
}

/** Sortable, paginated table (UI-003). Rows open with a click or Enter. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onOpen,
  pageSize = 10,
  initialSort,
  empty,
  minWidth = 760,
  caption,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onOpen?: (row: T) => void
  pageSize?: number
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  empty: { title: string; body?: string; action?: ReactNode }
  minWidth?: number
  caption?: string
}) {
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sort) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = col.sort!(a)
      const y = col.sort!(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
    })
  }, [rows, columns, sort])

  if (!rows.length) return <EmptyState {...empty} />
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const shown = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-sunk">
              {columns.map((c) => {
                const active = sort?.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.sort ? (
                      <button type="button" onClick={() => toggle(c.key)} className={`inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {c.header}
                        <Icon size={12} aria-hidden className={active ? 'text-accent' : 'opacity-50'} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={rowKey(row)}
                tabIndex={onOpen ? 0 : undefined}
                onClick={onOpen ? () => onOpen(row) : undefined}
                onKeyDown={
                  onOpen
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpen(row)
                        }
                      }
                    : undefined
                }
                className={`border-b border-line last:border-b-0 ${onOpen ? 'cursor-pointer hover:bg-sunk focus:bg-accent-soft focus:outline-none' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right' : ''} ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-line hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono">
              {current + 1} / {pages}
            </span>
            <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-line hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </span>
        </nav>
      )}
    </div>
  )
}
