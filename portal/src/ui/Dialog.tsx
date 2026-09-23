import { useEffect, useRef, type ReactNode } from 'react'

/** Modal dialog built on the native <dialog> element (focus trap and Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-900/40 dark:backdrop:bg-slate-950/60"
    >
      {open && (
        <div className="flex flex-col">
          <div className="border-b border-line px-6 pt-5 pb-4">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 className="mt-1 text-base font-semibold">{title}</h2>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line bg-sunk px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
