import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext, type ToastKind } from './toast'

interface Toast {
  id: string
  kind: ToastKind
  title: string
  body?: string
}

const DOT: Record<ToastKind, string> = { success: 'bg-ok-dot', error: 'bg-crit-dot', info: 'bg-faint' }
const TIMEOUT_MS = 4200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, kind, title, body }].slice(-3))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? TIMEOUT_MS * 1.5 : TIMEOUT_MS)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed right-5 bottom-5 z-80 flex w-[min(360px,calc(100vw-40px))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="flex gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-ink shadow-lg shadow-slate-900/10 [animation:ol-toast_.22s_ease-out]"
          >
            <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${DOT[t.kind]}`} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs leading-snug text-muted">{t.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
