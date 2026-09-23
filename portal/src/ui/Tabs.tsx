export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line px-3 pt-2">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'} transition-colors duration-200`}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded bg-sunk px-1.5 font-mono text-[11px] text-muted">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
